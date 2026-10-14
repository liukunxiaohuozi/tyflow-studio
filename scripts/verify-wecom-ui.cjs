/* Actual Electron + preload + IPC + OS vault. HTTP is a deterministic sink, never a live group. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { _electron, expect } = require("playwright/test");

async function main() {
  const workspace = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "studio-wecom-ui-"));
  const evidence = path.join(workspace, "test-results", "wecom-ui");
  fs.mkdirSync(evidence, { recursive: true });
  const settings = {
    developer: {
      name: "Fixture",
      email: "fixture@example.invalid",
      defaultProject: "fixture",
    },
    projects: [
      {
        id: "fixture",
        name: "Fixture",
        directory: fixture,
        repository: "",
        auth: "system",
        username: "",
        startScript: "start:dev",
        targetUrl: "http://localhost:8000",
        defaultBranchMode: "existing",
      },
    ],
    agent: {
      command: "codex",
      tyflowDirectory: fixture,
      testSkill: path.join(fixture, "SKILL.md"),
    },
    zentao: { enabled: false, url: "", username: "", mappings: {} },
    notifications: {
      enabled: true,
      desktop: false,
      milestones: {
        planReady: true,
        developmentComplete: true,
        acceptanceReady: true,
        failed: true,
      },
    },
    theme: "#1677FF",
    language: "zh-CN",
    updates: { manifestUrl: "", githubRepository: "", checkOnLaunch: false },
  };
  fs.writeFileSync(
    path.join(fixture, "state.json"),
    JSON.stringify({ schemaVersion: 1, settings, tasks: [] }),
  );
  const env = {
    ...process.env,
    STUDIO_UI_TEST: "1",
    STUDIO_TEST_DATA: fixture,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.STUDIO_SMOKE;
  const app = await _electron.launch({
    executablePath: path.join(
      workspace,
      "node_modules",
      "electron",
      "dist",
      process.platform === "win32"
        ? "electron.exe"
        : "Electron.app/Contents/MacOS/Electron",
    ),
    args: [workspace],
    env,
    timeout: 45000,
  });
  const child = app.process();
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Main-process interception has no production IPC endpoint. Allow no actual WeCom egress.
    await app.evaluate(() => {
      globalThis.wecomFixtureCalls = [];
      globalThis.wecomFixtureCode = 0;
      const original = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        if (String(url).startsWith("https://qyapi.weixin.qq.com/")) {
          globalThis.wecomFixtureCalls.push(JSON.parse(init.body));
          return new Response(
            JSON.stringify({
              errcode: globalThis.wecomFixtureCode,
              errmsg: "fixture",
            }),
          );
        }
        return original(url, init);
      };
    });
    await page.getByRole("button", { name: "开发配置", exact: true }).click();
    await page.getByRole("button", { name: "完成通知", exact: true }).click();
    const send = page.getByRole("button", {
      name: "发送测试通知",
      exact: true,
    });
    await expect(send).toBeDisabled();
    await page.getByLabel("企业微信测试群通知", { exact: true }).check();
    await page
      .getByLabel("WeCom Webhook", { exact: true })
      .fill(
        "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=fixture-only-not-a-real-key",
      );
    await expect(send).toBeDisabled();
    expect(await app.evaluate(() => globalThis.wecomFixtureCalls.length)).toBe(
      0,
    );
    await page.getByRole("button", { name: "保存配置", exact: true }).click();
    await expect(send).toBeEnabled();
    await expect(page.getByLabel("WeCom Webhook", { exact: true })).toHaveValue(
      "",
    );
    const saved = await page.evaluate(
      async () => (await window.studio.bootstrap()).settings,
    );
    expect(saved.notifications.wecom).toEqual({
      enabled: true,
      hasSecret: true,
    });
    expect(JSON.stringify(saved)).not.toContain("fixture-only-not-a-real-key");
    expect(
      fs.readFileSync(path.join(fixture, "state.json"), "utf8"),
    ).not.toContain("fixture-only-not-a-real-key");
    expect(
      fs.readFileSync(path.join(fixture, "credentials.json"), "utf8"),
    ).not.toContain("fixture-only-not-a-real-key");
    await send.click();
    await expect(
      page.getByText("企业微信已确认接收测试通知，请在测试群核对消息", {
        exact: true,
      }),
    ).toBeVisible();
    const sent = await app.evaluate(() => globalThis.wecomFixtureCalls);
    expect(sent).toHaveLength(1);
    expect(sent[0].msgtype).toBe("text");
    expect(sent[0].text.content).toContain("通知连接测试");
    await page.screenshot({
      path: path.join(evidence, "configured.png"),
      fullPage: true,
      animations: "disabled",
    });
    await app.evaluate(() => {
      globalThis.wecomFixtureCode = 93000;
    });
    await send.click();
    await expect(
      page.getByText(
        "Error: 企业微信未确认通知成功（93000），请检查群机器人配置",
        { exact: true },
      ),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(evidence, "business-rejection.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "清除", exact: true }).click();
    await page.getByRole("button", { name: "保存配置", exact: true }).click();
    await expect(send).toBeDisabled();
    expect(
      (
        await page.evaluate(
          async () => (await window.studio.bootstrap()).settings,
        )
      ).notifications.wecom.hasSecret,
    ).toBe(false);
    expect(await app.evaluate(() => globalThis.wecomFixtureCalls.length)).toBe(
      2,
    );
    expect(errors).toEqual([]);
    fs.writeFileSync(
      path.join(evidence, "result.json"),
      JSON.stringify(
        {
          passed: true,
          platform: process.platform,
          credentialStorage: "actual OS safeStorage",
          transport: "isolated main-process stub; zero real group messages",
          assertions: [
            "unsaved cannot send",
            "save does not send",
            "encrypted credential",
            "no renderer secret read-back",
            "explicit test",
            "business rejection",
            "credential clear",
          ],
          payload: sent[0],
          errors,
        },
        null,
        2,
      ),
    );
    console.log(`WeCom Electron/IPC smoke passed. Evidence: ${evidence}`);
    if (process.platform === "win32") {
      await page.close();
      await expect.poll(() => child.exitCode, { timeout: 15000 }).toBe(0);
    }
  } finally {
    if (child.exitCode === null) await app.close().catch(() => {});
    await fs.promises.rm(fixture, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
