import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { CheckResult } from "../shared/contracts";
import { resolveCommand, runCommand } from "./process";
import type { EvidenceStore } from "./evidence";
import type { Task } from "../shared/contracts";

interface Diagnostic {
  ruleId: string | null;
  severity: number;
  message: string;
  column: number;
  source: string;
  fatal?: boolean;
}
export interface LintFileProof {
  file: string;
  sourceHash: string;
  before: Diagnostic[];
  after: Diagnostic[];
}
// This is not a general waiver for lint, security or correctness failures.
const historicalQualityRules = new Set([
  "no-case-declarations",
  "no-unused-vars",
  "@typescript-eslint/no-unused-vars",
  "prettier/prettier",
  "curly",
]);
export function unchangedQualityDiagnostics(
  before: Diagnostic[],
  after: Diagnostic[],
) {
  if (
    !before.length ||
    !after.length ||
    after.some((d) => d.fatal || !historicalQualityRules.has(d.ruleId ?? ""))
  )
    return false;
  const counts = new Map<string, number>();
  const key = (d: Diagnostic) =>
    JSON.stringify([d.ruleId, d.severity, d.message, d.column, d.source]);
  for (const d of before)
    if (!d.fatal) counts.set(key(d), (counts.get(key(d)) ?? 0) + 1);
  return after.every((d) => {
    const count = counts.get(key(d)) ?? 0;
    counts.set(key(d), count - 1);
    return count > 0;
  });
}
export function evaluateDevelopmentChecks(
  checks: CheckResult[],
  requiredIds: string[] = [],
) {
  const failures = checks
    .filter((c) => c.state === "failed" && !c.historical)
    .map((c) => c.name);
  const pending = checks
    .filter(
      (c) =>
        c.state === "blocked" ||
        (c.state === "unexecuted" && c.purpose !== "manual"),
    )
    .map((c) => c.name);
  const verified = checks.filter(
    (c) =>
      c.state === "passed" &&
      c.purpose === "regression" &&
      c.evidence?.some(
        (e) =>
          e.kind === "command" &&
          e.exitCode === 0 &&
          e.command?.trim() &&
          !/git\s+(?:diff|status)|\beslint\b|\b(?:tsc|prettier)\b|createSourceFile/i.test(
            e.command,
          ) &&
          e.summary.trim(),
      ),
  );
  const regression =
    verified.length > 0 &&
    requiredIds.every((id) => verified.some((c) => c.covers?.includes(id)));
  if (!regression) pending.push("缺少针对本次需求的聚焦回归断言及成功命令证据");
  return {
    outcome: failures.length
      ? ("failed" as const)
      : pending.length
        ? ("incomplete" as const)
        : ("completed" as const),
    failures,
    pending,
  };
}

export function qualityEnvironmentIdentity(directory: string) {
  const hash = createHash("sha256");
  for (const folder of [directory, path.join(directory, "config")]) {
    if (!fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder).sort()) {
      if (
        !/(?:eslint|tslint|package\.json|package-lock|pnpm-lock|yarn\.lock|tsconfig)/i.test(
          name,
        )
      )
        continue;
      const file = path.join(folder, name);
      if (fs.lstatSync(file).isFile())
        hash.update(file).update(fs.readFileSync(file));
    }
  }
  for (const tool of ["eslint", "tslint", "typescript"]) {
    const installedTool = path.join(
      directory,
      `node_modules/${tool}/package.json`,
    );
    if (fs.existsSync(installedTool))
      hash.update(fs.readFileSync(installedTool));
  }
  return hash.digest("hex");
}

// Static script; never execute a command supplied in an Agent check.
const eslintRunner = String.raw`
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),{createHash}=require('node:crypto');
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',b=>input+=b);process.stdin.on('end',async()=>{try{
const p=JSON.parse(input),requireProject=createRequire(path.join(p.directory,'package.json')),mod=requireProject('eslint');
const ESLint=mod.loadESLint?await mod.loadESLint():mod.ESLint;if(!ESLint)throw new Error('Unsupported ESLint API');
const eslint=new ESLint({cwd:p.directory,fix:false,cache:false});const files=[];
const normalize=(r,text)=>r.messages.map(m=>({ruleId:m.ruleId,severity:m.severity,message:m.message,column:m.column,fatal:Boolean(m.fatal),source:text.split(/\r?\n/)[m.line-1]?.trim()??''}));
for(const f of p.files){
const filename=path.join(p.directory,f.file),config=await eslint.calculateConfigForFile(filename);if(!config)throw new Error('File ignored or configuration unavailable: '+f.file);
const [before]=await eslint.lintText(f.before,{filePath:filename}),[after]=await eslint.lintText(f.after,{filePath:filename});
if(!before||!after||before.messages.some(m=>m.message.includes('File ignored'))||after.messages.some(m=>m.message.includes('File ignored')))throw new Error('File ignored: '+f.file);
files.push({file:f.file,before:normalize(before,f.before),after:normalize(after,f.after),configRules:config.rules,sourceHash:createHash('sha256').update(f.after).digest('hex')});
}
console.log(JSON.stringify({files,version:requireProject('eslint/package.json').version}));
}catch(e){console.error(e.message);process.exitCode=1;}});`;

// TSLint is still used by some connected legacy projects. Lint both source
// versions in memory with the project's installed TSLint and configuration;
// never execute a command or formatter supplied by the Agent.
const tslintRunner = String.raw`
const path=require('node:path'),{createRequire}=require('node:module'),{createHash}=require('node:crypto');
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',b=>input+=b);process.stdin.on('end',()=>{try{
const p=JSON.parse(input),requireProject=createRequire(path.join(p.directory,'package.json')),{Linter,Configuration}=requireProject('tslint');
const files=[];
const normalize=(filename,text,configuration)=>{const linter=new Linter({fix:false,formatter:'json'});linter.lint(filename,text,configuration);return linter.getResult().failures.map(f=>{const pos=f.getStartPosition().getLineAndCharacter(),line=text.split(/\r?\n/)[pos.line]?.trim()??'';return {ruleId:f.getRuleName(),severity:2,message:f.getFailure(),column:pos.character+1,fatal:false,source:line};});};
for(const f of p.files){const filename=path.join(p.directory,f.file),configuration=Configuration.findConfiguration(null,filename).results;files.push({file:f.file,before:normalize(filename,f.before,configuration),after:normalize(filename,f.after,configuration),sourceHash:createHash('sha256').update(f.after).digest('hex')});}
console.log(JSON.stringify({files,version:requireProject('tslint/package.json').version}));
}catch(e){console.error(e.message);process.exitCode=1;}});`;

export async function reconcileHistoricalLint(options: {
  task: Task;
  checks: CheckResult[];
  changedFiles: string[];
  sourceBaseline?: Record<string, string>;
  preExistingFiles?: string[];
  identityBefore: string;
  evidence: EvidenceStore;
  signal: AbortSignal;
  preferredCommand: string;
}): Promise<CheckResult[]> {
  const { task, signal, evidence } = options;
  const checks = structuredClone(options.checks);
  // Never trust Agent-supplied history, including on early exits.
  for (const check of checks) {
    delete check.historical;
    delete check.qualityProof;
  }
  const isFocusedQualityCheck = (check: CheckResult, tool: "eslint" | "tslint") =>
    check.state !== "passed" &&
    check.purpose !== "regression" &&
    check.purpose !== "manual" &&
    new RegExp(`\\b${tool}\\b`, "i").test(check.name) &&
    !/[+&;|]|\b(?:tsc|typescript|typecheck|jest|test|build|prettier)\b|类型|构建|回归|与|及/i.test(
      check.name,
    );
  const candidateGroups = (["eslint", "tslint"] as const)
    .map((tool) => ({
      tool,
      checks: checks.filter((check) => isFocusedQualityCheck(check, tool)),
    }))
    .filter((group) => group.checks.length);
  const candidates = candidateGroups.flatMap((group) => group.checks);
  if (!candidates.length) return checks;
  // Report wording/commands are evidence only. Never execute or infer success
  // from them; run a fixed tool adapter over the complete changed-source scope.
  const reported = evidence.saveResult(task, {
    tool: "agent-eslint-report",
    checks: candidates,
  });
  try {
    if (signal.aborted) throw new Error("任务已停止");
    if (!task.snapshot || !/^[a-f0-9]{40,64}$/i.test(task.snapshot.baseCommit))
      throw new Error("缺少冻结基线");
    const directory = task.snapshot.project.directory;
    if (
      qualityEnvironmentIdentity(directory) !== options.identityBefore ||
      options.changedFiles.some((f) =>
        /(?:eslint|tslint|(?:^|\/)package\.json|(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)|tsconfig)/i.test(
          f,
        ),
      )
    )
      throw new Error("配置或依赖身份变化，无法使用旧基线");
    const sourceFiles = [
      ...new Set(options.changedFiles.map((f) => f.replace(/\\/g, "/"))),
    ]
      .filter((f) => /\.(?:[cm]?[jt]sx?)$/i.test(f))
      .sort();
    if (!sourceFiles.length || sourceFiles.length > 20)
      throw new Error("变更源码范围为空或超出 20 文件的聚焦检查上限");
    const inputs: { file: string; before: string; after: string }[] = [];
    const preExistingFiles = new Set(
      (options.preExistingFiles ?? []).map((file) => file.replace(/\\/g, "/")),
    );
    const deadline = Date.now() + 30000;
    for (const file of sourceFiles) {
      if (
        file.split("/").some((s) => s === "..") ||
        /^(?:\/|[a-z]:|node_modules\/|\.git\/)/i.test(file)
      )
        throw new Error("源码路径无效");
      const absolute = path.join(directory, file);
      if (
        !fs.existsSync(absolute) ||
        !fs.lstatSync(absolute).isFile() ||
        fs.statSync(absolute).size > 500_000
      )
        throw new Error("源码缺失、链接或文件过大：" + file);
      const relative = path.relative(
        fs.realpathSync.native(directory),
        fs.realpathSync.native(absolute),
      );
      if (relative.startsWith("..") || path.isAbsolute(relative))
        throw new Error("源码路径越界");
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("ESLint 基线准备超时");
      let before: string;
      if (preExistingFiles.has(file)) {
        if (!Object.hasOwn(options.sourceBaseline ?? {}, file))
          throw new Error("任务开始时源码基线缺失：" + file);
        before = options.sourceBaseline![file];
      } else {
        const tracked = await runCommand(
          resolveCommand("git"),
          ["ls-tree", "--name-only", task.snapshot.baseCommit, "--", file],
          { cwd: directory, signal, timeout: Math.min(10000, remaining) },
        );
        before = tracked.trim()
          ? await runCommand(
              resolveCommand("git"),
              ["show", `${task.snapshot.baseCommit}:${file}`],
              {
                cwd: directory,
                signal,
                timeout: Math.max(1, Math.min(10000, deadline - Date.now())),
              },
            )
          : "";
      }
      const after = fs.readFileSync(absolute, "utf8");
      if (before.length > 500_000) throw new Error("基线文件过大");
      inputs.push({ file, before, after });
    }
    if (JSON.stringify(inputs).length > 2_000_000)
      throw new Error("聚焦检查总大小超出上限");
    for (const group of candidateGroups) {
      try {
        const raw = await runCommand(
          resolveCommand("node", options.preferredCommand),
          ["-e", group.tool === "eslint" ? eslintRunner : tslintRunner],
          {
            cwd: directory,
            signal,
            timeout: 30000,
            input: JSON.stringify({ directory, files: inputs }),
          },
        );
        const report = JSON.parse(raw) as {
          files: LintFileProof[];
          version: string;
        };
        if (
          report.files.length !== inputs.length ||
          inputs.some(
            (input, i) =>
              report.files[i].file !== input.file ||
              fs.readFileSync(path.join(directory, input.file), "utf8") !==
                input.after,
          ) ||
          qualityEnvironmentIdentity(directory) !== options.identityBefore
        )
          throw new Error("检查过程中源码或配置发生变化");
        const reference = evidence.saveResult(task, {
          tool: group.tool,
          baseCommit: task.snapshot.baseCommit,
          environment: options.identityBefore,
          reported,
          ...report,
        });
        const count = report.files.reduce(
          (sum, file) => sum + file.after.length,
          0,
        );
        const comparable = report.files.every(
          (file) =>
            !file.after.length ||
            unchangedQualityDiagnostics(file.before, file.after),
        );
        const toolLabel = group.tool === "eslint" ? "ESLint" : "TSLint";
        for (const check of group.checks) {
          check.evidence = [
            ...(check.evidence ?? []),
            {
              kind: "log",
              path: reference.path,
              sha256: reference.sha256,
              summary: `Studio 独立 ${toolLabel} 检查及 Agent 原始报告`,
            },
          ];
          if (!count) {
            check.state = "passed";
            check.qualityProof = reference;
            check.detail += `\nStudio 已独立重新执行全部变更源码的 ${toolLabel}：当前无诊断；此前报告保留在证据中。`;
          } else if (comparable) {
            check.state = "failed";
            check.historical = {
              evidencePath: reference.path,
              sha256: reference.sha256,
              count,
            };
            check.detail += `\nStudio 已独立对比全部 ${report.files.length} 个变更源码：${count} 项历史质量问题，无新增诊断；原始报告保留，不计为检查通过。`;
          } else {
            check.state = "failed";
            check.detail +=
              `\nStudio 独立检查发现新增、变化或不可豁免的 ${toolLabel} 诊断：` +
              report.files
                .flatMap((file) =>
                  file.after.map(
                    (diagnostic) =>
                      `${file.file}: ${diagnostic.ruleId ?? "fatal"} ${diagnostic.message}`,
                  ),
                )
                .join("；")
                .slice(0, 1500);
          }
        }
      } catch (error) {
        if (signal.aborted) throw error;
        const toolLabel = group.tool === "eslint" ? "ESLint" : "TSLint";
        for (const check of group.checks) {
          check.state = "blocked";
          check.detail +=
            `\nStudio 独立 ${toolLabel} 核对未完成：` +
            (error instanceof Error ? error.message : String(error)).slice(
              0,
              500,
            ) +
            "；原始报告保留，不能据此确认有新增错误或直接通过。";
          check.evidence = [
            ...(check.evidence ?? []),
            {
              kind: "log",
              path: reported.path,
              sha256: reported.sha256,
              summary: `Agent 原始 ${toolLabel} 报告，独立核对尚未完成`,
            },
          ];
        }
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    for (const check of candidates) {
      check.state = "blocked";
      check.detail +=
        "\nStudio 独立质量基线核对未完成：" +
        (error instanceof Error ? error.message : String(error)).slice(0, 500) +
        "；原始报告保留，不能据此确认有新增错误或直接通过。";
      check.evidence = [
        ...(check.evidence ?? []),
        {
          kind: "log",
          path: reported.path,
          sha256: reported.sha256,
          summary: "Agent 原始质量检查报告，独立核对尚未完成",
        },
      ];
    }
  }
  return checks;
}
