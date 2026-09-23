import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import {
  ArrowRight,
  Ban,
  Bug,
  Check,
  Code2,
  FileArchive,
  FileText,
  ExternalLink,
  GitBranch,
  Loader2,
  RefreshCw,
  Save,
  UploadCloud,
  X,
} from "lucide-react";
import type {
  FileAsset,
  AssetDiff,
  RepositoryInfo,
  Settings,
  Task,
  TaskInput,
  TaskKind,
  StudioAPI,
  ZenTaoItem,
} from "../shared/contracts";
import { activeStatuses, Field, Notice, Modal, PlanDialog } from "./components";
import { I18nT } from "./i18n";
import AttachmentImages from "./AttachmentImages";
import BranchSelection from "./BranchSelection";
interface Props {
  api?: StudioAPI;
  simulated?: boolean;
  task?: Task;
  settings: Settings;
  onTask: (task: Task) => void;
  report: (message: string, error?: boolean) => void;
  openSettings: () => void;
}
function suggestedBranch() {
  return `feat/studio-${new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14)}`;
}
function inputFromTask(task: Task): TaskInput {
  return {
    title: task.title,
    kind: task.kind,
    size: task.size,
    description: task.description,
    projectId: task.projectId,
    assetIds: task.assetIds,
    branch: { ...task.branch, version: "" },
    autoTest: task.kind === "bug" ? false : task.autoTest,
    zentao: task.zentao ? { ...task.zentao } : undefined,
  };
}
export default function TaskEditor({
  api = window.studio,
  simulated = false,
  task,
  settings,
  onTask,
  report,
  openSettings,
}: Props) {
  const [input, setInput] = useState<TaskInput>(() =>
    task
      ? inputFromTask(task)
      : {
          title: "",
          description: "",
          kind: "design",
          size: "medium",
          projectId:
            settings.developer.defaultProject || settings.projects[0]?.id || "",
          assetIds: [],
          branch: {
            mode:
              settings.projects.find(
                (p) => p.id === settings.developer.defaultProject,
              )?.defaultBranchMode || "new",
            base: "",
            name: suggestedBranch(),
            version: "",
          },
          autoTest: true,
          zentao: undefined,
        },
  );
  const [assets, setAssets] = useState<FileAsset[]>(task?.assets || []);
  const [designUpdate, setDesignUpdate] = useState<{
    previous: FileAsset;
    incoming: FileAsset;
    diff: AssetDiff;
  }>();
  const [repo, setRepo] = useState<RepositoryInfo>();
  const [repoError, setRepoError] = useState("");
  const [repoBusy, setRepoBusy] = useState(false);
  const [zentaoItems, setZentaoItems] = useState<ZenTaoItem[]>([]);
  const [zentaoBusy, setZentaoBusy] = useState(false);
  const [repoRevision, setRepoRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [edited, setEdited] = useState(false);
  const [dialog, setDialog] = useState<"plan" | "tests">();
  const [editMode, setEditMode] = useState(false);
  const [planFeedback, setPlanFeedback] = useState("");
  const [dirtyAction, setDirtyAction] = useState<
    "analyze" | "develop" | "fix"
  >();
  const [dirtyConfirmed, setDirtyConfirmed] = useState(false);
  const pasteLock = useRef(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const project = settings.projects.find((p) => p.id === input.projectId);
  const native = Boolean(api);
  const running = Boolean(task && activeStatuses.includes(task.status));
  const confirm = Boolean(task?.plan && !editMode);
  const selectedRemote = repo?.remoteBranches?.find(
    (b) => b.ref === input.branch.base,
  );
  const selectedLocal =
    !selectedRemote || input.branch.mode === "existing"
      ? repo?.branchStates?.find(
          (b) => b.name === (selectedRemote?.branch || input.branch.base),
        )
      : undefined;
  const upstream = repo?.remoteBranches?.find(
    (b) => b.ref === selectedLocal?.upstream,
  );
  const selectedTip =
    selectedRemote && !(input.branch.mode === "existing" && selectedLocal)
      ? selectedRemote.commit
      : selectedLocal?.behind
        ? upstream?.commit
        : selectedLocal?.commit;
  const targetChanged = Boolean(
    task?.plan && selectedTip && selectedTip !== task.targetCommit,
  );
  const branchChanged = Boolean(
    task?.plan &&
    (targetChanged ||
      input.branch.mode !== task.branch.mode ||
      input.branch.base !== task.branch.base ||
      input.branch.name !== task.branch.name),
  );
  const patch = (value: Partial<TaskInput>, changesSource = false) => {
    setInput((prev) => ({ ...prev, ...value }));
    setEdited(true);
    if (changesSource) setEditMode(true);
  };
  useEffect(() => {
    if (task && !edited) {
      setInput(inputFromTask(task));
      setAssets(task.assets);
    }
  }, [task, edited]);
  useEffect(() => {
    let valid = true;
    setRepo(undefined);
    setRepoError("");
    if (!api || !input.projectId) return;
    setRepoBusy(true);
    api
      .repository(input.projectId, true)
      .then((result) => {
        if (!valid) return;
        setRepo(result);
        setRepoError(result.syncError || "");
        setInput((prev) => ({
          ...prev,
          branch: {
            ...prev.branch,
            base: prev.branch.base || result.branch,
            name:
              prev.branch.mode === "existing"
                ? result.remoteBranches?.find((b) => b.ref === prev.branch.base)
                    ?.branch ||
                  prev.branch.base ||
                  result.branch
                : prev.branch.name,
          },
        }));
      })
      .catch((error) => {
        if (valid) setRepoError(String(error.message || error));
      })
      .finally(() => {
        if (valid) setRepoBusy(false);
      });
    return () => {
      valid = false;
    };
  }, [api, input.projectId, settings.projects, repoRevision]);
  useEffect(() => {
    if (!api || task?.status !== "ready" || task.projectId !== input.projectId)
      return;
    let valid = true;
    // Assessment may fetch newer refs than the page initially loaded.
    void api
      .repository(input.projectId, false)
      .then((result) => {
        if (valid) {
          setRepo(result);
          setRepoError(result.syncError || "");
        }
      })
      .catch((error) => {
        if (valid) setRepoError(String(error.message || error));
      });
    return () => {
      valid = false;
    };
  }, [api, input.projectId, task?.projectId, task?.status, task?.planRevision]);
  async function loadZentaoItems(silent = false) {
    if (!api || !settings.zentao.enabled) return;
    setZentaoBusy(true);
    try {
      setZentaoItems((await api.zentaoCatalog()).items);
    } catch (error) {
      if (!silent) report((error as Error).message, true);
    } finally {
      setZentaoBusy(false);
    }
  }
  useEffect(() => {
    void loadZentaoItems(true);
  }, [api, settings.zentao.enabled]);
  async function importFiles(kind: "design" | "attachment", files?: FileList) {
    if (busy || running) return;
    if (!api)
      return report(
        I18nT("请在桌面客户端导入文件。", "Import files in the desktop app."),
        true,
      );
    setBusy(true);
    try {
      if (kind === "design" && files && files.length > 1)
        throw new Error(
          I18nT(
            "每次请选择一个设计 ZIP 或 HTML 文件。",
            "Choose one design ZIP or HTML file at a time.",
          ),
        );
      const paths = files
        ? Array.from(files)
            .map((f) => api!.pathForFile(f))
            .filter(Boolean)
        : undefined;
      if (files && !paths?.length)
        throw new Error(
          I18nT(
            "无法读取文件路径，请点击选择文件。",
            "File paths unavailable. Use the file picker.",
          ),
        );
      const incoming = await api.importFiles(kind, paths);
      if (!incoming.length) return;
      if (kind === "design") {
        if (incoming.length !== 1)
          throw new Error(
            I18nT(
              "每次请选择一个设计 ZIP 或 HTML 文件。",
              "Choose one design ZIP or HTML file at a time.",
            ),
          );
        const previous = assets.find((asset) => asset.kind === "design");
        if (previous) {
          if (previous.sha256 === incoming[0].sha256) {
            report(
              I18nT(
                "该设计与当前版本相同，无需替换。",
                "The imported design matches the current version; no replacement is needed.",
              ),
            );
            return;
          }
          const diff = await api.compareDesigns(previous.id, incoming[0].id);
          setDesignUpdate({ previous, incoming: incoming[0], diff });
          return;
        }
      }
      const merged = [...assets];
      for (const asset of incoming)
        if (!merged.some((a) => a.sha256 === asset.sha256)) merged.push(asset);
      setAssets(merged);
      patch({ assetIds: merged.map((a) => a.id) }, true);
      if (incoming.length)
        report(
          I18nT(
            "设计文件已识别，选择项目和分支后即可评估。",
            "Design files inspected. Select a project and branch to start assessment.",
          ),
        );
    } catch (error) {
      report(String((error as Error).message), true);
    } finally {
      setBusy(false);
    }
  }
  function removeAttachment(id: string) {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
    setInput((prev) => ({
      ...prev,
      assetIds: prev.assetIds.filter((value) => value !== id),
    }));
    setEdited(true);
    setEditMode(true);
  }
  async function pasteImages(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!files.length) return; // Leave ordinary text paste to the browser.
    event.preventDefault();
    if (busy || running || pasteLock.current) return;
    if (!api)
      return report(
        I18nT(
          "请在桌面客户端粘贴截图。",
          "Paste screenshots in the desktop app.",
        ),
        true,
      );
    const text = event.clipboardData.getData("text/plain");
    if (text) {
      const area = event.currentTarget;
      patch(
        {
          description:
            area.value.slice(0, area.selectionStart) +
            text +
            area.value.slice(area.selectionEnd),
        },
        true,
      );
    }
    if (files.length > 10 || files.some((file) => file.size > 20 * 1024 * 1024))
      return report(
        I18nT(
          "每次最多粘贴 10 张截图，单张不超过 20 MB。",
          "Paste up to 10 screenshots at a time, each up to 20 MB.",
        ),
        true,
      );
    if (input.assetIds.length + files.length > 30)
      return report(
        I18nT(
          "每个任务最多保留 30 个文件，请先移除不需要的附件。",
          "Each task supports up to 30 files. Remove unused attachments first.",
        ),
        true,
      );
    pasteLock.current = true;
    setBusy(true);
    try {
      for (const file of files) {
        const asset = await api.importImage(
          new Uint8Array(await file.arrayBuffer()),
        );
        setAssets((prev) =>
          prev.some((a) => a.id === asset.id) ? prev : [...prev, asset],
        );
        setInput((prev) => ({
          ...prev,
          assetIds: prev.assetIds.includes(asset.id)
            ? prev.assetIds
            : [...prev.assetIds, asset.id],
        }));
        setEdited(true);
        setEditMode(true);
      }
      report(
        I18nT(
          "截图已加入，可继续补充描述并保存。",
          "Screenshots added. Continue describing the issue and save.",
        ),
      );
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      pasteLock.current = false;
      setBusy(false);
      requestAnimationFrame(() => descriptionRef.current?.focus());
    }
  }
  async function save(analyze = false, allowDirty = false) {
    if (!api) return;
    setBusy(true);
    try {
      const prepared =
        input.kind === "bug" && !input.title.trim()
          ? {
              ...input,
              title:
                input.description.trim().split(/\r?\n/)[0].slice(0, 80) ||
                I18nT("Bug 修复", "Bug fix"),
            }
          : input;
      const saved = await api.saveTask(prepared, task?.id);
      setEdited(false);
      setEditMode(false);
      onTask(saved);
      if (analyze)
        onTask(
          await api.taskAction(saved.id, "analyze", { allowDirty }),
        );
      else report(I18nT("草稿已保存", "Draft saved"));
    } catch (error) {
      report(String((error as Error).message), true);
    } finally {
      setBusy(false);
    }
  }
  async function develop(allowDirty = false) {
    if (!api || !task) return;
    setBusy(true);
    try {
      const saved = await api.saveTask(input, task.id);
      setEdited(false);
      onTask(saved);
      onTask(await api.taskAction(saved.id, "develop", { allowDirty }));
    } catch (error) {
      report(String((error as Error).message), true);
    } finally {
      setBusy(false);
    }
  }
  async function revisePlan() {
    if (!api || !task || !planFeedback.trim()) return;
    setBusy(true);
    try {
      const notes = planFeedback.trim();
      onTask(
        await api.taskAction(task.id, "analyze", {
          planFeedback: notes,
        }),
      );
      setPlanFeedback("");
      if (simulated) {
        report(
          I18nT(
            "正在按意见重生成演示计划与用例…",
            "Regenerating the demo plan and cases from your notes…",
          ),
        );
      }
    } catch (error) {
      report(String((error as Error).message), true);
    } finally {
      setBusy(false);
    }
  }
  async function fix(allowDirty = false) {
    if (!api) return;
    setBusy(true);
    try {
      const saved = await api.saveTask(
        {
          ...input,
          title:
            input.title.trim() ||
            input.description.trim().split(/\r?\n/)[0].slice(0, 80) ||
            I18nT("Bug 修复", "Bug fix"),
        },
        task?.id,
      );
      setEdited(false);
      setEditMode(false);
      onTask(saved);
      onTask(await api.taskAction(saved.id, "fix", { allowDirty }));
    } catch (error) {
      report(String((error as Error).message), true);
    } finally {
      setBusy(false);
    }
  }
  function continueAction(action: "analyze" | "develop" | "fix") {
    if (repo?.dirty) {
      setDirtyConfirmed(false);
      setDirtyAction(action);
      return;
    }
    if (action === "develop") void develop();
    else if (action === "fix") void fix();
    else void save(true);
  }
  function confirmDirtyAction() {
    if (!dirtyAction || !dirtyConfirmed) return;
    const action = dirtyAction;
    setDirtyAction(undefined);
    setDirtyConfirmed(false);
    if (action === "develop") void develop(true);
    else if (action === "fix") void fix(true);
    else void save(true, true);
  }
  const sourceOptions: {
    key: TaskKind;
    title: string;
    icon: typeof FileText;
  }[] = [
    {
      key: "design",
      title: I18nT("OpenDesign 设计", "OpenDesign design"),
      icon: FileArchive,
    },
    { key: "text", title: I18nT("文字需求", "Text request"), icon: FileText },
    { key: "bug", title: I18nT("Bug 修复", "Bug fix"), icon: Bug },
  ];
  return (
    <>
      {running && (
        <Notice>
          <Loader2 className="spin" size={16} />{" "}
          {input.kind === "bug"
            ? I18nT(
                "Codex 正在所选分支定位并修复 Bug。",
                "Codex is diagnosing and fixing the Bug on the selected branch.",
              )
            : I18nT(
                "Tyflow 正在读取需求和项目，生成开发计划及测试用例。",
                "Tyflow is assessing the requirement and repository to create the plan and test cases.",
              )}
        </Notice>
      )}
      {task?.error && <Notice tone="error">{task.error}</Notice>}
      {!confirm && repoError && (
        <Notice tone="error">
          {repoError}{" "}
          <button
            className="text-button"
            disabled={repoBusy}
            onClick={() => setRepoRevision((n) => n + 1)}
          >
            {I18nT("重新检查", "Check again")}
          </button>{" "}
          ·{" "}
          <button className="text-button" onClick={openSettings}>
            {I18nT("前往开发配置", "Open development settings")}
          </button>
        </Notice>
      )}
      <div className="repository-sync">
        <span>
          {repoBusy
            ? I18nT("正在同步远程分支…", "Syncing remote branches…")
            : repo?.syncedAt
              ? `${repo.syncRemote} · ${I18nT("最近同步：", "Last synced: ")}${new Date(repo.syncedAt).toLocaleString()}`
              : I18nT(
                  "尚未同步远程；本地缓存不代表最新版本。",
                  "Remote not synced; cached branches may be outdated.",
                )}
          {repo?.syncedAt &&
            !repoBusy &&
            ` · ${repo.remoteBranches?.filter((b) => b.remote === repo.syncRemote).length || 0} ${I18nT("个远程分支", "remote branches")}`}
        </span>
        <button
          className="text-button"
          disabled={repoBusy || running || !native}
          onClick={() => setRepoRevision((n) => n + 1)}
        >
          <RefreshCw size={13} className={repoBusy ? "spin" : undefined} />
          {I18nT("同步远程", "Sync remote")}
        </button>
      </div>
      {!confirm ? (
        <section className="panel intake-panel">
          <div className="intake-toolbar">
            <div
              className="tabs"
              role="tablist"
              aria-label={I18nT("任务来源", "Task source")}
            >
              {sourceOptions.map(({ key, title, icon: Icon }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={input.kind === key}
                  disabled={running}
                  onClick={() =>
                    patch(
                      {
                        kind: key,
                        ...(key === "bug" ? { autoTest: false } : {}),
                      },
                      true,
                    )
                  }
                >
                  <Icon size={16} />
                  {title}
                </button>
              ))}
            </div>
            <label className="project-picker">
              {I18nT("所属项目", "Project")}
              <select
                disabled={running}
                value={input.projectId}
                onChange={(e) => {
                  const p = settings.projects.find(
                    (x) => x.id === e.target.value,
                  );
                  patch(
                    {
                      projectId: e.target.value,
                      branch: {
                        mode: p?.defaultBranchMode || "new",
                        base: "",
                        name:
                          p?.defaultBranchMode === "existing"
                            ? ""
                            : suggestedBranch(),
                        version: "",
                      },
                    },
                    true,
                  );
                }}
              >
                {settings.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {settings.zentao.enabled && (
            <div className="project-create-card">
              <div className="form-row">
                <Field
                  label={I18nT("关联我的禅道事项（可选）", "Link my ZenTao item (optional)")}
                  hint={I18nT(
                    "列表来自当前账号负责的任务和 Bug，无需填写 ID。",
                    "Loaded from tasks and bugs assigned to the current account; no ID entry needed.",
                  )}
                >
                  <select
                    disabled={running}
                    value={input.zentao ? `${input.zentao.type}:${input.zentao.id}` : ""}
                    onChange={(event) => {
                      const [type, id] = event.target.value.split(":");
                      patch({
                        zentao: id
                          ? { type: type as "task" | "bug", id }
                          : undefined,
                      });
                    }}
                  >
                    <option value="">{I18nT("不关联禅道事项", "Do not link an item")}</option>
                    {zentaoItems.map((item) => (
                      <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>
                        {item.type === "task" ? I18nT("任务", "Task") : "Bug"} #{item.id} · {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={I18nT("禅道条目", "ZenTao item")}>
                  <div className="input-action">
                    <button type="button" disabled={zentaoBusy || running} onClick={() => void loadZentaoItems()}>
                      {zentaoBusy ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                      {I18nT("刷新列表", "Refresh list")}
                    </button>
                    <button
                      type="button"
                      disabled={!native || !input.zentao?.id}
                      onClick={() =>
                        input.zentao && void api?.openZentao(input.zentao.type, input.zentao.id)
                      }
                    >
                      <ExternalLink size={15} />
                      {I18nT("打开", "Open")}
                    </button>
                  </div>
                </Field>
              </div>
            </div>
          )}
          <fieldset className="plain-fieldset" disabled={running || busy}>
            {input.kind !== "bug" && (
              <div className="form-row">
                <Field label={I18nT("任务名称", "Task name")}>
                  <input
                    maxLength={160}
                    placeholder={I18nT(
                      "例如：优化告警规则筛选体验",
                      "For example: Improve alert rule filtering",
                    )}
                    value={input.title}
                    onChange={(e) => patch({ title: e.target.value }, true)}
                  />
                </Field>
              </div>
            )}
            {input.kind === "design" && (
              <div
                className={`dropzone ${drag ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  void importFiles("design", e.dataTransfer.files);
                }}
              >
                <div className="upload-icon">
                  <UploadCloud size={25} />
                </div>
                <strong>
                  {I18nT(
                    "将设计交付文件拖到这里",
                    "Drop design handoff files here",
                  )}
                </strong>
                <p>
                  {I18nT(
                    "支持 OpenDesign 导出的 ZIP、HTML，识别页面与资源后进入评估。",
                    "Import exported ZIP or HTML files. Inspect pages and assets before assessment.",
                  )}
                </p>
                <button
                  type="button"
                  disabled={!native}
                  onClick={() => void importFiles("design")}
                >
                  <FileArchive size={15} />
                  {I18nT("选择设计文件", "Choose design files")}
                </button>
              </div>
            )}
            {assets
              .filter((a) => a.kind === "design")
              .map((a) => (
                <div className="asset-card" key={a.id}>
                  <div className="asset-heading">
                    <FileArchive size={19} />
                    <div>
                      <strong>{a.name}</strong>
                      <small>
                        {Math.max(1, Math.round(a.size / 1024))} KB ·{" "}
                        {a.pages?.length || 0} {I18nT("个页面", "pages")}
                      </small>
                    </div>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() =>
                        api
                          ?.previewAsset(a.id)
                          .catch((e) => report(e.message, true))
                      }
                    >
                      {I18nT("预览设计", "Preview design")}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={I18nT("移除文件", "Remove file")}
                      onClick={() => {
                        setAssets((prev) => prev.filter((x) => x.id !== a.id));
                        patch(
                          {
                            assetIds: input.assetIds.filter(
                              (id) => id !== a.id,
                            ),
                          },
                          true,
                        );
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p>{a.summary}</p>
                  <details>
                    <summary>
                      {I18nT(
                        "查看识别到的页面与文件",
                        "Inspect recognized pages and files",
                      )}
                    </summary>
                    <ul className="file-list">
                      {(a.pages || a.entries || []).slice(0, 40).map((page) => (
                        <li key={page}>
                          <button
                            className="text-button"
                            onClick={() =>
                              api
                                ?.previewAsset(a.id, page)
                                .catch((e) => report(e.message, true))
                            }
                          >
                            {page}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              ))}
            {input.kind !== "design" && (
              <Field
                label={
                  input.kind === "bug"
                    ? I18nT(
                        "问题描述与复现步骤",
                        "Problem and reproduction steps",
                      )
                    : I18nT("需求说明", "Requirement description")
                }
                hint={
                  input.kind === "bug"
                    ? I18nT(
                        "建议包含实际表现、预期结果、出现页面和操作步骤。支持 Ctrl+V / ⌘V 粘贴截图，点击截图可放大。",
                        "Include actual and expected behavior, page and reproduction steps. Paste screenshots with Ctrl+V / ⌘V; click to enlarge.",
                      )
                    : I18nT(
                        "说明需要改什么、预期效果和验收标准；支持 Ctrl+V / ⌘V 粘贴截图。",
                        "Describe the change, intended outcome and acceptance criteria. Paste screenshots with Ctrl+V / ⌘V.",
                      )
                }
              >
                <div className="description-with-images">
                  <textarea
                    ref={descriptionRef}
                    className="main-input"
                    value={input.description}
                    onPaste={(event) => void pasteImages(event)}
                    onChange={(e) =>
                      patch({ description: e.target.value }, true)
                    }
                    placeholder={
                      input.kind === "bug"
                        ? I18nT(
                            "在哪个页面遇到了什么问题？怎样可以重现？",
                            "Where does the issue occur, and how can it be reproduced?",
                          )
                        : I18nT(
                            "描述你想完成的事情…",
                            "Describe what you want to achieve…",
                          )
                    }
                  />
                  <AttachmentImages
                    assets={assets}
                    api={api}
                    remove={removeAttachment}
                    report={report}
                  />
                </div>
              </Field>
            )}
            <BranchSelection
              input={input}
              repo={repo}
              disabled={running || busy || repoBusy}
              settings={settings}
              patch={(value) => patch(value)}
            />
          </fieldset>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>
                  {I18nT(
                    "评估完成，确认后开始开发",
                    "Assessment ready. Confirm to start development.",
                  )}
                </h2>
                <p>
                  {I18nT(
                    "先预览开发计划和测试用例，再确认本次执行范围。",
                    "Review the plan and test cases, then confirm the execution scope.",
                  )}
                </p>
              </div>
              <button
                className="text-button"
                disabled={running}
                onClick={() => setEditMode(true)}
              >
                {I18nT("修改需求", "Edit requirement")}
              </button>
            </div>
            <div className="task-summary">
              <p className="prewrap">{task?.plan?.summary}</p>
              <div className="document-buttons">
                <button onClick={() => setDialog("plan")}>
                  <FileText size={16} />
                  {I18nT("预览开发计划", "Preview plan")}
                  <span className="button-count">
                    {task?.plan?.steps.length}
                  </span>
                </button>
                <button onClick={() => setDialog("tests")}>
                  <Check size={16} />
                  {I18nT("查看测试用例", "View test cases")}
                  <span className="button-count">
                    {task?.plan?.testCases.length}
                  </span>
                </button>
              </div>
            </div>
            {task?.plan?.blockers.length ? (
              <Notice tone="error">
                <strong>
                  {I18nT("以下问题需要先解决", "Resolve these blockers first")}
                </strong>
                <ul>
                  {task.plan.blockers.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
            <div className="plan-revision">
              {simulated && (
                <Notice>
                  {I18nT(
                    "演示也可体验：填写计划/用例修改意见后点重生成，会模拟修订后的计划与新增验收用例。",
                    "The demo supports this too. Enter plan/test revision notes and regenerate to simulate an updated plan and an extra acceptance case.",
                  )}
                </Notice>
              )}
              <Field
                label={I18nT(
                  "计划 / 用例修改意见",
                  "Plan / test-case revision notes",
                )}
                hint={I18nT(
                  "不改原始需求，只说明开发计划或测试用例哪里不满意，例如步骤范围、实现方式、遗漏用例。",
                  "Keep the original requirement. Describe what to change in the plan or test cases, such as scope, approach, or missing coverage.",
                )}
              >
                <textarea
                  className="main-input"
                  rows={4}
                  disabled={running || busy}
                  value={planFeedback}
                  onChange={(e) => setPlanFeedback(e.target.value)}
                  placeholder={I18nT(
                    "例如：第 2 步不要改公共组件；测试用例补充移动端与权限校验；风险里写清楚回滚方式。",
                    "Example: do not touch shared components in step 2; add mobile and permission cases; include rollback risks.",
                  )}
                />
              </Field>
              <button
                disabled={
                  running ||
                  busy ||
                  !native ||
                  !planFeedback.trim() ||
                  !task?.plan
                }
                onClick={() => void revisePlan()}
              >
                {busy ? (
                  <Loader2 className="spin" size={15} />
                ) : (
                  <RefreshCw size={15} />
                )}
                {I18nT(
                  "按意见重生成计划与用例",
                  "Regenerate plan and cases from notes",
                )}
              </button>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>
                <GitBranch size={18} />
                {I18nT("项目与开发分支", "Project and development branch")}
              </h2>
              <div className="actions">
                <button className="text-button" onClick={openSettings}>
                  {I18nT("开发配置", "Development settings")}
                </button>
              </div>
            </div>
            <div className="project-summary">
              <div>
                <small>{I18nT("项目", "Project")}</small>
                <strong>{project?.name}</strong>
              </div>
              <div>
                <small>{I18nT("本地目录", "Local directory")}</small>
                <span className="mono">
                  {project?.directory || I18nT("尚未配置", "Not configured")}
                </span>
              </div>
            </div>
            {repoBusy && (
              <p className="muted">
                <Loader2 size={14} className="spin" />
                {I18nT("正在读取仓库…", "Reading repository…")}
              </p>
            )}
            {repoError && <Notice tone="error">{repoError}</Notice>}
            {repo?.dirty && (
              <Notice tone="error">
                {I18nT(
                  "工作区存在未提交修改。请先自行处理后重新评估，本次开发不会覆盖已有修改。",
                  "The working tree has changes. Resolve them and reassess before development.",
                )}
              </Notice>
            )}
            <fieldset className="branch-choice" disabled>
              <legend>{I18nT("选择开发方式", "Development mode")}</legend>
              <div className="branch-modes">
                {(["new", "existing"] as const).map((mode) => (
                  <label
                    key={mode}
                    className={input.branch.mode === mode ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="branch-mode"
                      checked={input.branch.mode === mode}
                      onChange={() =>
                        patch({
                          branch: {
                            ...input.branch,
                            mode,
                            base:
                              mode === "existing"
                                ? repo?.branch || ""
                                : input.branch.base,
                            name:
                              mode === "existing"
                                ? repo?.branch || ""
                                : suggestedBranch(),
                          },
                        })
                      }
                    />
                    <span>
                      <strong>
                        {mode === "new"
                          ? I18nT("新建分支开发", "Create a new branch")
                          : I18nT("在原有分支开发", "Use an existing branch")}
                      </strong>
                      <small>
                        {mode === "new"
                          ? I18nT(
                              "从指定基线创建独立分支",
                              "Create an isolated branch from a selected base",
                            )
                          : I18nT(
                              "选择已有分支，直接继续开发",
                              "Continue development on the selected branch",
                            )}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-row">
              <Field
                label={
                  input.branch.mode === "new"
                    ? I18nT("基线分支", "Base branch")
                    : I18nT("开发分支", "Development branch")
                }
              >
                <select
                  disabled
                  value={input.branch.base}
                  onChange={(e) =>
                    patch({
                      branch: {
                        ...input.branch,
                        base: e.target.value,
                        ...(input.branch.mode === "existing"
                          ? {
                              name:
                                repo?.remoteBranches?.find(
                                  (b) => b.ref === e.target.value,
                                )?.branch || e.target.value,
                            }
                          : {}),
                      },
                    })
                  }
                >
                  <option value="">
                    {I18nT("请选择分支", "Select a branch")}
                  </option>
                  <optgroup label={I18nT("本地分支", "Local branches")}>
                    {repo?.branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                        {b === repo.branch
                          ? ` (${I18nT("当前", "current")})`
                          : ""}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={I18nT("远程分支", "Remote branches")}>
                    {repo?.remoteBranches
                      ?.filter(
                        (b) => !repo.syncRemote || b.remote === repo.syncRemote,
                      )
                      .map((b) => (
                        <option key={b.ref} value={b.ref}>
                          {b.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </Field>
              {input.branch.mode === "new" && (
                <Field label={I18nT("新分支名称", "New branch name")}>
                  <input
                    disabled
                    placeholder="feature/my-change"
                    value={input.branch.name}
                    onChange={(e) =>
                      patch({
                        branch: { ...input.branch, name: e.target.value },
                      })
                    }
                  />
                </Field>
              )}
            </div>
            {selectedRemote && input.branch.mode === "existing" && (
              <Notice>
                {I18nT(
                  "确认开发时会使用对应的本地跟踪分支：",
                  "Development will use the corresponding local tracking branch: ",
                )}
                {selectedRemote.branch}
              </Notice>
            )}
            {selectedLocal && (
              <Notice
                tone={
                  selectedLocal.upstreamMissing ||
                  (selectedLocal.ahead > 0 && selectedLocal.behind > 0)
                    ? "error"
                    : "info"
                }
              >
                {selectedLocal.upstreamMissing
                  ? I18nT(
                      "上游分支已删除，请重新选择分支。",
                      "The upstream branch was deleted. Choose another branch.",
                    )
                  : selectedLocal.ahead > 0 && selectedLocal.behind > 0
                    ? I18nT(
                        "本地和远程已经分叉，请自行处理后重新评估。",
                        "Local and remote histories diverged. Resolve them and reassess.",
                      )
                    : selectedLocal.behind > 0
                      ? `${I18nT("本地落后", "Local branch is behind by ")} ${selectedLocal.behind} ${I18nT("个提交；评估采用上游最新版本，确认开发时仅允许快进。", "commits. Assessment uses the upstream tip; development only permits fast-forward updates.")}`
                      : selectedLocal.ahead > 0
                        ? `${I18nT("本地领先", "Local branch is ahead by ")} ${selectedLocal.ahead} ${I18nT("个提交，将保留本地提交。", "commits; local commits will be preserved.")}`
                        : selectedLocal.upstream
                          ? I18nT(
                              "本地分支与已同步的上游一致。",
                              "The local branch matches the cached upstream.",
                            )
                          : I18nT(
                              "该本地分支没有上游；如需远端最新版本，请选择远程分支。",
                              "This local branch has no upstream. Select a remote branch to use the remote tip.",
                            )}
              </Notice>
            )}
            {branchChanged && (
              <Notice>
                {I18nT(
                  "开发分支已变更，需要重新评估后才能开始开发。",
                  "The development branch changed. Reassess before starting development.",
                )}
              </Notice>
            )}
            {input.kind !== "bug" && (
              <div className="test-setting">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    disabled
                    checked={input.autoTest}
                    onChange={(e) => patch({ autoTest: e.target.checked })}
                  />
                  <span>
                    <strong>
                      {I18nT("自动化测试介入", "Include automated testing")}
                    </strong>
                    <small>
                      {I18nT(
                        "开发完成后执行检查和测试 Skill，结果与日志进入本次记录。",
                        "Run checks and the test skill after development; retain results and logs.",
                      )}
                    </small>
                  </span>
                </label>
                <span className="subtle-code">
                  {settings.agent.testSkill
                    .replace(/\\/g, "/")
                    .split("/")
                    .slice(-2, -1)[0] || I18nT("测试 Skill", "Test skill")}
                </span>
              </div>
            )}
          </section>
        </>
      )}
      {task && task.logs.length > 0 && (
        <details className="panel">
          <summary>{I18nT("评估日志", "Assessment logs")}</summary>
          <div className="log-output">
            {task.logs.slice(-100).map((entry, index) => (
              <div className={`log-line ${entry.level}`} key={index}>
                <time>{new Date(entry.time).toLocaleTimeString()}</time>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="actionbar">
        <div>
          <span className="action-hint">
            <Code2 size={16} />
            {simulated
              ? I18nT(
                  "演示操作仅改变模拟状态，不执行真实开发。",
                  "Demo actions only change simulated state; no real development runs.",
                )
              : confirm
                ? I18nT(
                    "确认后锁定计划与版本，开始实际开发。",
                    "Confirmation freezes the plan and version and starts real development.",
                  )
                : input.kind === "bug"
                  ? I18nT(
                      "直接调用 Codex 在所选分支定位、修复并完成必要检查，然后启动项目供你验收。",
                      "Call Codex directly to diagnose, fix and run required checks on the selected branch, then launch the project for review.",
                    )
                  : I18nT(
                      "将基于所选分支进行只读评估，不修改代码。",
                      "Run a read-only assessment against the selected branch without modifying code.",
                    )}
          </span>
        </div>
        <div className="actions">
          {running ? (
            <button
              onClick={() =>
                task &&
                api
                  ?.taskAction(task.id, "stop")
                  .then(onTask)
                  .catch((e) => report(e.message, true))
              }
            >
              {input.kind === "bug"
                ? I18nT("停止修复", "Stop fixing")
                : I18nT("停止评估", "Stop assessment")}
            </button>
          ) : (
            <>
              <button
                disabled={
                  busy ||
                  !native ||
                  (input.kind !== "bug" && !input.title.trim()) ||
                  (input.kind === "bug" && !input.description.trim())
                }
                onClick={() => void save()}
              >
                <Save size={15} />
                {I18nT("保存草稿", "Save draft")}
              </button>
              {confirm ? (
                <button
                  className="primary"
                  disabled={
                    busy ||
                    repoBusy ||
                    Boolean(repoError) ||
                    !native ||
                    (!branchChanged && Boolean(task?.plan?.blockers.length)) ||
                    !repo ||
                    !input.branch.name
                  }
                  onClick={() =>
                    branchChanged
                      ? continueAction("analyze")
                      : continueAction("develop")
                  }
                >
                  {busy ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  {branchChanged
                    ? I18nT("按所选分支重新评估", "Reassess selected branch")
                    : I18nT("确认并开始开发", "Confirm and develop")}
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={
                    busy ||
                    repoBusy ||
                    Boolean(repoError) ||
                    !repo ||
                    !native ||
                    (input.kind !== "bug" && !input.title.trim()) ||
                    !input.branch.base ||
                    (input.branch.mode === "new" &&
                      !input.branch.name.trim()) ||
                    Boolean(selectedLocal?.upstreamMissing) ||
                    Boolean(selectedLocal?.ahead && selectedLocal?.behind) ||
                    (!input.description.trim() &&
                      !assets.some((a) => a.kind === "design"))
                  }
                  onClick={() =>
                    continueAction(input.kind === "bug" ? "fix" : "analyze")
                  }
                >
                  {busy ? (
                    <Loader2 className="spin" size={16} />
                  ) : task?.plan ? (
                    <RefreshCw size={16} />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  {input.kind === "bug"
                    ? I18nT("开始修复", "Start fixing")
                    : task?.plan
                      ? I18nT("重新评估", "Reassess")
                      : I18nT("开始评估", "Start assessment")}
                </button>
              )}
            </>
          )}
          {task && !["accepted", "stopped"].includes(task.status) && (
            <button
              disabled={busy || !native}
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
                void api
                  ?.taskAction(task.id, "terminate")
                  .then(onTask)
                  .catch((e) => report(e.message, true));
              }}
            >
              <Ban size={15} />
              {I18nT("终止", "Terminate")}
            </button>
          )}
        </div>
      </div>
      {dialog && task && (
        <PlanDialog
          task={task}
          tab={dialog}
          close={() => setDialog(undefined)}
        />
      )}
      {dirtyAction && (
        <Modal
          title={I18nT(
            "检测到未提交代码",
            "Uncommitted changes detected",
          )}
          close={() => {
            setDirtyAction(undefined);
            setDirtyConfirmed(false);
          }}
        >
          <Notice tone="error">
            {I18nT(
              "当前项目存在未提交修改。继续后，这些修改会保留在工作区，并可能与本次开发结果一起进入检查、提交和推送；切换分支发生冲突时操作仍会停止。",
              "This project has uncommitted changes. Continuing preserves them, but they may be included with this task in checks, commits, and pushes. The operation will still stop if switching branches conflicts.",
            )}
          </Notice>
          <label className="checkbox dirty-confirmation">
            <input
              type="checkbox"
              checked={dirtyConfirmed}
              onChange={(event) => setDirtyConfirmed(event.target.checked)}
            />
            <span>
              <strong>
                {I18nT(
                  "不管，我就要进行下一步",
                  "Continue anyway",
                )}
              </strong>
            </span>
          </label>
          <div className="actions modal-actions">
            <button
              onClick={() => {
                setDirtyAction(undefined);
                setDirtyConfirmed(false);
              }}
            >
              {I18nT("关闭", "Close")}
            </button>
            <button
              className="primary"
              disabled={!dirtyConfirmed}
              onClick={confirmDirtyAction}
            >
              <ArrowRight size={16} />
              {I18nT("继续下一步", "Continue")}
            </button>
          </div>
        </Modal>
      )}
      {designUpdate && (
        <Modal
          title={I18nT("确认设计版本变更", "Review design version changes")}
          close={() => setDesignUpdate(undefined)}
        >
          <div className="design-versions">
            <div>
              <small>{I18nT("当前设计", "Current design")}</small>
              <strong>{designUpdate.previous.name}</strong>
              <p className="mono">SHA256: {designUpdate.previous.sha256}</p>
            </div>
            <div>
              <small>{I18nT("待采用设计", "Proposed design")}</small>
              <strong>{designUpdate.incoming.name}</strong>
              <p className="mono">SHA256: {designUpdate.incoming.sha256}</p>
            </div>
          </div>
          <Notice>
            {I18nT(
              "以下对比来自实际文件内容。采用新版后需重新评估交互与开发影响，原有计划不能直接执行。",
              "These differences reflect actual file contents. Adopting the revision requires reassessment of behavior and implementation impact; the previous plan cannot be executed directly.",
            )}
          </Notice>
          <div className="design-diff-counts">
            <span>
              {I18nT("新增", "Added")}{" "}
              <strong>{designUpdate.diff.added.length}</strong>
            </span>
            <span>
              {I18nT("删除", "Removed")}{" "}
              <strong>{designUpdate.diff.removed.length}</strong>
            </span>
            <span>
              {I18nT("修改", "Changed")}{" "}
              <strong>{designUpdate.diff.changed.length}</strong>
            </span>
            <span>
              {I18nT("未变化", "Unchanged")}{" "}
              <strong>{designUpdate.diff.unchanged}</strong>
            </span>
          </div>
          {[
            { key: "added", title: I18nT("新增文件", "Added files") },
            { key: "removed", title: I18nT("删除文件", "Removed files") },
            { key: "changed", title: I18nT("修改文件", "Changed files") },
          ].map((group) => {
            const files =
              designUpdate.diff[group.key as "added" | "removed" | "changed"];
            return files.length ? (
              <details className="diff-file-group" key={group.key} open>
                <summary>
                  {group.title} ({files.length})
                </summary>
                <ul className="file-list">
                  {files.map((file) => (
                    <li className="mono" key={file}>
                      {file}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null;
          })}
          <div className="actions design-diff-actions">
            <button onClick={() => setDesignUpdate(undefined)}>
              {I18nT("保留当前", "Keep current")}
            </button>
            <button
              className="primary"
              onClick={() => {
                const next = [
                  ...assets.filter((asset) => asset.kind !== "design"),
                  designUpdate.incoming,
                ];
                setAssets(next);
                patch({ assetIds: next.map((asset) => asset.id) }, true);
                setDesignUpdate(undefined);
                report(
                  I18nT(
                    "已采用新版设计，请重新评估后确认执行。",
                    "Design revision adopted. Reassess before confirming execution.",
                  ),
                );
              }}
            >
              {I18nT("采用新版", "Adopt revision")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
