import type {
  FailureCategory,
  Stage,
  TaskFailure,
} from "../../shared/contracts";

export class ProviderFailure extends Error {
  constructor(
    public category: FailureCategory,
    public code: string,
    message: string,
    public retryable = true,
  ) {
    super(message);
    this.name = "ProviderFailure";
  }
}
export function failureDetail(
  error: unknown,
  stage: Stage,
  checkpointId: string,
  category: FailureCategory,
  sanitize: (s: string) => string,
): TaskFailure {
  const typed = error instanceof ProviderFailure ? error : undefined;
  const kind = typed?.category ?? category;
  const operations: Record<FailureCategory, string[]> = {
    environment: ["检查执行环境与登录状态", "修复配置后重试此检查点"],
    agent: ["检查 Agent 日志、网络和额度", "补充上下文后重试此检查点"],
    code: ["检查失败命令或代码检查结果", "修复代码后重试；已有代码保留"],
    test: ["检查失败用例及测试证据", "补充环境或证据后重试失败项"],
    git: ["检查仓库、分支、认证及远程状态", "保留本地提交后重试，不强制推送"],
    policy: [
      "检查需求覆盖、差异范围与证据",
      "修订已授权范围内的问题后重试；范围变化需重新确认",
    ],
    interrupted: ["已有代码和检查点已保留", "确认当前工作区后继续未完成步骤"],
  };
  return {
    category: kind,
    code: typed?.code ?? "STAGE_FAILED",
    stage,
    checkpointId,
    message: sanitize(error instanceof Error ? error.message : String(error)),
    impact: [
      "当前检查点尚未完成，后续步骤不会继续",
      "已完成检查点会按基线与证据有效性决定是否复用",
    ],
    recommendedActions: operations[kind],
    retryable: typed?.retryable ?? true,
    at: new Date().toISOString(),
  };
}
