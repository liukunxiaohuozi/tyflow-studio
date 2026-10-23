import type { TaskInput } from "./contracts";

export type TaskIntentMode =
  | "diagnose"
  | "implement"
  | "plan"
  | "verify"
  | "explain";

export interface TaskIntent {
  mode: TaskIntentMode;
  source: "explicit" | "inferred";
  reason: string;
}
const diagnosisOnly = [
  /(?:先|只|仅)(?:帮我)?(?:分析|排查|定位|查一下|看看)(?:一下)?(?:原因|根因|问题)?/i,
  /(?:分析|排查|定位|查)(?:一下)?(?:是什么|什么)?原因/i,
  /(?:不要|先别|暂时不|无需)(?:修改|改代码|修复|动代码)/i,
  /(?:只想|我想|需要)(?:知道|了解)(?:一下)?(?:原因|根因)/i,
  /(?:我)?只想知道为什么/i,
  /(?:分析|排查|定位|看看|查)(?:一)?下(?:原因|根因)?/i,
  /\b(?:analy[sz]e|investigate|diagnose)\b.*\b(?:only|first)\b/i,
  /\b(?:do not|don't)\s+(?:change|modify|fix)\b/i,
];

const explicitImplementation = [
  /(?:直接|帮我|请|立即|马上)?(?:修复|修改|改掉|解决|实现|开发|补上|增加|新增)/i,
  /(?:找到|定位)(?:原因|根因)?后(?:直接)?(?:修复|修改|解决)/i,
  /\b(?:fix|implement|change|modify|build)\b/i,
];

const planOnly = [
  /(?:先|只|仅)?(?:给我|帮我)?(?:出|写|整理)?(?:方案|计划|设计思路)(?:先|即可|就行)?/i,
  /(?:先别|不要)(?:开发|实现|修改)/i,
  /\b(?:plan|proposal|design)\s+(?:only|first)\b/i,
];

const verifyOnly = [
  /(?:只|仅|帮我)?(?:验证|验收|测试|检查)(?:一下)?(?:现有|当前|这个)?(?:修改|代码|结果)?/i,
  /\b(?:verify|validate|test|review)\s+(?:only|this)\b/i,
];

function matches(text: string, rules: RegExp[]) {
  return rules.some((rule) => rule.test(text));
}

/**
 * Infer the user's requested outcome, independent of which input tab they used.
 * Explicit constraints win; the task kind only supplies the default.
 */
export function inferTaskIntent(
  input: Pick<TaskInput, "kind" | "description">,
): TaskIntent {
  const text = input.description.trim();
  if (input.kind === "bug")
    return {
      mode: "diagnose",
      source: "inferred",
      reason: "Bug 默认先完成只读根因分析，等待用户确认后再修复",
    };
  if (matches(text, diagnosisOnly))
    return {
      mode: "diagnose",
      source: "explicit",
      reason: "用户明确要求先分析或禁止修改代码",
    };
  if (matches(text, planOnly))
    return {
      mode: "plan",
      source: "explicit",
      reason: "用户明确要求先输出方案或计划",
    };
  if (
    matches(text, verifyOnly) &&
    !/(?:修复|改掉|解决|实现|开发|补上|增加|新增|请修改|帮我修改|直接修改)/i.test(
      text,
    )
  )
    return {
      mode: "verify",
      source: "explicit",
      reason: "用户明确要求验证现有结果",
    };
  if (matches(text, explicitImplementation))
    return {
      mode: "implement",
      source: "explicit",
      reason: "用户明确要求修改或实现",
    };
  return {
    mode: "implement",
    source: "inferred",
    reason: "需求输入默认以实现目标为导向",
  };
}

export interface AutonomousExecutionPolicy {
  workflowMode: "quick" | "standard";
  autoTest: boolean;
  reason: string;
}

/**
 * Compatibility policy for the existing workflow engine. The user describes the
 * desired outcome; Studio derives the amount of orchestration and verification.
 * Codex still decides which installed skills are useful inside the chosen stage.
 */
export function deriveExecutionPolicy(
  input: Pick<
    TaskInput,
    | "kind"
    | "description"
    | "size"
    | "branch"
    | "workspaceMode"
    | "workflowMode"
  >,
): AutonomousExecutionPolicy {
  const intent = inferTaskIntent(input);
  if (intent.mode === "diagnose" || intent.mode === "explain")
    return {
      workflowMode:
        input.workflowMode === "standard" ||
        input.workspaceMode === "isolated" ||
        input.branch.mode === "new"
          ? "standard"
          : "quick",
      autoTest: false,
      reason: "当前请求只需要分析说明，不修改代码，也不运行自动化测试",
    };
  if (intent.mode === "verify")
    return {
      workflowMode: "standard",
      autoTest: true,
      reason: "当前请求以验证为目标，自动启用测试与证据收集",
    };
  if (intent.mode === "plan")
    return {
      workflowMode: "standard",
      autoTest: false,
      reason: "当前请求只生成方案，不修改代码或执行测试",
    };
  if (input.workflowMode === "standard")
    return {
      workflowMode: "standard",
      autoTest: input.kind === "design" || input.size !== "small",
      reason: "已选择目标分支或标准工作流，保留分支准备与版本冻结能力",
    };
  if (input.workspaceMode === "isolated" || input.branch.mode === "new")
    return {
      workflowMode: "standard",
      autoTest: input.kind === "design" || input.size !== "small",
      reason: "新分支或独立工作区需要标准准备流程；验证深度仍按改动风险自动决定",
    };
  if (input.kind === "design" || input.size === "medium" || input.size === "large")
    return {
      workflowMode: "standard",
      autoTest: true,
      reason: "设计或中大型开发自动采用完整流程，并启用自动化验证",
    };
  return {
    workflowMode: "quick",
    autoTest: false,
    reason: "小型修改直接由 Codex 实施必要检查，完成后由现有浏览器热更新验收",
  };
}

