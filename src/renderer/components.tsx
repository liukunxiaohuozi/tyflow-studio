import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, FileText, X } from "lucide-react";
import type { TaskStatus, Task } from "../shared/contracts";
import { I18nT } from "./i18n";
export const activeStatuses: TaskStatus[] = [
  "analyzing",
  "developing",
  "testing",
  "starting",
];
export function statusLabel(status: TaskStatus) {
  const values: Record<TaskStatus, string> = {
    draft: I18nT("草稿", "Draft"),
    analyzing: I18nT("评估中", "Assessing"),
    ready: I18nT("待确认", "Ready"),
    developing: I18nT("开发中", "Developing"),
    "waiting-test": I18nT("待测试", "Awaiting tests"),
    "waiting-review": I18nT("待人工验证", "Awaiting manual review"),
    testing: I18nT("测试中", "Testing"),
    starting: I18nT("启动中", "Starting"),
    review: I18nT("待验收", "Awaiting acceptance"),
    accepted: I18nT("已验收", "Accepted"),
    failed: I18nT("执行失败", "Failed"),
    stopped: I18nT("已终止", "Terminated"),
  };
  return values[status];
}
export function Status({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`badge ${status === "accepted" ? "success" : status === "failed" ? "danger" : status === "stopped" || status === "waiting-test" || status === "waiting-review" ? "warning" : ""}`}
    >
      <i className={activeStatuses.includes(status) ? "pulse" : ""} />
      {statusLabel(status)}
    </span>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {tone === "success" ? (
        <CheckCircle2 size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      <div>{children}</div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <FileText size={28} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const node = ref.current;
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label={I18nT("关闭", "Close")}
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function PlanDialog({
  task,
  tab,
  close,
}: {
  task: Task;
  tab: "plan" | "tests";
  close: () => void;
}) {
  return (
    <Modal
      title={
        tab === "plan"
          ? I18nT("开发计划", "Development plan")
          : I18nT("测试用例", "Test cases")
      }
      close={close}
    >
      {!task.plan ? (
        <Empty title={I18nT("评估后生成", "Generated after assessment")} />
      ) : tab === "plan" ? (
        <>
          <div className="doc-meta">
            {task.title} · v{task.planRevision}
          </div>
          <p className="prewrap">{task.plan.summary}</p>
          <h3>{I18nT("实施步骤", "Implementation steps")}</h3>
          <ol className="document-list">
            {task.plan.steps.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
          <h3>{I18nT("风险与依赖", "Risks and dependencies")}</h3>
          {task.plan.risks.length ? (
            <ul className="document-list">
              {task.plan.risks.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {I18nT("未报告额外风险", "No additional risks reported")}
            </p>
          )}
          {task.plan.blockers.length > 0 && (
            <Notice tone="error">
              <ul>
                {task.plan.blockers.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </Notice>
          )}
        </>
      ) : (
        <>
          <p className="muted">
            {I18nT(
              "以下为待执行用例，实际结果以运行记录为准。",
              "These are planned cases. Execution results are recorded in the run.",
            )}
          </p>
          {task.plan.testCases.map((x, i) => (
            <section className="test-case" key={x.id || i}>
              <h3>
                <span className="mono">{x.id}</span> {x.title}
              </h3>
              <ol>
                {x.steps.map((step, j) => (
                  <li key={j}>{step}</li>
                ))}
              </ol>
              <div className="expected">
                <strong>{I18nT("预期结果：", "Expected: ")}</strong>
                {x.expected}
              </div>
            </section>
          ))}
        </>
      )}
    </Modal>
  );
}
