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
    recommendedActions:
      typed?.code === "DEVELOPMENT_VALIDATION_INCOMPLETE" ||
      typed?.code === "DEVELOPMENT_CHECK_FAILED"
        ? [
            "查看具体检查项：已保存代码不等于开发检查已通过；历史质量问题须有同环境基线证据，不能直接忽略",
            "点击“重新执行开发检查”只补齐验证，不重复实现；若确认实现错误，再选择“重新修复”",
          ]
        : typed?.code === "TEST_BROWSER_PREPARATION"
          ? [
              "点击“测试准备”：填写非生产测试地址，打开专用 Chrome/Firefox 并手动登录；不要在补充信息中填写密码",
              "确认页面运行的是任务工作区代码及可操作的测试数据范围，再继续验证；无需重新评估或开发",
            ]
          : typed?.code === "TEST_INCOMPLETE"
            ? [
                "查看未完成用例的具体原因，补齐测试地址、启动项目、浏览器工具或测试账号等所需条件；无需重录需求",
                "在原任务补充信息后重试测试；有效的已通过检查点会保留，未执行用例不会算作通过",
              ]
            : typed?.code === "AGENT_READ_BLOCKED"
              ? [
                  "查看执行日志中的命令拒绝或沙箱初始化原因，联系 Studio 维护者处理；不要关闭安全限制",
                  "处理后在原任务重试源码评估；无需补充需求或重建任务",
                ]
              : typed?.code === "AGENT_PLAN_INVALID"
                ? [
                    "检查提示中具体计划步骤的文件范围或字段",
                    "纯验证动作应放入测试用例；补充实际文件线索后重试此检查点，无需重建任务",
                  ]
                : typed?.code === "NETWORK_LOST" && kind === "agent"
                  ? [
                      "检查系统代理、网络连接及 Codex 服务可达性",
                      "连接恢复后重试当前检查点；无需重录需求，已有代码保留",
                    ]
                  : operations[kind],
    retryable: typed?.retryable ?? true,
    at: new Date().toISOString(),
  };
}
