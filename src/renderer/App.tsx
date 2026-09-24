import { useCallback, useEffect, useState } from "react";
import packageInfo from "../../package.json";
import {
  ArrowUpRight,
  CircleHelp,
  FileClock,
  FolderGit2,
  LayoutDashboard,
  Loader2,
  Plus,
  CirclePlay,
  Settings2,
  X,
} from "lucide-react";
import type { Bootstrap, Settings, Task } from "../shared/contracts";
import { activeStatuses, Modal, Notice } from "./components";
import { I18nT, setLanguage } from "./i18n";
import { applyTheme } from "./theme";
import TaskEditor from "./TaskEditor";
import RunView from "./RunView";
import Records from "./Records";
import SettingsView from "./SettingsView";
const demoVideoZhUrl = new URL(
  "./assets/TingYun-Studio-demo-zh.webm",
  import.meta.url,
).href;
const demoVideoEnUrl = new URL(
  "./assets/TingYun-Studio-demo-en.webm",
  import.meta.url,
).href;
const previewBootstrap: Bootstrap = {
  settings: {
    developer: { name: "", email: "", defaultProject: "explore" },
    projects: ["explore", "o11y-apm-ui"].map((id) => ({
      id,
      name: id,
      directory: "",
      repository: "",
      auth: "system",
      username: "",
      startScript: "start:dev",
      targetUrl: "http://localhost:8000/",
      defaultBranchMode: "new",
    })),
    agent: { command: "codex", tyflowDirectory: "", testSkill: "" },
    zentao: { enabled: false, url: "", username: "", mappings: {} },
    notifications: {
      enabled: true,
      desktop: true,
      milestones: {
        planReady: true,
        developmentComplete: true,
        acceptanceReady: true,
        failed: true,
      },
    },
    theme: "#1677FF",
    language: "zh-CN",
  },
  tasks: [],
  environment: {
    platform: "Browser preview",
    version: packageInfo.version,
    dataDirectory: "",
    agentAvailable: false,
    gitAvailable: false,
    tyflowAvailable: false,
    testSkillAvailable: false,
    credentialStorage: false,
  },
};
export default function App() {
  const [data, setData] = useState<Bootstrap>();
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<"task" | "records" | "settings">("task");
  const [selected, setSelected] = useState<string>();
  const [newKey, setNewKey] = useState(0);
  const [edit, setEdit] = useState(false);
  const [demo, setDemo] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean }>();
  const [settingsTab, setSettingsTab] = useState("developer");
  const report = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const updateTask = useCallback(
    (task: Task) =>
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.some((t) => t.id === task.id)
                ? prev.tasks.map((t) => (t.id === task.id ? task : t))
                : [task, ...prev.tasks],
            }
          : prev,
      ),
    [],
  );
  useEffect(() => {
    let mounted = true;
    const bootstrap = window.studio
      ? window.studio.bootstrap()
      : Promise.resolve(previewBootstrap);
    bootstrap
      .then((value) => {
        if (mounted) {
          setLanguage(value.settings.language);
          applyTheme(value.settings.theme);
          setData(value);
        }
      })
      .catch((error) => {
        if (mounted) setLoadError(error.message);
      });
    const unsubscribe = window.studio?.onTask(updateTask);
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [updateTask]);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = window.setTimeout(() => setToast(undefined), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function create() {
    setDemo(false);
    setSelected(undefined);
    setEdit(false);
    setNewKey((key) => key + 1);
    setView("task");
  }
  function openTask(task: Task) {
    setDemo(false);
    setSelected(task.id);
    setEdit(false);
    setView("task");
  }
  function taskResult(task: Task) {
    updateTask(task);
    setSelected(task.id);
    if (activeStatuses.includes(task.status)) setEdit(false);
  }
  function saveSettings(settings: Settings) {
    setLanguage(settings.language);
    applyTheme(settings.theme);
    setData((prev) => (prev ? { ...prev, settings } : prev));
    void window.studio
      ?.bootstrap()
      .then((next) =>
        setData((prev) =>
          prev ? { ...prev, environment: next.environment } : prev,
        ),
      )
      .catch(() => undefined);
  }
  if (!data)
    return (
      <div className="loading-screen">
        <div className="brand-logo">
          <ArrowUpRight size={28} />
        </div>
        <h1>TingYun Studio</h1>
        {loadError ? (
          <Notice tone="error">
            {loadError}
            <button onClick={() => location.reload()}>
              {I18nT("重新加载", "Reload")}
            </button>
          </Notice>
        ) : (
          <p>
            <Loader2 className="spin" size={17} />
            {I18nT("正在打开你的工作台…", "Opening your workspace…")}
          </p>
        )}
      </div>
    );
  const current = data.tasks.find((t) => t.id === selected);
  const runningCount = data.tasks.filter((t) =>
    activeStatuses.includes(t.status),
  ).length;
  const showRun =
    current &&
    (current.snapshot ||
      [
        "developing",
        "waiting-test",
        "waiting-review",
        "testing",
        "starting",
        "review",
        "accepted",
      ].includes(current.status));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <ArrowUpRight size={23} />
          </div>
          <div>
            TingYun <strong>Studio</strong>
            <small>{I18nT("从想法到交付", "From idea to delivery")}</small>
          </div>
        </div>
        <button className="new-task primary" onClick={create}>
          <Plus size={18} />
          {I18nT("新建任务", "New task")}
        </button>
        <nav aria-label={I18nT("主导航", "Main navigation")}>
          <button
            className={view === "task" ? "selected" : ""}
            onClick={() => {
              setDemo(false);
              setView("task");
            }}
          >
            <LayoutDashboard size={18} />
            {I18nT("工作台", "Workspace")}
            {runningCount > 0 && (
              <span className="nav-count">{runningCount}</span>
            )}
          </button>
          <button
            className={view === "records" ? "selected" : ""}
            onClick={() => {
              setDemo(false);
              setView("records");
            }}
          >
            <FileClock size={18} />
            {I18nT("需求记录", "Records")}
            <span className="nav-count">{data.tasks.length}</span>
          </button>
        </nav>
        <div className="nav-section-label">
          {I18nT("接入项目", "Connected projects")}
        </div>
        <div className="sidebar-projects">
          {data.settings.projects.map((p) => (
            <button
              key={p.id}
              title={p.directory || p.name}
              onClick={() => {
                setDemo(false);
                setView("settings");
                setSettingsTab("developer");
              }}
            >
              <FolderGit2 size={16} />
              <span>{p.name}</span>
              <span
                className={`project-dot ${p.directory ? "configured" : ""}`}
              />
            </button>
          ))}
        </div>
        {data.tasks.length > 0 && (
          <>
            <div className="nav-section-label">
              {I18nT("最近任务", "Recent tasks")}
            </div>
            <div className="recent-tasks">
              {[...data.tasks]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 4)
                .map((t) => (
                  <button
                    key={t.id}
                    className={
                      selected === t.id && view === "task" ? "selected" : ""
                    }
                    onClick={() => openTask(t)}
                  >
                    <span
                      className={`tiny-dot ${activeStatuses.includes(t.status) ? "pulse" : ""}`}
                    />
                    <span>{t.title}</span>
                  </button>
                ))}
            </div>
          </>
        )}
        <div className="sidebar-bottom">
          <button
            className={view === "settings" ? "selected" : ""}
            onClick={() => {
              setDemo(false);
              setView("settings");
              setSettingsTab("developer");
            }}
          >
            <Settings2 size={18} />
            {I18nT("开发配置", "Settings")}
          </button>
          <button
            className={demo ? "selected" : ""}
            onClick={() => {
              setDemo(true);
            }}
          >
            <CirclePlay size={18} />
            {I18nT("演示示例", "Demo example")}
          </button>
          <div className="device-state">
            <span
              className={`project-dot ${window.studio ? "configured" : ""}`}
            />
            {window.studio
              ? I18nT("本地桌面客户端", "Local desktop app")
              : I18nT("浏览器预览", "Browser preview")}
            <small>v{data.environment.version}</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <main
          className={
            view === "task" && !showRun
              ? "task-intake"
              : view === "task" && showRun
                ? "compact-workspace run-workspace"
                : view === "records" || view === "settings"
                  ? "compact-workspace"
                  : undefined
          }
        >
          <div className="content">
            <div>
              {!window.studio && (
                <Notice>
                  <strong>
                    {I18nT("浏览器预览模式", "Browser preview mode")}
                  </strong>{" "}
                  ·{" "}
                  {I18nT(
                    "本地客户端能力仅在桌面应用中可用。当前页面可查看界面与主题，执行、导入和保存已禁用。",
                    "Native features are available only in the desktop app. Browse the interface and preview themes here; execution, import and saving are disabled.",
                  )}
                </Notice>
              )}
              <div hidden={view !== "task"}>
                {showRun ? (
                  <RunView
                    task={current}
                    onTask={taskResult}
                    report={report}
                    edit={() => setEdit(true)}
                  />
                ) : (
                  <TaskEditor
                    key={selected || `new-${newKey}`}
                    task={current}
                    settings={data.settings}
                    onTask={taskResult}
                    report={report}
                    openSettings={() => setView("settings")}
                  />
                )}
              </div>
              {view === "records" && (
                <Records
                  tasks={data.tasks}
                  settings={data.settings}
                  open={openTask}
                  create={create}
                />
              )}
              {view === "settings" && (
                <SettingsView
                  key={`settings-${settingsTab}`}
                  settings={data.settings}
                  environment={data.environment}
                  onSave={saveSettings}
                  report={report}
                  initialTab={settingsTab}
                />
              )}
              <div className="workspace-footer">
                <span>
                  OpenDesign <ArrowUpRight size={11} /> Tyflow
                </span>
                <span>
                  <CircleHelp size={12} />
                  {I18nT(
                    "计划可预览 · 过程可追溯 · 结果可验收",
                    "Review plans · Trace execution · Accept outcomes",
                  )}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
      {edit && current && (
        <Modal
          title={I18nT("执行需求快照", "Execution requirement snapshot")}
          close={() => setEdit(false)}
        >
          <h3>{current.title}</h3>
          <p className="prewrap">
            {current.snapshot?.description || current.description}
          </p>
          <Notice>
            {I18nT(
              "本次执行内容已锁定。如需修改需求，请新建任务；当前任务可在解决问题后重试。",
              "This execution is frozen. Create a new task to change the requirement, or retry this task after resolving its issue.",
            )}
          </Notice>
          <button className="primary" onClick={create}>
            <Plus size={16} />
            {I18nT("新建任务", "New task")}
          </button>
        </Modal>
      )}
      {demo && (
        <div
          className="demo-video-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={I18nT("TingYun Studio 演示视频", "TingYun Studio demo video")}
        >
          <div className="demo-video-dialog">
            <button
              className="demo-video-close"
              aria-label={I18nT("关闭演示视频", "Close demo video")}
              title={I18nT("关闭", "Close")}
              onClick={() => setDemo(false)}
            >
              <X size={22} />
            </button>
            <video
              src={
                data.settings.language === "en-US"
                  ? demoVideoEnUrl
                  : demoVideoZhUrl
              }
              autoPlay
              controls
              playsInline
            />
          </div>
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label={I18nT("关闭提示", "Dismiss notification")}
            onClick={() => setToast(undefined)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
