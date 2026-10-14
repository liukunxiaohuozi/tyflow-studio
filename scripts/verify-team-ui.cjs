/* Real Electron/IPC smoke against disposable Git data and a deterministic CLI. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { execFileSync } = require("node:child_process");
const { _electron, expect } = require("playwright/test");

async function main() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-team-ui-"));
  const repository = path.join(fixtureRoot, "repository"),
    data = path.join(fixtureRoot, "data");
  const evidence = path.join(
    repositoryRoot,
    "test-results",
    "team-readiness-ui",
  );
  fs.mkdirSync(repository);
  fs.mkdirSync(data);
  fs.mkdirSync(evidence, { recursive: true });
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  const git = (...args) =>
    execFileSync("git", args, { cwd: repository, stdio: "pipe" });
  git("init", "--initial-branch=main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  fs.writeFileSync(
    path.join(repository, "package.json"),
    JSON.stringify({
      scripts: {
        test: "node -e \"console.log('fixture')\"",
        "start:dev": "node server.cjs",
      },
    }),
  );
  fs.writeFileSync(
    path.join(repository, "server.cjs"),
    "require('node:http').createServer((req,res)=>res.end('Disposable task preview')).listen(Number(process.env.PORT),'127.0.0.1')",
  );
  git("add", ".");
  git("commit", "-m", "fixture base");
  fs.writeFileSync(path.join(repository, "unfinished.txt"), "keep source work");
  fs.copyFileSync(
    path.join(repositoryRoot, "tests", "fixtures", "fake-codex.js"),
    path.join(fixtureRoot, "fake-codex.js"),
  );
  fs.writeFileSync(path.join(fixtureRoot, "control.json"), '{"delay":1800}');
  fs.mkdirSync(path.join(fixtureRoot, "tyflow", "shared"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, "tyflow", "shared", "WORKFLOW.md"),
    "fixture workflow",
  );
  fs.writeFileSync(path.join(fixtureRoot, "SKILL.md"), "fixture skill");
  const settings = {
    developer: {
      name: "Fixture",
      email: "fixture@example.invalid",
      defaultProject: "other",
    },
    projects: [
      {
        id: "fixture",
        name: "Fixture project",
        directory: repository,
        repository: "",
        auth: "system",
        username: "",
        startScript: "start:dev",
        targetUrl: `http://127.0.0.1:${port}`,
        defaultBranchMode: "existing",
      },
    ],
    agent: {
      command: path.join(fixtureRoot, "fake-codex.js"),
      tyflowDirectory: path.join(fixtureRoot, "tyflow"),
      testSkill: path.join(fixtureRoot, "SKILL.md"),
    },
    zentao: { enabled: false, url: "", username: "", mappings: {} },
    notifications: {
      enabled: false,
      desktop: false,
      milestones: {
        planReady: false,
        developmentComplete: false,
        acceptanceReady: false,
        failed: false,
      },
    },
    execution: { concurrency: 2, previewMode: "single" },
    updates: {
      manifestUrl: "https://updates.example.invalid/manifest.json",
      githubRepository: "",
      checkOnLaunch: false,
    },
    theme: "#1677FF",
    language: "zh-CN",
  };
  settings.projects.push({
    ...settings.projects[0],
    id: "other",
    name: "Other project",
  });
  fs.writeFileSync(
    path.join(data, "state.json"),
    JSON.stringify({ schemaVersion: 1, settings, tasks: [] }),
  );
  const env = {
    ...process.env,
    STUDIO_UI_TEST: "1",
    STUDIO_TEST_DATA: data,
    CODEX_HOME: path.join(fixtureRoot, "codex-home"),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.STUDIO_SMOKE;
  const app = await _electron.launch({
    executablePath: path.join(
      repositoryRoot,
      "node_modules",
      "electron",
      "dist",
      process.platform === "win32"
        ? "electron.exe"
        : "Electron.app/Contents/MacOS/Electron",
    ),
    args: [repositoryRoot],
    env,
    timeout: 45000,
  });
  const electronProcess = app.process();
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await app.evaluate(() => {
      globalThis.teamWecomMessages = [];
      const original = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        if (String(url).startsWith("https://qyapi.weixin.qq.com/")) {
          globalThis.teamWecomMessages.push(JSON.parse(init.body));
          return new Response(JSON.stringify({ errcode: 0 }));
        }
        return original(url, init);
      };
    });
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const settings = (await window.studio.bootstrap()).settings;
            settings.notifications.enabled = true;
            settings.notifications.wecom = { enabled: true };
            for (const key of Object.keys(settings.notifications.milestones))
              settings.notifications.milestones[key] = true;
            try {
              await window.studio.saveSettings({
                ...settings,
                secrets: {
                  wecom:
                    "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=team-fixture-not-real",
                },
              });
              return "saved";
            } catch (error) {
              if (String(error).includes("远程同步中")) return "initial-sync";
              throw error;
            }
          }),
        { timeout: 15000 },
      )
      .toBe("saved");
    await page.evaluate(async () => {
      for (const projectId of ["fixture", "other"]) {
        await window.studio.saveTask({
          title: `${projectId} scoped draft`,
          kind: "bug",
          size: "small",
          description: "Project navigation fixture",
          projectId,
          assetIds: [],
          workspaceMode: "isolated",
          autoTest: false,
          branch: { mode: "existing", base: "main", name: "main", version: "" },
        });
      }
    });
    const projectButton = page
      .locator(".sidebar-projects button")
      .filter({ hasText: "Fixture project" });
    await projectButton.click();
    await expect(projectButton).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: "Fixture project", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "开发配置", exact: true }),
    ).not.toHaveClass(/selected/);
    await expect(
      page
        .locator("main table")
        .getByRole("button", { name: "fixture scoped draft", exact: true }),
    ).toBeVisible();
    await expect(page.locator("main table")).not.toContainText(
      "other scoped draft",
    );
    await expect(page.getByLabel("筛选项目")).toHaveCount(0);
    await page.screenshot({
      path: path.join(evidence, "project-workspace.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "在此项目新建任务", exact: true })
      .click();
    await expect(page.getByLabel("所属项目")).toHaveValue("fixture");
    await projectButton.click();
    await page.getByRole("button", { name: "工作台", exact: true }).click();
    await expect(page.getByLabel("所属项目")).toHaveValue("other");
    await page.getByRole("button", { name: "需求记录", exact: false }).click();
    await expect(page.locator("main table")).toContainText(
      "other scoped draft",
    );
    await expect(page.locator("main table")).toContainText(
      "fixture scoped draft",
    );
    await page.getByRole("button", { name: "开发配置", exact: true }).click();
    await page.getByRole("button", { name: "本地执行", exact: true }).click();
    await expect(page.getByLabel("同时执行任务数")).toHaveValue("2");
    await expect(page.getByLabel("项目验证方式")).toHaveValue("single");
    await page
      .getByRole("button", { name: "执行完整体检", exact: true })
      .click();
    await expect(
      page.getByText("Codex 执行与登录 · 通过", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await page.screenshot({
      path: path.join(evidence, "setup.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "客户端更新", exact: true }).click();
    await expect(
      page.getByText("内部客户端更新", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("内部更新清单地址（可选）")).toHaveValue(
      settings.updates.manifestUrl,
    );
    await page.screenshot({
      path: path.join(evidence, "updates.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "新建任务" }).click();
    await expect(page.getByLabel("任务工作区")).toHaveValue("isolated");
    await page.screenshot({
      path: path.join(evidence, "workspace-choice.png"),
      fullPage: true,
    });
    const ids = await page.evaluate(async () => {
      const ids = [];
      for (const title of ["并行任务 A", "并行任务 B", "排队任务 C"]) {
        const task = await window.studio.saveTask({
          title,
          kind: "bug",
          size: "small",
          description: "Fixture repair",
          projectId: "fixture",
          assetIds: [],
          workspaceMode: "isolated",
          branch: { mode: "existing", base: "main", name: "main", version: "" },
          autoTest: false,
        });
        ids.push(task.id);
        await window.studio.taskAction(task.id, "fix");
      }
      return ids;
    });
    await expect
      .poll(() =>
        page.evaluate(
          async (id) =>
            (await window.studio.bootstrap()).tasks.find(
              (task) => task.id === id,
            )?.status,
          ids[2],
        ),
      )
      .toBe("queued");
    await page.evaluate((id) => window.studio.taskAction(id, "stop"), ids[2]);
    await expect
      .poll(
        () =>
          page.evaluate(
            async () =>
              (await window.studio.bootstrap()).tasks.filter(
                (task) => task.status === "waiting-review",
              ).length,
          ),
        { timeout: 30000 },
      )
      .toBe(2);
    await expect
      .poll(
        () =>
          app.evaluate(
            () =>
              globalThis.teamWecomMessages.filter((message) =>
                message.text.content.startsWith(
                  "TingYun Studio · 开发修复完成",
                ),
              ).length,
          ),
        { timeout: 10000 },
      )
      .toBe(2);
    const developmentMessages = await app.evaluate(
      () => globalThis.teamWecomMessages,
    );
    expect(
      developmentMessages.some((message) =>
        message.text.content.includes("并行任务 A"),
      ),
    ).toBe(true);
    expect(
      developmentMessages.some((message) =>
        message.text.content.includes("并行任务 B"),
      ),
    ).toBe(true);
    const result = await page.evaluate(
      async () => (await window.studio.bootstrap()).tasks,
    );
    if (
      new Set(
        result
          .filter((task) => task.workspace)
          .map((task) => task.workspace.directory),
      ).size !== 2
    )
      throw new Error("Workspaces not independent");
    if (
      (await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      )) !== 1
    )
      throw new Error("Development opened an unexpected verification window");
    await page.evaluate((id) => window.studio.taskAction(id, "start"), ids[0]);
    await expect
      .poll(
        () =>
          page.evaluate(
            async (id) =>
              (await window.studio.bootstrap()).tasks.find(
                (task) => task.id === id,
              )?.status,
            ids[0],
          ),
        { timeout: 30000 },
      )
      .toBe("review");
    await page.evaluate((id) => window.studio.taskAction(id, "start"), ids[1]);
    await expect
      .poll(
        () =>
          page.evaluate(
            async (id) =>
              (await window.studio.bootstrap()).tasks.find(
                (task) => task.id === id,
              )?.status,
            ids[1],
          ),
        { timeout: 30000 },
      )
      .toBe("review");
    expect(
      await app.evaluate(
        () =>
          globalThis.teamWecomMessages.filter((message) =>
            message.text.content.startsWith("TingYun Studio · 开发修复完成"),
          ).length,
      ),
    ).toBe(2);
    const windows = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((win) => ({
        title: win.getTitle(),
        url: win.webContents.getURL(),
      })),
    );
    if (
      windows.length !== 2 ||
      !windows.some((win) => win.title.includes("并行任务 B"))
    )
      throw new Error("Verification window was not reused for task B");
    if (
      fs.readFileSync(path.join(repository, "unfinished.txt"), "utf8") !==
      "keep source work"
    )
      throw new Error("Original source changed");
    fs.writeFileSync(path.join(fixtureRoot, "control.json"), '{"delay":10000}');
    const recoveryId = await page.evaluate(async () => {
      const task = await window.studio.saveTask({
        title: "需求评估暂停恢复",
        kind: "text",
        size: "small",
        description:
          "Verify assessment recovery without replacing the requirement",
        projectId: "fixture",
        assetIds: [],
        workspaceMode: "isolated",
        autoTest: false,
        branch: { mode: "existing", base: "main", name: "main", version: "" },
      });
      await window.studio.taskAction(task.id, "analyze");
      return task.id;
    });
    await expect
      .poll(
        () => {
          const file = path.join(fixtureRoot, "calls.jsonl");
          return (
            fs.existsSync(file) &&
            fs.readFileSync(file, "utf8").includes('"stage":"analysis"')
          );
        },
        { timeout: 20000 },
      )
      .toBe(true);
    await page.getByRole("button", { name: "需求记录", exact: false }).click();
    await page
      .locator("main table")
      .getByRole("button", { name: "需求评估暂停恢复", exact: true })
      .click();
    await page.getByRole("button", { name: "暂停并补充", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "取消", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          async (id) =>
            (await window.studio.bootstrap()).tasks.find((t) => t.id === id)
              ?.status,
          recoveryId,
        ),
      )
      .toBe("stopped");
    await expect(page.getByText("独立检查点", { exact: false })).toBeVisible();
    await page.screenshot({
      path: path.join(evidence, "assessment-paused.png"),
      fullPage: false,
      animations: "disabled",
    });
    fs.writeFileSync(path.join(fixtureRoot, "control.json"), "{}");
    await page
      .getByRole("button", { name: "补充信息后重试", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("补充说明", { exact: true })
      .fill("补充受控测试证据，需求范围不变。");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "保存补充并继续当前阶段", exact: true })
      .click();
    await expect
      .poll(
        () =>
          page.evaluate(
            async (id) =>
              (await window.studio.bootstrap()).tasks.find((t) => t.id === id)
                ?.status,
            recoveryId,
          ),
        { timeout: 30000 },
      )
      .toBe("ready");
    const recovered = await page.evaluate(
      async (id) =>
        (await window.studio.bootstrap()).tasks.find((t) => t.id === id),
      recoveryId,
    );
    expect(recovered.supplements[0].stage).toBe("analysis");
    expect(
      recovered.runs
        .filter((run) => run.stage === "analysis")
        .map((run) => run.status),
    ).toEqual(["stopped", "passed"]);
    await expect(
      page.getByRole("button", { name: "追加信息并重新评估", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(evidence, "assessment-resumed.png"),
      fullPage: false,
      animations: "disabled",
    });
    fs.writeFileSync(
      path.join(fixtureRoot, "control.json"),
      '{"fail":"analysis"}',
    );
    const failureId = await page.evaluate(async () => {
      const task = await window.studio.saveTask({
        title: "Agent 失败恢复展示",
        kind: "text",
        size: "small",
        description: "Controlled Agent failure",
        projectId: "fixture",
        assetIds: [],
        workspaceMode: "isolated",
        autoTest: false,
        branch: { mode: "existing", base: "main", name: "main", version: "" },
      });
      await window.studio.taskAction(task.id, "analyze");
      return task.id;
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            async (id) =>
              (await window.studio.bootstrap()).tasks.find((t) => t.id === id)
                ?.status,
            failureId,
          ),
        { timeout: 30000 },
      )
      .toBe("failed");
    await page.getByRole("button", { name: "需求记录", exact: false }).click();
    await page
      .locator("main table")
      .getByRole("button", { name: "Agent 失败恢复展示", exact: true })
      .click();
    await expect(
      page.getByText("Agent 失败 · ABNORMAL_EXIT", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("推荐操作", { exact: false })).toBeVisible();
    await page.screenshot({
      path: path.join(evidence, "failure-recovery.png"),
      fullPage: false,
      animations: "disabled",
    });
    expect(errors).toEqual([]);
    const wecomMessages = await app.evaluate(
      () => globalThis.teamWecomMessages,
    );
    if (process.platform === "win32") {
      const child = electronProcess;
      await page.close();
      await expect.poll(() => child.exitCode, { timeout: 15000 }).toBe(0);
      const previewPort = Number(
        new URL(
          windows.find((win) => win.url.startsWith("http://127.0.0.1:")).url,
        ).port,
      );
      await expect
        .poll(
          () =>
            new Promise((resolve) => {
              const socket = net.connect(previewPort, "127.0.0.1");
              socket.once("connect", () => {
                socket.destroy();
                resolve(true);
              });
              socket.once("error", () => {
                socket.destroy();
                resolve(false);
              });
              socket.setTimeout(1000, () => {
                socket.destroy();
                resolve(false);
              });
            }),
          { timeout: 5000 },
        )
        .toBe(false);
    }
    fs.writeFileSync(
      path.join(evidence, "result.json"),
      JSON.stringify(
        {
          passed: true,
          windows,
          errors,
          wecom: {
            transport: "isolated sink; no live group writes",
            messages: wecomMessages,
          },
          recovery: {
            id: recoveryId,
            checkpoints: recovered.checkpoints,
            runs: recovered.runs.map((r) => ({
              stage: r.stage,
              status: r.status,
            })),
          },
          tasks: result.map((task) => ({
            title: task.title,
            status: task.status,
            workspace: task.workspace?.branch,
          })),
        },
        null,
        2,
      ),
    );
    console.log(`Real Electron/IPC UI checks passed. Evidence: ${evidence}`);
  } finally {
    // Windows close smoke has already awaited the OS process exit. Do not send
    // a second protocol close to an exited Electron process.
    if (electronProcess.exitCode === null) await app.close().catch(() => {});
    await fs.promises.rm(fixtureRoot, {
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
