import { useEffect, useState } from "react";
import type {
  SettingsInput,
  SetupCheck,
  UpdateInfo,
} from "../shared/contracts";
import { Field, Notice } from "./components";
import { I18nT } from "./i18n";

export function SetupPanel({ projectId }: { projectId: string }) {
  const [checks, setChecks] = useState<SetupCheck[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    if (!window.studio?.setupChecks) return;
    setBusy(true);
    setError("");
    try {
      setChecks(await window.studio.setupChecks(projectId));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{I18nT("首次接入与项目体检", "Setup and project health")}</h2>
      <p>
        {I18nT(
          "检查已保存配置中的 Git、Node、Codex 登录、配套技能和所选项目；失败项会给出处理方法。",
          "Check saved Git, Node, Codex login, bundled skills and the selected project, with remedies for failed checks.",
        )}
      </p>
      <button
        disabled={busy || !window.studio?.setupChecks}
        onClick={() => void run()}
      >
        {busy
          ? I18nT("正在体检…", "Checking…")
          : I18nT("执行完整体检", "Run setup checks")}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="setup-checks">
        {checks.map((check) => (
          <div key={check.id} className={`setup-check ${check.state}`}>
            <strong>
              {check.name} ·{" "}
              {check.state === "passed"
                ? I18nT("通过", "Passed")
                : check.state === "warning"
                  ? I18nT("需留意", "Attention")
                  : I18nT("需处理", "Action required")}
            </strong>
            <p>{check.detail}</p>
            {check.remedy && <small>{check.remedy}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function UpdatePanel({
  draft,
  patch,
}: {
  draft: SettingsInput;
  patch: (value: Partial<SettingsInput>) => void;
}) {
  const defaults = {
    manifestUrl: "",
    githubRepository: "liukunxiaohuozi/tyflow-studio",
    checkOnLaunch: true,
  };
  const updates: NonNullable<SettingsInput["updates"]> =
    draft.updates ?? defaults;
  const [info, setInfo] = useState<UpdateInfo>();
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const poll = () =>
      window.studio
        ?.updateStatus?.()
        .then((next) => {
          if (live) setInfo(next);
        })
        .catch(() => {});
    void poll();
    const timer = setInterval(() => void poll(), 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  async function action(kind: "check" | "download" | "activate" | "rollback") {
    setBusy(true);
    setOperation(kind);
    setError("");
    try {
      if (kind === "check") setInfo(await window.studio?.checkUpdate?.());
      else if (kind === "download")
        setInfo(await window.studio?.downloadUpdate?.());
      else if (
        window.confirm(
          I18nT(
            "将关闭验证服务并重启客户端，是否继续？任务记录和配置会保留。",
            "Close preview services and restart Studio? Task history and settings will be retained.",
          ),
        )
      )
        await window.studio?.activateUpdate?.(kind === "rollback");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
      setOperation("");
    }
  }
  return (
    <section className="panel">
      <h2>{I18nT("内部客户端更新", "Internal app updates")}</h2>
      <p>
        {I18nT(
          "可边开发边下载；启用更新前需要完成或停止运行和排队任务。旧版本保留，配置与任务历史继续使用。",
          "Download while developing. Finish or stop running and queued tasks before activation. Previous versions, settings and history are retained.",
        )}
      </p>
      <Field
        label={I18nT(
          "内部更新清单地址（可选）",
          "Internal manifest URL (optional)",
        )}
      >
        <input
          value={updates.manifestUrl}
          placeholder="https://internal.example.com/studio/update-manifest.json"
          onChange={(event) =>
            patch({ updates: { ...updates, manifestUrl: event.target.value } })
          }
        />
      </Field>
      <Field
        label={I18nT(
          "GitHub 仓库（未填写清单时使用）",
          "GitHub repository (when no manifest is set)",
        )}
      >
        <input
          value={updates.githubRepository}
          onChange={(event) =>
            patch({
              updates: { ...updates, githubRepository: event.target.value },
            })
          }
        />
      </Field>
      <Field
        label={I18nT(
          "更新访问 Token（私有仓库或内部服务）",
          "Update access token (private repository or internal service)",
        )}
      >
        <input
          type="password"
          autoComplete="new-password"
          placeholder={updates.hasSecret ? "••••••••" : ""}
          value={draft.secrets?.updates ?? ""}
          onChange={(event) =>
            patch({
              secrets: { ...draft.secrets, updates: event.target.value },
            })
          }
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={updates.checkOnLaunch}
          onChange={(event) =>
            patch({
              updates: { ...updates, checkOnLaunch: event.target.checked },
            })
          }
        />
        {I18nT("启动时检查新版本", "Check for updates on launch")}
      </label>
      <p>
        {I18nT(
          "先保存配置，再检查更新。",
          "Save configuration before checking for updates.",
        )}
      </p>
      {info && (
        <Notice>
          {I18nT("当前版本", "Current version")}：{info.currentVersion}
          {info.version && (
            <>
              {" "}
              · {I18nT("可用版本", "Available version")}：{info.version}
            </>
          )}
          {info.status === "current" && (
            <p>{I18nT("已是最新版本", "Up to date")}</p>
          )}
          {info.status === "checking" && (
            <p>{I18nT("正在检查更新…", "Checking for updates…")}</p>
          )}
          {info.status === "downloading" && (
            <p>
              {I18nT("正在下载", "Downloading")}：{info.progress ?? 0}%
            </p>
          )}
          {info.status === "downloaded" && (
            <p>
              {I18nT(
                "下载与完整性校验完成，可启用新版本。",
                "Download and integrity checks complete. The update is ready.",
              )}
            </p>
          )}
          {info.notes && <p>{info.notes}</p>}
        </Notice>
      )}
      {(error || info?.error) && (
        <Notice tone="error">{error || info?.error}</Notice>
      )}
      {busy && ["activate", "rollback"].includes(operation) && (
        <Notice>
          {I18nT(
            "正在准备客户端更新，请稍候；完成后会自动重启。",
            "Preparing the app update. Studio will restart automatically when ready.",
          )}
        </Notice>
      )}
      <div className="actions">
        <button
          disabled={
            busy ||
            !window.studio?.checkUpdate ||
            info?.status === "downloading"
          }
          onClick={() => void action("check")}
        >
          {I18nT("检查新版本", "Check for updates")}
        </button>
        {info?.status === "available" && (
          <button disabled={busy} onClick={() => void action("download")}>
            {I18nT("下载更新", "Download update")}
          </button>
        )}
        {info?.status === "downloaded" && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => void action("activate")}
          >
            {I18nT("启用更新并重启", "Activate and restart")}
          </button>
        )}
        {info?.previousAvailable && (
          <button disabled={busy} onClick={() => void action("rollback")}>
            {I18nT("回退上一版本", "Roll back")}
          </button>
        )}
      </div>
      <p className="inline-hint">
        {I18nT(
          "内部包未做付费签名公证，macOS 首次安装或更新仍可能要求在隐私与安全性中确认打开。",
          "Internal builds are not commercially signed or notarized. macOS may still require approval in Privacy & Security on first install or update.",
        )}
      </p>
    </section>
  );
}
