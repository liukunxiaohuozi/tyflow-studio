import { useEffect, useRef, useState } from "react";
import type { StudioAPI, Task } from "../shared/contracts";
import type {
  BrowserTestAction,
  BrowserTestState,
  TestBrowser,
} from "../shared/browser-test";
import { PreviewDrawer, Field, Notice, activeStatuses } from "./components";
import { I18nT } from "./i18n";

export default function BrowserTestDrawer({
  api,
  task,
  onTask,
  close,
}: {
  api: StudioAPI;
  task: Task;
  onTask: (task: Task) => void;
  close: () => void;
}) {
  const [state, setState] = useState<BrowserTestState>();
  const [url, setUrl] = useState(
    task.browserTest?.url ?? task.snapshot?.project.targetUrl ?? "",
  );
  const [scope, setScope] = useState(task.browserTest?.scope ?? "");
  const [origins, setOrigins] = useState(
    task.browserTest?.allowedOrigins.join("\n") ?? "",
  );
  const [nonProduction, setNonProduction] = useState(false);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [allowWrites, setAllowWrites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState<TestBrowser>();
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const editedUrl = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let disposed = false;
    let initialized = false;
    const poll = async () => {
      if (!api.browserTest || busyRef.current) return;
      const version = generation.current;
      try {
        const data = await api.browserTest(task.id, "status");
        if (disposed || version !== generation.current) return;
        setState(data);
        if (!initialized && !editedUrl.current) setUrl(data.url);
        if (!initialized) setScope((previous) => previous || data.scope || "");
        initialized = true;
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
    // Form edits are intentionally not reset by background polling.
  }, [api, task.id]);
  const input = () => ({
    url,
    browser: undefined,
    nonProduction,
    sourceConfirmed,
    allowWrites,
    scope,
    allowedOrigins: origins.split(/[\s,]+/).filter(Boolean),
  });
  async function execute(action: BrowserTestAction, browser: TestBrowser) {
    if (!api.browserTest) return;
    if (action === "install") {
      setInstalling(browser);
      setError("");
      generation.current++;
      setState((previous) =>
        previous
          ? {
              ...previous,
              browsers: previous.browsers.map((item) =>
                item.browser === browser
                  ? { ...item, phase: "installing" }
                  : item,
              ),
            }
          : previous,
      );
      try {
        setState(await api.browserTest(task.id, action, { browser }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setInstalling(undefined);
      }
      return;
    }
    generation.current++;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      setState(await api.browserTest(task.id, action, { ...input(), browser }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function continueTests() {
    if (!api.browserTest || !state) return;
    generation.current++;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      let confirmed = state;
      for (const browser of state.required)
        confirmed = await api.browserTest(task.id, "confirm", {
          ...input(),
          browser,
        });
      setState(confirmed);
      if (!confirmed.ready)
        throw new Error(
          I18nT(
            "请先完成所有必需浏览器的登录确认",
            "Confirm login in every required browser first",
          ),
        );
      onTask(
        await api.taskAction(
          task.id,
          ["failed", "stopped"].includes(task.status) ? "retry" : "test",
        ),
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const labels = {
    closed: I18nT("未打开", "Not open"),
    opening: I18nT("正在打开", "Opening"),
    login: I18nT("等待手动登录与确认", "Awaiting manual login"),
    ready: I18nT("已确认，可以验证", "Confirmed, ready to verify"),
    error: I18nT("需要处理", "Needs attention"),
    installing: I18nT("组件下载中", "Downloading component"),
  };
  const formReady = nonProduction && sourceConfirmed && Boolean(scope.trim());
  return (
    <PreviewDrawer
      title={I18nT("测试准备与手动登录", "Test preparation and manual login")}
      close={close}
    >
      <div className="browser-test-flow">
        <Notice>
          {I18nT(
            "使用专用测试浏览器，不会复用你日常浏览器的登录。请手动登录；Studio 不读取或填写密码，不导出 Cookie。确认后，脱敏测试页面内容和截图可用于 Agent 验证。",
            "Use dedicated test browsers, separate from your everyday browser. Log in manually. Studio does not read or fill passwords or export cookies. After confirmation, redacted test-page content and screenshots may be used by the agent.",
          )}
        </Notice>
        {error && <Notice tone="error">{error}</Notice>}
        <Field
          label={I18nT("测试页面地址", "Test page URL")}
          hint={I18nT(
            "先从本次任务工作区启动项目；不要填写包含密码或 Token 的链接。",
            "Start the app from this task's worktree. Do not include passwords or tokens in the URL.",
          )}
        >
          <input
            value={url}
            disabled={busy}
            onChange={(e) => {
              editedUrl.current = true;
              setUrl(e.target.value);
            }}
            placeholder="http://localhost:8000/rum/"
          />
        </Field>
        <div className="browser-test-workspace">
          <strong>{I18nT("本次任务工作区", "Task worktree")}</strong>
          <p className="mono">
            {state?.workspace ?? task.snapshot?.project.directory}
          </p>
          <button
            onClick={() =>
              void api
                .openWorkspace?.(task.id)
                .catch((e) => setError(e.message))
            }
          >
            {I18nT("打开工作区", "Open worktree")}
          </button>
        </div>
        <label className="check-line">
          <input
            type="checkbox"
            checked={nonProduction}
            disabled={busy}
            onChange={(e) => setNonProduction(e.target.checked)}
          />
          {I18nT(
            "我确认这是开发/测试环境，不是生产环境",
            "I confirm this is a development/test environment, not production",
          )}
        </label>
        <Field
          label={I18nT(
            "允许测试的应用与数据范围",
            "Allowed test applications and data",
          )}
          hint={I18nT(
            "例如：仅测试应用 ID 123 的设置；使用测试数据，说明必要的恢复方式。不要填写账号密码。",
            "For example: settings of test application ID 123 only. Use test data and describe restoration if needed. Do not enter credentials.",
          )}
        >
          <textarea
            rows={3}
            value={scope}
            disabled={busy}
            onChange={(e) => setScope(e.target.value)}
          />
        </Field>
        <Field
          label={I18nT(
            "额外允许的测试后端域名（可选）",
            "Additional allowed test backend origins (optional)",
          )}
          hint={I18nT(
            "默认只允许测试页面同源请求。需要跨域测试接口时，每行填写一个非生产域名，包含协议和端口，不含路径。",
            "Only same-origin test requests are allowed by default. For cross-origin test APIs, enter one non-production origin per line, with protocol and port but no path.",
          )}
        >
          <textarea
            rows={2}
            value={origins}
            disabled={busy}
            onChange={(e) => setOrigins(e.target.value)}
            placeholder="https://test.example.com"
          />
        </Field>
        <label className="check-line">
          <input
            type="checkbox"
            checked={sourceConfirmed}
            disabled={busy}
            onChange={(e) => setSourceConfirmed(e.target.checked)}
          />
          {I18nT(
            "我确认该页面运行的是上述任务工作区代码（此项由我确认，不是 Studio 自动证明）",
            "I confirm the page runs the task worktree code above (user attestation, not automatic proof)",
          )}
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={allowWrites}
            disabled={busy}
            onChange={(e) => setAllowWrites(e.target.checked)}
          />
          {I18nT(
            "允许在上述测试范围内点击、填写与保存；不允许删除、发布或部署",
            "Allow clicking, filling and saving within the test scope above; no deletion, publishing or deployment",
          )}
        </label>
        <Notice>
          {I18nT(
            "先填写范围，再分别打开并登录必需的浏览器。深层地址返回 404 时，可从首页进入后手动打开目标页面；不必反复重试整项任务。",
            "Set the scope, then open and log in to each required browser. If a deep link returns 404, enter through the home page and navigate manually; do not keep retrying the whole task.",
          )}
        </Notice>
        <div className="browser-test-browsers">
          {(state?.browsers ?? []).map((item) => (
            <section className="browser-test-card" key={item.browser}>
              <div className="browser-test-card-title">
                <strong>
                  {item.browser === "chrome" ? "Chrome" : "Firefox"}
                  {state!.required.includes(item.browser)
                    ? ` · ${I18nT("本计划必需", "Required by plan")}`
                    : ` · ${I18nT("可选", "Optional")}`}
                </strong>
                <span>{labels[item.phase]}</span>
              </div>
              {item.url && <p className="mono">{item.url}</p>}
              {item.title && <p>{item.title}</p>}
              {item.httpStatus !== undefined && (
                <p>
                  HTTP {item.httpStatus}
                  {item.version ? ` · ${item.version}` : ""}
                </p>
              )}
              {item.detail && <p>{item.detail}</p>}
              {(item.httpStatus ?? 0) >= 400 && (
                <Notice>
                  {I18nT(
                    "服务器返回错误页。先从首页进入并打开目标页面，再确认登录；404 不代表业务用例执行失败。",
                    "The server returned an error page. Enter through home, navigate to the target page, then confirm login. A 404 is not a business-test assertion failure.",
                  )}
                </Notice>
              )}
              <div className="browser-test-card-actions">
                <button
                  disabled={
                    busy ||
                    item.phase === "installing" ||
                    !nonProduction ||
                    !url.trim() ||
                    activeStatuses.includes(task.status)
                  }
                  onClick={() => void execute("open", item.browser)}
                >
                  {I18nT("打开专用测试浏览器", "Open dedicated test browser")}
                </button>
                {["login", "ready"].includes(item.phase) && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => void execute("home", item.browser)}
                    >
                      {I18nT("从首页进入", "Enter through home")}
                    </button>
                    <button
                      disabled={busy || !formReady}
                      onClick={() => void execute("confirm", item.browser)}
                    >
                      {I18nT(
                        "已登录，确认此浏览器",
                        "Logged in, confirm this browser",
                      )}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void execute("close", item.browser)}
                    >
                      {I18nT("关闭测试浏览器", "Close test browser")}
                    </button>
                  </>
                )}
                {item.phase === "installing" && (
                  <button
                    disabled={busy}
                    onClick={() => void execute("close", item.browser)}
                  >
                    {I18nT("取消组件下载", "Cancel component download")}
                  </button>
                )}
                {item.browser === "firefox" &&
                  ["closed", "error"].includes(item.phase) && (
                    <button
                      disabled={busy || Boolean(installing)}
                      onClick={() => void execute("install", item.browser)}
                    >
                      {I18nT(
                        "下载 Firefox 测试组件",
                        "Download Firefox test component",
                      )}
                    </button>
                  )}
              </div>
              {item.browser === "firefox" && (
                <small>
                  {I18nT(
                    "首次使用需要联网下载版本匹配的组件，仅写入当前用户缓存，不修改业务项目。Chrome 通过不能代替 Firefox 通过。",
                    "First use requires a matching component download into the current user's cache, without changing the business project. Chrome success cannot substitute for Firefox success.",
                  )}
                </small>
              )}
            </section>
          ))}
        </div>
        <div className="browser-test-card-actions">
          <button onClick={close}>{I18nT("稍后继续", "Continue later")}</button>
          <button
            className="primary"
            disabled={
              busy ||
              Boolean(installing) ||
              !formReady ||
              !state?.ready ||
              !["waiting-test", "failed", "stopped"].includes(task.status)
            }
            onClick={() => void continueTests()}
          >
            {busy
              ? I18nT("正在处理…", "Working…")
              : I18nT("开始/继续验证", "Start / continue verification")}
          </button>
        </div>
        <small>
          {I18nT(
            "浏览器确认不代表测试通过。修改代码、关闭浏览器或退出 Studio 后，可能需要重新打开并登录；密码和 Cookie 不会写入任务记录。",
            "Browser confirmation does not mean tests passed. Code changes, closing a browser or quitting Studio may require reopening and logging in. Passwords and cookies are not written to task records.",
          )}
        </small>
      </div>
    </PreviewDrawer>
  );
}
