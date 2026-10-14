import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WeComNotifier, wecomContent } from "../src/main/providers/wecom";
import { validateWeComWebhook } from "../src/main/providers/wecom-webhook";
import {
  NotificationProvider,
  notificationForTransition,
} from "../src/main/providers/notification";
import { Store } from "../src/main/store";
import { StudioService } from "../src/main/service";
import { redact, validateSettings } from "../src/main/policy";

const webhook =
  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=fixture-private-key";
const message = {
  title: "开发完成",
  body: "Sensitive logs must not be included",
};
let root: string;
let store: Store;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-wecom-"));
  store = new Store(root);
});
afterEach(() => {
  jest.useRealTimers();
  fs.rmSync(root, { recursive: true, force: true });
});
function task() {
  return store.saveTask({
    title: "修复筛选",
    description: "private requirement",
    kind: "bug",
    size: "small",
    projectId: "explore",
    branch: { mode: "existing", base: "main", name: "", version: "" },
    assetIds: [],
    autoTest: false,
  });
}
const success = () =>
  new Response(JSON.stringify({ errcode: 0, errmsg: "ok" }), { status: 200 });
test("accepts only a single-key official HTTPS webhook", () =>
  expect(validateWeComWebhook(webhook)).toBe(webhook));
test.each([
  "http://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret",
  "https://localhost/cgi-bin/webhook/send?key=secret",
  "https://qyapi.weixin.qq.com.evil.example/cgi-bin/webhook/send?key=secret",
  "https://secret@qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret",
  "https://qyapi.weixin.qq.com:8443/cgi-bin/webhook/send?key=secret",
  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret#secret",
  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret&key=secret",
  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret&url=http://localhost",
  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=%0Asecret",
  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=",
  "https://qyapi.weixin.qq.com/cgi-bin/gettoken?key=secret",
  " secret",
])(
  "rejects untrusted or malformed webhook without echoing credential: %s",
  (url) => {
    expect(() => validateWeComWebhook(url)).toThrow("请填写有效");
    try {
      validateWeComWebhook(url);
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
  },
);
test("text payload is UTF-8 bounded, sanitized and omits sensitive task detail", () => {
  const t = task();
  t.title = "fixture-private-key @all\n" + "😀中".repeat(900);
  t.error = "secret error";
  const content = wecomContent(message, t, store.settings(), (s) =>
    redact(s, ["fixture-private-key"]),
  );
  expect(Buffer.byteLength(content)).toBeLessThan(2048);
  for (const secret of [
    "private requirement",
    "fixture-private-key",
    "secret error",
    message.body,
    "@all",
    "�",
  ])
    expect(content).not.toContain(secret);
  expect(content).toContain("项目：explore");
  expect(content).toContain("分支：main");
});
test("test sends exactly one plain message and checks the business response", async () => {
  const transport = jest.fn(async () => success());
  await new WeComNotifier(root, () => webhook, transport).test();
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, init] = transport.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe(webhook);
  expect(init).toMatchObject({ method: "POST", redirect: "error" });
  expect(JSON.parse(init.body as string)).toEqual({
    msgtype: "text",
    text: {
      content:
        "TingYun Studio 通知连接测试\n这是一条由本地配置页主动发送的测试消息，不包含项目或任务内容。",
    },
  });
});
test.each([{ errcode: 93000, errmsg: webhook }, { errcode: "0" }, {}, null])(
  "HTTP 200 alone is not success: %j",
  async (result) => {
    const sender = new WeComNotifier(
      root,
      () => webhook,
      async () => new Response(JSON.stringify(result)),
    );
    await expect(sender.test()).rejects.toThrow("企业微信未确认");
  },
);
test("HTTP failure and malformed response never expose URL or server text", async () => {
  const http = new WeComNotifier(
    root,
    () => webhook,
    async () => new Response(webhook, { status: 403 }),
  );
  await expect(http.test()).rejects.toThrow("HTTP 403");
  const bad = new WeComNotifier(
    root,
    () => webhook,
    async () => new Response(webhook),
  );
  await expect(bad.test()).rejects.toThrow("送达状态不确定");
});
test("transport exception is untrusted even if it resembles a local error", async () => {
  const sender = new WeComNotifier(
    root,
    () => webhook,
    async () => {
      throw new Error("企业微信 " + webhook);
    },
  );
  await expect(sender.test()).rejects.toThrow("网络异常");
  try {
    await sender.test();
  } catch (error) {
    expect(String(error)).not.toContain("fixture-private-key");
  }
});
test("ten-second timeout aborts without automatic retransmission", async () => {
  jest.useFakeTimers();
  const transport = jest.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init.signal!.addEventListener("abort", () =>
          reject(new Error(webhook)),
        ),
      ),
  );
  const work = new WeComNotifier(root, () => webhook, transport).test();
  const assertion = expect(work).rejects.toThrow("送达状态不确定");
  await jest.advanceTimersByTimeAsync(10_000);
  await assertion;
  expect(transport).toHaveBeenCalledTimes(1);
});
test("dedupes parallel delivery and restart, with no credentials in receipts", async () => {
  const t = task();
  t.status = "waiting-review";
  const transport = jest.fn(async () => success());
  const sender = new WeComNotifier(root, () => webhook, transport);
  await Promise.all([
    sender.send(message, t, store.settings(), (s) => s),
    sender.send(message, t, store.settings(), (s) => s),
  ]);
  await new WeComNotifier(root, () => webhook, transport).send(
    message,
    t,
    store.settings(),
    (s) => s,
  );
  expect(transport).toHaveBeenCalledTimes(1);
  const raw = fs.readFileSync(
    path.join(root, "notification-receipts.json"),
    "utf8",
  );
  expect(raw).not.toContain("fixture-private-key");
  expect(raw).not.toContain(t.title);
  expect(raw).toContain('"sent"');
  t.planRevision++;
  await sender.send(message, t, store.settings(), (s) => s);
  expect(transport).toHaveBeenCalledTimes(2);
});
test("failed or interrupted receipts are not replayed; corrupt journal fails closed", async () => {
  const t = task();
  const transport = jest.fn(async () => {
    throw new Error("offline");
  });
  await expect(
    new WeComNotifier(root, () => webhook, transport).send(
      message,
      t,
      store.settings(),
      (s) => s,
    ),
  ).rejects.toThrow("网络异常");
  const file = path.join(root, "notification-receipts.json");
  const journal = JSON.parse(fs.readFileSync(file, "utf8"));
  journal[Object.keys(journal)[0]].state = "sending";
  fs.writeFileSync(file, JSON.stringify(journal));
  await new WeComNotifier(root, () => webhook, transport).send(
    message,
    t,
    store.settings(),
    (s) => s,
  );
  expect(transport).toHaveBeenCalledTimes(1);
  fs.writeFileSync(file, "invalid");
  expect(() => new WeComNotifier(root, () => webhook, transport)).toThrow(
    "去重记录损坏",
  );
});
test("rate guard limits attempts and includes explicit test sends", async () => {
  const transport = jest.fn(async () => success());
  const sender = new WeComNotifier(root, () => webhook, transport);
  for (let i = 0; i < 18; i++) await sender.test();
  await expect(sender.test()).rejects.toThrow("过于频繁");
  expect(transport).toHaveBeenCalledTimes(18);
});
test("credential replacement uses a distinct destination and genuine failure retry is a new event", async () => {
  let destination = webhook;
  const transport = jest.fn(async () => success());
  const sender = new WeComNotifier(root, () => destination, transport);
  const t = task();
  t.status = "failed";
  await sender.send(message, t, store.settings(), (s) => s);
  destination = webhook.replace("fixture-private-key", "other-fixture-key");
  await sender.send(message, t, store.settings(), (s) => s);
  t.failure = {
    category: "agent",
    code: "EXIT",
    stage: "development",
    checkpointId: "development:agent",
    message: "private-error",
    impact: [],
    recommendedActions: [],
    retryable: true,
    at: "2026-10-14T12:01:00Z",
  };
  await sender.send(message, t, store.settings(), (s) => s);
  expect(transport).toHaveBeenCalledTimes(3);
});
test("journal cannot be written: fail closed before the HTTP side effect", async () => {
  const transport = jest.fn(async () => success());
  const sender = new WeComNotifier(root, () => webhook, transport);
  fs.mkdirSync(path.join(root, "notification-receipts.json"));
  await expect(
    sender.send(message, task(), store.settings(), (s) => s),
  ).rejects.toThrow("记录保存失败");
  expect(transport).not.toHaveBeenCalled();
});
test("preview switch/startup does not replay the completed development milestone", async () => {
  const transport = jest.fn(async () => success());
  const sender = new WeComNotifier(root, () => webhook, transport);
  const t = task();
  t.status = "waiting-review";
  const run = {
    id: "dev-one",
    stage: "development" as const,
    startedAt: "now",
    finishedAt: "now",
    status: "passed" as const,
    checks: [],
  };
  t.runs = [run];
  await sender.send(message, t, store.settings(), (s) => s);
  t.runs.push({ ...run, id: "preview-one", stage: "startup" });
  await sender.send(message, t, store.settings(), (s) => s);
  expect(transport).toHaveBeenCalledTimes(1);
  t.runs.push({ ...run, id: "dev-two" });
  await sender.send(message, t, store.settings(), (s) => s);
  expect(transport).toHaveBeenCalledTimes(2);
});
test("summary identifies the actual isolated task branch, not the source base branch", () => {
  const t = task();
  t.workspace = {
    directory: "private-path",
    sourceDirectory: "private-source",
    branch: "studio/task-123",
    baseCommit: "abc",
  };
  const content = wecomContent(message, t, store.settings(), (s) => s);
  expect(content).toContain("分支：studio/task-123");
  expect(content).not.toContain("private-path");
  expect(content).not.toContain("private-source");
});
test("focus suppresses desktop only; switches and milestones suppress external sends", async () => {
  const send = jest.fn(async () => {}),
    desktop = jest.fn();
  const provider = new NotificationProvider([
    { channel: "wecom", enabled: (n) => n.wecom?.enabled ?? false, send },
    { channel: "desktop", enabled: (n) => n.desktop, send: desktop },
  ]);
  const settings = store.settings();
  settings.notifications.wecom = { enabled: true };
  const t = task();
  t.status = "waiting-review";
  await provider.dispatch("developing", t, settings, true);
  expect(send).toHaveBeenCalledTimes(1);
  expect(desktop).not.toHaveBeenCalled();
  await provider.dispatch(undefined, t, settings, false);
  await provider.dispatch(t.status, t, settings, false);
  settings.notifications.milestones.developmentComplete = false;
  await provider.dispatch("developing", t, settings, false);
  settings.notifications.enabled = false;
  t.status = "failed";
  await provider.dispatch("developing", t, settings, false);
  expect(send).toHaveBeenCalledTimes(1);
});
test("delivery notification requires successful push, not acceptance alone", () => {
  const t = task();
  t.status = "accepted";
  expect(notificationForTransition("review", t)).toBeUndefined();
  t.delivery = {
    commit: "abc",
    branch: "main",
    remote: "origin",
    pushedAt: new Date().toISOString(),
  };
  expect(notificationForTransition("review", t)?.title).toBe("代码已成功推送");
});
test("external-channel failure cannot fail workflow or prevent another channel", async () => {
  const t = task();
  t.status = "waiting-review";
  const desktop = jest.fn();
  const provider = new NotificationProvider([
    {
      channel: "wecom",
      enabled: () => true,
      send: async () => {
        throw new Error("network");
      },
    },
    { channel: "desktop", enabled: () => true, send: desktop },
  ]);
  await expect(
    provider.dispatch("developing", t, store.settings(), false),
  ).resolves.toEqual([
    { channel: "wecom", sent: false },
    { channel: "desktop", sent: true },
  ]);
  expect(desktop).toHaveBeenCalledTimes(1);
  expect(t.status).toBe("waiting-review");
});
test("settings validate before vault mutation; read-back hides secret and omission preserves it", async () => {
  const values: Record<string, string> = {};
  const setMany = jest.fn((input: Record<string, string>) => {
    for (const [k, v] of Object.entries(input)) {
      if (v) values[k] = v;
      else delete values[k];
    }
  });
  const credentials = {
    available: () => true,
    has: (k: string) => Boolean(values[k]),
    get: (k: string) => values[k] ?? "",
    setMany,
    secrets: () => Object.values(values),
  };
  const transport = jest.fn(async () => success());
  const service = new StudioService(
    store,
    credentials,
    () => {},
    async () => {},
    { wecomTransport: transport },
  );
  const settings = store.settings();
  settings.notifications.wecom = { enabled: true };
  expect(() =>
    service.saveSettings({
      ...settings,
      secrets: { wecom: "https://localhost/?key=secret" },
    }),
  ).toThrow("请填写有效");
  expect(setMany).not.toHaveBeenCalled();
  const saved = service.saveSettings({
    ...settings,
    secrets: { wecom: webhook },
  });
  expect(saved.notifications.wecom).toEqual({ enabled: true, hasSecret: true });
  expect(JSON.stringify(saved)).not.toContain("fixture-private-key");
  expect(fs.readFileSync(path.join(root, "state.json"), "utf8")).not.toContain(
    "fixture-private-key",
  );
  service.saveSettings(saved);
  expect(values.wecom).toBe(webhook);
  await expect(service.testConnection("wecom")).resolves.toMatchObject({
    ok: true,
  });
  expect(transport).toHaveBeenCalledTimes(1);
  service.saveSettings({ ...saved, secrets: { wecom: "" } });
  expect(service.settings().notifications.wecom?.hasSecret).toBe(false);
  await expect(service.testConnection("wecom")).resolves.toMatchObject({
    ok: false,
  });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(() =>
    validateSettings({ ...settings, secrets: { wecom: webhook } }),
  ).not.toThrow();
});
