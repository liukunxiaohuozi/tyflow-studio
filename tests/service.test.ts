import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import net from "node:net";
import http from "node:http";
import { StudioService } from "../src/main/service";
import { Store } from "../src/main/store";
import type { Task, TaskInput } from "../src/shared/contracts";

jest.setTimeout(30000);
let root: string;
let repository: string;
let fixture: string;
let store: Store;
let service: StudioService;
let observed: Task[];
let opened: string[];
const secret = "fixture-private-token-never-persist";
const originalCodexHome = process.env.CODEX_HOME;
const credentials = {
  available: () => true,
  has: () => false,
  get: () => "",
  setMany: () => {},
  secrets: () => [secret],
};
function git(...args: string[]) {
  return execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}
function configure(value: Record<string, unknown>) {
  fs.writeFileSync(path.join(fixture, "control.json"), JSON.stringify(value));
}
function calls(): {
  args: string[];
  prompt: string;
  schema: { properties: Record<string, unknown> };
  stage: string;
  cwd: string;
  codexHome: string;
}[] {
  const file = path.join(fixture, "calls.jsonl");
  return fs.existsSync(file)
    ? fs
        .readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
}
async function until(predicate: () => boolean) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 15000)
      throw new Error(
        "Timed out waiting for fixture service: " +
          JSON.stringify(
            store.tasks().map((t) => ({ status: t.status, error: t.error })),
          ),
      );
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  // Public task status is published immediately before the active-operation finally block.
  await new Promise((resolve) => setTimeout(resolve, 20));
}
async function status(id: string, expected: Task["status"]) {
  await until(() => store.getTask(id).status === expected);
  return store.getTask(id);
}
function create(overrides: Partial<TaskInput> = {}) {
  return service.saveTask({
    title: "Isolated requirement",
    description: "Add behavior in the fixture only",
    kind: "text",
    size: "small",
    projectId: "fixture",
    assetIds: [],
    branch: { mode: "new", base: "main", name: "feature/fixture", version: "" },
    autoTest: false,
    ...overrides,
  });
}
async function ready() {
  const task = create();
  await service.action(task.id, "analyze");
  return status(task.id, "ready");
}
async function developed() {
  const task = await ready();
  await service.action(task.id, "develop");
  return status(task.id, "waiting-test");
}
async function unusedPort() {
  const reservation = net.createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const address = reservation.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture port allocation failed");
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
async function installServerFixture() {
  const port = await unusedPort();
  fs.writeFileSync(
    path.join(repository, "server.cjs"),
    `require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({pid:process.pid,route:req.url}))}).listen(${port},'127.0.0.1')`,
  );
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repository, "package.json"), "utf8"),
  );
  pkg.scripts["start:corrected"] = "node server.cjs";
  fs.writeFileSync(path.join(repository, "package.json"), JSON.stringify(pkg));
  git("add", "server.cjs", "package.json");
  git("commit", "-m", "isolated HTTP fixture");
  return `http://127.0.0.1:${port}/development/fixture`;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tyflow-service-test-"));
  process.env.CODEX_HOME = path.join(root, "user-codex-home");
  fs.mkdirSync(process.env.CODEX_HOME);
  fs.writeFileSync(
    path.join(process.env.CODEX_HOME, "auth.json"),
    JSON.stringify({ fixture: "shared-login" }),
  );
  repository = path.join(root, "repository");
  fixture = path.join(root, "agent");
  fs.mkdirSync(repository);
  fs.mkdirSync(fixture);
  fs.copyFileSync(
    path.join(__dirname, "fixtures", "fake-codex.js"),
    path.join(fixture, "fake-codex.js"),
  );
  configure({});
  fs.writeFileSync(
    path.join(repository, "package.json"),
    JSON.stringify({
      private: true,
      scripts: { test: "node verify.cjs", "start:dev": "node server.cjs" },
    }),
  );
  fs.writeFileSync(
    path.join(repository, "verify.cjs"),
    'console.log("fixture local test passed")',
  );
  git("init", "--initial-branch=main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("add", ".");
  git("commit", "-m", "fixture base");
  const tyflow = path.join(root, "tyflow");
  fs.mkdirSync(path.join(tyflow, "shared"), { recursive: true });
  fs.writeFileSync(
    path.join(tyflow, "shared", "WORKFLOW.md"),
    "Fixture workflow",
  );
  fs.writeFileSync(path.join(root, "SKILL.md"), "Fixture testing skill");
  store = new Store(path.join(root, "data"));
  const settings = store.settings();
  settings.projects = [
    {
      id: "fixture",
      name: "Fixture",
      directory: repository,
      repository: "",
      auth: "system",
      username: "",
      startScript: "start:dev",
      targetUrl: "http://127.0.0.1:49999",
      defaultBranchMode: "new",
    },
  ];
  settings.developer.defaultProject = "fixture";
  settings.agent = {
    command: path.join(fixture, "fake-codex.js"),
    tyflowDirectory: tyflow,
    testSkill: path.join(root, "SKILL.md"),
  };
  store.saveSettings(settings);
  observed = [];
  opened = [];
  service = new StudioService(
    store,
    credentials,
    (task) => observed.push(task),
    async (url) => {
      opened.push(url);
    },
  );
});
afterEach(async () => {
  service.close();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await fs.promises.rm(root, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
  if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = originalCodexHome;
});
test("opens a linked ZenTao item under the configured site", async () => {
  const settings = store.settings();
  settings.zentao = {
    enabled: true,
    url: "https://zentao.example.test/zentao/",
    username: "developer",
    mappings: { fixture: { productId: "12", projectId: "34" } },
  };
  store.saveSettings(settings);
  await service.openZentao("task", "81742");
  expect(opened).toEqual([
    "https://zentao.example.test/zentao/task-view-81742.html",
  ]);
});

test("bug screenshots persist with the draft, reach assessment, and removal invalidates the previous plan", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNu0AAAAASUVORK5CYII=",
    "base64",
  );
  const asset = await service.assets.importImage(png);
  const task = create({
    kind: "bug",
    description: "步骤一：打开页面；步骤二：筛选后出现异常，见截图。",
    assetIds: [asset.id],
  });
  const restored = new Store(store.directory).getTask(task.id);
  expect(restored.assets).toEqual([asset]);
  expect(restored.description).toBe(task.description);
  await service.action(task.id, "analyze");
  const assessed = await status(task.id, "ready");
  expect(calls()[0].prompt).toContain(service.assets.filePath(asset.id));
  expect(calls()[0].prompt).toContain(asset.sha256);
  const updated = service.saveTask(
    {
      title: task.title,
      description: task.description,
      kind: task.kind,
      size: task.size,
      projectId: task.projectId,
      assetIds: [],
      branch: task.branch,
      autoTest: task.autoTest,
    },
    assessed.id,
  );
  expect(updated.assets).toEqual([]);
  expect(updated.plan).toBeUndefined();
  expect(new Store(store.directory).getTask(task.id).assetIds).toEqual([]);
});

test("bug fix calls Codex directly on the selected branch without a planning invocation", async () => {
  const url = await installServerFixture();
  const settings = store.settings();
  settings.projects[0].startScript = "start:corrected";
  settings.projects[0].targetUrl = url;
  service.saveSettings(settings);
  const task = create({
    kind: "bug",
    description: "打开列表后筛选无效，请定位并修复。",
    autoTest: true,
    branch: {
      mode: "new",
      base: "main",
      name: "feature/fixture",
      version: "v1.0.0",
    },
  });
  expect(task.autoTest).toBe(false);
  expect(task.branch.version).toBe("");
  await service.action(task.id, "fix");
  const fixed = await status(task.id, "waiting-review");
  expect(fixed.plan?.testCases).toEqual([
    expect.objectContaining({ id: "BUG-REGRESSION" }),
  ]);
  expect(fixed.snapshot?.branch).toEqual(task.branch);
  expect(calls().map((call) => call.stage)).toEqual(["development"]);
  expect(opened).toEqual([]);
  expect(calls()[0].prompt).toContain("direct Bug repair");
  expect(calls()[0].prompt).not.toContain("Tyflow workflow");
  expect(fixed.logs.some((log) => log.message.includes("直接调用 Codex"))).toBe(
    true,
  );
  await service.action(task.id, "start");
  await status(task.id, "review");
  expect(opened).toEqual([url]);
});

test("bug fix with runtime-only unexecuted checks waits for manual review instead of failing", async () => {
  configure({
    result: {
      summary: "Code fix complete; runtime review remains",
      checks: [
        {
          name: "static check",
          state: "passed",
          detail: "lint passed",
        },
        {
          name: "real browser review",
          state: "unexecuted",
          detail: "requires the running application",
        },
      ],
    },
  });
  const task = create({ kind: "bug", description: "runtime bug" });
  await service.action(task.id, "fix");
  const fixed = await status(task.id, "waiting-review");
  expect(fixed.error).toBeUndefined();
  expect(fixed.checks.map((check) => check.state)).toEqual([
    "passed",
    "unexecuted",
  ]);
  expect(
    fixed.logs.some((log) =>
      log.message.includes("运行时检查等待人工验证"),
    ),
  ).toBe(true);
});

test("assessment invokes read-only Codex, passes schema and exact target commit, and persists the plan", async () => {
  const task = await ready();
  const invocation = calls()[0];
  expect(observed.some((t) => t.status === "analyzing")).toBe(true);
  expect(invocation.args).toEqual(
    expect.arrayContaining([
      "exec",
      "--ignore-user-config",
      "--sandbox",
      "read-only",
      "--output-schema",
      "--output-last-message",
      "-",
    ]),
  );
  expect(invocation.cwd).toBe(repository);
  expect(invocation.schema.properties).toHaveProperty("testCases");
  expect(invocation.prompt).toContain(git("rev-parse", "HEAD"));
  expect(task.targetCommit).toBe(git("rev-parse", "HEAD"));
  expect(task.plan?.testCases[0].id).toBe("CASE-1");
  expect(task.planRevision).toBe(1);
  expect(new Store(store.directory).getTask(task.id).plan).toEqual(task.plan);
  expect(git("status", "--porcelain")).toBe("");
  expect(git("branch", "--show-current")).toBe("main");
});

test("terminate marks a non-accepted task as stopped", async () => {
  const task = await ready();
  const terminated = await service.action(task.id, "terminate");
  expect(terminated.status).toBe("stopped");
  expect(terminated.error).toBe("任务已终止。");
  expect(new Store(store.directory).getTask(task.id).status).toBe("stopped");
  await expect(service.action(task.id, "terminate")).rejects.toThrow();
});

test("plan feedback revises assessment without changing the original requirement", async () => {
  const task = await ready();
  const originalDescription = task.description;
  const previousSummary = task.plan!.summary;
  configure({
    result: {
      summary: "按意见收窄范围后的计划",
      steps: ["只改列表筛选", "补充权限用例"],
      risks: [],
      blockers: [],
      testCases: [
        {
          id: "CASE-2",
          title: "权限校验",
          steps: ["无权限账号访问"],
          expected: "拒绝访问",
        },
      ],
    },
  });
  await service.action(task.id, "analyze", {
    planFeedback: "不要改公共组件；测试补权限场景",
  });
  const revised = await status(task.id, "ready");
  const invocation = calls().at(-1)!;
  expect(invocation.prompt).toContain("Previous plan JSON");
  expect(invocation.prompt).toContain("不要改公共组件；测试补权限场景");
  expect(invocation.prompt).toContain(previousSummary);
  expect(revised.plan?.summary).toBe("按意见收窄范围后的计划");
  expect(revised.plan?.testCases[0].id).toBe("CASE-2");
  expect(revised.planFeedback).toBeUndefined();
  expect(revised.planRevision).toBe(task.planRevision + 1);
  expect(revised.description).toBe(originalDescription);
});

test("agent connection and assessment reject a CLI without isolated execution before sending a prompt", async () => {
  configure({ unsupported: true });
  const connection = await service.testConnection("agent");
  expect(connection.ok).toBe(false);
  expect(connection.message).toContain("隔离评估");
  const task = create();
  await service.action(task.id, "analyze");
  const failed = await status(task.id, "failed");
  expect(failed.error).toContain("隔离评估");
  expect(calls()).toHaveLength(0);
  expect(git("status", "--porcelain")).toBe("");
});

test("remote synchronization persists its timestamp and stale assessment blocks development before the agent runs", async () => {
  const remote = path.join(root, "upstream.git");
  execFileSync("git", ["clone", "--bare", repository, remote], {
    windowsHide: true,
    stdio: "ignore",
  });
  git("remote", "add", "origin", remote);
  const synced = await service.repository("fixture", true);
  expect(synced.syncError).toBeUndefined();
  expect(synced.syncedAt).toBeTruthy();
  expect((await service.repository("fixture")).syncedAt).toBe(synced.syncedAt);
  git("branch", "--set-upstream-to=origin/main", "main");
  const task = await ready();
  const peer = path.join(root, "peer");
  execFileSync("git", ["clone", remote, peer], {
    windowsHide: true,
    stdio: "ignore",
  });
  const peerGit = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: peer,
      windowsHide: true,
      stdio: "ignore",
    });
  peerGit("config", "user.name", "Fixture");
  peerGit("config", "user.email", "fixture@example.invalid");
  fs.writeFileSync(path.join(peer, "remote-update.txt"), "new commit");
  peerGit("add", ".");
  peerGit("commit", "-m", "remote update");
  peerGit("push", "origin", "main");
  const head = git("rev-parse", "HEAD");
  await service.action(task.id, "develop");
  const failed = await status(task.id, "failed");
  expect(failed.error).toMatch(/重新评估/);
  expect(failed.plan).toBeUndefined();
  expect(calls()).toHaveLength(1);
  expect(git("rev-parse", "HEAD")).toBe(head);
  expect(git("branch", "--show-current")).toBe("main");
});

test("remote-only existing branch freezes the actual local branch for subsequent test validation", async () => {
  const remote = path.join(root, "upstream.git");
  execFileSync("git", ["clone", "--bare", repository, remote], {
    windowsHide: true,
    stdio: "ignore",
  });
  execFileSync(
    "git",
    ["--git-dir", remote, "branch", "feature/remote-only", "main"],
    { windowsHide: true, stdio: "ignore" },
  );
  git("remote", "add", "origin", remote);
  const task = create({
    branch: {
      mode: "existing",
      base: "refs/remotes/origin/feature/remote-only",
      name: "feature/remote-only",
      version: "",
    },
  });
  await service.action(task.id, "analyze");
  await status(task.id, "ready");
  await service.action(task.id, "develop");
  const developedTask = await status(task.id, "waiting-test");
  expect(developedTask.snapshot?.branch.base).toBe("feature/remote-only");
  expect(git("rev-parse", "--abbrev-ref", "@{upstream}")).toBe(
    "origin/feature/remote-only",
  );
  configure({ fail: "test" });
  await service.action(task.id, "test");
  const failed = await status(task.id, "failed");
  expect(failed.error).toContain("fixture deliberate failure");
  expect(calls().some((call) => call.stage === "test")).toBe(true);
});

test("structured agent results redact credentials from nested plans, frozen snapshots, checks and persisted result files", async () => {
  configure({
    result: {
      summary: `Assessment ${secret}`,
      requirements: [
        {
          id: "REQ-001",
          text: `Requirement ${secret}`,
          priority: "P0",
          source: "description",
        },
      ],
      planSteps: [
        {
          id: "PLAN-001",
          title: `Implement ${secret}`,
          covers: ["REQ-001"],
          expectedFiles: ["**"],
        },
      ],
      steps: [`Implement without exposing ${secret}`],
      risks: [`Credential ${secret}`],
      blockers: [],
      testCases: [
        {
          id: "CASE-1",
          title: "Credential evidence",
          covers: ["REQ-001"],
          verifies: ["PLAN-001"],
          priority: "P0",
          steps: [`Inspect ${secret}`],
          expected: `Redact ${secret}`,
        },
      ],
    },
  });
  const task = await ready();
  expect(task.plan?.summary).toContain("[REDACTED]");
  expect(task.plan?.testCases[0].steps[0]).toContain("[REDACTED]");
  expect(JSON.stringify(task.plan)).not.toContain(secret);
  configure({
    result: {
      summary: `Development ${secret}`,
      checks: [
        {
          name: `Check ${secret}`,
          state: "passed",
          detail: `Evidence ${secret}`,
        },
      ],
    },
  });
  await service.action(task.id, "develop");
  const completed = await status(task.id, "waiting-test");
  expect(completed.checks[0].detail).toContain("[REDACTED]");
  expect(completed.checks[0].name).toContain("[REDACTED]");
  expect(JSON.stringify(completed)).not.toContain(secret);
  const files = (directory: string): string[] =>
    fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      );
  const persisted = files(store.directory);
  expect(
    persisted.filter((file) => path.basename(file) === "result.json"),
  ).toHaveLength(2);
  for (const file of persisted)
    expect(fs.readFileSync(file, "utf8")).not.toContain(secret);
});

test.each(["directory", "repository"] as const)(
  "changing project %s invalidates an unfrozen assessment and notifies subscribers",
  async (field) => {
    const task = await ready();
    const settings = store.settings();
    settings.projects[0][field] =
      field === "directory"
        ? path.join(root, "another-checkout")
        : "https://example.invalid/another-repository.git";
    service.saveSettings(settings);
    const invalidated = store.getTask(task.id);
    expect(invalidated.status).toBe("draft");
    expect(invalidated.plan).toBeUndefined();
    expect(invalidated.baseCommit).toBeUndefined();
    expect(invalidated.targetCommit).toBeUndefined();
    expect(invalidated.planRevision).toBeGreaterThan(task.planRevision);
    expect(observed.at(-1)?.status).toBe("draft");
    await expect(service.action(task.id, "develop")).rejects.toThrow();
  },
);

test("project configuration changes leave an executing snapshot and its original checkout intact", async () => {
  const task = await developed();
  const settings = store.settings();
  settings.projects[0].directory = path.join(root, "new-checkout");
  settings.projects[0].repository = "https://example.invalid/new-project.git";
  service.saveSettings(settings);
  const preserved = store.getTask(task.id);
  expect(preserved.snapshot).toEqual(task.snapshot);
  expect(preserved.status).toBe("waiting-test");
  expect(preserved.plan).toEqual(task.plan);
});

test("development freezes approval and creates the requested branch before executing, then waits for manual testing", async () => {
  const task = await developed();
  expect(task.snapshot?.baseCommit).toBe(git("rev-parse", "HEAD"));
  expect(task.snapshot?.plan).toEqual(task.plan);
  expect(task.approvedRevision).toBe(task.planRevision);
  expect(git("branch", "--show-current")).toBe("feature/fixture");
  expect(calls().map((c) => c.stage)).toEqual(["analysis", "development"]);
  expect(calls()[1].args).toEqual(expect.arrayContaining(["--approve-for-me"]));
  expect(calls()[1].args).not.toContain("workspace-write");
  expect(calls()[1].codexHome).toBe(process.env.CODEX_HOME);
  expect(
    fs.existsSync(path.join(store.directory, "codex-home", "auth.json")),
  ).toBe(false);
  expect(opened).toEqual([]);
  await expect(service.action(task.id, "accept")).rejects.toThrow();
  await expect(service.action(task.id, "start")).rejects.toThrow();
  await expect(service.action(task.id, "analyze")).rejects.toThrow(/快照/);
  expect(() => service.saveTask({ ...task, assetIds: [] }, task.id)).toThrow();
});

test("active assessment prevents duplicate work and settings changes; stop and retry preserve its log history", async () => {
  configure({ delay: 10000 });
  const task = create();
  await service.action(task.id, "analyze");
  await until(() => calls().length === 1);
  await expect(service.action(task.id, "analyze")).rejects.toThrow();
  expect(() => service.saveSettings(store.settings())).toThrow(/任务执行中/);
  const second = create({
    title: "Second isolated task",
    branch: { mode: "existing", base: "main", name: "", version: "" },
  });
  await expect(service.action(second.id, "analyze")).rejects.toThrow(
    /已有任务/,
  );
  await service.action(task.id, "stop");
  await until(() =>
    store
      .getTask(task.id)
      .logs.some((l) => l.level === "error" && l.message.includes("停止")),
  );
  configure({});
  await service.action(task.id, "retry");
  const completed = await status(task.id, "ready");
  expect(calls()).toHaveLength(2);
  expect(completed.logs.some((l) => l.message.includes("停止"))).toBe(true);
  expect(git("branch", "--show-current")).toBe("main");
});

test("changing checkout after development blocks test intervention before any additional agent execution", async () => {
  const task = await developed();
  git("switch", "main");
  await service.action(task.id, "test");
  const failed = await status(task.id, "failed");
  expect(failed.error).toMatch(/分支或提交已改变/);
  expect(calls()).toHaveLength(2);
  await expect(service.action(task.id, "accept")).rejects.toThrow();
  expect(opened).toEqual([]);
});

test("missing test skill is a visible blocking failure and never leads to startup or acceptance", async () => {
  const task = await developed();
  fs.unlinkSync(path.join(root, "SKILL.md"));
  await service.action(task.id, "test");
  const failed = await status(task.id, "failed");
  expect(failed.error).toMatch(/Skill 文件不存在/);
  expect(failed.stage).toBe("test");
  expect(calls()).toHaveLength(2);
  expect(opened).toEqual([]);
  await expect(service.action(task.id, "accept")).rejects.toThrow();
});

test("failed development retries on its frozen branch without recreating it or discarding prior evidence", async () => {
  const task = await ready();
  configure({ fail: "development", log: "token=" + secret });
  await service.action(task.id, "develop");
  const failed = await status(task.id, "failed");
  expect(failed.snapshot).toBeDefined();
  expect(failed.error).toMatch(/退出码 7/);
  expect(
    fs.readFileSync(path.join(store.directory, "state.json"), "utf8"),
  ).not.toContain(secret);
  configure({});
  await service.action(task.id, "retry");
  const retried = await status(task.id, "waiting-test");
  expect(retried.snapshot).toEqual(failed.snapshot);
  expect(git("branch", "--show-current")).toBe("feature/fixture");
  expect(retried.logs.some((l) => l.level === "error")).toBe(true);
});

test("failed development accepts supplemental text and evidence before retry without replacing the frozen request", async () => {
  const task = await ready();
  configure({ fail: "development" });
  await service.action(task.id, "develop");
  const failed = await status(task.id, "failed");
  const frozen = structuredClone(failed.snapshot);
  const asset = await service.assets.importImage(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNu0AAAAASUVORK5CYII=",
      "base64",
    ),
  );
  configure({});
  await service.action(task.id, "retry", {
    supplement: {
      text: "筛选条件为最近 30 分钟，控制台报错见新截图。",
      assetIds: [asset.id],
    },
  });
  const retried = await status(task.id, "waiting-test");
  expect(retried.snapshot).toEqual(frozen);
  expect(retried.supplements).toEqual([
    expect.objectContaining({
      stage: "development",
      text: "筛选条件为最近 30 分钟，控制台报错见新截图。",
      assetIds: [asset.id],
    }),
  ]);
  expect(retried.assets).toContainEqual(asset);
  expect(calls().at(-1)?.prompt).toContain(
    "Additional evidence supplied after a paused or failed run",
  );
  expect(calls().at(-1)?.prompt).toContain("最近 30 分钟");
  expect(calls().at(-1)?.prompt).toContain(service.assets.filePath(asset.id));
});

test("an active Bug repair can pause for evidence and resume without becoming a failure", async () => {
  configure({ delay: 10000 });
  const task = create({
    kind: "bug",
    description: "筛选条件变更后页面未刷新，请定位并修复。",
  });
  await service.action(task.id, "fix");
  await until(
    () =>
      store.getTask(task.id).status === "developing" && calls().length === 1,
  );

  const paused = await service.action(task.id, "pause");
  expect(paused.status).toBe("stopped");
  expect(paused.error).toBeUndefined();
  expect(
    paused.logs.some((log) => log.message.includes("等待补充信息后继续")),
  ).toBe(true);

  configure({});
  await service.action(task.id, "retry", {
    supplement: { text: "只有选择最近 30 分钟后才能复现。" },
  });
  const resumed = await status(task.id, "waiting-review");
  expect(resumed.supplements).toEqual([
    expect.objectContaining({
      stage: "development",
      text: "只有选择最近 30 分钟后才能复现。",
    }),
  ]);
  expect(resumed.logs.some((log) => log.level === "error")).toBe(false);
  expect(calls()).toHaveLength(2);
  expect(calls().at(-1)?.prompt).toContain("最近 30 分钟");
});

test("an absent structured agent result fails assessment without creating a usable plan", async () => {
  configure({ missingOutput: true });
  const task = create();
  await service.action(task.id, "analyze");
  const failed = await status(task.id, "failed");
  expect(failed.error).toMatch(/未生成结构化结果/);
  expect(failed.plan).toBeUndefined();
  await expect(service.action(task.id, "develop")).rejects.toThrow();
});

test("testing refuses a generic passed report that omits the approved case even after real npm checks pass", async () => {
  const task = await developed();
  configure({
    result: {
      summary: "Insufficient coverage",
      checks: [
        { name: "everything", state: "passed", detail: "generic evidence" },
      ],
    },
  });
  await service.action(task.id, "test");
  const failed = await status(task.id, "failed");
  expect(failed.error).toMatch(/覆盖不完整/);
  expect(failed.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "npm run test", state: "passed" }),
      expect.objectContaining({ name: "CASE-1", state: "blocked" }),
    ]),
  );
  expect(opened).toEqual([]);
  await expect(service.action(task.id, "accept")).rejects.toThrow();
});

test("retrying tests retains prior failed case evidence in durable run history", async () => {
  const task = await developed();
  configure({
    result: {
      summary: "First verification failed",
      checks: [
        {
          name: "CASE-1",
          state: "failed",
          detail: "first-run assertion mismatch",
        },
      ],
    },
  });
  await service.action(task.id, "test");
  await status(task.id, "failed");
  configure({
    result: {
      summary: "Second verification blocked",
      checks: [
        {
          name: "CASE-1",
          state: "blocked",
          detail: "second-run environment unavailable",
        },
      ],
    },
  });
  await service.action(task.id, "retry");
  const retried = await status(task.id, "failed");
  const records = retried.runs?.filter((run) => run.stage === "test") ?? [];
  expect(records).toHaveLength(2);
  expect(records[0].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        state: "failed",
        detail: "first-run assertion mismatch",
      }),
    ]),
  );
  expect(records[1].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        state: "blocked",
        detail: "second-run environment unavailable",
      }),
    ]),
  );
  expect(records.every((run) => run.status === "failed")).toBe(true);
  expect(new Store(store.directory).getTask(task.id).runs).toEqual(
    retried.runs,
  );
  expect(opened).toEqual([]);
});

test("explicit repair uses the frozen branch and failed evidence, then retests even when automatic testing was initially off", async () => {
  const task = await developed();
  configure({
    result: {
      summary: "Verification failure",
      checks: [
        {
          name: "CASE-1",
          state: "failed",
          detail: "repair-this-specific-observed-failure",
        },
      ],
    },
  });
  await service.action(task.id, "test");
  const failed = await status(task.id, "failed");
  configure({});
  await service.action(task.id, "repair");
  // This fixture intentionally has no server.cjs: successful repair + retesting
  // must reach startup, then truthfully fail instead of claiming delivery.
  const repaired = await status(task.id, "failed");
  expect(repaired.stage).toBe("startup");
  expect(calls().map((call) => call.stage)).toEqual([
    "analysis",
    "development",
    "test",
    "development",
    "test",
  ]);
  expect(calls()[3].prompt).toContain("repair-this-specific-observed-failure");
  expect(repaired.snapshot).toEqual(failed.snapshot);
  expect(git("branch", "--show-current")).toBe("feature/fixture");
  expect(
    repaired.runs?.some(
      (run) => run.stage === "test" && run.status === "passed",
    ),
  ).toBe(true);
  expect(
    repaired.runs?.some((run) =>
      run.checks.some(
        (check) => check.detail === "repair-this-specific-observed-failure",
      ),
    ),
  ).toBe(true);
  expect(opened).toEqual([]);
});

test("successful case evidence and actual HTTP readiness precede opening the precise route and manual acceptance", async () => {
  const reservation = net.createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const address = reservation.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture port allocation failed");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  fs.writeFileSync(
    path.join(repository, "server.cjs"),
    `let periodic;require('node:http').createServer((req,res)=>{res.writeHead(200);res.end('fixture route '+req.url);if(req.url==='/evidence-after-accept'&&!periodic){periodic=setInterval(()=>console.log('post-accept periodic evidence'),250)}}).listen(${port},'127.0.0.1')`,
  );
  git("add", "server.cjs");
  git("commit", "-m", "fixture local HTTP server");
  const settings = store.settings();
  settings.projects[0].targetUrl = `http://127.0.0.1:${port}/development/fixture?source=studio`;
  store.saveSettings(settings);
  const task = await developed();
  await service.action(task.id, "test");
  const review = await status(task.id, "review");
  expect(review.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "npm run test", state: "passed" }),
      expect.objectContaining({ name: "Skill · CASE-1", state: "passed" }),
    ]),
  );
  expect(opened).toEqual([settings.projects[0].targetUrl]);
  expect(await (await fetch(opened[0])).text()).toBe(
    "fixture route /development/fixture?source=studio",
  );
  expect(
    review.logs.findIndex((l) => l.message.includes("必要检查已通过")),
  ).toBeLessThan(
    review.logs.findIndex((l) => l.message.includes("开发页已打开")),
  );
  const remote = path.join(root, "delivery.git");
  execFileSync("git", ["init", "--bare", remote], { windowsHide: true });
  git("remote", "add", "origin", remote);
  fs.writeFileSync(
    path.join(repository, "delivered.txt"),
    "accepted delivery evidence",
  );
  const accepted = await service.action(task.id, "accept");
  expect(accepted.status).toBe("accepted");
  expect(accepted.delivery).toEqual(
    expect.objectContaining({ branch: "feature/fixture", remote: "origin" }),
  );
  expect(
    execFileSync("git", ["rev-parse", "refs/heads/feature/fixture"], {
      cwd: remote,
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
  ).toBe(accepted.delivery?.commit);
  await (await fetch(`http://127.0.0.1:${port}/evidence-after-accept`)).text();
  await until(
    () =>
      store
        .getTask(task.id)
        .logs.filter((log) =>
          log.message.includes("post-accept periodic evidence"),
        ).length >= 2,
  );
  expect(store.getTask(task.id).status).toBe("accepted");
  expect(new Store(store.directory).getTask(task.id).status).toBe("accepted");
});

test("a second task replaces the service-owned server for the same project and URL", async () => {
  const url = await installServerFixture();
  const settings = store.settings();
  settings.projects[0].targetUrl = url;
  service.saveSettings(settings);
  const first = await developed();
  await service.action(first.id, "test");
  await status(first.id, "review");
  const firstServer = (await (await fetch(url)).json()) as { pid: number };
  const second = create({
    title: "Second change on the same checkout",
    branch: {
      mode: "existing",
      base: "feature/fixture",
      name: "",
      version: "",
    },
    autoTest: true,
  });
  await service.action(second.id, "analyze");
  await status(second.id, "ready");
  await service.action(second.id, "develop");
  const reviewed = await status(second.id, "review");
  const secondServer = (await (await fetch(url)).json()) as { pid: number };
  expect(secondServer.pid).not.toBe(firstServer.pid);
  expect(reviewed.logs.some((log) => log.message.includes("此前启动"))).toBe(
    true,
  );
  expect(opened).toEqual([url, url]);
  expect(reviewed.runtime?.targetUrl).toBe(url);
});

test("an unrelated HTTP responder blocks startup without killing it or opening the wrong page", async () => {
  const external = http.createServer((_request, response) =>
    response.end("unrelated fixture responder"),
  );
  await new Promise<void>((resolve) =>
    external.listen(0, "127.0.0.1", resolve),
  );
  const address = external.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture listener unavailable");
  const url = `http://127.0.0.1:${address.port}/unrelated`;
  try {
    const settings = store.settings();
    settings.projects[0].targetUrl = url;
    service.saveSettings(settings);
    const task = await developed();
    await service.action(task.id, "test");
    const failed = await status(task.id, "failed");
    expect(failed.stage).toBe("startup");
    expect(failed.error).toContain("目标地址已有服务响应");
    expect(await (await fetch(url)).text()).toBe("unrelated fixture responder");
    expect(external.listening).toBe(true);
    expect(opened).toEqual([]);
  } finally {
    external.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      external.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("startup retry adopts corrected runtime settings while preserving the frozen checkout and last successful open URL", async () => {
  const url = await installServerFixture();
  const settings = store.settings();
  settings.projects[0].startScript = "start:missing";
  service.saveSettings(settings);
  const task = await developed();
  await service.action(task.id, "test");
  const failed = await status(task.id, "failed");
  expect(failed.stage).toBe("startup");
  expect(failed.error).toContain("start:missing");
  const corrected = store.settings();
  corrected.projects[0].startScript = "start:corrected";
  corrected.projects[0].targetUrl = url;
  corrected.projects[0].directory = path.join(
    root,
    "different-nonexistent-checkout",
  );
  service.saveSettings(corrected);
  await service.action(task.id, "retry");
  const reviewed = await status(task.id, "review");
  expect(reviewed.snapshot).toEqual(failed.snapshot);
  expect(reviewed.snapshot?.project.directory).toBe(repository);
  expect(reviewed.runtime).toEqual({
    startScript: "start:corrected",
    targetUrl: url,
  });
  expect(opened).toEqual([url]);
  const afterSuccess = store.settings();
  afterSuccess.projects[0].targetUrl = "http://127.0.0.1:49998/different-page";
  service.saveSettings(afterSuccess);
  await service.openTarget(task.id);
  expect(opened).toEqual([url, url]);
  expect(new Store(store.directory).getTask(task.id).runtime).toEqual(
    reviewed.runtime,
  );
});
