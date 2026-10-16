// Actual Electron/IPC/current checkout and an already-open browser; synthetic data only.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { _electron, chromium, expect } = require("playwright/test");
const esbuild = require("esbuild");

async function main() {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "studio-quick-ui-"));
  const repository = path.join(fixture, "repository");
  const data = path.join(fixture, "data");
  const executable = process.env.STUDIO_VERIFY_EXECUTABLE;
  const evidence = path.join(root, "test-results", executable ? "quick-flow-packaged-ui" : "quick-flow-ui");
  for (const directory of [repository, data, evidence, path.join(repository, "src"), path.join(fixture, "tyflow/shared")]) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(repository, "src/copy.txt"), "Old copy");
  // Deliberately no dependencies installed: quick development must not install them.
  fs.writeFileSync(path.join(repository, "package.json"), JSON.stringify({ private: true, dependencies: { "unused-fixture-dependency": "0.0.0" } }));
  const git = (...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8", windowsHide: true }).trim();
  git("init", "--initial-branch=main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid"); git("add", "."); git("commit", "-m", "fixture");
  fs.copyFileSync(path.join(root, "tests/fixtures/fake-codex.js"), path.join(fixture, "fake-codex.js"));
  fs.writeFileSync(path.join(fixture, "control.json"), JSON.stringify({ developmentFiles: { "src/copy.txt": "Updated copy" } }));
  fs.writeFileSync(path.join(fixture, "SKILL.md"), "Disposable formal testing skill; not invoked by this quick task.");
  fs.writeFileSync(path.join(fixture, "tyflow/shared/WORKFLOW.md"), "Disposable standard workflow; quick task must not load this.");
  const settingsBundle = path.join(fixture, "store.cjs");
  esbuild.buildSync({ entryPoints: [path.join(root, "src/main/store.ts")], bundle: true, platform: "node", format: "cjs", outfile: settingsBundle });
  const settings = require(settingsBundle).initialSettings();
  settings.projects = [{ id: "fixture", name: "Fixture", directory: repository, repository: "", auth: "system", username: "", startScript: "start", targetUrl: "http://localhost:8000", defaultBranchMode: "new" }];
  settings.developer.defaultProject = "fixture";
  settings.agent = { command: path.join(fixture, "fake-codex.js"), tyflowDirectory: path.join(fixture, "tyflow"), testSkill: path.join(fixture, "SKILL.md") };
  settings.notifications.enabled = false; settings.updates.checkOnLaunch = false;
  fs.writeFileSync(path.join(data, "state.json"), JSON.stringify({ schemaVersion: 1, settings, tasks: [] }));
  const server = http.createServer((request, response) => {
    if (request.url === "/copy") { response.end(fs.readFileSync(path.join(repository, "src/copy.txt"))); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><title>Already-running developer browser</title><h1>Existing page</h1><p id="copy"></p><script>async function refresh(){copy.textContent=await(await fetch("/copy")).text()}refresh();setInterval(refresh,200);</script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let app, browser;
  const result = { passed: false, packaged: Boolean(executable), businessTaskTouched: false };
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const existingPage = await browser.newPage();
    await existingPage.goto(`http://127.0.0.1:${server.address().port}/`);
    await expect(existingPage.locator("#copy")).toHaveText("Old copy");
    const env = { ...process.env, STUDIO_UI_TEST: "1", STUDIO_TEST_DATA: data, CODEX_HOME: path.join(fixture, "codex-home") };
    delete env.ELECTRON_RUN_AS_NODE;
    if (executable) env.STUDIO_SMOKE = "1"; else delete env.STUDIO_SMOKE;
    app = await _electron.launch({ executablePath: executable || path.join(root, "node_modules/electron/dist/electron.exe"), args: [...(executable ? [] : [root]), "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"], env, timeout: 30000 });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "新建任务", exact: true }).waitFor();
    if (executable) {
      await page.evaluate(async (directory) => { const initial = await window.studio.bootstrap(); await window.studio.saveSettings({ ...initial.settings, projects: initial.settings.projects.map(project => ({ ...project, directory })) }); }, repository);
      await page.reload();
    }
    await page.getByRole("button", { name: "新建任务", exact: true }).click();
    await expect(page.getByRole("tab", { name: "文字需求", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("combobox", { name: "执行方式", exact: true })).toHaveValue("quick");
    await expect(page.getByRole("checkbox", { name: /自动化测试介入/ })).not.toBeChecked();
    await page.getByLabel("任务名称", { exact: true }).fill("Quick copy fixture");
    await page.locator("textarea").first().fill("把 src/copy.txt 的 Old copy 改成 Updated copy，仅修改文案。");
    const start = Date.now();
    await page.getByRole("button", { name: "开始修改", exact: true }).click();
    await expect(page.getByText("Quick copy fixture", { exact: true }).first()).toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.studio.bootstrap())).tasks[0]?.status, { timeout: 30000 }).toBe("waiting-review");
    const task = (await page.evaluate(() => window.studio.bootstrap())).tasks[0];
    assert.equal(task.workflowMode, "quick"); assert.equal(task.autoTest, false); assert.equal(task.workspace, undefined);
    assert.equal(task.snapshot.project.directory, repository); assert.equal(git("branch", "--show-current"), "main");
    assert.equal(fs.existsSync(path.join(repository, "node_modules")), false);
    assert.equal(task.checkpoints.some(c => c.id.startsWith("analysis:") || c.id.startsWith("test:") || c.id === "development:dependencies" || c.id.startsWith("startup:")), false);
    const calls = fs.readFileSync(path.join(fixture, "calls.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(calls.map(call => call.stage), ["development"]);
    await expect(page.getByRole("button", { name: "测试准备 / 手动登录", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "启动项目进入验证", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", {name:"预览开发计划", exact:true})).toHaveCount(0);
    await expect(page.getByRole("button", {name:"查看测试用例", exact:true})).toHaveCount(0);
    await expect(existingPage.locator("#copy")).toHaveText("Updated copy");
    await expect(page.getByRole("button", { name: "自动化测试介入（可选）", exact: true })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => { const window=BrowserWindow.getAllWindows()[0]; window.restore(); window.show(); window.focus(); });
    await page.bringToFront(); await page.screenshot({ path: path.join(evidence, "manual-finish.png"), animations: "disabled" });
    await existingPage.screenshot({ path: path.join(evidence, "existing-browser-updated.png"), animations: "disabled" });
    Object.assign(result, { passed: true, elapsedMs: Date.now() - start, currentDirectoryEdited: true, currentBranchPreserved: true, oneDevelopmentCall: true, dependencyInstallationCount: 0, formalTestCount: 0, noBrowserLoginOrStartupDialog: true, alreadyOpenPageObservedUpdate: true, manualReviewNotFakedAsAutomation: !task.testExecution, optionalTestingVisible: true });
  } catch (error) { result.error = error.message; fs.writeFileSync(path.join(evidence, `failure-${Date.now()}.json`), JSON.stringify(result, null, 2)); throw error; }
  finally {
    await app?.close().catch(() => {}); await browser?.close().catch(() => {});
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    await fs.promises.rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  console.log("Quick current-workspace/manual-review UI passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
