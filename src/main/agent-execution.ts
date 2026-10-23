import type { Stage } from "../shared/contracts";

/** Studio is a standalone application, not the signed Codex Desktop package. */
export function standaloneCodexEnvironment(): NodeJS.ProcessEnv {
  return { CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY: undefined };
}

export function codexExecutionArgs(stage: Stage, _platform = process.platform) {
  return [
    "exec",
    // Inherit the user's Codex model, skills, MCP servers and trusted-project
    // configuration. Studio supplies task intent; it must not create a reduced
    // second Codex personality by ignoring the user's configuration.
    ...(stage === "analysis"
      ? ["--sandbox", "read-only", "-c", 'approval_policy="never"']
      : ["--approve-for-me"]),
  ];
}

export function isReadExecutionBlocked(message: string) {
  return /blocked by policy|sandbox provisioning failed|helper_sandbox_lock_failed|windows sandbox failed/i.test(
    message,
  );
}

export const readExecutionBlockedMessage =
  "源码评估受阻：Codex 的读取命令被执行策略或沙箱初始化阻止，尚未完成源码检查。请检查执行日志及沙箱配置；无需重填需求或切换分支。处理后在原任务重新评估，不能直接开始开发。";
