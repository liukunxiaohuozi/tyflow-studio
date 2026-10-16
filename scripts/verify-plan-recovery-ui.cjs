// Real Electron + IPC + deterministic Codex subprocess, disposable Git/user data only.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const http = require("node:http");
const { _electron, expect } = require("playwright/test");

async function main() {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "studio-plan-ui-"));
  const repository = path.join(fixture, "repository"),
    data = path.join(fixture, "data");
  const networkMode = process.env.STUDIO_VERIFY_AGENT_NETWORK === "1";
  const readMode = process.env.STUDIO_VERIFY_AGENT_READ_ONLY === "1";
  const drawerMode = process.env.STUDIO_VERIFY_CONTENT_DRAWER === "1";
  const artifactMode = process.env.STUDIO_VERIFY_TEST_ARTIFACTS === "1";
  const browserMode = process.env.STUDIO_VERIFY_BROWSER_PREPARATION === "1";
  const packagedExecutable = process.env.STUDIO_VERIFY_EXECUTABLE;
  let browserFixture;
  let browserUrl;
  if (browserMode) {
    browserFixture=http.createServer(async(req,res)=>{
      if(req.url==="/"){res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<!DOCTYPE html><title>Browser preparation fixture</title><h1>Fixture settings</h1><label>Setting value<input id="setting"></label><button id="save">Save</button><p role="status" id="result">Not saved</p><script>save.onclick=async()=>{const r=await fetch("/api/save",{method:"POST",body:JSON.stringify({value:setting.value})});const b=await r.json();result.textContent="Fixture saved: "+b.value};</script>');return;}
      if(req.url==="/api/save"&&req.method==="POST"){let b="";for await(const c of req)b+=c;res.setHeader("Content-Type","application/json");res.end(JSON.stringify(JSON.parse(b)));return;}
      res.statusCode=404;res.end("<title>Error</title>Cannot GET /deep/settings");
    });
    await new Promise(resolve=>browserFixture.listen(0,"127.0.0.1",resolve));
    browserUrl=`http://127.0.0.1:${browserFixture.address().port}/deep/settings`;
  }
  const evidence = path.join(
    root,
    browserMode
      ? packagedExecutable ? "test-results/browser-preparation-packaged-ui" : "test-results/browser-preparation-ui"
      : artifactMode
      ? "test-results/test-artifacts-ui"
      : drawerMode
      ? "test-results/content-drawer-ui"
      : readMode
        ? "test-results/agent-readonly-ui"
        : networkMode
          ? "test-results/agent-network-ui"
          : "test-results/plan-recovery-ui",
  );
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
      ...(artifactMode || browserMode
        ? { result: artifactMode ? {...plan(false),testCases:[{...plan(false).testCases[0],title:"Fixture command evidence",steps:["Run the fixture command"],expected:"Exit zero"}]} : {...plan(false),testCases:[{...plan(false).testCases[0],title:"Chrome 浏览器保存验证",steps:["在 Chrome 中保存测试设置"],expected:"Fixture saved: controlled"}]} }
        : drawerMode
        ? {
            result: {
              ...plan(false),
              testCases: Array.from({ length: 18 }, (_, index) => ({
                ...plan(false).testCases[0],
                id: `CASE-${index + 1}`,
                title: `保存文案验收 ${index + 1}`,
                steps: [
                  "进入三端设置并触发保存。",
                  "只修改成功提示，不改变保存请求和失败提示。",
                ],
                expected: `验收结果 ${index + 1}：保存成功，显示对应端的延迟和重启说明。`,
              })),
            },
          }
        : readMode
          ? { readBlocked: true, result: plan(false) }
          : networkMode
            ? {
                eventError: "workspace routing discovery failed",
                fail: "analysis",
              }
            : {
                analysisResults: [
                  plan(true),
                  plan(true),
                  plan(true),
                  plan(false),
                ],
              }),
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
        notifications: {
          enabled: false, desktop: false, wecom: { enabled: false },
          milestones: { planReady: false, developmentComplete: false, acceptanceReady: false, failed: false, deliveryComplete: false },
        },
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
  if (packagedExecutable) env.STUDIO_SMOKE = "1";
  let app, child;
  let stderrTail = "";
  try {
    app = await _electron.launch({
      executablePath: packagedExecutable || path.join(
        root,
        "node_modules/electron/dist",
        process.platform === "win32"
          ? "electron.exe"
          : "Electron.app/Contents/MacOS/Electron",
      ),
      args: packagedExecutable ? [] : [root],
      env,
      timeout: 30000,
    });
    child = app.process();
    child.stderr?.on("data", (chunk) => { stderrTail = (stderrTail + chunk).slice(-6000); });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "工作台", exact: true }).waitFor();
    if (packagedExecutable) {
      // Packaged smoke deliberately clears project paths. Configure only this
      // disposable repository through the same IPC used by the settings screen.
      await page.evaluate(async (directory) => {
        const initial = await window.studio.bootstrap();
        await window.studio.saveSettings({
          ...initial.settings,
          projects: initial.settings.projects.map((project) => ({ ...project, directory })),
        });
      }, repository);
      await page.reload();
      await page.getByRole("button", { name: "工作台", exact: true }).waitFor();
    }
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
    if (browserMode) {
      await expect.poll(async()=>(await task()).status,{timeout:30000}).toBe("ready");
      fs.writeFileSync(path.join(fixture,"control.json"),"{}");
      await page.evaluate(taskId=>window.studio.taskAction(taskId,"develop"),id);
      await expect.poll(async()=>(await task()).status,{timeout:30000}).toBe("waiting-review");
      await page.getByRole("button",{name:"自动化测试介入（可选）",exact:true}).click();
      await expect.poll(async()=>(await task()).failure?.code,{timeout:30000}).toBe("TEST_BROWSER_PREPARATION");
      await page.getByRole("button",{name:"测试准备 / 手动登录",exact:true}).click();
      const drawer=page.getByRole("dialog",{name:"测试准备与手动登录",exact:true});
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("button",{name:"打开专用测试浏览器",exact:true})).toHaveCount(2);
      await expect(drawer.getByRole("button",{name:"开始/继续验证",exact:true})).toBeDisabled();
      await drawer.getByLabel(/^测试页面地址/).fill(browserUrl);
      await drawer.getByLabel("我确认这是开发/测试环境，不是生产环境",{exact:true}).check();
      await drawer.getByLabel(/^允许测试的应用与数据范围/).fill("Only local fixture application; memory data resets when the test server closes");
      await drawer.getByLabel("我确认该页面运行的是上述任务工作区代码（此项由我确认，不是 Studio 自动证明）",{exact:true}).check();
      await drawer.getByLabel("允许在上述测试范围内点击、填写与保存；不允许删除、发布或部署",{exact:true}).check();
      const chrome=drawer.locator(".browser-test-card").filter({hasText:"Chrome"}).first();
      await chrome.getByRole("button",{name:"打开专用测试浏览器",exact:true}).click();
      await expect(chrome).toContainText("HTTP 404",{timeout:30000});
      await chrome.getByRole("button",{name:"从首页进入",exact:true}).click();
      await expect(chrome).toContainText("HTTP 200",{timeout:30000});
      await chrome.getByRole("button",{name:"已登录，确认此浏览器",exact:true}).click();
      await expect(chrome).toContainText("已确认，可以验证");
      const padding=await drawer.locator(".ant-drawer-body").evaluate(node=>{const s=getComputedStyle(node);return [s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft]});
      assert.deepEqual(padding,["16px","16px","16px","16px"]);
      await page.screenshot({path:path.join(evidence,"ready-desktop.png"),fullPage:false,animations:"disabled"});
      fs.writeFileSync(path.join(fixture,"control.json"),JSON.stringify({browserTest:true}));
      await drawer.getByRole("button",{name:"开始/继续验证",exact:true}).click();
      await expect(drawer).toHaveCount(0);
      await expect.poll(async()=>(await task()).status,{timeout:45000}).toBe("waiting-review");
      const after=await task();
      assert.equal(after.testExecution.conclusion,"VERIFIED");
      assert.equal(after.checkpoints.find(c=>c.id==="test:browser-preparation").attempts,2);
      assert(after.checks.find(c=>c.name==="Skill · CASE-001").evidence.some(e=>e.path?.includes("studio-browser-")));
      assert(!JSON.stringify(after).includes("STUDIO_BROWSER_TOKEN="));
      assert.deepEqual(errors,[]);
      fs.writeFileSync(path.join(evidence,"result.json"),JSON.stringify({passed:true,mode:"real Electron IPC, dedicated Chrome and scoped MCP; deterministic CLI fixture",preparationBeforeEngineering:true,deepLink404Recovered:true,sourceAndScopeConsentRequired:true,realBrowserAssertionRegistered:true,sameTaskContinued:true,padding,pageErrors:errors,businessTaskTouched:false},null,2));
      await page.close();
      if(process.platform==="win32")await expect.poll(()=>child.exitCode,{timeout:10000}).toBe(0);
      return;
    }
    if (artifactMode) {
      await expect.poll(async () => (await task()).status, { timeout: 30000 }).toBe("ready");
      fs.writeFileSync(path.join(fixture, "control.json"), "{}");
      await page.evaluate((taskId) => window.studio.taskAction(taskId, "develop"), id);
      await expect.poll(async () => (await task()).status, { timeout: 30000 }).toBe("waiting-review");
      fs.writeFileSync(path.join(fixture, "control.json"), JSON.stringify({
        testFiles: {
          "test-results/run/VERIFY.md": "incomplete fixture report",
          "test-results/run/scan-workspace/src/app.ts": "isolated source copy",
          "test-results/run/scan-workspace/package.json": "{}",
        },
        result: { summary: "验证未完成", checks: [{ name: "CASE-001", state: "blocked", detail: "浏览器测试账号未配置，页面保存尚未执行" }] },
      }));
      await page.getByRole("button", { name: "自动化测试介入（可选）", exact: true }).click();
      await expect.poll(async () => (await task()).failure?.code, { timeout: 30000 }).toBe("TEST_INCOMPLETE");
      await expect(page.locator(".run-status-card h2")).toHaveText("验证未完成");
      const recovery = page.getByRole("region", { name: "阶段恢复" });
      // RecoveryPanel is a named section, exposed as a region.
      await expect(recovery).toContainText("无需重录需求");
      await expect(recovery).not.toContainText("TEST_CHANGED_BUSINESS");
      await expect(page.getByRole("button", { name: "修复并重测", exact: true })).toHaveCount(0);
      await page.bringToFront();
      await page.screenshot({ path: path.join(evidence, "validation-incomplete.png"), fullPage: false, animations: "disabled" });
      fs.writeFileSync(path.join(fixture, "control.json"), JSON.stringify({
        result: { summary: "fixture verification recovered", checks: [{ name: "CASE-001", state: "passed", detail: "independent fixture command", evidence: [{ kind: "command", command: "fixture-check", exitCode: 0, summary: "controlled success" }] }] },
      }));
      await page.getByRole("button", { name: "直接重试", exact: true }).click();
      await expect.poll(async () => (await task()).status, { timeout: 30000 }).toBe("waiting-review");
      const after = await task();
      assert.equal(after.testExecution.conclusion, "VERIFIED");
      assert.equal(after.checkpoints.find((item) => item.id === "test:command:test").attempts, 1);
      assert.equal(after.checkpoints.find((item) => item.id === "test:command:test").reused, 1);
      const calls = fs.readFileSync(path.join(fixture, "calls.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
      assert.deepEqual(calls.map((call) => call.stage), ["analysis", "development", "test", "test"]);
      assert.deepEqual(errors, []);
      fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify({ passed: true, mode: "real Electron and IPC with deterministic CLI fixture", sameTaskRecovered: true, artifactFalsePositivePrevented: true, incompleteNotPassed: true, passedCommandReused: true, noRepeatedDevelopment: true, noMisleadingRepairButton: true, businessTaskTouched: false, pageErrors: errors }, null, 2));
      await page.close();
      if (process.platform === "win32") await expect.poll(() => child.exitCode, { timeout: 10000 }).toBe(0);
      return;
    }
    if (drawerMode) {
      await expect
        .poll(async () => (await task()).status, { timeout: 30000 })
        .toBe("ready");
      const casesButton = page.getByRole("button", { name: /查看测试用例/ });
      await casesButton.click();
      const drawer = page.getByRole("dialog", {
        name: "测试用例",
        exact: true,
      });
      await expect(drawer).toBeVisible();
      await expect.poll(() => drawer.evaluate((node) => Math.round(node.getBoundingClientRect().right) - innerWidth)).toBe(0);
      await expect(drawer.locator(".test-case")).toHaveCount(18);
      await expect(drawer).toContainText("验收结果 18");
      const metrics = await drawer.evaluate((node) => {
        const body = node.querySelector(".ant-drawer-body");
        const header = node.querySelector(".ant-drawer-header");
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(body);
        return {
          padding: [
            style.paddingTop,
            style.paddingRight,
            style.paddingBottom,
            style.paddingLeft,
          ],
          headerPadding: getComputedStyle(header).padding,
          right: rect.right,
          viewport: innerWidth,
          scrollable: body.scrollHeight > body.clientHeight,
          horizontalOverflow: body.scrollWidth > body.clientWidth,
        };
      });
      assert.deepEqual(metrics.padding, ["16px", "16px", "16px", "16px"]);
      assert.equal(metrics.headerPadding, "16px");
      assert.equal(Math.round(metrics.right), metrics.viewport);
      assert.equal(metrics.scrollable, true);
      assert.equal(metrics.horizontalOverflow, false);
      await page.screenshot({
        path: path.join(evidence, "test-cases-desktop.png"),
        animations: "disabled",
        fullPage: false,
      });
      const headerTop = await drawer
        .locator(".ant-drawer-header")
        .evaluate((node) => node.getBoundingClientRect().top);
      await drawer.locator(".ant-drawer-body").evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expect(drawer.getByText(/验收结果 18/)).toBeInViewport();
      assert.equal(
        await drawer
          .locator(".ant-drawer-header")
          .evaluate((node) => node.getBoundingClientRect().top),
        headerTop,
      );
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(casesButton).toBeFocused();
      await page.getByRole("button", { name: /预览开发计划/ }).click();
      const planDrawer = page.getByRole("dialog", {
        name: "开发计划",
        exact: true,
      });
      await expect(planDrawer).toBeVisible();
      await expect(planDrawer).toContainText("实施步骤");
      await planDrawer
        .getByRole("button", { name: "关闭", exact: true })
        .click();
      await expect(planDrawer).toHaveCount(0);
      await casesButton.click();
      await expect(drawer).toBeVisible();
      await page
        .locator(".studio-content-drawer .ant-drawer-mask")
        .click({ position: { x: 20, y: 100 } });
      await expect(drawer).toHaveCount(0);
      await page.setViewportSize({ width: 640, height: 760 });
      await casesButton.click();
      await expect(drawer).toBeVisible();
      const narrow = await drawer.evaluate((node) => ({
        width: node.getBoundingClientRect().width,
        viewport: innerWidth,
        bodyOverflow:
          node.querySelector(".ant-drawer-body").scrollWidth >
          node.querySelector(".ant-drawer-body").clientWidth,
      }));
      assert(narrow.width <= narrow.viewport);
      assert.equal(narrow.bodyOverflow, false);
      await page.screenshot({
        path: path.join(evidence, "test-cases-narrow.png"),
        animations: "disabled",
        fullPage: false,
      });
      for (let index = 0; index < 6; index++) {
        await page.keyboard.press("Tab");
        assert(
          await drawer.evaluate((node) =>
            node.contains(document.activeElement),
          ),
        );
      }
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      assert.equal((await task()).status, "ready");
      assert.equal((await task()).snapshot, undefined);
      assert.equal(git("status", "--porcelain"), "");
      // Exercise the same preview from RunView and the separate frozen-requirement entry.
      // Only the disposable fake-Agent task advances; no real provider or user task is used.
      await page.setViewportSize({ width: 1424, height: 900 });
      fs.writeFileSync(path.join(fixture, "control.json"), JSON.stringify({}));
      await page.evaluate((taskId) => window.studio.taskAction(taskId, "develop"), id);
      await expect.poll(async () => (await task()).status, { timeout: 30000 }).toBe("waiting-review");
      await page.getByRole("button", { name: /查看测试用例/ }).click();
      await expect(drawer).toBeVisible();
      await expect(drawer.locator(".test-case")).toHaveCount(18);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "追加信息", exact: true }).click();
      const confirmation = page.locator("dialog[open]");
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "关闭", exact: true }).click();
      assert.equal((await task()).status, "waiting-review");
      await page.evaluate((taskId) => window.studio.taskAction(taskId, "terminate"), id);
      await expect.poll(async () => (await task()).status).toBe("stopped");
      await page.getByRole("button", { name: "查看需求", exact: true }).click();
      const snapshotDrawer = page.getByRole("dialog", { name: "执行需求快照", exact: true });
      await expect(snapshotDrawer).toBeVisible();
      await expect(snapshotDrawer).toContainText("三端保存提示文案变更");
      await snapshotDrawer.getByRole("button", { name: "关闭", exact: true }).click();
      await expect(snapshotDrawer).toHaveCount(0);
      assert.deepEqual(errors, []);
      fs.writeFileSync(
        path.join(evidence, "result.json"),
        JSON.stringify(
          {
            passed: true,
            mode: "real Electron and IPC; deterministic assessment and development fixture",
            metrics,
            narrow,
            titleAndCasesPreserved: true,
            escClose: true,
            buttonClose: true,
            maskClose: true,
            focusReturn: true,
            focusTrap: true,
            previewLeavesTaskUnchanged: true,
            runViewCasesPreserved: true,
            snapshotDrawer: true,
            nativeSupplementModalRetained: true,
            businessTaskTouched: false,
            pageErrors: errors,
          },
          null,
          2,
        ),
      );
      await page.close();
      if (process.platform === "win32")
        await expect.poll(() => child.exitCode, { timeout: 10000 }).toBe(0);
      return;
    }
    await expect
      .poll(async () => (await task()).status, { timeout: 30000 })
      .toBe("failed");
    const recovery = page.getByRole("region", { name: "阶段恢复" });
    const expectedCode = readMode
      ? "AGENT_READ_BLOCKED"
      : networkMode
        ? "NETWORK_LOST"
        : "AGENT_PLAN_INVALID";
    await expect(recovery).toContainText(expectedCode);
    await expect(recovery).toContainText(
      readMode
        ? "无需重填需求"
        : networkMode
          ? "检查网络与系统代理"
          : "第 6 个计划步骤",
    );
    await expect(recovery).not.toContainText("网络和额度");
    await page.screenshot({
      path: path.join(evidence, "invalid-plan.png"),
      fullPage: true,
    });
    const before = await task();
    assert.equal(before.plan, undefined);
    if (networkMode || readMode) {
      assert(before.failure.message.length < 400);
      fs.writeFileSync(
        path.join(fixture, "control.json"),
        JSON.stringify({
          result: readMode
            ? { ...plan(false), blockers: ["fixture unresolved source access"] }
            : plan(false),
        }),
      );
    }
    await page.getByRole("button", { name: "直接重试", exact: true }).click();
    await expect
      .poll(async () => (await task()).status, { timeout: 30000 })
      .toBe("ready");
    if (readMode) {
      await expect(
        page.getByRole("heading", { name: "需求已整理，评估存在阻塞" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "评估完成，确认后开始开发" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "确认并开始开发", exact: true }),
      ).toBeDisabled();
      await page.screenshot({
        path: path.join(evidence, "blocked-assessment.png"),
        fullPage: true,
      });
      fs.writeFileSync(
        path.join(fixture, "control.json"),
        JSON.stringify({ result: plan(false) }),
      );
      await page
        .getByRole("button", { name: "问题已处理，重新评估", exact: true })
        .click();
      await expect
        .poll(async () => (await task()).plan?.blockers.length, {
          timeout: 30000,
        })
        .toBe(0);
      await expect
        .poll(async () => (await task()).status, { timeout: 30000 })
        .toBe("ready");
      await expect(
        page.getByRole("heading", { name: "评估完成，确认后开始开发" }),
      ).toBeVisible();
    }
    const after = await task();
    assert.equal(after.id, id);
    assert.equal(after.snapshot, undefined);
    assert.deepEqual(after.plan.planSteps[5].expectedFiles, ["verify.cjs"]);
    await expect(recovery).not.toContainText(expectedCode);
    const calls = fs
      .readFileSync(path.join(fixture, "calls.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(calls.length, readMode ? 3 : networkMode ? 2 : 4);
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
  } catch (error) {
    {
      const state = fs.existsSync(path.join(data, "state.json")) ? JSON.parse(fs.readFileSync(path.join(data, "state.json"), "utf8")) : { tasks: [] };
      const failure={passed:false,message: error.message, exitCode: child?.exitCode, stderrTail, tasks: state.tasks.map((item) => ({ status: item.status, error: item.error, logs: item.logs?.slice(-5) }))};
      fs.writeFileSync(path.join(evidence, `failure-${Date.now()}.json`), JSON.stringify(failure,null,2));
      fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify(failure,null,2));
    }
    throw error;
  } finally {
    if (app && child?.exitCode === null) await app.close().catch(() => {});
    if(browserFixture){browserFixture.closeAllConnections();await new Promise(resolve=>browserFixture.close(resolve));}
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
