import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import net from "node:net";
import http from "node:http";
import { StudioService } from "../src/main/service";
import { Store } from "../src/main/store";
import { GitSCMProvider } from "../src/main/providers/scm";
import { PolicyEngine } from "../src/main/policy";
import type { Task, TaskInput } from "../src/shared/contracts";
import type { BrowserProvider } from "../src/main/providers/browser";
import { ProviderFailure } from "../src/main/workflow/failures";
import { EvidenceStore } from "../src/main/evidence";
import { qualityEnvironmentIdentity } from "../src/main/development-checks";
import { createHash } from "node:crypto";

// These integration cases exercise real Git repositories and child processes.
// Shared CI runners need headroom without changing any Studio runtime deadline.
jest.setTimeout(180000);
let root: string;
let repository: string;
let fixture: string;
let store: Store;
let service: StudioService;
let observed: Task[];
let opened: string[];
let openingContexts: { external?: boolean }[];
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
async function until(predicate: () => boolean, timeoutMs = 120000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs)
      throw new Error(
        "Timed out waiting for fixture service: " +
          JSON.stringify(
            store.tasks().map((t) => ({
              status: t.status,
              error: t.error,
              logs: t.logs.slice(-4),
            })),
          ),
      );
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  // Public task status is published immediately before the active-operation finally block.
  await new Promise((resolve) => setTimeout(resolve, 20));
}
async function status(id: string, expected: Task["status"], timeoutMs = 15000) {
  await until(() => {
    const task = store.getTask(id);
    if (task.status === "failed" && expected !== "failed")
      throw new Error(
        `Task failed while waiting for ${expected}: ${task.error || "unknown failure"}`,
      );
    return task.status === expected;
  }, timeoutMs);
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
  return status(task.id, "waiting-review");
}

test("a non-running task can be deleted with its local run and evidence records", () => {
  const task = create();
  const runDirectory = path.join(store.directory, "runs", task.id);
  const evidenceDirectory = path.join(store.directory, "evidence", task.id);
  fs.mkdirSync(runDirectory, { recursive: true });
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(path.join(runDirectory, "run.json"), "{}");
  fs.writeFileSync(path.join(evidenceDirectory, "logs.jsonl"), "{}\n");

  service.deleteTask(task.id);

  expect(() => store.getTask(task.id)).toThrow("任务不存在");
  expect(fs.existsSync(runDirectory)).toBe(false);
  expect(fs.existsSync(evidenceDirectory)).toBe(false);
});

test("an explicit diagnosis request performs a read-only Codex investigation", async () => {
  const before = git("status", "--short");
  const task = create({
    kind: "bug",
    description: "页面打不开，先帮我分析根因，不要修改代码",
    branch: { mode: "existing", base: "main", name: "main", version: "" },
  });
  await service.action(task.id, "analyze");
  const diagnosed = await status(task.id, "ready");

  expect(diagnosed.intent).toMatchObject({ mode: "diagnose" });
  expect(diagnosed.diagnosis).toMatchObject({
    confidence: "high",
    affectedFiles: ["verify.cjs"],
  });
  expect(diagnosed.plan).toBeUndefined();
  expect(diagnosed.checks).toEqual([]);
  expect(git("status", "--short")).toBe(before);
  expect(calls()).toHaveLength(1);
  expect(calls()[0]).toMatchObject({ stage: "analysis", cwd: repository });
  expect(calls()[0].args).toContain("read-only");
  expect(calls()[0].prompt).toContain("DIAGNOSIS ONLY");
  expect(calls()[0].prompt).not.toContain("Read applicable AGENTS.md and the Tyflow workflow");
});

test("explicit isolated-task application makes checked code visible in original checkout without accepting or pushing", async () => {
  const task = create({
    kind: "bug",
    workspaceMode: "isolated",
    branch: { mode: "existing", base: "main", name: "main", version: "" },
  });
  configure({
    developmentFiles: { "verify.cjs": "console.log('editor visible fix')" },
  });
  const original = fs.readFileSync(path.join(repository, "verify.cjs"), "utf8");
  await expect(service.applyWorkspace(task.id)).rejects.toThrow(/完成开发/);
  await service.action(task.id, "fix");
  const finished = await status(task.id, "waiting-review", 30000);
  expect(fs.readFileSync(path.join(repository, "verify.cjs"), "utf8")).toBe(
    original,
  );
  const before = git("rev-parse", "HEAD");
  const applying = service.applyWorkspace(task.id);
  await expect(service.applyWorkspace(task.id)).rejects.toThrow();
  const applied = await applying;
  expect(applied.status).toBe("waiting-review");
  expect(applied.workspace?.application?.files).toContain("verify.cjs");
  expect(applied.snapshot).toEqual(finished.snapshot);
  expect(applied.delivery).toBeUndefined();
  expect(
    fs.readFileSync(path.join(repository, "verify.cjs"), "utf8"),
  ).toContain("editor visible fix");
  expect(git("branch", "--show-current")).toBe("main");
  expect(git("rev-parse", "HEAD")).toBe(before);
  expect(git("diff", "--cached", "--name-only")).toBe("");
  expect(
    (await service.applyWorkspace(task.id)).workspace?.application?.files,
  ).toContain("verify.cjs");
}, 60000);

test("isolated task source modified after development checks cannot be applied using stale completion", async () => {
  const task = create({
    kind: "bug",
    workspaceMode: "isolated",
    branch: { mode: "existing", base: "main", name: "main", version: "" },
  });
  configure({
    developmentFiles: { "verify.cjs": "console.log('checked fix')" },
  });
  await service.action(task.id, "fix");
  const finished = await status(task.id, "waiting-review", 30000);
  fs.appendFileSync(
    path.join(finished.workspace!.directory, "verify.cjs"),
    "\n// changed after checks",
  );
  await expect(service.applyWorkspace(task.id)).rejects.toThrow(/已变化/);
  expect(git("status", "--porcelain")).toBe("");
  expect(service.busy).toBe(false);
}, 60000);

test("quick text modification uses the live checkout with one Agent call and no test/browser ceremony", async () => {
  const task = create({
    kind: "text",
    size: "small",
    workflowMode: "quick",
    workspaceMode: "current",
    branch: { mode: "existing", base: "main", name: "main", version: "" },
    autoTest: false,
  });
  configure({
    developmentFiles: { "verify.cjs": "console.log('quick copy updated')" },
  });
  await service.action(task.id, "fix");
  const finished = await status(task.id, "waiting-review");
  expect(finished.workspace).toBeUndefined();
  expect(finished.snapshot?.project.directory).toBe(repository);
  expect(git("branch", "--show-current")).toBe("main");
  expect(
    fs.readFileSync(path.join(repository, "verify.cjs"), "utf8"),
  ).toContain("quick copy updated");
  expect(calls().map((call) => call.stage)).toEqual(["development"]);
  expect(calls()[0].prompt).toContain("L1");
  expect(calls()[0].prompt).not.toContain(
    "Read applicable AGENTS.md and the Tyflow workflow",
  );
  expect(calls()[0].prompt).not.toContain(
    "Studio will invoke the configured professional test provider",
  );
  expect(
    finished.checkpoints?.some(
      (c) =>
        c.id === "development:dependencies" ||
        c.id.startsWith("analysis:") ||
        c.id.startsWith("test:"),
    ),
  ).toBe(false);
  expect(
    finished.logs.some((entry) =>
      /安装独立依赖|专用.*浏览器/.test(entry.message),
    ),
  ).toBe(false);
});

test("optional quick testing verifies only pending cases without full commands or workflow reload", async () => {
  const task = create({
    workflowMode: "quick",
    workspaceMode: "current",
    branch: { mode: "existing", base: "main", name: "main", version: "" },
  });
  await service.action(task.id, "fix");
  await status(task.id, "waiting-review");
  configure({
    result: {
      summary: "Targeted regression",
      checks: [
        {
          name: "BUG-REGRESSION",
          state: "passed",
          detail: "Independent fixture assertion",
          evidence: [
            {
              kind: "command",
              command: "fixture-targeted-check",
              exitCode: 0,
              summary: "Fixture assertion",
            },
          ],
        },
      ],
    },
  });
  await service.action(task.id, "test");
  const verified = await status(task.id, "waiting-review");
  expect(verified.testExecution?.conclusion).toBe("VERIFIED");
  expect(calls().map((c) => c.stage)).toEqual(["development", "test"]);
  expect(calls().at(-1)!.prompt).toContain("L1 targeted verification only");
  expect(calls().at(-1)!.prompt).not.toContain(
    "Read applicable AGENTS.md and the Tyflow workflow",
  );
  expect(
    verified.checkpoints?.some((c) => c.id.startsWith("test:command:")),
  ).toBe(false);
});

test("unchecked automated testing finishes text development for manual browser review", async () => {
  const task = await ready();
  await service.action(task.id, "develop");
  const finished = await status(task.id, "waiting-review");
  expect(finished.testExecution).toBeUndefined();
  expect(calls().map((call) => call.stage)).toEqual([
    "analysis",
    "development",
  ]);
  expect(finished.logs.at(-1)?.message).toContain("浏览器");
});

test("quick mode refuses another branch and preserves dirty work until explicitly confirmed", async () => {
  git("branch", "other");
  const changedBranch = create({
    workflowMode: "quick",
    workspaceMode: "current",
    branch: { mode: "existing", base: "other", name: "other", version: "" },
  });
  await service.action(changedBranch.id, "fix");
  expect((await status(changedBranch.id, "failed")).failure?.code).toBe(
    "QUICK_BRANCH_CHANGED",
  );
  expect(git("branch", "--show-current")).toBe("main");
  expect(calls()).toHaveLength(0);
  fs.writeFileSync(path.join(repository, "user-note.txt"), "User work remains");
  const dirtyTask = create({
    workflowMode: "quick",
    workspaceMode: "current",
    branch: { mode: "existing", base: "main", name: "main", version: "" },
  });
  configure({ developmentFiles: { "verify.cjs": "console.log('small fix')" } });
  await service.action(dirtyTask.id, "fix");
  await status(dirtyTask.id, "failed");
  expect(calls()).toHaveLength(0);
  await service.action(dirtyTask.id, "retry", { allowDirty: true });
  await status(dirtyTask.id, "waiting-review");
  expect(fs.readFileSync(path.join(repository, "user-note.txt"), "utf8")).toBe(
    "User work remains",
  );
  expect(calls().map((call) => call.stage)).toEqual(["development"]);
});

test("quick source guard blocks new package edits without erasing the generated or existing code", async () => {
  const task = create({
    workflowMode: "quick",
    workspaceMode: "current",
    branch: { mode: "existing", base: "main", name: "main", version: "" },
  });
  const replacement =
    '{"private":true,"scripts":{"test":"node verify.cjs"},"changed":true}';
  configure({ developmentFiles: { "package.json": replacement } });
  await service.action(task.id, "fix");
  const stopped = await status(task.id, "failed");
  expect(stopped.failure?.code).toBe("QUICK_REQUIRES_STANDARD");
  expect(fs.readFileSync(path.join(repository, "package.json"), "utf8")).toBe(
    replacement,
  );
  expect(stopped.testExecution).toBeUndefined();
});
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
  openingContexts = [];
  service = new StudioService(
    store,
    credentials,
    (task) => observed.push(task),
    async (url, context) => {
      opened.push(url);
      openingContexts.push({ external: context?.external });
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
test("retired ZenTao integration cannot connect, navigate or create new associations", async () => {
  const settings = store.settings();
  settings.zentao = {
    enabled: true,
    url: "https://zentao.example.test/zentao/",
    username: "developer",
    mappings: { fixture: { productId: "12", projectId: "34" } },
  };
  store.saveSettings(settings);
  expect(service.settings().zentao.enabled).toBe(false);
  expect(service.settings().zentao.hasSecret).toBeUndefined();
  expect(await service.testConnection("zentao")).toMatchObject({ ok: false });
  expect(opened).toEqual([]);
  expect(
    create({ zentao: { type: "task", id: "81742" } }).zentao,
  ).toBeUndefined();
});

test("retiring ZenTao preserves legacy task links and configuration while ordinary settings still save", () => {
  const legacy = { type: "bug" as const, id: "60683" };
  const task = create();
  task.zentao = legacy;
  store.putTask(task);
  const edited = service.saveTask(
    {
      title: "Updated title",
      description: task.description,
      kind: task.kind,
      size: task.size,
      projectId: task.projectId,
      assetIds: task.assetIds,
      branch: task.branch,
      autoTest: task.autoTest,
    },
    task.id,
  );
  expect(edited.zentao).toEqual(legacy);
  const settings = store.settings();
  settings.zentao = {
    enabled: true,
    url: "legacy retired address",
    username: "legacy",
    mappings: {},
  };
  store.saveSettings(settings);
  const saved = service.saveSettings({
    ...service.settings(),
    theme: "#008A70",
  });
  expect(saved.theme).toBe("#008A70");
  expect(saved.zentao.enabled).toBe(false);
  expect(saved.zentao.url).toBe(settings.zentao.url);
  expect(store.getTask(task.id).zentao).toEqual(legacy);
  const reopened = new Store(store.directory);
  expect(reopened.getTask(task.id).zentao).toEqual(legacy);
  expect(reopened.settings().zentao.enabled).toBe(false);
  expect(() =>
    service.saveSettings({
      ...saved,
      secrets: { zentao: "not-saved-fixture" },
    }),
  ).toThrow("Unknown credential key");
});

test("two isolated Bug repairs execute separately while a third queues; stopping it leaves both active", async () => {
  fs.writeFileSync(path.join(repository, "unfinished.txt"), "keep user work");
  configure({ delay: 1800 });
  const make = () =>
    create({
      kind: "bug",
      workspaceMode: "isolated",
      branch: { mode: "existing", base: "main", name: "main", version: "" },
    });
  const first = make(),
    second = make(),
    third = make();
  await service.action(first.id, "fix");
  await service.action(second.id, "fix");
  expect((await service.action(third.id, "fix")).status).toBe("queued");
  await service.action(third.id, "stop");
  await until(() => calls().length === 2);
  expect(store.getTask(first.id).status).toBe("developing");
  expect(store.getTask(second.id).status).toBe("developing");
  await status(first.id, "waiting-review");
  await status(second.id, "waiting-review");
  const a = store.getTask(first.id),
    b = store.getTask(second.id);
  expect(a.snapshot?.project.directory).not.toBe(b.snapshot?.project.directory);
  expect(
    calls()
      .map((call) => call.cwd)
      .sort(),
  ).toEqual(
    [a.workspace!.directory, b.workspace!.directory]
      .map((directory) => fs.realpathSync(directory))
      .sort(),
  );
  expect(store.getTask(third.id).status).toBe("stopped");
  expect(fs.readFileSync(path.join(repository, "unfinished.txt"), "utf8")).toBe(
    "keep user work",
  );
  expect(git("branch", "--show-current")).toBe("main");
  expect(opened).toEqual([]);
});

test("stopping one parallel repair does not cancel its sibling", async () => {
  configure({ delay: 1500 });
  const make = () =>
    create({
      kind: "bug",
      workspaceMode: "isolated",
      branch: { mode: "existing", base: "main", name: "main", version: "" },
    });
  const first = make(),
    second = make();
  await service.action(first.id, "fix");
  await service.action(second.id, "fix");
  await until(() => calls().length === 2);
  await service.action(first.id, "stop");
  await status(second.id, "waiting-review");
  await until(
    () => store.getTask(first.id).status === "stopped" && !service.busy,
  );
  expect(store.getTask(second.id).error).toBeUndefined();
  expect(store.getTask(first.id).snapshot?.project.directory).not.toBe(
    repository,
  );
});

test("a Bug cancelled while queued can retry its original direct-repair intent without a plan", async () => {
  const settings = store.settings();
  settings.execution = { concurrency: 1, previewMode: "single" };
  service.saveSettings(settings);
  configure({ delay: 1000 });
  const make = () =>
    create({
      kind: "bug",
      workspaceMode: "isolated",
      branch: { mode: "existing", base: "main", name: "main", version: "" },
    });
  const first = make(),
    queued = make();
  await service.action(first.id, "fix");
  expect((await service.action(queued.id, "fix")).status).toBe("queued");
  await service.action(queued.id, "stop");
  await status(first.id, "waiting-review");
  configure({});
  expect(store.getTask(queued.id).snapshot).toBeUndefined();
  await service.action(queued.id, "retry");
  const repaired = await status(queued.id, "waiting-review");
  expect(repaired.snapshot?.directFix).toBe(true);
  expect(repaired.workspace).toBeDefined();
});

test("an unauthenticated CLI returns a login remedy before sending any development prompt", async () => {
  configure({ loggedOut: true });
  const task = create({ kind: "bug" });
  await service.action(task.id, "fix");
  const failed = await status(task.id, "failed");
  expect(failed.error).toContain("codex login");
  expect(calls()).toEqual([]);
  configure({});
  await service.action(task.id, "retry");
  await status(task.id, "waiting-review");
  expect(calls().map((call) => call.stage)).toEqual(["development"]);
});

test("manual browser review preserves the frozen workspace and does not manufacture acceptance", async () => {
  const task = create({
    kind: "bug",
    workspaceMode: "isolated",
    branch: { mode: "existing", base: "main", name: "main", version: "" },
  });
  await service.action(task.id, "fix");
  const waiting = await status(task.id, "waiting-review");
  await service.openTarget(task.id, true);
  expect(openingContexts).toEqual([{ external: true }]);
  expect(store.getTask(task.id).status).toBe("waiting-review");
  expect(store.getTask(task.id).snapshot).toEqual(waiting.snapshot);
  expect(store.getTask(task.id).delivery).toBeUndefined();
});

test("requirement documents can drive assessment without pasted text and all source paths reach the Agent", async () => {
  const document = path.join(root, "requirement.md");
  const rules = path.join(root, "interaction.txt");
  fs.writeFileSync(document, "# Fixed requirement");
  fs.writeFileSync(rules, "Use the design and preserve behavior");
  const assets = await service.assets.importFiles(
    [document, rules],
    "attachment",
  );
  const task = create({
    kind: "text",
    description: "",
    assetIds: assets.map((a) => a.id),
  });
  await service.action(task.id, "analyze");
  await status(task.id, "ready");
  for (const asset of assets) {
    expect(calls()[0].prompt).toContain(service.assets.rootPath(asset.id));
    expect(calls()[0].prompt).toContain(service.assets.filePath(asset.id));
  }
  expect(calls()[0].prompt).toContain("not interactive HTML prototypes");
  expect(calls()[0].prompt).toContain("untrusted");
  const image = await service.assets.importImage(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNu0AAAAASUVORK5CYII=",
      "base64",
    ),
  );
  expect(() => create({ description: "", assetIds: [image.id] })).toThrow(
    "需求或问题描述",
  );
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

test("bug fix with proved regression and explicit manual browser acceptance waits for review", async () => {
  configure({
    result: {
      summary: "Code fix complete; runtime review remains",
      checks: [
        {
          name: "focused regression",
          purpose: "regression",
          state: "passed",
          detail: "independent expected behavior asserted",
          covers: ["BUG-REQ-001"],
          evidence: [
            {
              kind: "command",
              command: "node focused-regression.cjs",
              exitCode: 0,
              summary: "expected fixture outcome asserted",
            },
          ],
        },
        {
          name: "real browser review",
          purpose: "manual",
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
    fixed.logs.some((log) => log.message.includes("运行时检查等待人工验证")),
  ).toBe(true);
});

test("assessment invokes read-only Codex, passes schema and exact target commit, and persists the plan", async () => {
  const task = await ready();
  const invocation = calls()[0];
  expect(observed.some((t) => t.status === "analyzing")).toBe(true);
  expect(invocation.args).toEqual(
    expect.arrayContaining([
      "exec",
      "--sandbox",
      "read-only",
      "-c",
      'approval_policy="never"',
      "--output-schema",
      "--output-last-message",
      "-",
    ]),
  );
  expect(invocation.cwd).toBe(fs.realpathSync(repository));
  expect(invocation.args).not.toContain("--approve-for-me");
  expect(invocation.args).not.toContain("--ignore-rules");
  expect(invocation.args).not.toContain(
    "--dangerously-bypass-approvals-and-sandbox",
  );
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
    workflowMode: "standard",
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
  const developedTask = await status(task.id, "waiting-review");
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
          purpose: "regression",
          state: "passed",
          detail: `Evidence ${secret}`,
          covers: ["REQ-001"],
          evidence: [
            {
              kind: "command",
              command: "node fixture-regression.cjs",
              exitCode: 0,
              summary: `Independent assertion ${secret}`,
            },
          ],
        },
      ],
    },
  });
  await service.action(task.id, "develop");
  const completed = await status(task.id, "waiting-review");
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
  expect(preserved.status).toBe("waiting-review");
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
  expect(task.status).toBe("waiting-review");
  expect(task.delivery).toBeUndefined();
  expect(
    task.checkpoints?.some((checkpoint) =>
      checkpoint.id.startsWith("startup:"),
    ),
  ).toBe(false);
  await expect(service.action(task.id, "analyze")).rejects.toThrow(/快照/);
  expect(() => service.saveTask({ ...task, assetIds: [] }, task.id)).toThrow();
});

test("active assessment prevents duplicate work and settings changes; stop and retry preserve its log history", async () => {
  configure({ delay: 10000 });
  const task = create();
  await service.action(task.id, "analyze");
  await until(() => calls().length === 1);
  await expect(service.action(task.id, "analyze")).rejects.toThrow();
  expect(() => service.saveSettings(store.settings())).toThrow(/任务执行.*中/);
  const second = create({
    title: "Second isolated task",
    branch: { mode: "existing", base: "main", name: "", version: "" },
  });
  expect((await service.action(second.id, "analyze")).status).toBe("queued");
  await service.action(second.id, "stop");
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
  const retried = await status(task.id, "waiting-review");
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
  const retried = await status(task.id, "waiting-review");
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
  // Checks complete without opening a server until the user requests runtime review.
  await status(task.id, "waiting-review");
  expect(opened).toEqual([]);
  await service.action(task.id, "start");
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
  await status(task.id, "waiting-review");
  expect(opened).toEqual([]);
  await service.action(task.id, "start");
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
  await status(first.id, "waiting-review");
  await service.action(first.id, "start");
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
  await status(second.id, "waiting-review");
  await service.action(second.id, "start");
  const reviewed = await status(second.id, "review");
  const secondServer = (await (await fetch(url)).json()) as { pid: number };
  expect(secondServer.pid).not.toBe(firstServer.pid);
  expect(reviewed.logs.some((log) => log.message.includes("此前启动"))).toBe(
    true,
  );
  expect(opened).toEqual([url, url]);
  expect(reviewed.runtime?.targetUrl).toBe(url);
  await expect(service.openTarget(first.id, true)).rejects.toThrow(
    "另一个任务",
  );
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
    await status(task.id, "waiting-review");
    await service.action(task.id, "start");
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
  await status(task.id, "waiting-review");
  await service.action(task.id, "start");
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

test("non-Bug assessment supports pause and supplementation without re-entering requirement input", async () => {
  configure({ delay: 10000 });
  const t = create();
  await service.action(t.id, "analyze");
  await until(() => calls().length === 1);
  const paused = await service.action(t.id, "pause");
  expect(paused.status).toBe("stopped");
  expect(paused.error).toBeUndefined();
  configure({});
  await service.action(t.id, "retry", {
    supplement: { text: "原需求范围不变，新增环境证据。" },
  });
  const resumed = await status(t.id, "ready");
  expect(resumed.supplements?.[0].stage).toBe("analysis");
  expect(calls().at(-1)?.prompt).toContain("新增环境证据");
  expect(
    resumed.checkpoints?.find((c) => c.id === "analysis:agent")?.attempts,
  ).toBe(2);
});

test("one failed case retries only that case and reuses passed engineering commands and cases", async () => {
  const planned = await ready();
  const caseOne = planned.plan!.testCases[0];
  planned.plan!.testCases.push({
    ...caseOne,
    id: "CASE-2",
    title: "Second case",
  });
  store.putTask(planned);
  await service.action(planned.id, "develop");
  await status(planned.id, "waiting-review");
  const passed = {
    name: "CASE-1",
    state: "passed",
    detail: "independent fixture observation",
    evidence: [
      {
        kind: "command",
        command: "fixture-check",
        exitCode: 0,
        summary: "controlled success",
      },
    ],
  };
  configure({
    result: {
      summary: "one failure",
      checks: [
        passed,
        {
          name: "CASE-2",
          state: "failed",
          detail: "controlled assertion mismatch",
        },
      ],
    },
  });
  await service.action(planned.id, "test");
  const failed = await status(planned.id, "failed");
  expect(failed.failure?.category).toBe("test");
  configure({
    result: {
      summary: "second case recovered",
      checks: [{ ...passed, name: "CASE-2" }],
    },
  });
  await service.action(planned.id, "retry");
  const recovered = await status(planned.id, "waiting-review");
  expect(calls().map((c) => c.stage)).toEqual([
    "analysis",
    "development",
    "test",
    "test",
  ]);
  const lastPrompt = calls().at(-1)!.prompt;
  expect(lastPrompt).toContain('"id":"CASE-2"');
  expect(lastPrompt).not.toContain('"id":"CASE-1"');
  expect(
    recovered.checkpoints?.find((c) => c.id === "test:command:test"),
  ).toMatchObject({ attempts: 1, reused: 1 });
  expect(
    recovered.checkpoints?.find((c) => c.id === "test:case:CASE-1"),
  ).toMatchObject({ attempts: 1, reused: 1 });
  expect(recovered.runs?.filter((r) => r.stage === "test")).toHaveLength(2);
});

test("browser prerequisites stop before expensive checks and resume the same task with scoped tools", async () => {
  const task = await developed();
  // This scenario explicitly requires browser assertions, unlike source-only cases.
  task.snapshot!.plan.testCases[0].browsers = ["chrome"];
  store.putTask(task);
  let prepared = false;
  let browserSession = 1;
  const release = jest.fn();
  const browser: BrowserProvider = {
    action: jest.fn(async () => ({
      url: "http://localhost:8000",
      workspace: repository,
      required: ["chrome" as const],
      ready: prepared,
      browsers: [],
    })),
    ready: jest.fn(async () => {
      if (!prepared)
        throw new ProviderFailure(
          "environment",
          "TEST_BROWSER_PREPARATION",
          "请先完成测试准备",
        );
    }),
    identity: () => ({ fixture: browserSession }),
    validateCheck: () => {},
    lease: async () => ({
      args: [],
      env: { STUDIO_BROWSER_TOKEN: "fixture-browser-secret" },
      secrets: ["fixture-browser-secret"],
      prompt: "\nScoped fixture browser available.",
      release,
    }),
    close: () => {},
  };
  service.close();
  service = new StudioService(
    store,
    credentials,
    (t) => observed.push(t),
    async () => {},
    { browser },
  );
  await service.action(task.id, "test");
  const pending = await status(task.id, "failed");
  expect(pending.failure).toMatchObject({
    code: "TEST_BROWSER_PREPARATION",
    checkpointId: "test:browser-preparation",
  });
  expect(
    pending.checkpoints?.some((c) => c.id.startsWith("test:command:")),
  ).toBe(false);
  expect(calls().map((c) => c.stage)).toEqual(["analysis", "development"]);
  prepared = true;
  configure({
    log: "fixture-browser-secret must not persist",
    result: {
      summary: "Fixture page still needs confirmation",
      checks: [
        {
          name: task.snapshot!.plan.testCases[0].id,
          state: "blocked",
          detail: "Fixture prerequisite",
        },
      ],
    },
  });
  await service.action(task.id, "retry");
  const recovered = await status(task.id, "failed");
  expect(recovered.failure?.code).toBe("TEST_INCOMPLETE");
  expect(calls().map((c) => c.stage)).toEqual([
    "analysis",
    "development",
    "test",
  ]);
  expect(calls().at(-1)!.prompt).toContain("Scoped fixture browser available");
  expect(
    recovered.checkpoints?.find((c) => c.id === "test:browser-preparation"),
  ).toMatchObject({ attempts: 2, status: "passed" });
  expect(release).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(recovered)).not.toContain("fixture-browser-secret");
  browserSession++;
  prepared = false;
  await service.action(task.id, "retry");
  const reopened = await status(task.id, "failed");
  expect(reopened.failure?.code).toBe("TEST_BROWSER_PREPARATION");
  prepared = true;
  configure({});
  await service.action(task.id, "retry");
  const reconfirmed = await status(task.id, "waiting-review");
  expect(
    reconfirmed.checkpoints?.find((c) => c.id === "test:command:test"),
  ).toMatchObject({ attempts: 1, reused: 1 });
  expect(calls().filter((c) => c.stage === "analysis")).toHaveLength(1);
  expect(calls().filter((c) => c.stage === "development")).toHaveLength(1);
  expect(calls().filter((c) => c.stage === "test")).toHaveLength(2);
  expect(release).toHaveBeenCalledTimes(2);
});

test("test evidence and an isolated scan copy do not trip the business gate or invalidate passed checkpoints", async () => {
  const task = await developed();
  const passed = {
    name: "CASE-1",
    state: "passed",
    detail: "independent fixture assertion",
    evidence: [
      {
        kind: "command",
        command: "fixture-check",
        exitCode: 0,
        summary: "fixture success",
      },
    ],
  };
  configure({
    testFiles: {
      "test-results/settings-copy/VERIFY.md": "fixture report",
      "test-results/settings-copy/scan-workspace/src/app.ts": "isolated copy",
      "test-results/settings-copy/scan-workspace/package.json": "{}",
    },
    result: { summary: "fixture verified", checks: [passed] },
  });
  await service.action(task.id, "test");
  await until(() =>
    ["failed", "waiting-review"].includes(store.getTask(task.id).status),
  );
  expect(store.getTask(task.id).failure).toBeUndefined();
  expect(store.getTask(task.id).status).toBe("waiting-review");
  const before = calls().length;
  await service.action(task.id, "start");
  // A launch failure does not invalidate the formal test result on retry.
  await status(task.id, "failed");
  expect(calls()).toHaveLength(before);
  expect(store.getTask(task.id).testExecution?.conclusion).toBe("VERIFIED");
});

test.each(["blocked", "unexecuted"])(
  "%s test cases report incomplete validation, preserve passed work, and recover in the same task",
  async (state) => {
    const task = await developed();
    configure({
      testFiles: { "test-results/fixture/raw-results.json": "{}" },
      result: {
        summary: "validation incomplete",
        checks: [
          {
            name: "CASE-1",
            state,
            detail: "Browser test identity is unavailable",
          },
        ],
      },
    });
    await service.action(task.id, "test");
    const failed = await status(task.id, "failed");
    expect(failed.failure).toMatchObject({
      category: "test",
      code: "TEST_INCOMPLETE",
    });
    expect(failed.testExecution).toBeUndefined();
    expect(failed.failure?.recommendedActions.join(" ")).toContain(
      "无需重录需求",
    );
    configure({});
    await service.action(task.id, "retry");
    const recovered = await status(task.id, "waiting-review");
    expect(calls().map((c) => c.stage)).toEqual([
      "analysis",
      "development",
      "test",
      "test",
    ]);
    expect(
      recovered.checkpoints?.find((c) => c.id === "test:command:test"),
    ).toMatchObject({ attempts: 1, reused: 1 });
    expect(recovered.testExecution?.conclusion).toBe("VERIFIED");
  },
);

test.each(["verify.cjs", "package.json", "test-results/tracked-config.json"])(
  "test modification of tracked %s still blocks the business gate",
  async (file) => {
    if (file.startsWith("test-results/")) {
      fs.mkdirSync(path.dirname(path.join(repository, file)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(repository, file), "original");
      git("add", file);
      git("commit", "-m", "tracked fixture config");
    }
    const task = await developed();
    configure({ testFiles: { [file]: "unauthorized mutation" } });
    await service.action(task.id, "test");
    const failed = await status(task.id, "failed");
    expect(failed.failure).toMatchObject({
      category: "policy",
      code: "TEST_CHANGED_BUSINESS",
    });
    expect(failed.testExecution).toBeUndefined();
  },
);

test("Git push failure retries delivery only and never creates another commit", async () => {
  const t = await developed();
  await service.action(t.id, "test");
  await status(t.id, "waiting-review");
  const remote = path.join(root, "recovery-remote.git");
  execFileSync("git", ["init", "--bare", remote], { windowsHide: true });
  git("remote", "add", "origin", remote);
  fs.writeFileSync(
    path.join(repository, "delivery.txt"),
    "authorized delivery",
  );
  const commitAndPush = jest.fn(GitSCMProvider.commitAndPush);
  commitAndPush.mockImplementationOnce(async (...args) => {
    const [project, , branch, title, , , onCommitted] = args;
    git("add", "--all");
    git("commit", "-m", title);
    onCommitted?.({
      commit: git("rev-parse", "HEAD"),
      branch,
      remote: "origin",
    });
    expect(project.directory).toBe(repository);
    throw new Error("fixture push disconnected");
  });
  service = new StudioService(
    store,
    credentials,
    (changed) => observed.push(changed),
    async () => {},
    { scm: { ...GitSCMProvider, commitAndPush } },
  );
  await expect(service.action(t.id, "accept")).rejects.toThrow("disconnected");
  const failed = store.getTask(t.id),
    commit = git("rev-parse", "HEAD"),
    count = calls().length;
  expect(failed.failure?.category).toBe("git");
  const recovered = await service.action(t.id, "retry");
  expect(recovered.status).toBe("accepted");
  expect(git("rev-parse", "HEAD")).toBe(commit);
  expect(calls().length).toBe(count);
  expect(
    recovered.checkpoints?.find((c) => c.id === "delivery:push")?.attempts,
  ).toBe(2);
});

test("supplementing an approved but unexecuted plan requires fresh assessment", async () => {
  const t = await ready();
  const updated = await service.action(t.id, "supplement", {
    supplement: { text: "补充验收上下文" },
  });
  expect(updated.status).toBe("draft");
  expect(updated.plan).toBeUndefined();
  await expect(service.action(t.id, "develop")).rejects.toThrow();
});

test("no-output notice does not advance the Agent's last real output timestamp", () => {
  const task = create({ kind: "bug" });
  task.activity = {
    lastOutputAt: "2026-10-01T00:00:00.000Z",
    idleTimeoutMs: 0,
  };
  const log = Reflect.get(service, "log") as (
    task: Task,
    stage: "development",
    message: string,
  ) => void;
  log.call(
    service,
    task,
    "development",
    "Agent 暂未收到新输出，继续等待；不会仅因无输出停止。",
  );
  expect(store.getTask(task.id).activity?.lastOutputAt).toBe(
    "2026-10-01T00:00:00.000Z",
  );
});

test("silent Codex exceeding legacy idle settings keeps running and completes without retry", async () => {
  const settings = store.settings();
  settings.execution = {
    concurrency: 2,
    previewMode: "single",
    agentIdleTimeoutMs: 1000,
  };
  store.saveSettings(settings);
  configure({ delay: 2500 });
  const task = create({ kind: "bug" });
  await service.action(task.id, "fix");
  await until(() => calls().some((call) => call.stage === "development"));
  expect(store.getTask(task.id).activity?.idleTimeoutMs).toBe(0);
  const finished = await status(task.id, "waiting-review", 30000);
  expect(finished.failure).toBeUndefined();
  expect(
    finished.logs.some((entry) => entry.message.includes("已暂停执行")),
  ).toBe(false);
  expect(calls().map((call) => call.stage)).toEqual(["development"]);
}, 45000);

test("legacy total deadline cannot stop a silent Codex execution or cause duplicate work", async () => {
  const settings = store.settings();
  settings.execution = {
    concurrency: 2,
    previewMode: "single",
    agentTimeoutMs: 1000,
  };
  store.saveSettings(settings);
  configure({ delay: 2500 });
  const t = create({ kind: "bug" });
  await service.action(t.id, "fix");
  const finished = await status(t.id, "waiting-review", 30000);
  expect(finished.failure).toBeUndefined();
  expect(finished.snapshot).toBeDefined();
  expect(calls().map((c) => c.stage)).toEqual(["development"]);
}, 45000);

test("Codex reconnect errors followed by completion succeed without a Studio retry", async () => {
  configure({
    transientError: "ECONNRESET reconnecting 1/5",
    completedEvent: true,
  });
  const t = create();
  await service.action(t.id, "analyze");
  const finished = await status(t.id, "ready");
  expect(finished.failure).toBeUndefined();
  expect(finished.plan).toBeDefined();
  expect(calls()).toHaveLength(1);
  expect(
    finished.logs.some((line) => line.message.includes("reconnecting 1/5")),
  ).toBe(true);
});

test("a network turn failure cannot become a pass even when Codex exits zero with valid JSON", async () => {
  configure({ eventError: "ECONNRESET connection reset by peer" });
  const t = create();
  await service.action(t.id, "analyze");
  const failed = await status(t.id, "failed");
  expect(failed.failure).toMatchObject({
    category: "agent",
    code: "NETWORK_LOST",
  });
  expect(failed.plan).toBeUndefined();
  expect(calls()).toHaveLength(1);
  expect(
    failed.checkpoints?.find((c) => c.id === "analysis:agent")?.status,
  ).toBe("failed");
});

test("Codex child receives scoped proxy environment without changing the Studio parent", async () => {
  const proxy = "http://127.0.0.1:17897",
    original = process.env.HTTPS_PROXY;
  configure({ requireProxy: proxy });
  const environment = jest.fn(async () => ({
    HTTPS_PROXY: proxy,
    HTTP_PROXY: proxy,
  }));
  const providers = { scm: GitSCMProvider, agentEnvironment: environment };
  service = new StudioService(
    store,
    credentials,
    (task) => observed.push(task),
    async () => {},
    providers,
  );
  const t = create();
  await service.action(t.id, "analyze");
  await until(() => ["ready", "failed"].includes(store.getTask(t.id).status));
  expect(store.getTask(t.id).status).toBe("ready");
  expect(environment).toHaveBeenCalledTimes(1);
  expect(calls()[0]).toMatchObject({
    proxyConfigured: true,
    proxyMatchesExpected: true,
  });
  expect(process.env.HTTPS_PROXY).toBe(original);
});

test("workspace routing transport failure is NETWORK_LOST with concise recovery feedback", async () => {
  configure({
    eventError: "workspace routing discovery failed",
    fail: "analysis",
  });
  const t = create();
  await service.action(t.id, "analyze");
  const failed = await status(t.id, "failed");
  expect(failed.failure).toMatchObject({
    category: "agent",
    code: "NETWORK_LOST",
  });
  expect(failed.failure?.message).toContain("代理");
  expect(failed.failure?.message.length).toBeLessThan(400);
  expect(failed.failure?.recommendedActions.join(";")).not.toContain("额度");
  expect(
    failed.logs.some((entry) =>
      entry.message.includes("workspace routing discovery failed"),
    ),
  ).toBe(true);
  expect(calls()).toHaveLength(1);
  expect(failed.plan).toBeUndefined();
});

function assessmentFixture(emptyLastScope: boolean) {
  return {
    summary: "设置保存提示文案变更",
    requirements: [
      {
        id: "REQ-001",
        text: "三端应用与全局设置保存提示",
        priority: "P1",
        source: "description",
      },
    ],
    planSteps: Array.from({ length: 6 }, (_, index) => ({
      id: `PLAN-00${index + 1}`,
      title: `修改已定位的保存提示 ${index + 1}`,
      covers: ["REQ-001"],
      expectedFiles: index === 5 && emptyLastScope ? [] : ["verify.cjs"],
    })),
    steps: ["仅调整保存成功提示文案"],
    risks: [],
    blockers: [],
    testCases: [
      {
        id: "CASE-001",
        title: "三端保存提示",
        covers: ["REQ-001"],
        verifies: Array.from(
          { length: 6 },
          (_, index) => `PLAN-00${index + 1}`,
        ),
        priority: "P1",
        steps: ["保存应用设置与全局设置"],
        expected: "显示对应端的延时与重启提示",
      },
    ],
  };
}

test("read-policy rejection cannot produce a successful assessment; same task retries without development", async () => {
  const originalFamily = process.env.CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY;
  process.env.CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY = "fixture-parent-package";
  try {
    configure({ readBlocked: true });
    const task = create();
    await service.action(task.id, "analyze");
    const failed = await status(task.id, "failed");
    expect(failed.failure).toMatchObject({
      category: "environment",
      code: "AGENT_READ_BLOCKED",
      checkpointId: "analysis:agent",
    });
    expect(failed.plan).toBeUndefined();
    expect(failed.snapshot).toBeUndefined();
    expect(calls()).toHaveLength(1);
    expect(calls()[0]).not.toHaveProperty("sandboxPackageFamily");
    expect(process.env.CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY).toBe(
      "fixture-parent-package",
    );
    configure({});
    await service.action(task.id, "retry");
    const recovered = await status(task.id, "ready");
    expect(recovered.id).toBe(task.id);
    expect(recovered.snapshot).toBeUndefined();
    expect(calls()).toHaveLength(2);
    expect(git("status", "--porcelain")).toBe("");
  } finally {
    if (originalFamily === undefined)
      delete process.env.CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY;
    else process.env.CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY = originalFamily;
  }
});

test("a blocked plan is reassessed rather than reusing a previously passed Agent checkpoint", async () => {
  const plan = {
    ...assessmentFixture(false),
    blockers: ["fixture source access blocked"],
  };
  configure({ result: plan });
  const task = await ready();
  expect(task.plan?.blockers).toHaveLength(1);
  configure({ result: assessmentFixture(false) });
  await service.action(task.id, "analyze");
  const recovered = await status(task.id, "ready");
  expect(calls()).toHaveLength(2);
  expect(recovered.plan?.blockers).toEqual([]);
  expect(recovered.snapshot).toBeUndefined();
});

test("invalid plan file scope receives one read-only correction and stops before development", async () => {
  configure({
    analysisResults: [assessmentFixture(true), assessmentFixture(false)],
  });
  const t = create();
  const originalFiles = git("status", "--porcelain");
  await service.action(t.id, "analyze");
  await until(() => ["ready", "failed"].includes(store.getTask(t.id).status));
  const result = store.getTask(t.id);
  expect(result.status).toBe("ready");
  expect(result.plan?.planSteps?.[5].expectedFiles).toEqual(["verify.cjs"]);
  expect(result.snapshot).toBeUndefined();
  const requests = calls();
  expect(requests).toHaveLength(2);
  expect(
    requests.every(
      (r) => r.stage === "analysis" && r.args.includes("read-only"),
    ),
  ).toBe(true);
  expect(requests[1].prompt).toContain("planSteps.5.expectedFiles");
  expect(requests[1].prompt).toContain("pure verification");
  expect(
    result.checkpoints?.find((c) => c.id === "analysis:agent")?.status,
  ).toBe("passed");
  expect(git("status", "--porcelain")).toBe(originalFiles);
});

test("persistent invalid plan stops after one correction with precise recovery guidance", async () => {
  configure({
    analysisResults: [
      assessmentFixture(true),
      assessmentFixture(true),
      assessmentFixture(false),
    ],
  });
  const t = create();
  await service.action(t.id, "analyze");
  const result = await status(t.id, "failed");
  expect(calls()).toHaveLength(2);
  expect(result.failure).toMatchObject({
    category: "agent",
    code: "AGENT_PLAN_INVALID",
    checkpointId: "analysis:agent",
  });
  expect(result.failure?.message).toContain("第 6 个计划步骤");
  expect(result.failure?.message).toContain("文件范围");
  expect(result.failure?.recommendedActions.join("；")).not.toContain(
    "网络和额度",
  );
  expect(result.plan).toBeUndefined();
  expect(result.snapshot).toBeUndefined();
  expect(
    result.checkpoints?.find((c) => c.id === "analysis:agent")?.status,
  ).toBe("failed");
});

test("reported implementation failures are code failures, not Agent transport failures", async () => {
  const t = await ready();
  configure({
    result: {
      summary: "controlled code failure",
      checks: [
        {
          name: "compile",
          state: "failed",
          detail: "independent compiler failure",
        },
      ],
    },
  });
  await service.action(t.id, "develop");
  const failed = await status(t.id, "failed");
  expect(failed.failure).toMatchObject({
    category: "code",
    code: "DEVELOPMENT_CHECK_FAILED",
  });
});

test("missing regression evidence remains incomplete and can recover with checks-only without reimplementation", async () => {
  const task = await ready();
  configure({
    developmentFiles: {
      "verify.cjs": "console.log('implementation retained')",
    },
    result: {
      summary: "saved, syntax only",
      checks: [
        {
          name: "syntax",
          purpose: "quality",
          state: "passed",
          detail: "parse only",
        },
      ],
    },
  });
  await service.action(task.id, "develop");
  const incomplete = await status(task.id, "failed");
  expect(incomplete.failure?.code).toBe("DEVELOPMENT_VALIDATION_INCOMPLETE");
  const content = fs.readFileSync(path.join(repository, "verify.cjs"), "utf8");
  configure({
    result: {
      summary: "focused behavior asserted",
      checks: [
        {
          name: "requirement regression",
          purpose: "regression",
          state: "passed",
          detail: "expected behavior matched",
          covers: ["REQ-001"],
          evidence: [
            {
              kind: "command",
              command: "node focused-assertion.cjs",
              exitCode: 0,
              summary: "independent assertion",
            },
          ],
        },
      ],
    },
  });
  await service.action(task.id, "retry", { developmentChecksOnly: true });
  const completed = await status(task.id, "waiting-review");
  expect(completed.failure).toBeUndefined();
  expect(fs.readFileSync(path.join(repository, "verify.cjs"), "utf8")).toBe(
    content,
  );
  expect(calls().map((c) => c.stage)).toEqual([
    "analysis",
    "development",
    "development",
  ]);
  expect(calls()[2].prompt).toContain("DEVELOPMENT CHECKS ONLY");
  expect(completed.runs?.map((r) => r.status)).toEqual([
    "passed",
    "failed",
    "passed",
  ]);
});

test("checks-only mutation is blocked and preserved rather than silently accepted or reverted", async () => {
  const task = await ready();
  configure({
    result: {
      summary: "failed check",
      checks: [
        {
          name: "regression",
          purpose: "regression",
          state: "failed",
          detail: "controlled mismatch",
        },
      ],
    },
  });
  await service.action(task.id, "develop");
  await status(task.id, "failed");
  configure({
    developmentFiles: {
      "verify.cjs": "console.log('unexpected verification write')",
    },
  });
  await service.action(task.id, "retry", { developmentChecksOnly: true });
  const failed = await status(task.id, "failed");
  expect(failed.failure?.code).toBe("DEVELOPMENT_CHECK_CHANGED_SOURCE");
  expect(
    fs.readFileSync(path.join(repository, "verify.cjs"), "utf8"),
  ).toContain("unexpected verification write");
});

test.each([0, 1])(
  "actual ESLint report %i recovers through service, persists proof and guards delivery",
  async (index) => {
    const reports = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "fixtures/development-lint-replay.json"),
        "utf8",
      ),
    );
    const original =
      "switch (mode) {\ncase 1:\n  const oldValue = 1;\n  break;\n}\n";
    fs.writeFileSync(path.join(repository, "verify.cjs"), original);
    fs.writeFileSync(path.join(repository, ".gitignore"), "node_modules/\n");
    fs.writeFileSync(
      path.join(repository, "eslint.config.cjs"),
      'module.exports=[{rules:{"no-case-declarations":"error"}}];',
    );
    fs.mkdirSync(path.join(repository, "node_modules/eslint"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(repository, "node_modules/eslint/index.cjs"),
      `module.exports=require(${JSON.stringify(require.resolve("eslint"))});`,
    );
    fs.writeFileSync(
      path.join(repository, "node_modules/eslint/package.json"),
      JSON.stringify({
        main: "index.cjs",
        version: JSON.parse(
          fs.readFileSync(require.resolve("eslint/package.json"), "utf8"),
        ).version,
      }),
    );
    git("add", ".");
    git("commit", "--quiet", "-m", "controlled lint baseline");
    const task = create({
      kind: "bug",
      workflowMode: "quick",
      workspaceMode: "current",
      branch: { mode: "existing", base: "main", name: "main", version: "" },
    });
    configure({
      developmentFiles: { "verify.cjs": "// repaired\n" + original },
      result: {
        summary: "syntax alone is insufficient",
        checks: [
          {
            name: "syntax",
            state: "passed",
            purpose: "quality",
            detail: "parse only",
          },
          reports[index],
        ],
      },
    });
    await service.action(task.id, "fix");
    // Real fixed-tool integration has bounded Git preparation + 30s ESLint;
    // do not use the 15s synthetic-provider polling budget for this case.
    const incomplete = await status(task.id, "failed", 60000);
    expect(incomplete.failure?.code).toBe("DEVELOPMENT_VALIDATION_INCOMPLETE");
    expect(
      incomplete.checks.find((c) => c.name === reports[index].name)?.historical
        ?.count,
    ).toBe(1);
    const retained = fs.readFileSync(
      path.join(repository, "verify.cjs"),
      "utf8",
    );
    configure({
      result: {
        summary: "focused requirement proof",
        checks: [
          {
            name: "behavior assertion",
            purpose: "regression",
            state: "passed",
            detail: "controlled independent behavior",
            covers: incomplete.snapshot!.plan.requirements!.map((r) => r.id),
            evidence: [
              {
                kind: "command",
                command: "node focused-regression.cjs",
                exitCode: 0,
                summary: "independent expected behavior matched",
              },
            ],
          },
          reports[index],
        ],
      },
    });
    await service.action(task.id, "retry", { developmentChecksOnly: true });
    const completed = await status(task.id, "waiting-review", 60000);
    expect(
      completed.checks.find((c) => c.name === reports[index].name)?.historical
        ?.count,
    ).toBe(1);
    expect(calls().map((c) => c.stage)).toEqual(["development", "development"]);
    expect(fs.readFileSync(path.join(repository, "verify.cjs"), "utf8")).toBe(
      retained,
    );
    const savedDirectory = store.directory;
    service.close();
    store = new Store(savedDirectory);
    const commitAndPush = jest
      .fn(GitSCMProvider.commitAndPush)
      .mockResolvedValue({
        commit: git("rev-parse", "HEAD"),
        branch: "main",
        remote: "fixture",
      });
    service = new StudioService(
      store,
      credentials,
      (t) => observed.push(t),
      async () => {},
      { scm: { ...GitSCMProvider, commitAndPush } },
    );
    expect(store.getTask(task.id).status).toBe("waiting-review");
    expect(store.getTask(task.id).runs?.map((r) => r.status)).toEqual([
      "failed",
      "passed",
    ]);
    if (index === 0) {
      expect((await service.action(task.id, "accept")).status).toBe("accepted");
      expect(commitAndPush).toHaveBeenCalledTimes(1);
    } else {
      fs.appendFileSync(
        path.join(repository, "verify.cjs"),
        "// source changed after validation\n",
      );
      await expect(service.action(task.id, "start")).rejects.toThrow(
        "历史检查对比证据",
      );
      expect(store.getTask(task.id).failure?.code).toBe(
        "DEVELOPMENT_EVIDENCE_INVALID",
      );
      expect(commitAndPush).not.toHaveBeenCalled();
    }
    expect(opened).toEqual([]);
  },
  120000,
);

test("an independently clean lint proof cannot be reused after source changes", async () => {
  const task = await developed();
  const evidence = new EvidenceStore(store.directory, (value) => value);
  const proof = evidence.saveResult(task, {
    tool: "eslint",
    baseCommit: task.snapshot!.baseCommit,
    environment: qualityEnvironmentIdentity(repository),
    files: [
      {
        file: "verify.cjs",
        sourceHash: createHash("sha256")
          .update(fs.readFileSync(path.join(repository, "verify.cjs")))
          .digest("hex"),
        before: [],
        after: [],
      },
    ],
  });
  task.checks.push({
    name: "ESLint",
    purpose: "quality",
    state: "passed",
    detail: "independent clean result",
    qualityProof: proof,
  });
  store.putTask(task);
  fs.appendFileSync(
    path.join(repository, "verify.cjs"),
    "\n// changed after proof\n",
  );
  await expect(service.action(task.id, "start")).rejects.toThrow(
    "历史检查对比证据",
  );
  expect(store.getTask(task.id).failure?.code).toBe(
    "DEVELOPMENT_EVIDENCE_INVALID",
  );
});

test.each([false, true])(
  "historical warning acceptance validates proof before delivery (tampered=%s)",
  async (tampered) => {
    const task = await developed();
    const evidence = new EvidenceStore(store.directory, (value) => value);
    const proof = evidence.saveResult(task, {
      tool: "eslint",
      file: "verify.cjs",
      baseCommit: task.snapshot!.baseCommit,
      environment: qualityEnvironmentIdentity(repository),
      sourceHash: createHash("sha256")
        .update(fs.readFileSync(path.join(repository, "verify.cjs")))
        .digest("hex"),
      after: [{ ruleId: "no-case-declarations" }],
    });
    task.checks.push({
      name: "historical lint",
      purpose: "quality",
      state: "failed",
      detail: "controlled historical fixture",
      historical: { evidencePath: proof.path, sha256: proof.sha256, count: 1 },
    });
    store.putTask(task);
    const commitAndPush = jest
      .fn(GitSCMProvider.commitAndPush)
      .mockResolvedValue({
        commit: git("rev-parse", "HEAD"),
        branch: task.snapshot!.branch.name,
        remote: "fixture",
      });
    service = new StudioService(
      store,
      credentials,
      (changed) => observed.push(changed),
      async () => {},
      { scm: { ...GitSCMProvider, commitAndPush } },
    );
    if (tampered) {
      fs.writeFileSync(proof.path, "{}");
      await expect(service.action(task.id, "accept")).rejects.toThrow(
        "历史检查对比证据",
      );
      expect(store.getTask(task.id).failure?.code).toBe(
        "DEVELOPMENT_EVIDENCE_INVALID",
      );
      expect(commitAndPush).not.toHaveBeenCalled();
    } else {
      expect((await service.action(task.id, "accept")).status).toBe("accepted");
      expect(commitAndPush).toHaveBeenCalledTimes(1);
      expect(
        store.getTask(task.id).checks.find((c) => c.name === "historical lint")
          ?.state,
      ).toBe("failed");
    }
  },
);

test("a policy-only failure revalidates the gate without repeating the completed development Agent", async () => {
  const t = await ready(),
    policy = new PolicyEngine();
  jest
    .spyOn(policy, "changes")
    .mockReturnValueOnce([
      { name: "scope", state: "blocked", detail: "controlled gate failure" },
    ]);
  service = new StudioService(
    store,
    credentials,
    (changed) => observed.push(changed),
    async () => {},
    { policy },
  );
  await service.action(t.id, "develop");
  const failed = await status(t.id, "failed");
  expect(failed.failure?.category).toBe("policy");
  await service.action(t.id, "retry");
  const recovered = await status(t.id, "waiting-review");
  expect(calls().map((c) => c.stage)).toEqual(["analysis", "development"]);
  expect(
    recovered.checkpoints?.find((c) => c.id === "development:agent"),
  ).toMatchObject({ attempts: 1, reused: 1 });
});
