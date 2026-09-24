import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type {
  ChangeReview,
  CheckResult,
  Plan,
  SettingsInput,
  Task,
  TaskAction,
  TaskInput,
  TestExecution,
} from "../shared/contracts";
const text = z.string().max(4000);
const ref = z
  .string()
  .max(250)
  .refine(
    (v) => !v.startsWith("-") && !/[\u0000-\u0020~^:?*\[\\]/.test(v),
    "Invalid Git reference",
  );
const project = z
  .object({
    id: z.string().regex(/^[\w-]{1,60}$/),
    name: z.string().min(1).max(80),
    directory: text,
    repository: text,
    auth: z.enum(["system", "token", "password"]),
    username: text,
    hasSecret: z.boolean().optional(),
    startScript: z.string().regex(/^[\w:.-]{1,80}$/),
    targetUrl: z.string().max(2048),
    defaultBranchMode: z.enum(["new", "existing"]),
  })
  .strict();
const settingsSchema = z
  .object({
    developer: z
      .object({ name: text, email: text, defaultProject: text })
      .strict(),
    projects: z.array(project).min(1).max(20),
    agent: z
      .object({ command: text, tyflowDirectory: text, testSkill: text })
      .strict(),
    zentao: z
      .object({
        enabled: z.boolean(),
        url: text,
        username: text,
        hasSecret: z.boolean().optional(),
        mappings: z.record(
          z.string().regex(/^[\w-]{1,60}$/),
          z.object({ productId: text, projectId: text }).strict(),
        ),
      })
      .strict(),
    notifications: z
      .object({
        enabled: z.boolean(),
        desktop: z.boolean(),
        milestones: z
          .object({
            planReady: z.boolean(),
            developmentComplete: z.boolean(),
            acceptanceReady: z.boolean(),
            failed: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    theme: z.string().regex(/^#[\da-fA-F]{6}$/),
    language: z.enum(["zh-CN", "en-US"]),
    secrets: z.record(z.string().max(100), z.string().max(10000)).optional(),
  })
  .strict();
export function validateSettings(value: unknown): SettingsInput {
  const data = settingsSchema.parse(value);
  if (new Set(data.projects.map((p) => p.id)).size !== data.projects.length)
    throw new Error("Project IDs must be unique");
  for (const p of data.projects) {
    safeTargetUrl(p.targetUrl);
    if (/https?:\/\/[^/]*@/i.test(p.repository))
      throw new Error(
        "Store repository credentials in the password field, not the URL",
      );
  }
  if (data.zentao.url) {
    const u = new URL(data.zentao.url);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
      throw new Error("Invalid ZenTao URL");
  }
  return data;
}

export function canReuseTestExecution(
  execution: TestExecution | undefined,
  expected: { sourceSnapshot: string; planHash: string; skillHash: string },
) {
  return Boolean(
    execution &&
      execution.sourceSnapshot === expected.sourceSnapshot &&
      execution.planHash === expected.planHash &&
      execution.skillHash === expected.skillHash &&
      execution.contractVersion === 1 &&
      execution.conclusion === "VERIFIED" &&
      execution.checks.length > 0 &&
      execution.checks.every((check) => check.state === "passed") &&
      execution.evidenceChecks.length > 0 &&
      execution.evidenceChecks.every((check) => check.state === "passed"),
  );
}
const inputSchema = z
  .object({
    title: z.string().min(1).max(160),
    kind: z.enum(["design", "text", "bug"]),
    size: z.enum(["small", "medium", "large"]),
    description: z.string().max(50000),
    projectId: z.string().regex(/^[\w-]{1,60}$/),
    assetIds: z.array(z.string().uuid()).max(30),
    branch: z
      .object({
        mode: z.enum(["new", "existing"]),
        base: ref,
        name: ref,
        version: ref,
      })
      .strict(),
    autoTest: z.boolean(),
    zentao: z
      .object({
        type: z.enum(["story", "task", "bug"]),
        id: z.string().regex(/^\d{0,12}$/),
      })
      .strict()
      .optional(),
  })
  .strict();
export function validateTaskInput(value: unknown): TaskInput {
  return inputSchema.parse(value);
}
export function safeTargetUrl(value: string): string {
  const u = new URL(value);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
    u.username ||
    u.password
  )
    throw new Error(
      "开发预览地址必须是本机 HTTP/HTTPS 地址（localhost / 127.0.0.1）",
    );
  return u.href;
}
export function canAct(task: Task, action: TaskAction) {
  if (action === "analyze" && task.snapshot)
    throw new Error("已执行任务的快照不可重新评估，请新建后续任务");
  const allowed: Record<TaskAction, string[]> = {
    repair: ["failed"],
    fix: ["draft", "ready", "failed", "stopped"],
    analyze: ["draft", "ready", "failed", "stopped"],
    develop: ["ready"],
    test: ["waiting-test"],
    start: ["waiting-review", "review"],
    stop: ["analyzing", "developing", "testing", "starting"],
    terminate: [
      "draft",
      "analyzing",
      "ready",
      "developing",
      "waiting-test",
      "testing",
      "starting",
      "review",
      "failed",
    ],
    accept: ["waiting-review", "review"],
    retry: ["failed", "stopped"],
  };
  if (!allowed[action]?.includes(task.status))
    throw new Error(`当前状态 ${task.status} 不能执行 ${action}`);
  if (action === "repair" && (!task.snapshot || task.stage !== "test"))
    throw new Error("只有测试失败的已执行任务可修复并重测");
  if (action === "fix" && task.kind !== "bug")
    throw new Error("直接修复仅适用于 Bug 任务");
  if (action === "fix" && task.snapshot)
    throw new Error("已进入执行阶段的 Bug 请从当前失败阶段重试");
  if (action === "develop" && (!task.plan || task.plan.blockers.length))
    throw new Error("请先完成评估并解决计划中的阻塞项");
  if (
    action === "accept" &&
    (!task.checks.length ||
      task.checks.some((c) => c.state === "failed" || c.state === "blocked"))
  )
    throw new Error("必要验证尚未全部通过");
}
export function redact(value: string, secrets: string[] = []): string {
  let s = value;
  for (const secret of secrets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    s = s.split(secret).join("[REDACTED]");
  }
  return s
    .replace(
      /(authorization\s*[:=]\s*)(?:bearer|basic)?\s*[^\s,;]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /((?:password|passwd|token|api[_-]?key|secret)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(https?:\/\/)[^/\s@]+@/g, "$1[REDACTED]@");
}
export const planSchema = z
  .object({
    summary: z.string().min(1).max(16000),
    requirements: z
      .array(
        z
          .object({
            id: z.string().min(1).max(60),
            text: z.string().min(1).max(4000),
            priority: z.enum(["P0", "P1", "P2"]),
            source: z.enum([
              "description",
              "design",
              "attachment",
              "manual",
              "bug",
            ]),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    planSteps: z
      .array(
        z
          .object({
            id: z.string().min(1).max(60),
            title: z.string().min(1).max(8000),
            covers: z.array(z.string().min(1).max(60)).min(1).max(100),
            expectedFiles: z.array(z.string().min(1).max(500)).min(1).max(100),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    steps: z.array(z.string().min(1).max(8000)).min(1).max(50),
    risks: z.array(z.string().max(4000)).max(50),
    testCases: z
      .array(
        z
          .object({
            id: z.string().min(1).max(60),
            title: z.string().min(1).max(500),
            covers: z.array(z.string().min(1).max(60)).max(100).optional(),
            verifies: z.array(z.string().min(1).max(60)).max(100).optional(),
            priority: z.enum(["P0", "P1", "P2"]).optional(),
            steps: z.array(z.string().max(4000)).min(1).max(30),
            expected: z.string().min(1).max(4000),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(
        (cases) => new Set(cases.map((c) => c.id)).size === cases.length,
        "Test case IDs must be unique",
      ),
    blockers: z.array(z.string().max(4000)).max(30),
  })
  .strict();

function gate(
  name: string,
  state: CheckResult["state"],
  detail: string,
): CheckResult {
  return { name, state, detail };
}

function id(index: number, prefix: string) {
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

export function normalizePlanTraceability(
  plan: Plan,
  source: "description" | "design" | "bug" = "description",
): Plan {
  const strict = Boolean(
    plan.requirements?.length &&
      plan.planSteps?.length &&
      plan.planSteps.every((step) => step.covers?.length && step.expectedFiles?.length) &&
      plan.testCases.every(
        (test) => test.covers?.length && test.verifies?.length && test.priority,
      ),
  );
  const requirements =
    plan.requirements?.length
      ? plan.requirements
      : [
          {
            id: source === "bug" ? "BUG-REQ-001" : "REQ-001",
            text: plan.summary,
            priority: "P0" as const,
            source,
          },
        ];
  const requirementIds = requirements.map((r) => r.id);
  const planSteps =
    plan.planSteps?.length
      ? plan.planSteps.map((step, index) => ({
          ...step,
          id: step.id || id(index, "PLAN"),
          covers: step.covers?.length ? step.covers : requirementIds,
          expectedFiles: step.expectedFiles ?? [],
        }))
      : plan.steps.map((step, index) => ({
          id: id(index, "PLAN"),
          title: step,
          covers: requirementIds,
          expectedFiles: [],
        }));
  const stepIds = planSteps.map((s) => s.id);
  return {
    ...plan,
    traceabilityMode: strict ? "strict" : "legacy",
    requirements,
    planSteps,
    testCases: plan.testCases.map((test) => ({
      ...test,
      covers: test.covers?.length ? test.covers : requirementIds,
      verifies: test.verifies?.length ? test.verifies : stepIds,
      priority: test.priority ?? "P1",
    })),
  };
}

export function validateTraceability(plan: Plan): CheckResult[] {
  const checks: CheckResult[] = [];
  checks.push(
    gate(
      "Trace · mode",
      plan.traceabilityMode === "strict" ? "passed" : "blocked",
      plan.traceabilityMode === "strict"
        ? "计划使用显式需求、步骤、文件范围与测试关联。"
        : "旧计划仅使用兼容映射，必须重新评估生成严格追踪关系后才能开发。",
    ),
  );
  const requirements = plan.requirements ?? [];
  const planSteps = plan.planSteps ?? [];
  const cases = plan.testCases;
  const requirementIds = new Set(requirements.map((r) => r.id));
  const stepIds = new Set(planSteps.map((s) => s.id));
  const coreRequirements = requirements.filter((r) => r.priority !== "P2");
  for (const req of coreRequirements) {
    const planned = planSteps.some((step) => step.covers.includes(req.id));
    const tested = cases.some((test) => test.covers?.includes(req.id));
    checks.push(
      gate(
        `Trace · ${req.id}`,
        planned && tested ? "passed" : "blocked",
        planned && tested
          ? "需求已被计划步骤和测试用例覆盖。"
          : `需求覆盖不完整：计划覆盖=${planned}，测试覆盖=${tested}`,
      ),
    );
  }
  for (const step of planSteps) {
    const unknown = step.covers.filter((req) => !requirementIds.has(req));
    const verified = cases.some((test) => test.verifies?.includes(step.id));
    const filesDeclared = step.expectedFiles.length > 0;
    checks.push(
      gate(
        `Trace · ${step.id}`,
        !unknown.length && verified && filesDeclared ? "passed" : "blocked",
        !unknown.length && verified && filesDeclared
          ? "计划步骤已绑定需求、预计文件并至少被一个测试用例验证。"
          : `计划步骤追踪不完整：未知需求=${unknown.join(", ") || "无"}，测试验证=${verified}，文件范围=${filesDeclared}`,
      ),
    );
  }
  for (const test of cases) {
    const unknownRequirements = (test.covers ?? []).filter(
      (req) => !requirementIds.has(req),
    );
    const unknownSteps = (test.verifies ?? []).filter(
      (step) => !stepIds.has(step),
    );
    checks.push(
      gate(
        `Trace · ${test.id}`,
        !unknownRequirements.length &&
          !unknownSteps.length &&
          Boolean(test.covers?.length) &&
          Boolean(test.verifies?.length)
          ? "passed"
          : "blocked",
        !unknownRequirements.length &&
          !unknownSteps.length &&
          Boolean(test.covers?.length) &&
          Boolean(test.verifies?.length)
          ? "测试用例可追溯到需求和计划步骤。"
          : `测试追踪不完整：未知需求=${unknownRequirements.join(", ") || "无"}，未知计划=${unknownSteps.join(", ") || "无"}`,
      ),
    );
  }
  if (!checks.length)
    checks.push(gate("Traceability", "blocked", "计划缺少可追踪项"));
  return checks;
}

function hashFile(file: string) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

export function validateEvidence(
  checks: CheckResult[],
  runDirectory: string,
  strictNames: Set<string> = new Set(),
): CheckResult[] {
  return checks.map((check) => {
    if (check.state !== "passed")
      return gate(
        `Evidence · ${check.name}`,
        check.detail.trim() ? "passed" : "blocked",
        check.detail.trim()
          ? "非通过项已说明阻塞、失败或未执行原因。"
          : "非通过项缺少原因说明。",
      );
    const evidence = check.evidence ?? [];
    if (!evidence.length && check.detail.trim() && !strictNames.has(check.name))
      return gate(
        `Evidence · ${check.name}`,
        "passed",
        "兼容旧结果：该通过项提供了文字证据；建议升级为 evidence 文件。",
      );
    if (!evidence.length)
      return gate(`Evidence · ${check.name}`, "blocked", "通过项缺少证据。");
    for (const item of evidence) {
      if (!item.summary?.trim())
        return gate(
          `Evidence · ${check.name}`,
          "blocked",
          "证据缺少摘要说明。",
        );
      if (
        item.kind === "command" &&
        (!item.command?.trim() || item.exitCode !== 0)
      )
        return gate(
          `Evidence · ${check.name}`,
          "blocked",
          `命令证据必须包含命令且退出码为 0：${item.command || "<missing>"} / ${item.exitCode}`,
        );
      if (item.path) {
        const target = path.resolve(runDirectory, item.path);
        const relative = path.relative(runDirectory, target);
        if (
          relative.startsWith("..") ||
          path.isAbsolute(relative) ||
          !fs.existsSync(target) ||
          !fs.statSync(target).isFile()
        )
          return gate(
            `Evidence · ${check.name}`,
            "blocked",
            `证据文件不存在或越界：${item.path}`,
          );
        if (item.sha256 && hashFile(target) !== item.sha256)
          return gate(
            `Evidence · ${check.name}`,
            "blocked",
            `证据文件哈希不匹配：${item.path}`,
          );
      }
    }
    return gate(`Evidence · ${check.name}`, "passed", "证据完整。");
  });
}

export function validateChangeReview(review: ChangeReview): CheckResult[] {
  return [
    gate(
      "Diff · planned files",
      review.unplannedFiles.length ? "blocked" : "passed",
      review.unplannedFiles.length
        ? `存在计划外改动：${review.unplannedFiles.join(", ")}`
        : "所有改动文件都能关联到计划步骤。",
    ),
    gate(
      "Diff · tested files",
      review.uncoveredFiles.length ? "blocked" : "passed",
      review.uncoveredFiles.length
        ? `存在未覆盖测试的改动：${review.uncoveredFiles.join(", ")}`
        : "所有改动文件都能关联到测试用例。",
    ),
    gate(
      "Diff · high risk",
      review.riskyChanges.length ? "blocked" : "passed",
      review.riskyChanges.length
        ? `存在高风险改动需确认：${review.riskyChanges.join(", ")}`
        : "未发现需阻断的高风险改动。",
    ),
  ];
}
