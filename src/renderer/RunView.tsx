import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  GitBranch,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Play,
  RotateCcw,
  Square,
  Ban,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import type { StudioAPI, Task, TaskAction } from "../shared/contracts";
import {
  activeStatuses,
  Notice,
  Modal,
  PlanDialog,
  Status,
  statusLabel,
} from "./components";
import { I18nT } from "./i18n";
import AttachmentImages from "./AttachmentImages";

function toneOf(status: Task["status"]) {
  if (status === "accepted") return "success";
  if (status === "failed") return "danger";
  if (status === "stopped" || status === "waiting-test") return "warning";
  if (activeStatuses.includes(status)) return "active";
  return "neutral";
}
function gateChecks(task: Task) {
  return [
    ...(task.testExecution
      ? [
          {
            name: I18nT("测试执行身份", "Test execution identity"),
            state: "passed" as const,
            detail: [
              `${I18nT("执行器", "Provider")}: ${task.testExecution.provider}`,
              `${I18nT("结果来源", "Result source")}: ${task.testExecution.reused ? I18nT("复用", "reused") : I18nT("本次执行", "executed")}`,
              `${I18nT("代码快照", "Source snapshot")}: ${task.testExecution.sourceSnapshot.slice(0, 12)}`,
              `${I18nT("计划哈希", "Plan hash")}: ${task.testExecution.planHash.slice(0, 12)}`,
              `Run ID: ${task.testExecution.runId}`,
            ].join("\n"),
          },
        ]
      : []),
    ...(task.gateReviews?.traceability ?? []),
    ...(task.gateReviews?.evidence ?? []),
    ...(task.gateReviews?.diff
      ? [
          {
            name: I18nT("差异审查", "Diff review"),
            state:
              task.gateReviews.diff.unplannedFiles.length ||
              task.gateReviews.diff.uncoveredFiles.length ||
              task.gateReviews.diff.riskyChanges.length
                ? ("blocked" as const)
                : ("passed" as const),
            detail: [
              `${I18nT("改动文件", "Changed files")}: ${task.gateReviews.diff.files.length}`,
              `${I18nT("计划外", "Unplanned")}: ${task.gateReviews.diff.unplannedFiles.join(", ") || "0"}`,
              `${I18nT("未覆盖", "Uncovered")}: ${task.gateReviews.diff.uncoveredFiles.join(", ") || "0"}`,
              `${I18nT("高风险", "High risk")}: ${task.gateReviews.diff.riskyChanges.join(", ") || "0"}`,
            ].join("\n"),
          },
        ]
      : []),
  ];
}

export default function RunView({
  api = window.studio,
  simulated = false,
  task,
  onTask,
  report,
  edit,
}: {
  api?: StudioAPI;
  simulated?: boolean;
  task: Task;
  onTask: (task: Task) => void;
  report: (message: string, error?: boolean) => void;
  edit: () => void;
}) {
  const [dialog, setDialog] = useState<"plan" | "tests">();
  const [filter, setFilter] = useState("all");
  const [follow, setFollow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [supplementText, setSupplementText] = useState("");
  const [supplementAssets, setSupplementAssets] = useState<Task["assets"]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const running = activeStatuses.includes(task.status);
  const tone = toneOf(task.status);
  const logs = task.logs.filter(
    (x) =>
      filter === "all" ||
      (filter === "test" && x.stage === "test") ||
      (filter === "error" && x.level === "error"),
  );
  useEffect(() => {
    if (follow && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [task.logs.length, follow]);
  async function action(value: TaskAction) {
    if (!api) return;
    setBusy(true);
    try {
      onTask(await api.taskAction(task.id, value));
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function addSupplementFiles() {
    if (!api) return;
    setBusy(true);
    try {
      const incoming = await api.importFiles("attachment");
      setSupplementAssets((previous) => {
        const merged = [...previous];
        for (const asset of incoming)
          if (!merged.some((item) => item.id === asset.id)) merged.push(asset);
        return merged;
      });
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function retryWithSupplement() {
    if (!api) return;
    if (!supplementText.trim() && !supplementAssets.length) {
      report(
        I18nT(
          "请填写补充信息或添加截图、日志等附件。",
          "Add supplemental details or attach screenshots or logs.",
        ),
        true,
      );
      return;
    }
    setBusy(true);
    try {
      const updated = await api.taskAction(task.id, "retry", {
        supplement: {
          text: supplementText.trim() || undefined,
          assetIds: supplementAssets.map((asset) => asset.id),
        },
      });
      setSupplementOpen(false);
      setSupplementText("");
      setSupplementAssets([]);
      onTask(updated);
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const stages =
    task.kind === "bug"
      ? [
          { key: "development", label: I18nT("问题修复", "Bug fix") },
          { key: "startup", label: I18nT("启动与验收", "Launch and accept") },
        ]
      : [
          { key: "analysis", label: I18nT("需求评估", "Assessment") },
          { key: "development", label: I18nT("开发实现", "Development") },
          { key: "test", label: I18nT("自动化测试", "Testing") },
          { key: "startup", label: I18nT("启动与验收", "Launch and accept") },
        ];
  const stageIndex =
    task.status === "accepted" || task.status === "review"
      ? stages.length - 1
      : Math.max(
          0,
          stages.findIndex((s) => s.key === task.stage),
        );
  const complete = task.status === "accepted";
  const good = task.checks.filter((x) => x.state === "passed").length;
  const gates = gateChecks(task);
  return (
    <div className={`run-page tone-${tone}`}>
      <header className="run-hero">
        <div className="run-hero-copy">
          <div className="eyebrow">
            {I18nT("工作台 / 需求详情", "Workspace / Requirement detail")}
          </div>
          <h1>{task.title}</h1>
          <p>
            {task.kind === "bug"
              ? I18nT(
                  "修复完成并通过必要检查后，直接启动项目供你验收。",
                  "After the fix passes required checks, launch the project for review.",
                )
              : I18nT(
                  "每个阶段都有结果，测试也计入交付进度。",
                  "Every stage records an outcome, including testing.",
                )}
          </p>
        </div>
        <Status status={task.status} />
      </header>

      <nav
        className="run-steps"
        aria-label={I18nT("流程步骤", "Workflow steps")}
      >
        {[
          I18nT("录入任务", "Task intake"),
          I18nT("确认执行", "Confirm execution"),
          I18nT("运行与验收", "Run and accept"),
        ].map((label, i) => (
          <div key={label} className={`step ${i === 2 ? "current" : "done"}`}>
            <span>{i < 2 ? <Check size={14} /> : 3}</span>
            {label}
            {i < 2 && <ChevronRight size={15} className="step-separator" />}
          </div>
        ))}
      </nav>

      {task.error && <Notice tone="error">{task.error}</Notice>}
      {task.status === "review" && (
        <Notice tone="success">
          {simulated
            ? I18nT(
                "演示页面已就绪，请体验内置筛选页面后确认验收。",
                "The demo page is ready. Try the built-in filters, then accept the demo.",
              )
            : I18nT(
                "应用已启动，等待你的实际体验与验收。自动化通过不代表已人工验收。",
                "The app is ready for your review. Passing automated checks does not imply manual acceptance.",
              )}
        </Notice>
      )}
      {complete && (
        <Notice tone="success">
          {simulated
            ? I18nT(
                "演示已验收；退出演示后临时记录会清除。",
                "Demo accepted. Temporary records are cleared when you exit.",
              )
            : task.delivery?.pushedAt
              ? `${I18nT("本次任务已完成，代码已推送到", "Task completed and pushed to")} ${task.delivery.remote}/${task.delivery.branch} (${task.delivery.commit.slice(0, 8)}).`
              : I18nT(
                  "本次任务已验收，计划、测试与执行记录已保留。",
                  "Task accepted. The plan, checks and execution records are retained.",
                )}
        </Notice>
      )}

      <div className="run-layout">
        <section className="run-board">
          <div className={`run-status-card tone-${tone}`}>
            <div className="run-status-main">
              <div className="run-indicator">
                {running ? (
                  <Loader2 className="spin" size={22} />
                ) : complete ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <Terminal size={22} />
                )}
              </div>
              <div>
                <h2>{statusLabel(task.status)}</h2>
                <p>
                  {simulated
                    ? I18nT(
                        "以下为演示阶段进度，测试结果与日志均为模拟数据。",
                        "This is simulated stage progress, with sample test results and logs.",
                      )
                    : I18nT(
                        "按实际阶段显示进度，不估算命令执行百分比。",
                        "Progress reflects actual stages; command completion is not estimated.",
                      )}
                </p>
              </div>
            </div>
            <div className="run-status-actions">
              <button
                className="text-button"
                disabled={!task.plan}
                onClick={() => setDialog("plan")}
              >
                <FileText size={14} />
                {I18nT("预览开发计划", "Preview plan")}
              </button>
              <button
                className="text-button"
                disabled={!task.plan}
                onClick={() => setDialog("tests")}
              >
                <FlaskConical size={14} />
                {I18nT("查看测试用例", "View test cases")}
              </button>
            </div>
          </div>

          <div
            className="stage-track"
            style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}
            aria-label={I18nT("阶段进度", "Stage progress")}
          >
            {stages.map((stage, index) => (
              <div
                key={stage.key}
                className={`${index < stageIndex || complete ? "finished" : ""} ${index === stageIndex && !complete ? "current-stage" : ""}`}
              >
                <div className="track-segment">
                  <span />
                </div>
                <small>
                  {index < stageIndex || complete ? <Check size={13} /> : null}
                  {stage.label}
                </small>
              </div>
            ))}
          </div>

          <div className="run-context">
            <span>
              <GitBranch size={14} />
              {task.snapshot?.branch.name || task.branch.name || "—"}
            </span>
            <span>{task.snapshot?.project.name || task.projectId}</span>
            <span className="mono">
              {task.snapshot?.baseCommit?.slice(0, 10) ||
                task.baseCommit?.slice(0, 10) ||
                "—"}
            </span>
            <span>
              {task.kind === "bug"
                ? I18nT("执行必要修复检查", "Required fix checks")
                : task.autoTest
                  ? I18nT("已开启自动化测试", "Automated testing enabled")
                  : I18nT("手动介入测试", "Manual test intervention")}
            </span>
          </div>

          <div className="run-checks">
            <div className="section-heading">
              <h2>
                <FlaskConical size={16} />
                {task.kind === "bug"
                  ? I18nT("修复检查", "Fix checks")
                  : I18nT("测试结果", "Test results")}
              </h2>
              <span className="muted">
                {good}/{task.checks.length}{" "}
                {I18nT("项检查通过", "checks passed")}
              </span>
            </div>
            {task.checks.length === 0 ? (
              <p className="muted">
                {task.kind === "bug"
                  ? I18nT(
                      "尚无检查结果。修复执行后将在这里显示验证证据。",
                      "No check results yet. Evidence appears after the fix runs.",
                    )
                  : I18nT(
                      "尚无测试结果。实际执行后将在这里显示检查证据。",
                      "No test results yet. Evidence appears after checks run.",
                    )}
              </p>
            ) : (
              <div className="checks">
                {task.checks.map((check, i) => (
                  <details key={`${check.name}-${i}`} className="check-result">
                    <summary>
                      <span className={`result-dot ${check.state}`} />
                      <strong>{check.name}</strong>
                      <span
                        className={`badge ${check.state === "passed" ? "success" : check.state === "failed" ? "danger" : "warning"}`}
                      >
                        {check.state === "passed"
                          ? I18nT("通过", "Passed")
                          : check.state === "failed"
                            ? I18nT("失败", "Failed")
                            : check.state === "blocked"
                              ? I18nT("阻塞", "Blocked")
                              : I18nT("未执行", "Not executed")}
                      </span>
                    </summary>
                    <pre>{check.detail}</pre>
                  </details>
                ))}
              </div>
            )}
          </div>
          {gates.length > 0 && (
            <div className="run-checks">
              <div className="section-heading">
                <h2>
                  <ShieldCheck size={16} />
                  {I18nT("门禁审查", "Gate review")}
                </h2>
                <span className="muted">
                  {gates.filter((x) => x.state === "passed").length}/
                  {gates.length} {I18nT("项通过", "passed")}
                </span>
              </div>
              <div className="checks">
                {gates.map((check, i) => (
                  <details key={`${check.name}-${i}`} className="check-result">
                    <summary>
                      <span className={`result-dot ${check.state}`} />
                      <strong>{check.name}</strong>
                      <span
                        className={`badge ${check.state === "passed" ? "success" : check.state === "failed" ? "danger" : "warning"}`}
                      >
                        {check.state === "passed"
                          ? I18nT("通过", "Passed")
                          : check.state === "failed"
                            ? I18nT("失败", "Failed")
                            : check.state === "blocked"
                              ? I18nT("阻塞", "Blocked")
                              : I18nT("未执行", "Not executed")}
                      </span>
                    </summary>
                    <pre>{check.detail}</pre>
                  </details>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="run-log-board">
          <div className="section-heading">
            <h2>
              <Terminal size={16} />
              {I18nT("执行日志", "Execution logs")}
            </h2>
            <div className="actions">
              <div className="segmented">
                {[
                  { key: "all", label: I18nT("全部", "All") },
                  ...(task.kind === "bug"
                    ? []
                    : [{ key: "test", label: I18nT("测试", "Tests") }]),
                  { key: "error", label: I18nT("错误", "Errors") },
                ].map((item) => (
                  <button
                    key={item.key}
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="checkbox compact">
                <input
                  type="checkbox"
                  checked={follow}
                  onChange={(e) => setFollow(e.target.checked)}
                />
                {I18nT("跟随日志", "Follow logs")}
              </label>
            </div>
          </div>
          <div
            className="log-output"
            ref={logRef}
            tabIndex={0}
            aria-label={I18nT("日志输出", "Log output")}
          >
            {logs.length ? (
              logs.map((entry, i) => (
                <div
                  className={`log-line ${entry.level}`}
                  key={`${entry.time}-${i}`}
                >
                  <time>{new Date(entry.time).toLocaleTimeString()}</time>
                  <span className="log-stage">[{entry.stage}]</span>
                  <span>{entry.message}</span>
                </div>
              ))
            ) : (
              <div className="log-empty">
                {I18nT(
                  "暂无日志。任务实际运行后会在这里实时输出。",
                  "No logs yet. Actual execution output will stream here.",
                )}
              </div>
            )}
          </div>
          <div className="log-footer">
            {logs.length} {I18nT("条日志", "log entries")}
            <button
              className="text-button"
              onClick={() =>
                api
                  ?.exportTask(task.id)
                  .then(
                    (path) =>
                      path &&
                      report(I18nT("记录已导出：", "Record exported: ") + path),
                  )
                  .catch((e) => report(e.message, true))
              }
            >
              <Download size={14} />
              {I18nT("导出记录", "Export record")}
            </button>
          </div>
        </section>
      </div>

      <div className="run-secondary">
        <details className="panel run-history">
          <summary>
            {I18nT("历次执行与测试", "Previous runs and tests")}
            <span className="button-count">{task.runs?.length || 0}</span>
          </summary>
          <p className="muted history-caption">
            {I18nT(
              "保留最近 50 次执行，展开查看每次的检查证据与失败原因。",
              "The latest 50 runs are retained. Expand a run to inspect its evidence and errors.",
            )}
          </p>
          {task.runs?.length ? (
            [...task.runs].reverse().map((run) => (
              <details className="history-run" key={run.id}>
                <summary>
                  <strong>
                    {stages.find((stage) => stage.key === run.stage)?.label ||
                      run.stage}
                  </strong>
                  <time>{new Date(run.startedAt).toLocaleString()}</time>
                  <span
                    className={`badge ${run.status === "passed" ? "success" : run.status === "failed" ? "danger" : "warning"}`}
                  >
                    {run.status === "passed"
                      ? I18nT("完成", "Completed")
                      : run.status === "failed"
                        ? I18nT("失败", "Failed")
                        : run.status === "stopped"
                          ? I18nT("已停止", "Stopped")
                          : I18nT("执行中", "Running")}
                  </span>
                </summary>
                <div className="history-detail">
                  <p className="muted">
                    {I18nT("结束时间：", "Finished: ")}
                    {run.finishedAt
                      ? new Date(run.finishedAt).toLocaleString()
                      : I18nT("尚未结束", "Not finished")}
                  </p>
                  {run.error && <Notice tone="error">{run.error}</Notice>}
                  {run.checks.length ? (
                    run.checks.map((check, index) => (
                      <details
                        className="check-result"
                        key={`${check.name}-${index}`}
                      >
                        <summary>
                          <span className={`result-dot ${check.state}`} />
                          <strong>{check.name}</strong>
                          <span
                            className={`badge ${check.state === "passed" ? "success" : check.state === "failed" ? "danger" : "warning"}`}
                          >
                            {check.state === "passed"
                              ? I18nT("通过", "Passed")
                              : check.state === "failed"
                                ? I18nT("失败", "Failed")
                                : check.state === "blocked"
                                  ? I18nT("阻塞", "Blocked")
                                  : I18nT("未执行", "Not executed")}
                          </span>
                        </summary>
                        <pre>{check.detail}</pre>
                      </details>
                    ))
                  ) : (
                    <p className="muted">
                      {I18nT(
                        "此次执行没有检查结果。",
                        "No check results were recorded for this run.",
                      )}
                    </p>
                  )}
                </div>
              </details>
            ))
          ) : (
            <p className="muted">
              {I18nT("尚无历史执行记录。", "No previous runs yet.")}
            </p>
          )}
        </details>
        <details className="panel snapshot">
          <summary>{I18nT("本次执行快照", "Execution snapshot")}</summary>
          <div className="metadata">
            <div>
              <small>{I18nT("需求", "Requirement")}</small>
              <p className="prewrap">
                {task.snapshot?.description || task.description}
              </p>
              <AttachmentImages
                assets={task.assets}
                api={api}
                report={report}
              />
              {Boolean(task.supplements?.length) && (
                <div className="supplement-history">
                  <small>
                    {I18nT("失败后补充记录", "Post-failure supplements")}
                  </small>
                  {task.supplements?.map((item, index) => (
                    <div key={item.id} className="supplement-record">
                      <strong>
                        #{index + 1} · {item.stage} ·{" "}
                        {new Date(item.createdAt).toLocaleString()}
                      </strong>
                      {item.text && <p className="prewrap">{item.text}</p>}
                      {item.assetIds.length > 0 && (
                        <span className="muted">
                          {I18nT("附件", "Attachments")}: {item.assetIds.length}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <small>{I18nT("锁定时间", "Frozen at")}</small>
              <p>
                {task.snapshot?.at
                  ? new Date(task.snapshot.at).toLocaleString()
                  : "—"}
              </p>
            </div>
            <div>
              <small>{I18nT("项目目录", "Project directory")}</small>
              <p className="mono">{task.snapshot?.project.directory || "—"}</p>
            </div>
            <div>
              <small>
                {I18nT("设计与附件哈希", "Design and attachment hashes")}
              </small>
              {(
                task.snapshot?.assetHashes || task.assets.map((a) => a.sha256)
              ).map((hash) => (
                <p className="mono" key={hash}>
                  {hash}
                </p>
              ))}
            </div>
          </div>
        </details>
      </div>

      <div className="actionbar run-actionbar">
        <span className="action-hint">
          {simulated
            ? I18nT(
                "演示模式，不调用真实项目或测试 Skill。",
                "Demo mode; no real project or testing skill is invoked.",
              )
            : running
              ? I18nT(
                  "正在本地执行，可以随时停止。",
                  "Running locally. You can stop execution at any time.",
                )
              : I18nT(
                  "执行记录会自动保留在本机。",
                  "Execution records are automatically retained on this device.",
                )}
        </span>
        <div className="actions">
          {running ? (
            <button disabled={busy} onClick={() => void action("stop")}>
              <Square size={15} />
              {I18nT("停止执行", "Stop")}
            </button>
          ) : (
            <>
              {["failed", "stopped"].includes(task.status) && (
                <>
                  <button onClick={edit}>
                    {I18nT("查看需求", "View requirement")}
                  </button>
                  <button disabled={busy} onClick={() => void action("retry")}>
                    <RotateCcw size={15} />
                    {I18nT("直接重试", "Retry now")}
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => setSupplementOpen(true)}
                  >
                    <MessageSquarePlus size={15} />
                    {I18nT("补充信息后重试", "Add details and retry")}
                  </button>
                </>
              )}
              {task.status === "failed" &&
                task.stage === "test" &&
                task.snapshot && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void action("repair")}
                  >
                    <Wrench size={16} />
                    {I18nT("修复并重测", "Repair and retest")}
                  </button>
                )}
              {task.status === "waiting-test" && task.kind !== "bug" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void action("test")}
                >
                  <FlaskConical size={16} />
                  {I18nT("自动化测试介入", "Run automated testing")}
                </button>
              )}
              {task.status === "review" &&
                task.checks.length > 0 &&
                task.checks.every((x) => x.state === "passed") && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void action("start")}
                  >
                    <Play size={15} />
                    {I18nT("启动项目", "Start project")}
                  </button>
                )}
              {["review", "accepted"].includes(task.status) && (
                <button
                  onClick={() =>
                    api
                      ?.openTarget(task.id)
                      .catch((e) => report(e.message, true))
                  }
                >
                  <ExternalLink size={16} />
                  {I18nT("打开开发页面", "Open development page")}
                </button>
              )}
              {task.status === "review" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void action("accept")}
                >
                  <CheckCircle2 size={16} />
                  {busy
                    ? I18nT("正在提交并推送…", "Committing and pushing…")
                    : I18nT("验收并提交代码", "Accept, commit and push")}
                </button>
              )}
            </>
          )}
          {!["accepted", "stopped"].includes(task.status) && (
            <button
              className="danger-ghost"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    I18nT(
                      "确定终止该任务？终止后状态变为已终止。",
                      "Terminate this task? Its status will become Terminated.",
                    ),
                  )
                )
                  return;
                void action("terminate");
              }}
            >
              <Ban size={15} />
              {I18nT("终止", "Terminate")}
            </button>
          )}
        </div>
        {supplementOpen && (
          <Modal
            title={I18nT("补充信息并继续修复", "Add details and continue")}
            close={() => !busy && setSupplementOpen(false)}
          >
            <div className="supplement-modal">
              <Notice>
                {I18nT(
                  "原需求、失败日志和已有代码都会保留。这里补充复现条件、账号权限、期望结果、控制台信息或新证据，然后从当前失败阶段继续。",
                  "The original request, failure logs, and code are preserved. Add reproduction conditions, permissions, expected behavior, console output, or new evidence, then continue from the failed stage.",
                )}
              </Notice>
              <label className="field">
                <span>{I18nT("补充说明", "Additional details")}</span>
                <textarea
                  autoFocus
                  rows={7}
                  maxLength={8000}
                  value={supplementText}
                  onChange={(event) => setSupplementText(event.target.value)}
                  placeholder={I18nT(
                    "例如：仅管理员账号复现；时间范围选择最近 30 分钟；控制台报错如下……",
                    "For example: only admin accounts reproduce it; select the last 30 minutes; console error follows…",
                  )}
                />
              </label>
              <button disabled={busy} onClick={() => void addSupplementFiles()}>
                <Paperclip size={15} />
                {I18nT(
                  "添加截图、日志或文本",
                  "Attach screenshots, logs, or text",
                )}
              </button>
              {supplementAssets.length > 0 && (
                <ul className="supplement-assets">
                  {supplementAssets.map((asset) => (
                    <li key={asset.id}>
                      <span>{asset.name}</span>
                      <button
                        className="link-button"
                        disabled={busy}
                        onClick={() =>
                          setSupplementAssets((items) =>
                            items.filter((item) => item.id !== asset.id),
                          )
                        }
                      >
                        {I18nT("移除", "Remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="modal-actions">
                <button
                  disabled={busy}
                  onClick={() => setSupplementOpen(false)}
                >
                  {I18nT("取消", "Cancel")}
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void retryWithSupplement()}
                >
                  {busy ? (
                    <Loader2 className="spin" size={15} />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                  {I18nT("保存补充并重试", "Save details and retry")}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
      {dialog && (
        <PlanDialog
          task={task}
          tab={dialog}
          close={() => setDialog(undefined)}
        />
      )}
    </div>
  );
}
