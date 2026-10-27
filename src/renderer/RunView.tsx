import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
  PreviewDrawer,
  PlanDialog,
  Status,
  statusLabel,
} from "./components";
import { I18nT } from "./i18n";
import AttachmentImages from "./AttachmentImages";
import RecoveryPanel from "./RecoveryPanel";
import SupplementDialog from "./SupplementDialog";
import { validationPending } from "../shared/browser-test";
import {
  developmentValidationPending,
  developmentProducedNoChanges,
  canRecheckDevelopment,
} from "../shared/development-checks";
const BrowserTestDrawer = lazy(() => import("./BrowserTestDrawer"));

function toneOf(status: Task["status"]) {
  if (status === "accepted") return "success";
  if (status === "failed") return "danger";
  if (
    status === "stopped" ||
    status === "waiting-test" ||
    status === "waiting-review"
  )
    return "warning";
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
  const [applyOpen, setApplyOpen] = useState(false);
  const [historyRun, setHistoryRun] = useState<
    NonNullable<Task["runs"]>[number] | null
  >(null);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [browserPreparationOpen, setBrowserPreparationOpen] = useState(false);
  const [activityNow, setActivityNow] = useState(Date.now());
  const logRef = useRef<HTMLDivElement>(null);
  const running = activeStatuses.includes(task.status);
  const bugAnalysis =
    task.kind === "bug" && task.intent?.mode === "diagnose" && !task.snapshot;
  const analysisReady = bugAnalysis && Boolean(task.diagnosis);
  const analysisRunning = bugAnalysis && !task.diagnosis;
  const developmentPending = developmentValidationPending(task.failure?.code);
  const noDevelopmentChanges = developmentProducedNoChanges(task);
  const incomplete =
    developmentPending || validationPending(task.failure?.code);
  const tone = incomplete ? "warning" : toneOf(task.status);
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
  useEffect(() => {
    if (task.status !== "developing" || !task.activity) return;
    const timer = window.setInterval(() => setActivityNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [task.status, task.activity?.lastOutputAt]);
  async function action(value: TaskAction, developmentChecksOnly = false) {
    if (!api) return;
    setBusy(true);
    try {
      onTask(
        await api.taskAction(
          task.id,
          value,
          developmentChecksOnly ? { developmentChecksOnly: true } : undefined,
        ),
      );
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function confirmStart() {
    if (!api) return;
    setBusy(true);
    try {
      const updated = await api.taskAction(task.id, "start");
      onTask(updated);
      if (updated.runtime?.reusedExisting)
        report(
          `${I18nT(
            "项目已经启动，已在常用浏览器打开",
            "The project is already running and was opened in your usual browser",
          )} ${updated.runtime.targetUrl}`,
        );
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function applyToProject() {
    if (!api?.applyWorkspace) return;
    setBusy(true);
    try {
      onTask(await api.applyWorkspace(task.id));
      setApplyOpen(false);
      report(
        I18nT(
          "改动已应用到原项目，请在编辑器更改区查看；尚未提交或推送。",
          "Changes applied to the original project. Review them in your editor; nothing was committed or pushed.",
        ),
      );
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function pauseAndSupplement() {
    if (!api) return;
    setBusy(true);
    try {
      onTask(await api.taskAction(task.id, "pause"));
      setSupplementOpen(true);
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const automated = Boolean(
    task.autoTest ||
    task.testExecution ||
    task.stage === "test" ||
    task.executionIntent?.forceTests,
  );
  const stages =
    (task.kind === "bug" && task.workflowMode !== "standard") ||
    task.workflowMode === "quick"
      ? [
          {
            key: "development",
            label: I18nT("修改与局部检查", "Edit and focused checks"),
          },
          ...(automated
            ? [{ key: "test", label: I18nT("自动化测试", "Testing") }]
            : []),
          {
            key: "startup",
            label: I18nT("自行查看效果", "Review in your browser"),
          },
        ]
      : [
          { key: "analysis", label: I18nT("需求评估", "Assessment") },
          { key: "development", label: I18nT("开发实现", "Development") },
          ...(automated
            ? [{ key: "test", label: I18nT("自动化测试", "Testing") }]
            : []),
          { key: "startup", label: I18nT("启动与验收", "Launch and accept") },
        ];
  const stageIndex =
    task.status === "accepted" ||
    task.status === "review" ||
    task.status === "waiting-review"
      ? stages.length - 1
      : Math.max(
          0,
          stages.findIndex((s) => s.key === task.stage),
        );
  const complete = task.status === "accepted";
  const good = task.checks.filter((x) => x.state === "passed").length;
  const gates = gateChecks(task);
  const quickView = task.workflowMode === "quick" && !automated;
  const workflowStep = quickView
    ? task.snapshot
      ? 1
      : 0
    : task.snapshot
      ? 2
      : task.stage === "analysis"
        ? 0
        : 1;
  const workflowLabels = quickView
    ? [I18nT("录入任务", "Task intake"), I18nT("修改与查看", "Edit and review")]
    : [
        I18nT("录入任务", "Task intake"),
        I18nT("确认执行", "Confirm execution"),
        I18nT("运行与验收", "Run and accept"),
      ];
  return (
    <div
      className={`run-page tone-${tone}${analysisReady ? " analysis-ready" : ""}${analysisRunning ? " analysis-running" : ""}`}
    >
      <header className="run-hero">
        <div className="run-hero-copy">
          <div className="eyebrow">
            {I18nT("工作台 / 需求详情", "Workspace / Requirement detail")}
          </div>
          <h1>{task.title}</h1>
          <p>
            {task.workspace?.application
              ? I18nT(
                  "改动已应用到原项目，可在编辑器更改区 review，并在原浏览器验证；尚未提交或推送。",
                  "Changes applied to the original project for editor review and existing-browser verification; not committed or pushed.",
                )
              : task.workspace
                ? I18nT(
                    "修改保存在独立工作区，原项目浏览器不会自动热更新；请核对下方实际修改目录。",
                    "Changes are saved in an isolated workspace. The original project's browser will not hot reload them; check the edited directory below.",
                  )
                : !automated
                  ? I18nT(
                      "修改保存后由现有项目热更新，你直接在已打开的浏览器查看即可。",
                      "Saved changes hot reload in the running project. Review them in your existing browser.",
                    )
                  : task.kind === "bug"
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
        {noDevelopmentChanges ? (
          <span className="badge error">
            {I18nT("未产生代码修改", "No code changes produced")}
          </span>
        ) : incomplete ? (
          <span className="badge warning">
            {developmentPending
              ? I18nT(
                  "代码已修改，检查待处理",
                  "Code changed; checks need attention",
                )
              : I18nT("验证未完成", "Validation incomplete")}
          </span>
        ) : (
          <Status status={task.status} />
        )}
      </header>

      <nav
        className="run-steps"
        aria-label={I18nT("流程步骤", "Workflow steps")}
      >
        {workflowLabels.map((label, i) => (
          <div
            key={label}
            className={`step ${i === workflowStep ? "current" : i < workflowStep ? "done" : ""}`}
          >
            <span>{i < workflowStep ? <Check size={14} /> : i + 1}</span>
            {label}
            {i < workflowLabels.length - 1 && (
              <ChevronRight size={15} className="step-separator" />
            )}
          </div>
        ))}
      </nav>

      {analysisReady && task.diagnosis && (
        <section className="panel diagnosis-result">
          <div className="section-heading">
            <div>
              <h2>{I18nT("问题分析结果", "Issue analysis result")}</h2>
              <p>{task.diagnosis.summary}</p>
            </div>
            <span className="badge success">
              {I18nT("置信度", "Confidence")}: {task.diagnosis.confidence}
            </span>
          </div>
          <div className="diagnosis-grid">
            <div>
              <strong>{I18nT("根因", "Root cause")}</strong>
              <p className="prewrap">{task.diagnosis.rootCause}</p>
            </div>
            <div>
              <strong>{I18nT("分析证据", "Evidence")}</strong>
              <ul>
                {task.diagnosis.evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {task.diagnosis.affectedFiles.length > 0 && (
              <div>
                <strong>{I18nT("涉及文件", "Affected files")}</strong>
                {task.diagnosis.affectedFiles.map((file) => (
                  <p className="mono" key={file}>
                    {file}
                  </p>
                ))}
              </div>
            )}
            <div>
              <strong>{I18nT("建议处理", "Recommendation")}</strong>
              <p className="prewrap">{task.diagnosis.recommendation}</p>
            </div>
            <div className="diagnosis-traceability">
              <strong>
                {I18nT("Bug 引入记录", "Bug introduction record")}
              </strong>
              <p>
                {I18nT("引入时间", "Introduced at")}:{" "}
                {task.diagnosis.introducedAt ||
                  I18nT("无法确认", "Unconfirmed")}
              </p>
              {task.diagnosis.introducingCommit ? (
                <>
                  <p className="mono">
                    Commit: {task.diagnosis.introducingCommit.hash}
                  </p>
                  <p>
                    {I18nT("作者", "Author")}:{" "}
                    {task.diagnosis.introducingCommit.author}
                  </p>
                  <p>
                    {I18nT("提交时间", "Committed at")}:{" "}
                    {task.diagnosis.introducingCommit.committedAt}
                  </p>
                  <p>
                    {I18nT("提交说明", "Commit message")}:{" "}
                    {task.diagnosis.introducingCommit.message}
                  </p>
                </>
              ) : (
                <p>
                  {I18nT(
                    "引入提交：无法确认",
                    "Introducing commit: unconfirmed",
                  )}
                </p>
              )}
              <p>
                {I18nT("对应版本", "Version")}:{" "}
                {task.diagnosis.versionInfo || I18nT("无法确认", "Unconfirmed")}
              </p>
              {task.diagnosis.traceabilityNotes && (
                <p className="prewrap">{task.diagnosis.traceabilityNotes}</p>
              )}
            </div>
          </div>
          {task.kind === "bug" && task.status === "ready" && (
            <div className="actions">
              <button disabled={busy} onClick={() => setSupplementOpen(true)}>
                <MessageSquarePlus size={16} />
                {I18nT("补充", "Add details")}
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void action("fix")}
              >
                <Wrench size={16} />
                {I18nT("修复", "Repair")}
              </button>
            </div>
          )}
        </section>
      )}

      {task.snapshot && api?.browserTest && task.stage === "test" && (
        <div className="browser-preparation-entry">
          <button
            className="primary"
            disabled={running}
            onClick={() => setBrowserPreparationOpen(true)}
          >
            {I18nT("测试准备 / 手动登录", "Test preparation / manual login")}
          </button>
          <span>
            {I18nT(
              "填写测试地址、打开专用浏览器并登录后，再继续页面验证。",
              "Set the test URL, open dedicated browsers and log in before continuing page verification.",
            )}
          </span>
        </div>
      )}
      {browserPreparationOpen && api && (
        <Suspense
          fallback={
            <Notice>
              {I18nT("正在打开测试准备…", "Opening test preparation…")}
            </Notice>
          }
        >
          <BrowserTestDrawer
            api={api}
            task={task}
            onTask={onTask}
            close={() => setBrowserPreparationOpen(false)}
          />
        </Suspense>
      )}
      <RecoveryPanel task={task} />
      {task.error && !task.failure && (
        <Notice tone="error">{task.error}</Notice>
      )}
      {Boolean(task.workspaceOverlap?.length) && (
        <Notice>
          <strong>
            {I18nT("请校验代码改动", "Review overlapping changes")}
          </strong>
          <br />
          {I18nT(
            "任务开始前已有未提交修改，本次又修改了相同文件。开发与验收可以继续，但 Studio 不会自动提交这些无法安全拆分的文件：",
            "These files already had uncommitted changes and were changed again by this task. Development and review can continue, but Studio will not auto-commit changes that cannot be separated safely:",
          )}{" "}
          {task.workspaceOverlap!.join(", ")}
        </Notice>
      )}
      {(task.status === "waiting-review" ||
        (!task.autoTest && task.status === "waiting-test")) && (
        <Notice>
          {task.workspace?.application
            ? I18nT(
                "已向原项目应用改动，请核对编辑器中的文件差异并自行验证。验收提交仍针对独立任务分支，不会代你提交原目录其他修改。",
                "Changes were applied to the original project. Review the editor diff and verify manually. Acceptance still submits the isolated task branch, never other changes in your original directory.",
              )
            : task.workspace
              ? I18nT(
                  "开发检查已完成，修改保存在独立工作区。原项目浏览器不会自动显示这些改动；请在任务工作区验证。尚未人工验收，也未自动合回原目录。",
                  "Development checks completed in the isolated workspace. The original project's browser will not show these changes automatically. Review the task workspace; no manual acceptance or merge is implied.",
                )
              : I18nT(
                  "修改已保存，开发阶段已结束。直接在你已打开的浏览器查看效果即可，无需再启动、登录或打开专用浏览器。人工查看结果不等于自动化测试通过。",
                  "Changes saved; development has ended. Review the result in your existing browser without another startup, login or dedicated browser. Manual review is not an automated test pass.",
                )}
        </Notice>
      )}
      {task.status === "queued" && (
        <Notice>
          {I18nT(
            "任务已排队，空闲后会自动执行。你可以切换到其他任务，也可以停止此任务。",
            "Task queued and will run when a slot is free. You can switch tasks or stop this task.",
          )}
        </Notice>
      )}
      {task.workspace && (
        <Notice>
          {I18nT("独立任务工作区", "Isolated task workspace")} ·{" "}
          {task.workspace.branch}
          <br />
          <span className="mono">{task.workspace.directory}</span>{" "}
          <button
            onClick={() =>
              void api
                ?.openWorkspace?.(task.id)
                .catch((error) => report(error.message, true))
            }
          >
            {I18nT("打开工作区", "Open workspace")}
          </button>
          <br />
          {I18nT("原项目目录", "Original project directory")}：{" "}
          <span className="mono">{task.workspace.sourceDirectory}</span>{" "}
          {api?.applyWorkspace &&
            ["waiting-review", "review"].includes(task.status) &&
            !task.failure && (
              <button disabled={busy} onClick={() => setApplyOpen(true)}>
                {I18nT(
                  "应用到原项目（编辑器可见）",
                  "Apply to original project (visible in editor)",
                )}
              </button>
            )}
          {task.workspace.application && (
            <small>
              {I18nT("上次应用", "Last applied")}：
              {new Date(task.workspace.application.at).toLocaleString()} ·{" "}
              {task.workspace.application.branch}
            </small>
          )}
        </Notice>
      )}
      {applyOpen && task.workspace && (
        <PreviewDrawer
          title={I18nT("应用改动到原项目", "Apply changes to original project")}
          close={() => {
            if (!busy) setApplyOpen(false);
          }}
        >
          <Notice>
            {I18nT(
              "将任务改动保存为原项目的未提交文件，在编辑器更改区即可 review，现有项目可热更新。不切换分支、不提交、不推送，也不表示已经验收。",
              "Save task changes as uncommitted files in the original project for editor review and hot reload. No branch switch, commit, push or acceptance.",
            )}
          </Notice>
          <p className="mono">{task.workspace.sourceDirectory}</p>
          <p>
            {I18nT(
              "原项目有未提交修改、文件冲突或任务检查已失效时会停止，不覆盖现有工作。应用前保留备份；后续验收提交仍针对独立任务分支。",
              "Stops on uncommitted source changes, conflicting files or stale checks without overwriting existing work. A backup is retained. Later acceptance still submits the isolated task branch.",
            )}
          </p>
          <p>
            {I18nT(
              "请先保存编辑器中尚未保存的文件，应用完成后在原项目的更改区查看。",
              "Save unsaved editor buffers first, then review the original project's changes after applying.",
            )}
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void applyToProject()}
          >
            {busy
              ? I18nT("正在核对并应用…", "Checking and applying…")
              : I18nT("确认应用到原项目", "Confirm apply to original project")}
          </button>
        </PreviewDrawer>
      )}
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
                <h2>
                  {noDevelopmentChanges
                    ? I18nT(
                        "未产生代码修改，需重新修复",
                        "No code changes were produced; retry implementation",
                      )
                    : incomplete
                      ? developmentPending
                        ? I18nT(
                            "代码已修改，检查待处理",
                            "Code changed; checks need attention",
                          )
                        : I18nT("验证未完成", "Validation incomplete")
                      : statusLabel(task.status)}
                  {task.status === "developing" && task.activity && (
                    <span className="activity-seconds">
                      {Math.max(
                        0,
                        Math.floor(
                          (activityNow -
                            Date.parse(task.activity.lastOutputAt)) /
                            1000,
                        ),
                      )}
                      s
                    </span>
                  )}
                </h2>
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
            {task.diagnosis && !analysisReady && (
              <div className="run-status-actions">
                <button
                  className="text-button"
                  onClick={() => setDiagnosisOpen(true)}
                >
                  <FileText size={14} />
                  {I18nT("查看原因", "View cause")}
                </button>
              </div>
            )}
            {!quickView && (
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
            )}
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
                  : I18nT(
                      "自行浏览器查看；自动化测试未启用",
                      "Review in your browser; automated testing off",
                    )}
            </span>
          </div>

          <div className="run-checks">
            <div className="section-heading">
              <h2>
                <FlaskConical size={16} />
                {!automated
                  ? I18nT("开发检查", "Development checks")
                  : task.kind === "bug"
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
                      <span
                        className={`result-dot ${check.historical ? "unexecuted" : check.state}`}
                      />
                      <strong>{check.name}</strong>
                      <span
                        className={`badge ${check.historical ? "warning" : check.state === "passed" ? "success" : check.state === "failed" ? "danger" : "warning"}`}
                      >
                        {check.historical
                          ? I18nT("历史问题", "Historical finding")
                          : check.state === "passed"
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
            <details
              className="run-checks"
              open={
                !quickView || gates.some((check) => check.state !== "passed")
              }
            >
              <summary>
                {I18nT("安全与范围检查详情", "Safety and scope check details")}
              </summary>
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
            </details>
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
                  <span>
                    {task.runtime?.targetUrl &&
                    entry.message.includes(task.runtime.targetUrl) ? (
                      <>
                        {entry.message.replace(task.runtime.targetUrl, "")}
                        <button
                          className="text-button"
                          onClick={() =>
                            void api
                              ?.openTarget(task.id, true)
                              .catch((error) => report(error.message, true))
                          }
                        >
                          {task.runtime.targetUrl}
                        </button>
                      </>
                    ) : (
                      entry.message
                    )}
                  </span>
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
              <div className="history-run" key={run.id}>
                <div className="history-run-summary">
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
                  {run.status === "failed" && (
                    <button onClick={() => setHistoryRun(run)}>
                      {I18nT("查看原因", "View reason")}
                    </button>
                  )}
                </div>
              </div>
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
                  <small>{I18nT("补充记录", "Supplement history")}</small>
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
              ? task.kind === "bug" && task.stage === "development"
                ? I18nT(
                    "正在本地修复，可暂停补充信息或停止执行。",
                    "Fixing locally. You can pause to add details or stop execution.",
                  )
                : I18nT(
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
            <>
              {running && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void pauseAndSupplement()}
                >
                  <MessageSquarePlus size={15} />
                  {I18nT("暂停并补充", "Pause and add details")}
                </button>
              )}
              <button disabled={busy} onClick={() => void action("stop")}>
                <Square size={15} />
                {I18nT("停止执行", "Stop")}
              </button>
            </>
          ) : (
            <>
              {["failed", "stopped"].includes(task.status) && (
                <>
                  <button onClick={edit}>
                    {I18nT("查看需求", "View requirement")}
                  </button>
                  {canRecheckDevelopment(task) && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void action("retry", true)}
                    >
                      <RotateCcw size={15} />
                      {I18nT("重新执行开发检查", "Rerun development checks")}
                    </button>
                  )}
                  <button disabled={busy} onClick={() => void action("retry")}>
                    <RotateCcw size={15} />
                    {canRecheckDevelopment(task)
                      ? I18nT("重新修复", "Retry implementation")
                      : I18nT("直接重试", "Retry now")}
                  </button>
                  {!task.snapshot && task.stage !== "analysis" && (
                    <button
                      disabled={busy}
                      onClick={() => void action("analyze")}
                    >
                      {I18nT("重新评估需求", "Reassess requirement")}
                    </button>
                  )}
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      setSupplementOpen(true);
                    }}
                  >
                    <MessageSquarePlus size={15} />
                    {I18nT("补充信息后重试", "Add details and retry")}
                  </button>
                </>
              )}
              {task.status === "failed" &&
                !incomplete &&
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
              {["waiting-test", "waiting-review", "review"].includes(
                task.status,
              ) && (
                <button disabled={busy} onClick={() => setSupplementOpen(true)}>
                  <MessageSquarePlus size={15} />
                  {I18nT("追加信息", "Add context")}
                </button>
              )}
              {task.failure?.checkpointId === "delivery:push" && (
                <button disabled={busy} onClick={() => void action("retry")}>
                  <RotateCcw size={15} />
                  {I18nT("只重试 Git 推送", "Retry Git delivery only")}
                </button>
              )}
              {["waiting-test", "waiting-review"].includes(task.status) &&
                !task.testExecution && (
                  <button disabled={busy} onClick={() => void action("test")}>
                    <FlaskConical size={16} />
                    {I18nT(
                      "自动化测试介入（可选）",
                      "Run automated testing (optional)",
                    )}
                  </button>
                )}
              {task.status === "waiting-review" &&
                (automated || task.workspace) && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void confirmStart()}
                  >
                    <Play size={15} />
                    {I18nT("启动或打开验证", "Start or open for review")}
                  </button>
                )}
              {(automated || task.workspace) &&
                ["waiting-review", "review", "accepted"].includes(
                  task.status,
                ) && (
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
              {!simulated &&
                (automated || task.workspace) &&
                ["waiting-review", "review", "accepted"].includes(
                  task.status,
                ) && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        task.status === "waiting-review" &&
                        !window.confirm(
                          I18nT(
                            "请确认已运行的是当前任务工作区与分支，再打开现有浏览器验证。",
                            "Confirm that the running project uses this task's workspace and branch before reviewing it in your browser.",
                          ) +
                            "\n" +
                            (task.workspace?.directory ??
                              task.snapshot?.project.directory ??
                              "") +
                            "\n" +
                            (task.workspace?.branch ??
                              task.snapshot?.branch.name ??
                              ""),
                        )
                      )
                        return;
                      void api
                        ?.openTarget(task.id, true)
                        .catch((error) => report(error.message, true));
                    }}
                  >
                    <ExternalLink size={16} />
                    {I18nT("在浏览器验证", "Review in browser")}
                  </button>
                )}
              {(["waiting-review", "review"].includes(task.status) ||
                (!task.autoTest && task.status === "waiting-test")) && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void action("accept")}
                >
                  <CheckCircle2 size={16} />
                  {busy
                    ? I18nT("正在提交并推送…", "Committing and pushing…")
                    : I18nT(
                        "我已验证，提交并推送代码",
                        "Reviewed: commit and push code",
                      )}
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
      </div>
      {supplementOpen && api && (
        <SupplementDialog
          api={api}
          task={task}
          onTask={onTask}
          report={report}
          close={() => setSupplementOpen(false)}
          continueWith={
            task.kind === "bug" && task.status === "ready" && task.diagnosis
              ? "analyze"
              : undefined
          }
        />
      )}
      {historyRun && (
        <PreviewDrawer
          title={I18nT("执行失败原因", "Execution failure reason")}
          close={() => setHistoryRun(null)}
        >
          <p className="muted">
            {I18nT("执行阶段", "Stage")}:{" "}
            {stages.find((stage) => stage.key === historyRun.stage)?.label ||
              historyRun.stage}
            <br />
            {I18nT("开始时间", "Started")}:{" "}
            {new Date(historyRun.startedAt).toLocaleString()}
            <br />
            {I18nT("结束时间", "Finished")}:{" "}
            {historyRun.finishedAt
              ? new Date(historyRun.finishedAt).toLocaleString()
              : I18nT("尚未结束", "Not finished")}
          </p>
          {historyRun.error && <Notice tone="error">{historyRun.error}</Notice>}
          {historyRun.checks.map((check, index) => (
            <section
              className="history-drawer-check"
              key={`${check.name}-${index}`}
            >
              <div className="history-run-summary">
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
              </div>
              <pre>{check.detail}</pre>
            </section>
          ))}
        </PreviewDrawer>
      )}
      {diagnosisOpen && task.diagnosis && (
        <PreviewDrawer
          title={I18nT("问题分析结果", "Issue analysis result")}
          close={() => setDiagnosisOpen(false)}
        >
          <p className="prewrap">{task.diagnosis.summary}</p>
          <div className="diagnosis-grid diagnosis-drawer-grid">
            <div>
              <strong>{I18nT("根因", "Root cause")}</strong>
              <p className="prewrap">{task.diagnosis.rootCause}</p>
            </div>
            <div>
              <strong>{I18nT("分析证据", "Evidence")}</strong>
              <ul>
                {task.diagnosis.evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {task.diagnosis.affectedFiles.length > 0 && (
              <div>
                <strong>{I18nT("涉及文件", "Affected files")}</strong>
                {task.diagnosis.affectedFiles.map((file) => (
                  <p className="mono" key={file}>
                    {file}
                  </p>
                ))}
              </div>
            )}
            <div>
              <strong>{I18nT("建议处理", "Recommendation")}</strong>
              <p className="prewrap">{task.diagnosis.recommendation}</p>
            </div>
            <div className="diagnosis-traceability">
              <strong>
                {I18nT("Bug 引入记录", "Bug introduction record")}
              </strong>
              <p>
                {I18nT("引入时间", "Introduced at")}:{" "}
                {task.diagnosis.introducedAt ||
                  I18nT("无法确认", "Unconfirmed")}
              </p>
              {task.diagnosis.introducingCommit ? (
                <>
                  <p className="mono">
                    Commit: {task.diagnosis.introducingCommit.hash}
                  </p>
                  <p>
                    {I18nT("作者", "Author")}:{" "}
                    {task.diagnosis.introducingCommit.author}
                  </p>
                  <p>
                    {I18nT("提交时间", "Committed at")}:{" "}
                    {task.diagnosis.introducingCommit.committedAt}
                  </p>
                  <p>
                    {I18nT("提交说明", "Commit message")}:{" "}
                    {task.diagnosis.introducingCommit.message}
                  </p>
                </>
              ) : (
                <p>
                  {I18nT(
                    "引入提交：无法确认",
                    "Introducing commit: unconfirmed",
                  )}
                </p>
              )}
              <p>
                {I18nT("对应版本", "Version")}:{" "}
                {task.diagnosis.versionInfo || I18nT("无法确认", "Unconfirmed")}
              </p>
              {task.diagnosis.traceabilityNotes && (
                <p className="prewrap">{task.diagnosis.traceabilityNotes}</p>
              )}
            </div>
          </div>
        </PreviewDrawer>
      )}
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
