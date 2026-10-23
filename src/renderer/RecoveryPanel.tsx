import type { FailureCategory, Task } from "../shared/contracts";
import { I18nT } from "./i18n";
import { Notice } from "./components";
import { validationPending } from "../shared/browser-test";
import { developmentValidationPending } from "../shared/development-checks";
const categoryLabel = (category: FailureCategory) =>
  ({
    environment: I18nT("环境失败", "Environment failure"),
    agent: I18nT("Agent 失败", "Agent failure"),
    code: I18nT("代码失败", "Code failure"),
    test: I18nT("测试失败", "Test failure"),
    git: I18nT("Git 失败", "Git failure"),
    policy: I18nT("硬闸阻断", "Policy blocked"),
    interrupted: I18nT("执行中断", "Interrupted"),
  })[category];
export default function RecoveryPanel({ task }: { task: Task }) {
  const developmentPending = developmentValidationPending(task.failure?.code);
  const incomplete =
    developmentPending || validationPending(task.failure?.code);
  if (!task.failure) return null;
  return (
    <section
      className="recovery-panel"
      aria-label={I18nT("阶段恢复", "Stage recovery")}
    >
      {task.failure && (
        <Notice
          tone={
            incomplete || task.failure.category === "interrupted"
              ? "info"
              : "error"
          }
        >
          <strong>
            {developmentPending
              ? I18nT("开发验证未完成", "Development validation incomplete")
              : incomplete
                ? I18nT("验证未完成", "Validation incomplete")
                : categoryLabel(task.failure.category)}{" "}
            · {task.failure.code}
          </strong>
          <p>{task.failure.message}</p>
          <p>
            {I18nT("影响范围", "Impact")}: {task.failure.impact.join("；")}
          </p>
          <p>
            {I18nT("推荐操作", "Recommended actions")}:{" "}
            {task.failure.recommendedActions.join("；")}
          </p>
          <small>
            {I18nT(
              "重试只执行失效或失败步骤；有效的已通过检查点会保留。",
              "Retry runs only failed or invalid steps; valid passed checkpoints are retained.",
            )}
          </small>
        </Notice>
      )}
    </section>
  );
}
