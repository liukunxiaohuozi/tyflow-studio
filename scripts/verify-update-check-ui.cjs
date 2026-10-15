// Real renderer/preload/main integration; remote responses are deterministic fixtures.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { _electron, expect } = require("playwright/test");

async function main() {
  const root = path.resolve(__dirname, "..");
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "studio-update-check-"));
  const evidence = path.join(root, "test-results/update-check-ui");
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(
    path.join(data, "state.json"),
    JSON.stringify({
      schemaVersion: 1,
      settings: {
        developer: { name: "Fixture", email: "", defaultProject: "fixture" },
        projects: [
          {
            id: "fixture",
            name: "Fixture",
            directory: data,
            repository: "",
            auth: "system",
            username: "",
            startScript: "start",
            targetUrl: "http://localhost:8000",
            defaultBranchMode: "existing",
          },
        ],
        agent: {
          command: "nonexistent-fixture-agent",
          tyflowDirectory: data,
          testSkill: path.join(data, "SKILL.md"),
        },
        zentao: { enabled: false, url: "", username: "", mappings: {} },
        notifications: { enabled: false, desktop: false },
        theme: "#1677FF",
        language: "zh-CN",
        updates: {
          manifestUrl: "",
          githubRepository: "fixture/studio",
          checkOnLaunch: false,
        },
      },
      tasks: [],
    }),
  );
  const env = { ...process.env, STUDIO_UI_TEST: "1", STUDIO_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.STUDIO_SMOKE;
  let app, child;
  try {
    app = await _electron.launch({
      executablePath: path.join(
        root,
        "node_modules/electron/dist",
        process.platform === "win32"
          ? "electron.exe"
          : "Electron.app/Contents/MacOS/Electron",
      ),
      args: [path.join(root, "tests/fixtures/update-check-entry.cjs")],
      env,
      timeout: 30000,
    });
    child = app.process();
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "开发配置", exact: true }).click();
    await page.getByRole("button", { name: "客户端更新", exact: true }).click();
    const check = page.getByRole("button", { name: "检查新版本", exact: true });
    const status = () => page.evaluate(() => window.studio.updateStatus());
    for (let attempt = 0; attempt < 2; attempt++) {
      await check.click();
      await expect(page.locator(".toast")).toHaveText("已是最新版本");
      await expect.poll(async () => (await status()).status).toBe("current");
    }
    assert.equal(
      await app.evaluate(() => globalThis.updateCheckFixture.requests.length),
      2,
    );
    await page.screenshot({ path: path.join(evidence, "current.png") });
    await app.evaluate(() => {
      globalThis.updateCheckFixture.mode = "offline";
    });
    await check.click();
    await expect(
      page
        .locator(".panel")
        .getByText(
          "暂时无法连接更新服务器，请检查网络、VPN 或系统代理后重试；本次未能确认是否为最新版本。",
          { exact: true },
        ),
    ).toBeVisible();
    await expect.poll(async () => (await status()).status).toBe("failed");
    // A failed check immediately replaces any previous success toast.
    await expect(page.locator(".toast")).toContainText("本次未能确认");
    await expect(page.locator(".toast")).toHaveAttribute("role", "alert");
    await page.screenshot({ path: path.join(evidence, "offline.png") });
    await app.evaluate(() => {
      globalThis.updateCheckFixture.mode = "newer";
    });
    await check.click();
    await expect.poll(async () => (await status()).status).toBe("available");
    await expect(
      page.getByRole("button", { name: "下载更新", exact: true }),
    ).toBeVisible();
    assert.equal((await status()).version, "99.0.0");
    await app.evaluate(() => {
      globalThis.updateCheckFixture.mode = "current";
    });
    await check.click();
    await expect(page.locator(".toast")).toHaveText("已是最新版本");
    assert.equal((await status()).error, undefined);
    assert.equal((await status()).version, undefined);
    const requests = await app.evaluate(
      () => globalThis.updateCheckFixture.requests,
    );
    assert.equal(requests.length, 6);
    fs.writeFileSync(
      path.join(evidence, "result.json"),
      JSON.stringify(
        {
          passed: true,
          platform: process.platform,
          requests,
          scenarios: [
            "repeat current without manifest",
            "offline is not current",
            "newer remains available",
            "recovery clears stale error",
          ],
        },
        null,
        2,
      ),
    );
    await page.close();
    if (process.platform === "win32")
      await expect.poll(() => child.exitCode, { timeout: 10000 }).toBe(0);
  } finally {
    if (app && child?.exitCode === null) await app.close().catch(() => {});
    await fs.promises.rm(data, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}
main()
  .then(() => {
    console.log("Update check UI regression passed");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
