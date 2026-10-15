// Real Electron + IPC + deterministic Codex subprocess, disposable Git/user data only.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { _electron, expect } = require("playwright/test");

async function main() {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "studio-plan-ui-"));
  const repository = path.join(fixture, "repository"),
    data = path.join(fixture, "data");
  const evidence = path.join(root, "test-results/plan-recovery-ui");
  for (const directory of [
    repository,
    data,
    evidence,
    path.join(fixture, "tyflow/shared"),
  ])
    fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(repository, "package.json"),
    JSON.stringify({ private: true, scripts: { test: "node verify.cjs" } }),
  );
  fs.writeFileSync(
    path.join(repository, "verify.cjs"),
    "console.log('fixture')",
  );
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: repository,
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  git("init", "--initial-branch=main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("add", ".");
  git("commit", "-m", "fixture");
  fs.copyFileSync(
    path.join(root, "tests/fixtures/fake-codex.js"),
    path.join(fixture, "fake-codex.js"),
  );
  fs.writeFileSync(
    path.join(fixture, "tyflow/shared/WORKFLOW.md"),
    "Fixture workflow",
  );
  fs.writeFileSync(path.join(fixture, "SKILL.md"), "Fixture skill");
  function plan(empty) {
    return {
      summary: "设置保存文案变更",
      requirements: [
        {
          id: "REQ-001",
          text: "按端调整保存成功提示",
          priority: "P1",
          source: "description",
        },
      ],
      planSteps: Array.from({ length: 6 }, (_, index) => ({
        id: `PLAN-00${index + 1}`,
        title: `文案修改 ${index + 1}`,
        covers: ["REQ-001"],
        expectedFiles: index === 5 && empty ? [] : ["verify.cjs"],
      })),
      steps: ["调整保存成功提示"],
      risks: [],
      blockers: [],
      testCases: [
        {
          id: "CASE-001",
          title: "保存提示回归",
          covers: ["REQ-001"],
          verifies: Array.from(
            { length: 6 },
            (_, index) => `PLAN-00${index + 1}`,
          ),
          priority: "P1",
          steps: ["分别保存设置"],
          expected: "按端显示预期提示",
        },
      ],
    };
  }
  fs.writeFileSync(
    path.join(fixture, "control.json"),
    JSON.stringify({
      analysisResults: [plan(true), plan(true), plan(true), plan(false)],
    }),
  );
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
            directory: repository,
            repository: "",
            auth: "system",
            username: "",
            startScript: "start",
            targetUrl: "http://localhost:8000",
            defaultBranchMode: "existing",
          },
        ],
        agent: {
          command: path.join(fixture, "fake-codex.js"),
          tyflowDirectory: path.join(fixture, "tyflow"),
          testSkill: path.join(fixture, "SKILL.md"),
        },
        zentao: { enabled: false, url: "", username: "", mappings: {} },
        notifications: { enabled: false, desktop: false },
        theme: "#1677FF",
        language: "zh-CN",
        updates: {
          manifestUrl: "",
          githubRepository: "",
          checkOnLaunch: false,
        },
      },
      tasks: [],
    }),
  );
  const env = {
    ...process.env,
    STUDIO_UI_TEST: "1",
    STUDIO_TEST_DATA: data,
    CODEX_HOME: path.join(fixture, "codex-home"),
  };
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
      args: [root],
      env,
      timeout: 30000,
    });
    child = app.process();
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "工作台", exact: true }).waitFor();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const id = await page.evaluate(
      async () =>
        (
          await window.studio.saveTask({
            title: "计划格式回归",
            description: "三端保存提示文案变更",
            kind: "text",
            size: "small",
            projectId: "fixture",
            assetIds: [],
            autoTest: false,
            branch: {
              mode: "existing",
              base: "main",
              name: "main",
              version: "",
            },
          })
        ).id,
    );
    await page
      .getByRole("button", { name: "计划格式回归", exact: true })
      .click();
    await page.evaluate(
      (taskId) => window.studio.taskAction(taskId, "analyze"),
      id,
    );
    const task = () =>
      page.evaluate(
        async (taskId) =>
          (await window.studio.bootstrap()).tasks.find(
            (item) => item.id === taskId,
          ),
        id,
      );
    await expect
      .poll(async () => (await task()).status, { timeout: 30000 })
      .toBe("failed");
    const recovery = page.getByRole("region", { name: "阶段恢复" });
    await expect(recovery).toContainText("AGENT_PLAN_INVALID");
    await expect(recovery).toContainText("第 6 个计划步骤");
    await expect(recovery).not.toContainText("网络和额度");
    await page.screenshot({
      path: path.join(evidence, "invalid-plan.png"),
      fullPage: true,
    });
    const before = await task();
    assert.equal(before.plan, undefined);
    await page.getByRole("button", { name: "直接重试", exact: true }).click();
    await expect
      .poll(async () => (await task()).status, { timeout: 30000 })
      .toBe("ready");
    const after = await task();
    assert.equal(after.id, id);
    assert.equal(after.snapshot, undefined);
    assert.deepEqual(after.plan.planSteps[5].expectedFiles, ["verify.cjs"]);
    await expect(recovery).not.toContainText("AGENT_PLAN_INVALID");
    const calls = fs
      .readFileSync(path.join(fixture, "calls.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(calls.length, 4);
    assert(
      calls.every(
        (call) => call.stage === "analysis" && call.args.includes("read-only"),
      ),
    );
    assert.equal(git("status", "--porcelain"), "");
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: path.join(evidence, "ready-plan.png"),
      fullPage: true,
    });
    fs.writeFileSync(
      path.join(evidence, "result.json"),
      JSON.stringify(
        {
          passed: true,
          platform: process.platform,
          sameTaskRecovered: true,
          readOnlyCalls: calls.length,
          failedCode: before.failure.code,
          finalStatus: after.status,
          noDevelopmentSnapshot: true,
          gitClean: true,
          pageErrors: errors,
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
    await fs.promises.rm(fixture, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}
main()
  .then(() => {
    console.log("Plan recovery UI regression passed");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
