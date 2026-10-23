import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { Task } from "../src/shared/contracts";
import { SkillTestProvider, type TestHost } from "../src/main/providers/test";
import { WorkflowEngine } from "../src/main/workflow/engine";
import { EvidenceStore } from "../src/main/evidence";
import { initialSettings } from "../src/main/store";

jest.setTimeout(30000);
let directory: string;
let task: Task;
let host: TestHost;
let logs: { message: string; level?: string }[];
let scripts: string[];
let controller: AbortController;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const git = (...args: string[]) =>
  execFileSync("git", args, {
    cwd: directory,
    windowsHide: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function configure(scriptNames: string[], body = "") {
  scripts = scriptNames;
  fs.writeFileSync(path.join(directory, "runner.cjs"), body);
  fs.writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "studio-test-fixture",
      version: "1.0.0",
      scripts: Object.fromEntries(
        scripts.map((name) => [name, `node runner.cjs ${name}`]),
      ),
    }),
  );
  git("add", ".");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--allow-empty",
    "-m",
    "fixture scripts",
  );
  task.snapshot!.baseCommit = git("rev-parse", "HEAD");
}
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "studio-provider-test-"));
  git("init", "--initial-branch=main");
  fs.writeFileSync(path.join(directory, "business.js"), "original");
  fs.writeFileSync(
    path.join(directory, "SKILL.md"),
    "Disposable testing skill",
  );
  controller = new AbortController();
  task = {
    id: "fixture",
    projectId: "fixture",
    status: "waiting-review",
    checks: [],
    logs: [],
    autoTest: false,
    title: "Fixture",
    description: "Targeted change",
    kind: "text",
    size: "small",
    assetIds: [],
    assets: [],
    branch: { mode: "existing", base: "main", name: "main", version: "" },
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:00Z",
    planRevision: 1,
    snapshot: {
      baseCommit: "",
      project: {
        id: "fixture",
        name: "Fixture",
        directory,
        repository: "",
        auth: "system",
        username: "",
        startScript: "",
        targetUrl: "",
        defaultBranchMode: "existing",
      },
      branch: { mode: "existing", base: "main", name: "main", version: "" },
      description: "Targeted change",
      assetHashes: [],
      at: "2026-10-19T00:00:00Z",
      plan: {
        summary: "fixture",
        steps: [],
        risks: [],
        blockers: [],
        testCases: [
          {
            id: "T1",
            title: "源码断言",
            steps: ["检查局部源码"],
            expected: "符合需求",
            priority: "P1",
          },
        ],
      },
    },
  };
  configure(["test"]);
  logs = [];
  const settings = initialSettings();
  settings.agent.command = process.execPath;
  settings.agent.testSkill = path.join(directory, "SKILL.md");
  const workflow = new WorkflowEngine(
    { save: () => {}, log: () => {}, sanitize: (s) => s },
    new EvidenceStore(path.join(directory, "evidence"), (s) => s),
    () => 1,
  );
  host = {
    workflow,
    settings: () => settings,
    assertSnapshot: async () =>
      ({ scripts }) as Awaited<ReturnType<TestHost["assertSnapshot"]>>,
    workspaceFileState: async () => ({
      "business.js": hash(
        fs.readFileSync(path.join(directory, "business.js"), "utf8"),
      ),
    }),
    sourceSnapshot: async () =>
      hash(fs.readFileSync(path.join(directory, "business.js"), "utf8")),
    planHash: () => hash(JSON.stringify(task.snapshot!.plan)),
    contextHash: () => "fixture",
    context: () => "",
    checkpoint: (t, id, label, category, signal, key, work, options) =>
      workflow.step(
        t,
        { id, label, category, stage: "test", fingerprint: key, ...options },
        signal,
        work,
      ),
    agent: jest.fn(async () => ({
      summary: "targeted assertion",
      checks: [
        {
          name: "T1",
          state: "passed",
          detail: "independent assertion",
          evidence: [
            {
              kind: "command",
              command: "fixture-targeted-check",
              exitCode: 0,
              summary: "actual fixture assertion",
            },
          ],
        },
      ],
    })),
    log: (_t, _stage, message, level) => logs.push({ message, level }),
    publish: () => {},
    safe: (s) => s,
  };
});
afterEach(async () => {
  host.workflow.close();
  await fs.promises.rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 200,
  });
});

test.each([0, 23])(
  "business mutation from a script exiting %i is caught before the Agent",
  async (exit) => {
    configure(
      ["test"],
      `require('node:fs').writeFileSync('business.js','unauthorized');process.exitCode=${exit};`,
    );
    await expect(
      new SkillTestProvider(host).verify(task, controller.signal),
    ).rejects.toMatchObject({ code: "TEST_CHANGED_BUSINESS" });
    expect(host.agent).not.toHaveBeenCalled();
    expect(task.failure?.code).toBe("TEST_CHANGED_BUSINESS");
    expect(task.testExecution).toBeUndefined();
    expect(fs.readFileSync(path.join(directory, "business.js"), "utf8")).toBe(
      "unauthorized",
    );
  },
);
test.each([false, true])(
  "scope guard survives Agent exception, including cancellation=%s",
  async (cancel) => {
    host.agent = jest.fn(async () => {
      fs.writeFileSync(path.join(directory, "business.js"), "unauthorized");
      if (cancel) controller.abort();
      throw new Error("fixture Agent exited");
    });
    await expect(
      new SkillTestProvider(host).verify(task, controller.signal),
    ).rejects.toMatchObject({ code: "TEST_CHANGED_BUSINESS" });
    expect(task.failure?.code).toBe("TEST_CHANGED_BUSINESS");
    expect(logs.some((l) => l.message.includes("fixture Agent exited"))).toBe(
      true,
    );
  },
);
test("a genuine command failure remains a failure when no business files changed", async () => {
  configure(
    ["test"],
    "console.error('independent assertion failed');process.exitCode=7;",
  );
  await expect(
    new SkillTestProvider(host).verify(task, controller.signal),
  ).rejects.toThrow("7");
  expect(host.agent).not.toHaveBeenCalled();
  expect(task.failure?.checkpointId).toBe("test:command:test");
});
test("stderr from a passing command is not an error log", async () => {
  configure(["test"], "console.error('Tests: 35 passed, 35 total');");
  await new SkillTestProvider(host).verify(task, controller.signal);
  expect(logs.find((l) => l.message.includes("35 passed"))?.level).toBe("info");
  expect(task.testExecution?.conclusion).toBe("VERIFIED");
});
test("quick testing selects targeted script without running the full test or build", async () => {
  task.workflowMode = "quick";
  configure(
    ["test", "build", "test:change"],
    "require('node:fs').appendFileSync('commands.log',process.argv[2]+'\\n');",
  );
  await new SkillTestProvider(host).verify(task, controller.signal);
  expect(fs.readFileSync(path.join(directory, "commands.log"), "utf8")).toBe(
    "test:change\n",
  );
  expect(task.testExecution?.conclusion).toBe("VERIFIED");
});
test("quick testing without targeted scripts still verifies approved cases once", async () => {
  task.workflowMode = "quick";
  configure(
    ["test", "build"],
    "throw Error('Full checks must not run in quick mode');",
  );
  await new SkillTestProvider(host).verify(task, controller.signal);
  expect(host.agent).toHaveBeenCalledTimes(1);
  expect(task.checks.some((c) => c.name.startsWith("npm run"))).toBe(false);
  expect(task.testExecution?.conclusion).toBe("VERIFIED");
});
test("standard testing retains full scripts, and static cases do not prepare browsers", async () => {
  configure(
    ["test", "build"],
    "require('node:fs').appendFileSync('commands.log',process.argv[2]+'\\n');",
  );
  host.prepareBrowser = jest.fn(async () => {
    throw Error("Static case must not prepare a browser");
  });
  await new SkillTestProvider(host).verify(task, controller.signal);
  expect(host.prepareBrowser).not.toHaveBeenCalled();
  expect(fs.readFileSync(path.join(directory, "commands.log"), "utf8")).toBe(
    "test\nbuild\n",
  );
});

test("a failed fresh attempt cannot retain an earlier VERIFIED envelope", async () => {
  await new SkillTestProvider(host).verify(task, controller.signal);
  expect(task.testExecution?.conclusion).toBe("VERIFIED");
  configure(["test"], "process.exitCode=8;");
  host.contextHash = () => "new-test-context";
  await expect(
    new SkillTestProvider(host).verify(task, controller.signal),
  ).rejects.toThrow("8");
  expect(task.testExecution).toBeUndefined();
});
