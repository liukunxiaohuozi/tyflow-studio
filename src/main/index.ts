import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  session,
  shell,
  Menu,
  IpcMainInvokeEvent,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Store } from "./store";
import { Vault } from "./vault";
import { StudioService } from "./service";
import { redact, validateTaskInput } from "./validation";
import { normalizeScreenshot, screenshotThumbnail } from "./images";
import { notificationForTransition } from "./notifications";

let main: BrowserWindow | undefined;
let service: StudioService | undefined;
let bootstrapServed = false;
const taskStatuses = new Map<string, import("../shared/contracts").TaskStatus>();
if (process.platform === "win32") app.setAppUserModelId("com.tyflow.studio");
if (process.env.STUDIO_TEST_DATA && process.env.STUDIO_SMOKE === "1")
  app.setPath("userData", path.resolve(process.env.STUDIO_TEST_DATA));
else {
  const current = app.getPath("userData");
  const legacy = path.join(app.getPath("appData"), "Tyflow Studio");
  if (
    path.resolve(current) !== path.resolve(legacy) &&
    !fs.existsSync(path.join(current, "state.json")) &&
    fs.existsSync(path.join(legacy, "state.json"))
  ) {
    fs.mkdirSync(current, { recursive: true });
    for (const name of [
      "state.json",
      "credentials.json",
      "repository-sync.json",
      "assets",
      "runs",
    ]) {
      const source = path.join(legacy, name);
      if (fs.existsSync(source))
        fs.cpSync(source, path.join(current, name), { recursive: true });
    }
  }
}
const uuid = z.string().uuid();
const devUrl =
  process.env.STUDIO_DEV_URL === "http://127.0.0.1:5178"
    ? "http://127.0.0.1:5178"
    : undefined;
function validSender(event: IpcMainInvokeEvent) {
  if (
    !main ||
    event.sender !== main.webContents ||
    event.senderFrame !== main.webContents.mainFrame
  )
    throw new Error("Untrusted IPC sender");
  const url = event.senderFrame.url;
  const expected =
    devUrl ??
    pathToFileURL(path.join(__dirname, "../renderer/index.html")).href;
  if (
    new URL(url).origin !== new URL(expected).origin ||
    (!devUrl && url.split("#")[0] !== expected)
  )
    throw new Error("Untrusted IPC origin");
}
function handle(channel: string, fn: (...args: unknown[]) => unknown) {
  ipcMain.handle("studio:" + channel, async (event, ...args) => {
    validSender(event);
    try {
      return await fn(...args);
    } catch (e) {
      throw new Error(redact(e instanceof Error ? e.message : String(e)));
    }
  });
}
function windowSecurity(
  win: BrowserWindow,
  allowNavigate?: (url: string) => boolean,
) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!allowNavigate?.(url)) event.preventDefault();
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_w, _p, callback) =>
    callback(false),
  );
  win.webContents.session.setPermissionCheckHandler(() => false);
}
async function preview(id: string, page?: string) {
  const assets = service!.assets;
  const file = assets.filePath(id, page);
  const root = path.resolve(assets.rootPath(id));
  const partition = "preview-" + randomUUID();
  const isolated = session.fromPartition(partition);
  isolated.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false;
    try {
      const u = new URL(details.url);
      if (u.protocol === "file:") {
        const rel = path.relative(root, fileURLToPath(u));
        allowed = !rel.startsWith("..") && !path.isAbsolute(rel);
      } else allowed = ["data:", "blob:", "about:"].includes(u.protocol);
    } catch {
      /* reject unknown request */
    }
    callback({ cancel: !allowed });
  });
  isolated.webRequest.onHeadersReceived((details, callback) =>
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' file: data: blob:; script-src 'self' file: 'unsafe-inline'; style-src 'self' file: 'unsafe-inline'; connect-src 'none'; object-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'",
        ],
      },
    }),
  );
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    title:
      service!.assets.get(id).kind === "design"
        ? "设计预览 · 隔离窗口"
        : "附件预览",
    parent: main,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      partition,
    },
  });
  windowSecurity(win, (url) => {
    try {
      const u = new URL(url);
      if (u.protocol !== "file:") return false;
      const page = path
        .relative(root, fileURLToPath(u))
        .split(path.sep)
        .join("/");
      return (
        Boolean(assets.get(id).pages?.includes(page)) &&
        assets.filePath(id, page) === fileURLToPath(u)
      );
    } catch {
      return false;
    }
  });
  await win.loadFile(file);
}
function bind() {
  handle("compare-designs", (before, after) =>
    service!.assets.compareDesigns(uuid.parse(before), uuid.parse(after)),
  );
  handle("bootstrap", () => {
    bootstrapServed = true;
    return service!.bootstrap();
  });
  handle("settings", (value) => service!.saveSettings(value as never));
  handle("directory", async () => {
    const result = await dialog.showOpenDialog(main!, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle("import", async (kind, paths) => {
    const type = z.enum(["design", "attachment"]).parse(kind);
    let selected: string[];
    if (paths !== undefined)
      selected = z
        .array(z.string().min(1).max(4000))
        .min(1)
        .max(30)
        .parse(paths);
    else {
      const result = await dialog.showOpenDialog(main!, {
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: type === "design" ? "Design" : "Evidence",
            extensions:
              type === "design"
                ? ["zip", "html", "htm"]
                : ["png", "jpg", "jpeg", "webp", "gif", "txt", "log"],
          },
        ],
      });
      if (result.canceled) return [];
      selected = result.filePaths;
    }
    return service!.assets.importFiles(selected, type);
  });
  handle("import-image", (bytes) =>
    service!.assets.importImage(normalizeScreenshot(bytes)),
  );
  handle("image-thumbnail", (id) => {
    const asset = service!.assets.get(uuid.parse(id));
    if (
      asset.kind !== "attachment" ||
      !/\.(png|jpe?g|gif|webp)$/i.test(asset.name)
    )
      throw new Error("该附件不是图片");
    return screenshotThumbnail(service!.assets.filePath(asset.id));
  });
  handle("preview", (id, page) =>
    preview(
      uuid.parse(id),
      page === undefined ? undefined : z.string().max(4000).parse(page),
    ),
  );
  handle("repository", (id, sync) =>
    service!.repository(
      z.string().max(60).parse(id),
      sync === undefined ? false : z.boolean().parse(sync),
    ),
  );
  handle("connection", (target, id) =>
    service!.testConnection(
      z.enum(["git", "agent", "zentao"]).parse(target),
      id === undefined ? undefined : z.string().max(60).parse(id),
    ),
  );
  handle("open-zentao", (type, id) =>
    service!.openZentao(
      z.enum(["story", "task", "bug"]).parse(type),
      z.string().regex(/^\d{1,12}$/).parse(id),
    ),
  );
  handle("zentao-catalog", () => service!.zentaoCatalog());
  handle("save-task", (input, id) =>
    service!.saveTask(
      validateTaskInput(input),
      id === undefined ? undefined : uuid.parse(id),
    ),
  );
  handle("action", (id, action, options) =>
    service!.action(
      uuid.parse(id),
      z
        .enum([
          "repair",
          "fix",
          "analyze",
          "develop",
          "test",
          "start",
          "stop",
          "terminate",
          "accept",
          "retry",
        ])
        .parse(action),
      options === undefined
        ? undefined
        : z
            .object({
              planFeedback: z.string().trim().min(1).max(8000).optional(),
              allowDirty: z.boolean().optional(),
            })
            .strict()
            .parse(options),
    ),
  );
  handle("open-target", (id) => service!.openTarget(uuid.parse(id)));
  handle("export", async (id) => {
    const task = service!.store.getTask(uuid.parse(id));
    const result = await dialog.showSaveDialog(main!, {
      defaultPath: `tingyun-${task.id}.json`,
      filters: [{ name: "Task snapshot", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, JSON.stringify(task, null, 2), {
      mode: 0o600,
    });
    return result.filePath;
  });
}
async function createWindow() {
  main = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    title: "TingYun Studio",
    backgroundColor: "#f0f1f5",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  windowSecurity(main);
  main.once("ready-to-show", () => main?.show());
  main.on("closed", () => {
    main = undefined;
  });
  if (devUrl) await main.loadURL(devUrl);
  else await main.loadFile(path.join(__dirname, "../renderer/index.html"));
  // Windows can honor SW_HIDE for the first show() after a hidden launch.
  // Loading and first paint are independent opportunities to reveal the window.
  main.show();
  if (process.env.STUDIO_SMOKE === "1") {
    const report = {
      ready: true,
      title: main.getTitle(),
      url: main.webContents.getURL(),
    };
    fs.writeFileSync(
      path.join(app.getPath("userData"), "smoke.json"),
      JSON.stringify(report, null, 2),
    );
    setTimeout(() => {
      fs.writeFileSync(
        path.join(app.getPath("userData"), "smoke.json"),
        JSON.stringify(
          {
            ...report,
            bootstrapServed,
            visible: main?.isVisible(),
            minimized: main?.isMinimized(),
          },
          null,
          2,
        ),
      );
      app.quit();
    }, 2500);
  }
}
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on("second-instance", () => {
    if (main) {
      if (main.isMinimized()) main.restore();
      main.show();
      main.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      Menu.setApplicationMenu(
        process.platform === "darwin"
          ? Menu.buildFromTemplate([
              {
                label: "TingYun Studio",
                submenu: [{ role: "about" }, { role: "quit" }],
              },
              {
                label: "Edit",
                submenu: [
                  { role: "undo" },
                  { role: "redo" },
                  { type: "separator" },
                  { role: "cut" },
                  { role: "copy" },
                  { role: "paste" },
                  { role: "selectAll" },
                ],
              },
              {
                label: "View",
                submenu: [
                  { role: "resetZoom" },
                  { role: "zoomIn" },
                  { role: "zoomOut" },
                ],
              },
            ])
          : null,
      );
      const store = new Store(app.getPath("userData"), {
        resourcesPath: process.resourcesPath,
      });
      if (process.env.STUDIO_TEST_DATA && process.env.STUDIO_SMOKE === "1") {
        const settings = store.settings();
        settings.projects = settings.projects.map((project) => ({
          ...project,
          directory: path.join(store.directory, "unconfigured-fixture"),
          repository: "",
        }));
        store.saveSettings(settings);
      }
      const vault = new Vault(store.directory);
      service = new StudioService(
        store,
        vault,
        (task) => {
          const previous = taskStatuses.get(task.id);
          taskStatuses.set(task.id, task.status);
          if (main && !main.isDestroyed()) {
            main.webContents.send("studio:task", task);
            const message = notificationForTransition(
              previous,
              task,
              store.settings().language,
            );
            const notificationSettings = store.settings().notifications;
            const milestoneEnabled =
              task.status === "ready"
                ? notificationSettings.milestones.planReady
                : task.status === "waiting-test"
                  ? notificationSettings.milestones.developmentComplete
                  : task.status === "review"
                    ? notificationSettings.milestones.acceptanceReady
                    : task.status === "failed"
                      ? notificationSettings.milestones.failed
                      : false;
            if (
              message &&
              notificationSettings.enabled &&
              notificationSettings.desktop &&
              milestoneEnabled &&
              !main.isFocused() &&
              Notification.isSupported()
            ) {
              const notification = new Notification(message);
              notification.on("click", () => {
                if (!main || main.isDestroyed()) return;
                if (main.isMinimized()) main.restore();
                main.show();
                main.focus();
              });
              notification.show();
            }
          }
        },
        (url) => shell.openExternal(url),
      );
      bind();
      await createWindow();
    })
    .catch((error) => {
      if (process.env.STUDIO_SMOKE === "1") {
        fs.writeFileSync(
          path.join(app.getPath("userData"), "smoke-error.txt"),
          redact(String(error)),
        );
        app.quit();
        return;
      }
      dialog.showErrorBox("TingYun Studio 启动失败", redact(String(error)));
      app.quit();
    });
  app.on("activate", () => {
    if (!main) void createWindow();
    else {
      if (main.isMinimized()) main.restore();
      main.show();
      main.focus();
    }
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => service?.close());
}
