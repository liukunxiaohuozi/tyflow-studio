import type { FailureCategory, Task } from "../shared/contracts";
import { I18nT } from "./i18n";
import { Notice } from "./components";
import { validationPending } from "../shared/browser-test";
import {
  developmentProducedNoChanges,
  developmentValidationPending,
} from "../shared/development-checks";
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
  const noDevelopmentChanges = developmentProducedNoChanges(task);
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
            {noDevelopmentChanges
              ? I18nT(
                  "未产生代码修改，需重新修复",
                  "No code changes were produced; retry implementation",
                )
              : developmentPending
              ? I18nT(
                  "代码已修改，开发检查待处理",
                  "Code changed; development checks need attention",
                )
              : incomplete
                ? I18nT("验证未完成", "Validation incomplete")
                : categoryLabel(task.failure.category)}{" "}
            · {task.failure.code}
          </strong>
          <p>
            {noDevelopmentChanges
              ? I18nT(
                  "本轮实现未写入任何项目文件，本地没有可审查的代码改动。",
                  "This implementation wrote no project files, so there are no local code changes to review.",
                )
              : task.failure.message}
          </p>
          <p>
            {I18nT("影响范围", "Impact")}: {task.failure.impact.join("；")}
          </p>
          <p>
            {I18nT("推荐操作", "Recommended actions")}:{" "}
            {noDevelopmentChanges
              ? I18nT(
                  "点击“重新修复”重新执行实现；也可以补充文件线索后重试。",
                  "Retry implementation, or add file details before retrying.",
                )
              : task.failure.recommendedActions.join("；")}
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
