import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  FolderOpen,
  GitBranch,
  Link2,
  Loader2,
  BellRing,
  Palette,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UserRound,
  X,
} from "lucide-react";
import type {
  EnvironmentInfo,
  Project,
  Settings,
  SettingsInput,
  ZenTaoCatalog,
} from "../shared/contracts";
import { Field, Notice } from "./components";
import { I18nT } from "./i18n";
import { applyTheme, themeColor } from "./theme";
export default function SettingsView({
  settings,
  environment,
  onSave,
  report,
  initialTab = "developer",
}: {
  settings: Settings;
  environment: EnvironmentInfo;
  onSave: (value: Settings) => void;
  report: (message: string, error?: boolean) => void;
  initialTab?: string;
}) {
  const [draft, setDraft] = useState<SettingsInput>(() =>
    structuredClone(settings),
  );
  const [tab, setTab] = useState(initialTab);
  const [projectId, setProjectId] = useState(
    settings.developer.defaultProject || settings.projects[0]?.id || "",
  );
  const [busy, setBusy] = useState("");
  const [connection, setConnection] = useState<{
    ok: boolean;
    message: string;
  }>();
  const [customHex, setCustomHex] = useState(settings.theme);
  const [addingProject, setAddingProject] = useState(false);
  const [zentaoCatalog, setZentaoCatalog] = useState<ZenTaoCatalog>();
  const [newProject, setNewProject] = useState({
    id: "",
    name: "",
    directory: "",
    repository: "",
  });
  const project = draft.projects.find((p) => p.id === projectId);
  const native = Boolean(window.studio);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  useEffect(() => {
    applyTheme(draft.theme);
    return () => applyTheme(settings.theme);
  }, [draft.theme, settings.theme]);
  const projectPatch = (value: Partial<Project>) =>
    setDraft((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId ? { ...p, ...value } : p,
      ),
    }));
  const secret = (key: string, value: string) =>
    setDraft((prev) => ({
      ...prev,
      secrets: { ...prev.secrets, [key]: value },
    }));
  async function chooseDirectory(target: "current" | "new" = "current") {
    try {
      const dir = await window.studio?.chooseDirectory();
      if (!dir) return;
      if (target === "new")
        setNewProject((previous) => ({ ...previous, directory: dir }));
      else projectPatch({ directory: dir });
    } catch (error) {
      report((error as Error).message, true);
    }
  }
  function addProject() {
    const id = newProject.id.trim();
    const name = newProject.name.trim();
    const directory = newProject.directory.trim();
    const repository = newProject.repository.trim();
    if (!/^[\w-]{1,60}$/.test(id)) {
      report(
        I18nT(
          "项目 ID 只能包含字母、数字、下划线和短横线，最长 60 个字符。",
          "Project ID may contain only letters, numbers, underscores, and hyphens, up to 60 characters.",
        ),
        true,
      );
      return;
    }
    if (!name) {
      report(I18nT("请填写项目名称。", "Enter a project name."), true);
      return;
    }
    if (!directory) {
      report(
        I18nT("请选择本地项目目录。", "Choose a local project directory."),
        true,
      );
      return;
    }
    if (draft.projects.some((item) => item.id === id)) {
      report(I18nT("项目 ID 已存在。", "Project ID already exists."), true);
      return;
    }
    const created: Project = {
      id,
      name,
      directory,
      repository,
      auth: "system",
      username: "",
      startScript: "start:dev",
      targetUrl: "http://localhost:8000",
      defaultBranchMode: "new",
    };
    setDraft((previous) => ({
      ...previous,
      projects: [...previous.projects, created],
    }));
    setProjectId(id);
    setAddingProject(false);
    setNewProject({ id: "", name: "", directory: "", repository: "" });
    setConnection(undefined);
  }
  async function save() {
    if (!window.studio) return;
    setBusy("save");
    try {
      const result = await window.studio.saveSettings(draft);
      setDraft(structuredClone(result));
      onSave(result);
      report(I18nT("开发配置已保存", "Development settings saved"));
      if (tab === "developer") {
        setBusy("sync");
        const targets = result.projects.filter(
          (p) =>
            p.directory &&
            (p.id === projectId ||
              JSON.stringify(
                settings.projects.find((old) => old.id === p.id),
              ) !== JSON.stringify(p)),
        );
        const results = await Promise.all(
          targets.map(async (p) => {
            try {
              const info = await window.studio!.repository(p.id, true);
              if (info.syncError)
                return { ok: false, message: `${p.name}：${info.syncError}` };
              return {
                ok: true,
                message: `${p.name} · ${info.syncRemote || I18nT("本地仓库", "Local repository")} · ${info.remoteBranches?.filter((b) => b.remote === info.syncRemote).length || 0} ${I18nT("个远程分支", "remote branches")}${info.syncedAt ? " · " + new Date(info.syncedAt).toLocaleString() : ""}`,
              };
            } catch (error) {
              return {
                ok: false,
                message: `${p.name}：${(error as Error).message}`,
              };
            }
          }),
        );
        setConnection({
          ok: results.every((item) => item.ok),
          message:
            I18nT(
              "配置已保存。远程同步结果：",
              "Settings saved. Remote sync results: ",
            ) + results.map((item) => item.message).join("；"),
        });
      }
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  async function test(target: "git" | "zentao" | "agent") {
    if (!window.studio) return;
    setBusy(target);
    setConnection(undefined);
    try {
      setConnection(
        await window.studio.testConnection(
          target,
          target === "git" ? projectId : undefined,
        ),
      );
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("失效凭据已清除"))
        setDraft((previous) => ({
          ...previous,
          zentao: { ...previous.zentao, hasSecret: false },
        }));
      setConnection({ ok: false, message });
    } finally {
      setBusy("");
    }
  }
  async function loadZentao() {
    if (!window.studio) return;
    setBusy("zentao-load");
    try {
      const catalog = await window.studio.zentaoCatalog();
      setZentaoCatalog(catalog);
      setConnection({
        ok: true,
        message: `${I18nT("加载完成", "Loaded")}：${catalog.products.length} ${I18nT("个产品", "products")}，${catalog.projects.length} ${I18nT("个项目", "projects")}，${catalog.items.length} ${I18nT("个待办事项", "assigned items")}。`,
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("失效凭据已清除"))
        setDraft((previous) => ({
          ...previous,
          zentao: { ...previous.zentao, hasSecret: false },
        }));
      setConnection({ ok: false, message });
    } finally {
      setBusy("");
    }
  }
  const tabs = [
    {
      key: "developer",
      name: I18nT("开发者与项目", "Developer and projects"),
      icon: UserRound,
    },
    {
      key: "runtime",
      name: I18nT("本地执行", "Local execution"),
      icon: Terminal,
    },
    {
      key: "zentao",
      name: I18nT("禅道连接", "ZenTao connection"),
      icon: Link2,
    },
    {
      key: "notifications",
      name: I18nT("完成通知", "Notifications"),
      icon: BellRing,
    },
    {
      key: "appearance",
      name: I18nT("外观与主题", "Appearance"),
      icon: Palette,
    },
  ];
  const presets = [
    { color: "#1677FF", name: I18nT("听云蓝", "Tingyun blue") },
    { color: "#5B4BDB", name: I18nT("雅致紫", "Violet") },
    { color: "#008A70", name: I18nT("松石绿", "Teal") },
    { color: "#D66B16", name: I18nT("暖阳橙", "Amber") },
    { color: "#CE3A65", name: I18nT("玫瑰红", "Rose") },
    { color: "#42526D", name: I18nT("石墨灰", "Graphite") },
  ];
  return (
    <>
      <header className="page-heading">
        <div>
          <div className="eyebrow">
            {I18nT("工作台 / 开发配置", "Workspace / Development settings")}
          </div>
          <h1>{I18nT("开发配置", "Development settings")}</h1>
          <p>
            {I18nT(
              "配置你自己的项目与连接，让工作台适应你的工作方式。",
              "Connect your own repositories and tools to fit the way you work.",
            )}
          </p>
        </div>
        <div className="page-heading-actions">
          <span className="badge">
            <ShieldCheck size={13} />
            {I18nT("本机个人配置", "Personal device settings")}
          </span>
        </div>
      </header>
      <div className="settings-tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            aria-current={tab === item.key ? "page" : undefined}
            onClick={() => {
              setTab(item.key);
              setConnection(undefined);
            }}
          >
            <item.icon size={17} />
            {item.name}
          </button>
        ))}
      </div>
      {tab === "developer" && (
        <>
          <section className="panel">
            <div className="section-heading">
              <h2>
                <UserRound size={18} />
                {I18nT("开发者身份", "Developer identity")}
              </h2>
            </div>
            <div className="form-row three">
              <Field label={I18nT("开发人", "Developer name")}>
                <input
                  value={draft.developer.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      developer: { ...draft.developer, name: e.target.value },
                    })
                  }
                  placeholder={I18nT("你的姓名", "Your name")}
                />
              </Field>
              <Field label={I18nT("Git 邮箱", "Git email")}>
                <input
                  type="email"
                  value={draft.developer.email}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      developer: { ...draft.developer, email: e.target.value },
                    })
                  }
                  placeholder="name@company.com"
                />
              </Field>
              <Field label={I18nT("默认项目", "Default project")}>
                <select
                  value={draft.developer.defaultProject}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      developer: {
                        ...draft.developer,
                        defaultProject: e.target.value,
                      },
                    })
                  }
                >
                  {draft.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>
                  <GitBranch size={18} />
                  {I18nT("项目与 Git 仓库", "Projects and Git repositories")}
                </h2>
                <p>
                  {I18nT(
                    "保存后同步所配置仓库的远程分支；只更新远程引用，确认开发时才更新工作区。",
                    "Saving syncs branches from the configured remote. Only remote references update until development is confirmed.",
                  )}
                </p>
              </div>
              <button
                className="project-add-button"
                type="button"
                disabled={draft.projects.length >= 20}
                onClick={() => {
                  setAddingProject(true);
                  setConnection(undefined);
                }}
              >
                <Plus size={15} />
                {I18nT("新增项目", "Add project")}
              </button>
            </div>
            {addingProject && (
              <div className="project-create-card">
                <div className="project-create-heading">
                  <div>
                    <strong>{I18nT("接入前端项目", "Connect a frontend project")}</strong>
                    <p>
                      {I18nT(
                        "项目 ID 保存后作为任务与配置的稳定标识，请使用简短英文名称。",
                        "The project ID is the stable task and settings identifier. Use a short ASCII name.",
                      )}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={I18nT("取消新增项目", "Cancel adding project")}
                    onClick={() => setAddingProject(false)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="form-row">
                  <Field
                    label={I18nT("项目 ID", "Project ID")}
                    hint={I18nT(
                      "例如 rum-web；仅支持字母、数字、下划线和短横线。",
                      "For example rum-web; letters, numbers, underscores, and hyphens only.",
                    )}
                  >
                    <input
                      value={newProject.id}
                      placeholder="rum-web"
                      onChange={(event) =>
                        setNewProject((previous) => ({
                          ...previous,
                          id: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label={I18nT("项目名称", "Project name")}>
                    <input
                      value={newProject.name}
                      placeholder={I18nT("例如 RUM 前端", "For example RUM frontend")}
                      onChange={(event) =>
                        setNewProject((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <div className="form-row">
                  <Field label={I18nT("本地项目目录", "Local project directory")}>
                    <div className="input-action">
                      <input
                        value={newProject.directory}
                        placeholder={I18nT(
                          "选择已克隆的项目目录",
                          "Choose an existing repository directory",
                        )}
                        onChange={(event) =>
                          setNewProject((previous) => ({
                            ...previous,
                            directory: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={!native}
                        aria-label={I18nT("选择项目目录", "Choose project directory")}
                        onClick={() => void chooseDirectory("new")}
                      >
                        <FolderOpen size={17} />
                      </button>
                    </div>
                  </Field>
                  <Field
                    label={I18nT("Git 仓库地址（可选）", "Git repository URL (optional)")}
                  >
                    <input
                      value={newProject.repository}
                      placeholder="git@host:team/repository.git"
                      onChange={(event) =>
                        setNewProject((previous) => ({
                          ...previous,
                          repository: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <div className="project-create-actions">
                  <button type="button" onClick={() => setAddingProject(false)}>
                    {I18nT("取消", "Cancel")}
                  </button>
                  <button className="primary" type="button" onClick={addProject}>
                    <Plus size={15} />
                    {I18nT("添加并继续配置", "Add and continue setup")}
                  </button>
                </div>
              </div>
            )}
            <div className="project-tabs">
              {draft.projects.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={p.id === projectId}
                  onClick={() => {
                    setProjectId(p.id);
                    setConnection(undefined);
                  }}
                >
                  {p.name}
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            {project && (
              <>
                <div className="form-row">
                  <Field
                    label={I18nT("项目 ID", "Project ID")}
                    hint={I18nT(
                      "稳定标识，用于关联历史任务，添加后不可修改。",
                      "Stable identifier used by task history and cannot be changed after creation.",
                    )}
                  >
                    <input value={project.id} readOnly />
                  </Field>
                  <Field label={I18nT("项目名称", "Project name")}>
                    <input
                      value={project.name}
                      onChange={(event) => projectPatch({ name: event.target.value })}
                    />
                  </Field>
                </div>
                <div className="form-row">
                  <Field label={I18nT("Git 仓库地址", "Git repository URL")}>
                    <input
                      value={project.repository}
                      placeholder="git@host:team/repository.git"
                      onChange={(e) =>
                        projectPatch({ repository: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label={I18nT("本地项目目录", "Local project directory")}
                  >
                    <div className="input-action">
                      <input
                        value={project.directory}
                        onChange={(e) =>
                          projectPatch({ directory: e.target.value })
                        }
                        placeholder={I18nT(
                          "选择已克隆的项目目录",
                          "Choose an existing repository directory",
                        )}
                      />
                      <button
                        aria-label={I18nT(
                          "选择项目目录",
                          "Choose project directory",
                        )}
                        disabled={!native}
                        onClick={() => void chooseDirectory("current")}
                      >
                        <FolderOpen size={17} />
                      </button>
                    </div>
                  </Field>
                </div>
                <div className="form-row">
                  <Field
                    label={I18nT("Git 认证方式", "Git authentication")}
                    hint={I18nT(
                      "系统模式复用本机已保存的凭据；尚未登录时请选择用户名与密码或 Token。",
                      "System mode reuses saved local credentials; otherwise choose username/password or token.",
                    )}
                  >
                    <select
                      value={project.auth}
                      onChange={(e) =>
                        projectPatch({
                          auth: e.target.value as Project["auth"],
                        })
                      }
                    >
                      <option value="system">
                        {I18nT(
                          "系统 Git 凭据 / SSH",
                          "System Git credentials / SSH",
                        )}
                      </option>
                      <option value="token">
                        {I18nT("访问令牌 Token", "Access token")}
                      </option>
                      <option value="password">
                        {I18nT("用户名与密码", "Username and password")}
                      </option>
                    </select>
                  </Field>
                  <Field
                    label={I18nT("默认开发方式", "Default development mode")}
                  >
                    <select
                      value={project.defaultBranchMode}
                      onChange={(e) =>
                        projectPatch({
                          defaultBranchMode: e.target
                            .value as Project["defaultBranchMode"],
                        })
                      }
                    >
                      <option value="new">
                        {I18nT("新建分支开发", "Create a new branch")}
                      </option>
                      <option value="existing">
                        {I18nT("在原有分支开发", "Use an existing branch")}
                      </option>
                    </select>
                  </Field>
                </div>
                {/^http:\/\//i.test(project.repository.trim()) && (
                  <p className="inline-hint">
                    {I18nT(
                      "当前仓库使用 HTTP，账号与凭据会通过未加密连接传输。请仅用于可信内网；仓库支持时优先使用 HTTPS 或 SSH。",
                      "This repository uses HTTP: credentials travel over an unencrypted connection. Use only on a trusted network; prefer HTTPS or SSH when available.",
                    )}
                  </p>
                )}
                {project.auth !== "system" && (
                  <div className="form-row">
                    <Field label={I18nT("Git 用户名", "Git username")}>
                      <input
                        autoComplete="off"
                        value={project.username}
                        onChange={(e) =>
                          projectPatch({ username: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={
                        project.auth === "token"
                          ? I18nT("访问令牌", "Access token")
                          : I18nT("密码", "Password")
                      }
                      hint={
                        project.hasSecret
                          ? I18nT(
                              "已保存凭据。保持为空则沿用；点击清除后保存可删除。",
                              "A credential is stored. Leave unchanged to retain it, or clear and save to remove it.",
                            )
                          : I18nT(
                              "凭据由操作系统加密保存，不写入任务与日志。",
                              "Credentials are encrypted by the operating system and excluded from task records and logs.",
                            )
                      }
                    >
                      <div className="input-action">
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={draft.secrets?.[`git:${project.id}`] || ""}
                          placeholder={project.hasSecret ? "••••••••" : ""}
                          onChange={(e) =>
                            secret(`git:${project.id}`, e.target.value)
                          }
                        />
                        <button onClick={() => secret(`git:${project.id}`, "")}>
                          {I18nT("清除", "Clear")}
                        </button>
                      </div>
                    </Field>
                  </div>
                )}
                <div className="form-row">
                  <Field
                    label={I18nT("启动脚本", "Start script")}
                    hint={I18nT(
                      "填写 package.json 中的脚本名，例如 start:dev。",
                      "Use a script name from package.json, such as start:dev.",
                    )}
                  >
                    <input
                      value={project.startScript}
                      placeholder="start:dev"
                      onChange={(e) =>
                        projectPatch({ startScript: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label={I18nT("开发页面地址", "Development page URL")}
                    hint={I18nT(
                      "项目就绪后自动打开到这个页面。",
                      "Open this page automatically once the project is ready.",
                    )}
                  >
                    <input
                      value={project.targetUrl}
                      placeholder="http://localhost:8000/"
                      onChange={(e) =>
                        projectPatch({ targetUrl: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <button
                  disabled={!native || Boolean(busy) || dirty}
                  onClick={() => void test("git")}
                >
                  {busy === "git" ? (
                    <Loader2 className="spin" size={15} />
                  ) : (
                    <Link2 size={15} />
                  )}
                  {I18nT("测试 Git 连接", "Test Git connection")}
                </button>
                <span className="inline-hint">
                  {dirty
                    ? I18nT(
                        "先保存配置，再测试连接。",
                        "Save settings before testing the connection.",
                      )
                    : I18nT(
                        "只读检查，不创建分支、不提交代码。",
                        "Read-only check. No branch creation or commits.",
                      )}
                </span>
              </>
            )}
          </section>
        </>
      )}
      {tab === "runtime" && (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>
                  <Terminal size={18} />
                  {I18nT("本地 Agent 与技能", "Local agent and skills")}
                </h2>
                <p>
                  {I18nT(
                    "复用本机 Codex 登录和 Tyflow 技能，执行前检查配置是否可用。",
                    "Use your local Codex sign-in and Tyflow skills. Availability is checked before execution.",
                  )}
                </p>
              </div>
            </div>
            <Field
              label={I18nT("Agent 命令", "Agent command")}
              hint={I18nT(
                "Codex 可执行命令或完整路径，不包含额外参数。",
                "Codex executable command or full path, without additional arguments.",
              )}
            >
              <input
                value={draft.agent.command}
                placeholder="codex"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    agent: { ...draft.agent, command: e.target.value },
                  })
                }
              />
            </Field>
            <Field label={I18nT("Tyflow 目录", "Tyflow directory")}>
              <input
                value={draft.agent.tyflowDirectory}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    agent: { ...draft.agent, tyflowDirectory: e.target.value },
                  })
                }
              />
            </Field>
            <Field
              label={I18nT(
                "自动化测试 Skill 路径",
                "Automated testing skill path",
              )}
              hint={I18nT(
                "选择已安装的 frontend-test 或 test-engineer 的 SKILL.md。",
                "Use the SKILL.md path of an installed frontend-test or test-engineer skill.",
              )}
            >
              <input
                value={draft.agent.testSkill}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    agent: { ...draft.agent, testSkill: e.target.value },
                  })
                }
              />
            </Field>
            <button
              disabled={!native || Boolean(busy) || dirty}
              onClick={() => void test("agent")}
            >
              {busy === "agent" ? (
                <Loader2 className="spin" size={15} />
              ) : (
                <Link2 size={15} />
              )}
              {I18nT("检查执行环境", "Check execution environment")}
            </button>
          </section>
          <section className="panel">
            <h2>{I18nT("当前环境", "Current environment")}</h2>
            <div className="environment-grid">
              {[
                { name: "Git", ok: environment.gitAvailable },
                { name: "Codex", ok: environment.agentAvailable },
                { name: "Tyflow", ok: environment.tyflowAvailable },
                {
                  name: I18nT("测试 Skill", "Test skill"),
                  ok: environment.testSkillAvailable,
                },
                {
                  name: I18nT("凭据加密", "Credential encryption"),
                  ok: environment.credentialStorage,
                },
              ].map((item) => (
                <div key={item.name}>
                  <span>{item.name}</span>
                  <span className={`badge ${item.ok ? "success" : "warning"}`}>
                    {item.ok
                      ? I18nT("可用", "Available")
                      : I18nT("未就绪", "Not ready")}
                  </span>
                </div>
              ))}
            </div>
            <div className="runtime-meta">
              <p>
                {environment.platform} · v{environment.version}
              </p>
              <small>{I18nT("数据目录", "Data directory")}</small>
              <p className="mono">{environment.dataDirectory || "—"}</p>
            </div>
          </section>
        </>
      )}
      {tab === "zentao" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>
                <Link2 size={18} />
                {I18nT("禅道连接", "ZenTao connection")}
              </h2>
              <p>
                {I18nT(
                  "保存个人连接配置，方便后续接入任务与缺陷。",
                  "Save personal connection details for later task and bug integration.",
                )}
              </p>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.zentao.enabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    zentao: { ...draft.zentao, enabled: e.target.checked },
                  })
                }
              />
              {I18nT("启用连接", "Enable connection")}
            </label>
          </div>
          <Notice>
            {I18nT(
              "连接后可映射本地项目，并在 Studio 任务中绑定禅道需求、任务或 Bug。状态回写默认关闭，避免未经确认修改禅道数据。",
              "Map local projects and link Studio tasks to ZenTao stories, tasks, or bugs. Status write-back remains off to prevent unapproved changes.",
            )}
          </Notice>
          <fieldset className="plain-fieldset" disabled={!draft.zentao.enabled}>
            <Field label={I18nT("禅道地址", "ZenTao URL")}>
              <input
                value={draft.zentao.url}
                placeholder="https://zentao.company.com"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    zentao: { ...draft.zentao, url: e.target.value },
                  })
                }
              />
            </Field>
            <div className="form-row">
              <Field label={I18nT("账号", "Username")}>
                <input
                  value={draft.zentao.username}
                  autoComplete="off"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      zentao: { ...draft.zentao, username: e.target.value },
                    })
                  }
                />
              </Field>
              <Field
                label={I18nT("密码 / Token", "Password / token")}
                hint={
                  draft.zentao.hasSecret
                    ? I18nT(
                        "已加密保存；留空沿用现有凭据。",
                        "Encrypted credential stored; leave unchanged to retain it.",
                      )
                    : I18nT(
                        "仅保存在当前系统用户的加密存储中。",
                        "Stored encrypted for the current operating system user.",
                      )
                }
              >
                <div className="input-action">
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={draft.zentao.hasSecret ? "••••••••" : ""}
                    value={draft.secrets?.zentao || ""}
                    onChange={(e) => secret("zentao", e.target.value)}
                  />
                  <button onClick={() => secret("zentao", "")}>
                    {I18nT("清除", "Clear")}
                  </button>
                </div>
              </Field>
            </div>
            <div className="section-heading">
              <div>
                <h2>{I18nT("项目映射", "Project mapping")}</h2>
                <p>
                  {I18nT(
                    "把本地前端工程对应到禅道产品与项目，任务录入时会显示该映射。",
                    "Map a local frontend repository to its ZenTao product and project.",
                  )}
                </p>
              </div>
            </div>
            <div className="form-row three">
              <Field label={I18nT("本地项目", "Local project")}>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {draft.projects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={I18nT("禅道产品", "ZenTao product")}>
                <select
                  value={draft.zentao.mappings[projectId]?.productId || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      zentao: {
                        ...draft.zentao,
                        mappings: {
                          ...draft.zentao.mappings,
                          [projectId]: {
                            productId: e.target.value,
                            projectId: draft.zentao.mappings[projectId]?.projectId || "",
                          },
                        },
                      },
                    })
                  }
                >
                  <option value="">{I18nT("请选择产品", "Select product")}</option>
                  {zentaoCatalog?.products.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={I18nT("禅道项目", "ZenTao project")}>
                <select
                  value={draft.zentao.mappings[projectId]?.projectId || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      zentao: {
                        ...draft.zentao,
                        mappings: {
                          ...draft.zentao.mappings,
                          [projectId]: {
                            productId: draft.zentao.mappings[projectId]?.productId || "",
                            projectId: e.target.value,
                          },
                        },
                      },
                    })
                  }
                >
                  <option value="">{I18nT("请选择项目", "Select project")}</option>
                  {zentaoCatalog?.projects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              disabled={!native || Boolean(busy) || dirty}
              onClick={() => void loadZentao()}
            >
              {busy === "zentao-load" ? (
                <Loader2 className="spin" size={15} />
              ) : (
                <Link2 size={15} />
              )}
              {I18nT("验证账号并加载", "Verify account and load")}
            </button>
          </fieldset>
        </section>
      )}
      {tab === "notifications" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>
                <BellRing size={18} />
                {I18nT("任务进度通知", "Task progress notifications")}
              </h2>
              <p>
                {I18nT(
                  "在关键节点通知开发人员；点击系统通知可返回 TingYun Studio。",
                  "Notify developers at key milestones; click a system notification to return to TingYun Studio.",
                )}
              </p>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.notifications.enabled}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    notifications: {
                      ...draft.notifications,
                      enabled: event.target.checked,
                    },
                  })
                }
              />
              {I18nT("启用任务通知", "Enable task notifications")}
            </label>
          </div>
          <fieldset className="plain-fieldset" disabled={!draft.notifications.enabled}>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.notifications.desktop}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    notifications: {
                      ...draft.notifications,
                      desktop: event.target.checked,
                    },
                  })
                }
              />
              {I18nT("Windows 桌面通知", "Windows desktop notifications")}
            </label>
            <div className="environment-grid">
              {([
                ["planReady", I18nT("方案完成，等待审批", "Plan ready for approval")],
                ["developmentComplete", I18nT("开发完成，等待自动化测试", "Development complete; awaiting tests")],
                ["acceptanceReady", I18nT("开发与测试完成，等待验收", "Development and testing complete; awaiting acceptance")],
                ["failed", I18nT("任务执行失败", "Task execution failed")],
              ] as const).map(([key, label]) => (
                <label className="checkbox" key={key}>
                  <input
                    type="checkbox"
                    checked={draft.notifications.milestones[key]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        notifications: {
                          ...draft.notifications,
                          milestones: {
                            ...draft.notifications.milestones,
                            [key]: event.target.checked,
                          },
                        },
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <Notice>
              {I18nT(
                "当前支持本机桌面通知；这里保留统一通知配置，后续可继续接入企业微信、钉钉或 Teams。",
                "Desktop notifications are supported now. This unified notification configuration can later add WeCom, DingTalk, or Teams.",
              )}
            </Notice>
          </fieldset>
        </section>
      )}
      {tab === "appearance" && (
        <section className="panel theme-panel">
          <div className="section-heading">
            <div>
              <h2>
                <Palette size={18} />
                {I18nT("平台主题色", "Platform theme color")}
              </h2>
              <p>
                {I18nT(
                  "选择后立即预览，保存后应用于整个平台。",
                  "Preview changes immediately. Save to apply across the platform.",
                )}
              </p>
            </div>
          </div>
          <div className="theme-layout">
            <div className="theme-controls">
              <div className="theme-presets">
                {presets.map((p) => (
                  <button
                    key={p.color}
                    aria-pressed={
                      draft.theme.toLowerCase() === p.color.toLowerCase()
                    }
                    onClick={() => {
                      setDraft({ ...draft, theme: p.color });
                      setCustomHex(p.color);
                    }}
                  >
                    <span className="swatch" style={{ background: p.color }} />
                    {p.name}
                    {draft.theme.toLowerCase() === p.color.toLowerCase() && (
                      <Check size={17} />
                    )}
                  </button>
                ))}
              </div>
              <div className="custom-color">
                <Field label={I18nT("自定义颜色", "Custom color")}>
                  <input
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(draft.theme)
                        ? draft.theme
                        : "#1677ff"
                    }
                    onChange={(e) => {
                      setDraft({ ...draft, theme: e.target.value });
                      setCustomHex(e.target.value);
                    }}
                  />
                </Field>
                <Field label="HEX">
                  <input
                    value={customHex}
                    maxLength={7}
                    onChange={(e) => {
                      setCustomHex(e.target.value);
                      if (/^#[0-9a-f]{6}$/i.test(e.target.value))
                        setDraft({ ...draft, theme: e.target.value });
                    }}
                    placeholder="#1677FF"
                  />
                </Field>
                <button
                  onClick={() => {
                    setDraft({ ...draft, theme: "#1677FF" });
                    setCustomHex("#1677FF");
                  }}
                >
                  <RotateCcw size={15} />
                  {I18nT("恢复默认", "Reset default")}
                </button>
              </div>
              {!/^#[0-9a-f]{6}$/i.test(customHex) && (
                <Notice tone="error">
                  {I18nT(
                    "请输入完整的六位 HEX 颜色，例如 #1677FF。",
                    "Enter a six-digit HEX color, such as #1677FF.",
                  )}
                </Notice>
              )}
              <Field label={I18nT("界面语言", "Interface language")}>
                <select
                  value={draft.language}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      language: e.target.value as Settings["language"],
                    })
                  }
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </Field>
            </div>
            <div className="theme-preview">
              <div className="section-heading">
                <h3>{I18nT("效果预览", "Theme preview")}</h3>
                <span className="badge">{I18nT("已选择", "Selected")}</span>
              </div>
              <div className="preview-row">
                <button className="primary" type="button">
                  {I18nT("确认并开始开发", "Confirm and develop")}
                </button>
                <button type="button">
                  {I18nT("预览开发计划", "Preview plan")}
                </button>
                <label className="checkbox">
                  <input type="checkbox" defaultChecked />
                  {I18nT("自动化测试介入", "Automated testing")}
                </label>
              </div>
              <div className="theme-progress">
                <span />
              </div>
              <p>
                {I18nT(
                  "主按钮保持白色文字；过浅的主题色会自动加深按钮背景，确保清晰可读。",
                  "Primary button text stays white. Light theme colors are darkened for legible contrast.",
                )}
              </p>
              <small className="mono">
                {draft.theme.toUpperCase()} →{" "}
                {themeColor(draft.theme).toUpperCase()}
              </small>
            </div>
          </div>
        </section>
      )}
      {connection && (
        <Notice tone={connection.ok ? "success" : "error"}>
          {connection.message}
        </Notice>
      )}
      <div className="actionbar settings-actionbar">
        <span
          className={`action-hint ${dirty ? "is-dirty" : "is-saved"}`}
        >
          <SlidersHorizontal size={16} />
          <span>
            <strong>
              {busy === "sync"
                ? I18nT("正在同步", "Syncing")
                : dirty
                  ? I18nT("未保存", "Unsaved")
                  : I18nT("已保存", "Saved")}
            </strong>
            <small>
              {busy === "sync"
                ? I18nT(
                    "配置已写入，正在同步远程分支…",
                    "Settings saved; syncing remote branches…",
                  )
                : dirty
                  ? I18nT(
                      "配置有未保存的修改，记得保存后再离开。",
                      "You have unsaved changes. Save before leaving.",
                    )
                  : I18nT(
                      "当前配置已保存，可继续调整主题与连接。",
                      "Current settings are saved. Keep tuning theme and connections.",
                    )}
            </small>
          </span>
        </span>
        <div className="actions">
          <button
            disabled={!dirty || Boolean(busy)}
            onClick={() => {
              setDraft(structuredClone(settings));
              setCustomHex(settings.theme);
              setConnection(undefined);
            }}
          >
            <RotateCcw size={15} />
            {I18nT("撤销修改", "Discard changes")}
          </button>
          <button
            className="primary"
            disabled={
              !native ||
              Boolean(busy) ||
              !dirty ||
              !/^#[0-9a-f]{6}$/i.test(customHex)
            }
            onClick={() => void save()}
          >
            {busy === "save" || busy === "sync" ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            {I18nT("保存配置", "Save settings")}
          </button>
        </div>
      </div>
    </>
  );
}
