import { useEffect, useState } from "react";
import type { FailureCategory, Task } from "../shared/contracts";
import { I18nT } from "./i18n";
import { Notice, activeStatuses } from "./components";
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
  const [now, setNow] = useState(Date.now());
  const running = activeStatuses.includes(task.status);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const states = {
    running: I18nT("执行中", "Running"),
    passed: I18nT("已通过", "Passed"),
    failed: I18nT("失败", "Failed"),
    interrupted: I18nT("已中断", "Interrupted"),
    invalidated: I18nT("需重新验证", "Needs revalidation"),
  };
  if (!task.failure && !task.checkpoints?.length) return null;
  return (
    <section
      className="recovery-panel"
      aria-label={I18nT("阶段恢复", "Stage recovery")}
    >
      {task.failure && (
        <Notice tone={task.failure.category === "interrupted" ? "info" : "error"}>
          <strong>
            {categoryLabel(task.failure.category)} · {task.failure.code}
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
      {running && task.activity && (
        <p role="status">
          {I18nT("距最近输出", "Since last output")}:{" "}
          {Math.max(
            0,
            Math.floor((now - Date.parse(task.activity.lastOutputAt)) / 1000),
          )}
          s
          {task.activity.idleTimeoutMs
            ? ` / ${I18nT("无输出超时", "Idle limit")} ${Math.floor(task.activity.idleTimeoutMs / 1000)}s`
            : ""}
        </p>
      )}
      {!!task.checkpoints?.length && (
        <details open={Boolean(task.failure)}>
          <summary>
            {I18nT("独立检查点", "Independent checkpoints")} ·{" "}
            {task.checkpoints.filter((c) => c.status === "passed").length}/
            {task.checkpoints.length}
          </summary>
          <ul>
            {task.checkpoints.map((c) => (
              <li key={c.id}>
                <span>{c.label}</span>
                <span>
                  {states[c.status]} · {I18nT("尝试", "Attempts")} {c.attempts}{" "}
                  · {I18nT("复用", "Reused")} {c.reused}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
