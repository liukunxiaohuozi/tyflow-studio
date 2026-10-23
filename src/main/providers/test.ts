import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  Task,
  Stage,
  Settings,
  RepositoryInfo,
  FailureCategory,
  CheckResult,
} from "../../shared/contracts";
import { changedFilesSince } from "./scm";
import { runCommand, resolveCommand } from "../process";
import { canReuseTestExecution, validateEvidence } from "../policy";
import { resultJsonSchema, resultSchema } from "./agent-schemas";
import { WorkflowEngine, fingerprint } from "../workflow/engine";
import { ProviderFailure } from "../workflow/failures";
import { assertTestScope } from "../test-scope";
import { requiredTestBrowsers } from "../../shared/browser-test";
export interface TestHost {
  validateBrowserCheck?(task: Task, check: CheckResult): void;
  prepareBrowser?(task: Task, signal: AbortSignal): Promise<void>;
  workflow: WorkflowEngine;
  settings(): Settings;
  assertSnapshot(task: Task): Promise<RepositoryInfo>;
  workspaceFileState(task: Task): Promise<Record<string, string>>;
  sourceSnapshot(task: Task): Promise<string>;
  planHash(task: Task): string;
  contextHash(task: Task): string;
  browserContextHash?(task: Task): string;
  context(task: Task): string;
  agent(
    task: Task,
    stage: Stage,
    prompt: string,
    schema: unknown,
    signal: AbortSignal,
  ): Promise<unknown>;
  checkpoint<T>(
    task: Task,
    id: string,
    label: string,
    category: FailureCategory,
    signal: AbortSignal,
    key: string,
    work: () => Promise<T>,
    options?: { reuse?: boolean },
  ): Promise<T>;
  log(
    task: Task,
    stage: Stage,
    message: string,
    level?: "info" | "error" | "success",
  ): void;
  publish(task: Task): unknown;
  safe(message: string): string;
}
export interface TestProvider {
  verify(task: Task, signal: AbortSignal): Promise<void>;
}
export class SkillTestProvider implements TestProvider {
  constructor(private host: TestHost) {}
  async verify(task: Task, signal: AbortSignal) {
    task.stage = "test";
    task.status = "testing";
    const info = await this.host.checkpoint(
      task,
      "test:environment",
      "测试环境与执行身份",
      "environment",
      signal,
      fingerprint(task.snapshot),
      async () => {
        const info = await this.host.assertSnapshot(task);
        if (!fs.existsSync(this.host.settings().agent.testSkill))
          throw new ProviderFailure(
            "environment",
            "TEST_SKILL_MISSING",
            "自动化测试 Skill 文件不存在，请先配置",
          );
        return info;
      },
      { reuse: false },
    );
    const settings = this.host.settings();
    if (!fs.existsSync(settings.agent.testSkill))
      throw new Error("自动化测试 Skill 文件不存在，请先配置");
    const beforeTestState = await this.host.workspaceFileState(task);
    let failure: unknown;
    try {
      await this.verifyFrozen(task, signal, info, settings, beforeTestState);
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      // A cancelled signal must not suppress the read-only safety audit.
      const boundary = task.activity?.checkpointId ?? "测试退出";
      try {
        await this.host.checkpoint(
          task,
          "test:policy",
          "测试范围与证据硬闸",
          "policy",
          new AbortController().signal,
          fingerprint("test-scope-v2", beforeTestState),
          async () => {
            await this.assertScope(task, beforeTestState, boundary);
            return task.gateReviews?.evidence ?? [];
          },
          { reuse: false },
        );
      } catch (error) {
        delete task.testExecution;
        this.host.workflow.invalidate(
          task,
          ["test:command", "test:agent", "test:case"],
          "测试期间源码发生变化或范围审查未完成，已有测试结果不能继续复用",
        );
        if (failure)
          this.host.log(
            task,
            "test",
            `原始执行失败：${this.host.safe(String(failure))}；同时发现测试范围或证据审查问题。`,
            "error",
          );
        this.host.publish(task);
        throw error;
      }
    }
    this.host.log(task, "test", "本次必要检查已通过。", "success");
  }
  private async assertScope(
    task: Task,
    before: Record<string, string>,
    boundary: string,
  ) {
    assertTestScope(
      task,
      before,
      await this.host.workspaceFileState(task),
      boundary,
    );
  }
  private async verifyFrozen(
    task: Task,
    signal: AbortSignal,
    info: RepositoryInfo,
    settings: Settings,
    beforeTestState: Record<string, string>,
  ) {
    const project = task.snapshot!.project;
    const sourceSnapshot = await this.host.sourceSnapshot(task);
    const planHash = this.host.planHash(task);
    const skillHash = createHash("sha256")
      .update(fs.readFileSync(settings.agent.testSkill))
      .digest("hex");
    const runtime = settings.projects.find((p) => p.id === task.projectId);
    const contextHash = fingerprint(
      "test-provider-v2",
      task.workflowMode === "quick",
      this.host.contextHash(task),
      runtime?.startScript,
      runtime?.targetUrl,
      process.version,
      settings.agent.command,
    );
    const browserContext = this.host.browserContextHash?.(task);
    const executionContext = browserContext
      ? fingerprint(contextHash, browserContext)
      : contextHash;
    const changedFiles = (
      await changedFilesSince(project.directory, task.snapshot!.baseCommit)
    ).map((file) => file.path);
    task.testRequest = {
      contractVersion: 1,
      verificationMode: "orchestrated",
      projectId: project.id,
      sourceSnapshot,
      planHash,
      requirements: task.snapshot!.plan.requirements ?? [],
      planSteps: task.snapshot!.plan.planSteps ?? [],
      testCases: task.snapshot!.plan.testCases,
      changedFiles,
      profile: "change",
    };
    const reusableExecution = task.testExecution;
    const browserProofValid = (check: CheckResult) => {
      try {
        this.host.validateBrowserCheck?.(task, check);
        return true;
      } catch {
        return false;
      }
    };
    if (
      reusableExecution &&
      canReuseTestExecution(reusableExecution, {
        sourceSnapshot,
        planHash,
        skillHash,
        contextHash: executionContext,
      }) &&
      task.snapshot!.plan.testCases.length > 0 &&
      task.snapshot!.plan.testCases.every((c) =>
        reusableExecution.checks.some(
          (check) =>
            check.name === `Skill · ${c.id}` &&
            check.state === "passed" &&
            browserProofValid({ ...check, name: c.id }),
        ),
      ) &&
      validateEvidence(
        reusableExecution.checks
          .filter((c) => c.name.startsWith("Skill · "))
          .map((c) => ({ ...c, name: c.name.slice(8) })),
        project.directory,
        new Set(
          task
            .snapshot!.plan.testCases.filter((c) => c.priority !== "P2")
            .map((c) => c.id),
        ),
      ).every((c) => c.state === "passed")
    ) {
      reusableExecution.reused = true;
      task.checks = structuredClone(reusableExecution.checks);
      task.gateReviews = {
        ...(task.gateReviews ?? {}),
        evidence: structuredClone(reusableExecution.evidenceChecks),
      };
      this.host.log(
        task,
        "test",
        "代码快照、计划和测试 Skill 均未变化，复用已有测试结果。",
        "success",
      );
      this.host.publish(task);
      return;
    }
    // An earlier envelope is not a verdict for a new/failed verification attempt.
    delete task.testExecution;
    if (
      this.host.prepareBrowser &&
      requiredTestBrowsers(task.snapshot!.plan).length
    )
      await this.host.checkpoint(
        task,
        "test:browser-preparation",
        "浏览器、登录与测试范围准备",
        "environment",
        signal,
        fingerprint(sourceSnapshot, contextHash),
        () => this.host.prepareBrowser!(task, signal),
        { reuse: false },
      );
    task.checks = [];
    this.host.publish(task);
    // Avoid scripts such as lint:prettier that implicitly rewrite the whole repository.
    const quick = task.workflowMode === "quick";
    const scripts = (
      quick ? ["test:change"] : ["typecheck", "tsc", "lint:js", "test", "build"]
    ).filter((name) => info.scripts.includes(name));
    const unique = scripts.filter(
      (name) => name !== "tsc" || !scripts.includes("typecheck"),
    );
    if (quick)
      this.host.log(
        task,
        "test",
        "轻量定向验证：只验证本次用例和已配置的 test:change；不自动运行全量测试或生产构建。",
        "info",
      );
    if (!unique.length && !quick) {
      task.checks.push({
        name: "工程验证命令",
        state: "blocked",
        detail:
          "未发现 typecheck / tsc / lint:js / test / build，请补充项目测试脚本",
      });
      this.host.publish(task);
      throw new ProviderFailure(
        "environment",
        "TEST_COMMAND_MISSING",
        "未发现可执行的工程验证脚本",
      );
    }
    const testKey = fingerprint(
      sourceSnapshot,
      planHash,
      skillHash,
      contextHash,
      process.platform,
    );
    // Browser/login changes invalidate page evidence, not source-only commands.
    const caseKey = browserContext
      ? fingerprint(testKey, browserContext)
      : testKey;
    for (const script of unique) {
      this.host.log(task, "test", `执行 npm run ${script}`);
      try {
        await this.host.checkpoint(
          task,
          `test:command:${script}`,
          `工程检查 · ${script}`,
          "test",
          signal,
          testKey,
          async () => {
            await runCommand(
              resolveCommand("npm", settings.agent.command),
              ["run", script],
              {
                cwd: project.directory,
                signal,
                env: { CI: "true", BROWSER: "none" },
                timeout: 10 * 60_000,
                // stderr is a stream, not a verdict (Jest prints passing summaries there).
                onLine: (line) => this.host.log(task, "test", line, "info"),
              },
            );
            await this.assertScope(
              task,
              beforeTestState,
              `工程检查 npm run ${script}`,
            );
            return {
              command: `npm run ${script}`,
              exitCode: 0,
              sourceSnapshot,
              planHash,
              skillHash,
              completedAt: new Date().toISOString(),
            };
          },
        );
        task.checks.push({
          name: `npm run ${script}`,
          state: "passed",
          detail: "命令退出码 0；输出见本次测试日志，命令身份见对应检查点",
        });
      } catch (error) {
        task.checks.push({
          name: `npm run ${script}`,
          state: "failed",
          detail: this.host.safe(String(error)),
        });
        this.host.publish(task);
        throw error;
      }
      this.host.publish(task);
    }
    const strictEvidence = new Set(
      task
        .snapshot!.plan.testCases.filter((c) => c.priority !== "P2")
        .map((c) => c.id),
    );
    const approved = task.snapshot!.plan.testCases;
    const valid = new Map<string, CheckResult>();
    for (const c of approved) {
      const previous = this.host.workflow.cached<CheckResult>(
        task,
        `test:case:${c.id}`,
        caseKey,
      );
      if (
        previous &&
        browserProofValid(previous) &&
        validateEvidence([previous], project.directory, strictEvidence).every(
          (g) => g.state === "passed",
        )
      )
        valid.set(c.id, previous);
      else if (previous)
        this.host.workflow.invalidate(
          task,
          [`test:case:${c.id}`],
          "用例证据缺失或已改变，需重新验证",
        );
    }
    const pending = approved.filter((c) => !valid.has(c.id));
    let generated: CheckResult[] = [];
    if (pending.length) {
      const report = await this.host.checkpoint(
        task,
        "test:agent",
        "测试 Provider 执行待验证用例",
        "agent",
        signal,
        fingerprint(
          caseKey,
          pending.map((c) => c.id),
        ),
        async () =>
          resultSchema.parse(
            await this.host.agent(
              task,
              "test",
              this.host.context(task) +
                (quick
                  ? "\nL1 targeted verification only: no full test/build, dependency or browser installation. Use focused source assertions or relevant existing tests. Do not expand the approved cases. If actual browser verification is required but unavailable, report blocked, not passed.\n"
                  : "") +
                `User requested automated testing intervention. Read and follow the skill at ${settings.agent.testSkill}. Frozen TestRequest V1 (only pending cases included):\n${JSON.stringify({ ...task.testRequest, testCases: pending })}\nVerify only the listed pending cases, once, with independent evidence. Previously passed cases have already been checked by Studio; do not repeat them. Do not change business implementation, commit, push or deploy. You may add targeted test files and local evidence only. Missing browser/auth/environment means blocked/unexecuted, never passed. Checks MUST contain an entry for every listed case; name MUST equal exact case id. P0/P1 passed checks MUST include structured evidence.`,
              resultJsonSchema,
              signal,
            ),
          ),
        { reuse: false },
      );
      await this.assertScope(task, beforeTestState, "测试 Agent 返回");
      this.host.log(task, "test", report.summary);
      generated = report.checks;
    }
    let firstFailure: unknown;
    for (const c of approved) {
      try {
        const check = await this.host.checkpoint(
          task,
          `test:case:${c.id}`,
          `用例 · ${c.title}`,
          "test",
          signal,
          caseKey,
          async () => {
            const check =
              valid.get(c.id) ?? generated.find((r) => r.name === c.id);
            if (!check || !check.detail.trim())
              throw new ProviderFailure(
                "test",
                "CASE_MISSING",
                `测试用例覆盖不完整：${c.id}`,
              );
            if (check.state === "blocked" || check.state === "unexecuted")
              throw new ProviderFailure(
                "test",
                "TEST_INCOMPLETE",
                `验证未完成（不是业务断言失败）：${c.id}: ${check.detail}`,
              );
            if (check.state !== "passed")
              throw new ProviderFailure(
                "test",
                "CASE_FAILED",
                `${c.id}: ${check.detail}`,
              );
            this.host.validateBrowserCheck?.(task, check);
            const gates = validateEvidence(
              [check],
              project.directory,
              strictEvidence,
            );
            if (gates.some((g) => g.state !== "passed"))
              throw new ProviderFailure(
                "test",
                "EVIDENCE_INVALID",
                gates.map((g) => g.detail).join("; "),
              );
            check.evidence = check.evidence?.map((item) =>
              item.path && !item.sha256
                ? {
                    ...item,
                    sha256: createHash("sha256")
                      .update(
                        fs.readFileSync(
                          path.resolve(project.directory, item.path),
                        ),
                      )
                      .digest("hex"),
                  }
                : item,
            );
            return check;
          },
        );
        task.checks.push({ ...check, name: `Skill · ${check.name}` });
      } catch (error) {
        if (signal.aborted) throw error;
        // A confirmed mismatch takes precedence over a missing prerequisite.
        if (
          !firstFailure ||
          (firstFailure instanceof ProviderFailure &&
            firstFailure.code === "TEST_INCOMPLETE" &&
            (!(error instanceof ProviderFailure) ||
              error.code !== "TEST_INCOMPLETE"))
        )
          firstFailure = error;
        const check = generated.find((r) => r.name === c.id);
        task.checks.push({
          ...check,
          name: check ? `Skill · ${c.id}` : c.id,
          state:
            check?.state === "passed" ? "blocked" : (check?.state ?? "blocked"),
          detail: check?.detail ?? String(error),
        });
      }
      this.host.publish(task);
    }
    const evidenceChecks = validateEvidence(
      task.checks
        .filter((c) => c.name.startsWith("Skill · "))
        .map((c) => ({ ...c, name: c.name.slice(8) })),
      project.directory,
      strictEvidence,
    );
    task.gateReviews = { ...task.gateReviews, evidence: evidenceChecks };
    this.host.publish(task);
    if (firstFailure) throw firstFailure;
    const finalSourceSnapshot = await this.host.sourceSnapshot(task);
    task.testExecution = {
      contractVersion: 1,
      provider: settings.agent.testSkill.toLowerCase().includes("test-engineer")
        ? "test-engineer"
        : "frontend-test",
      runId: randomUUID(),
      sourceSnapshot: finalSourceSnapshot,
      planHash,
      skillHash,
      contextHash: executionContext,
      completedAt: new Date().toISOString(),
      reused: false,
      checks: structuredClone(task.checks),
      evidenceChecks: structuredClone(evidenceChecks),
      conclusion: "VERIFIED",
    };
  }
}
