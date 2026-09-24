import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store, initialSettings } from "../src/main/store";
import {
  validateSettings,
  validateTaskInput,
  canAct,
  redact,
  safeTargetUrl,
  canReuseTestExecution,
  normalizePlanTraceability,
  validateEvidence,
  validateTraceability,
} from "../src/main/validation";
import { notificationForTransition } from "../src/main/notifications";
import type { Task } from "../src/shared/contracts";

const input = {
  title: "Requirement",
  kind: "text" as const,
  size: "small" as const,
  description: "Add filtering",
  projectId: "explore",
  assetIds: [],
  branch: {
    mode: "new" as const,
    base: "main",
    name: "feat/filter",
    version: "",
  },
  autoTest: true,
};
describe("security and state invariants", () => {
  test("legacy inferred traceability cannot pass the strict development gate", () => {
    const plan = normalizePlanTraceability({
      summary: "legacy",
      steps: ["change code"],
      risks: [],
      blockers: [],
      testCases: [{ id: "CASE-1", title: "case", steps: ["run"], expected: "ok" }],
    });
    expect(plan.traceabilityMode).toBe("legacy");
    expect(validateTraceability(plan).some((check) => check.state !== "passed")).toBe(true);
  });

  test("P0 evidence cannot pass with prose only", () => {
    const checks = [{ name: "CASE-1", state: "passed" as const, detail: "looks good" }];
    expect(validateEvidence(checks, process.cwd(), new Set(["CASE-1"]))[0].state).toBe("blocked");
  });
  test("reuses formal tests only when source, plan, skill and evidence all match", () => {
    const execution = {
      contractVersion: 1 as const,
      provider: "frontend-test" as const,
      runId: "run-1",
      sourceSnapshot: "source-1",
      planHash: "plan-1",
      skillHash: "skill-1",
      completedAt: new Date().toISOString(),
      reused: false,
      checks: [{ name: "CASE-1", state: "passed" as const, detail: "ok" }],
      evidenceChecks: [
        { name: "evidence", state: "passed" as const, detail: "ok" },
      ],
      conclusion: "VERIFIED" as const,
    };
    expect(
      canReuseTestExecution(execution, {
        sourceSnapshot: "source-1",
        planHash: "plan-1",
        skillHash: "skill-1",
      }),
    ).toBe(true);
    expect(
      canReuseTestExecution(execution, {
        sourceSnapshot: "changed",
        planHash: "plan-1",
        skillHash: "skill-1",
      }),
    ).toBe(false);
    expect(
      canReuseTestExecution(
        { ...execution, evidenceChecks: [] },
        {
          sourceSnapshot: "source-1",
          planHash: "plan-1",
          skillHash: "skill-1",
        },
      ),
    ).toBe(false);
  });
  test("rejects options as refs and unsafe URLs", () => {
    expect(() =>
      validateTaskInput({
        ...input,
        branch: { ...input.branch, base: "--upload-pack=bad" },
      }),
    ).toThrow();
    expect(() => safeTargetUrl("file:///etc/passwd")).toThrow();
    expect(() => safeTargetUrl("https://evil.example")).toThrow();
    expect(safeTargetUrl("http://localhost:8000/query")).toContain("/query");
  });
  test("cannot develop an unplanned draft or accept incomplete tests", () => {
    const task: Task = {
      ...input,
      status: "draft",
      id: "test",
      createdAt: "now",
      updatedAt: "now",
      planRevision: 0,
      checks: [],
      logs: [],
      assets: [],
    };
    expect(() => canAct(task, "develop")).toThrow();
    expect(() =>
      canAct({ ...task, status: "waiting-test" }, "accept"),
    ).toThrow();
    expect(() =>
      canAct(
        {
          ...task,
          status: "review",
          checks: [{ name: "tests", state: "failed", detail: "" }],
        },
        "accept",
      ),
    ).toThrow();
    expect(() =>
      canAct(
        {
          ...task,
          status: "waiting-review",
          checks: [
            { name: "runtime", state: "unexecuted", detail: "manual review" },
          ],
        },
        "accept",
      ),
    ).not.toThrow();
  });
  test("notifies only when a task enters a human-attention milestone", () => {
    const task: Task = {
      ...input,
      status: "waiting-test",
      id: "notify-task",
      createdAt: "now",
      updatedAt: "now",
      planRevision: 0,
      checks: [],
      logs: [],
      assets: [],
    };
    expect(notificationForTransition("developing", task)).toEqual({
      title: "开发完成",
      body: "“Requirement”已完成开发，等待启动自动化测试。",
    });
    expect(notificationForTransition("waiting-test", task)).toBeUndefined();
    expect(
      notificationForTransition("developing", {
        ...task,
        status: "waiting-review",
      }),
    ).toEqual({
      title: "开发修复完成",
      body: "“Requirement”已完成开发，可启动项目或在现有环境中自行验证。",
    });
    expect(
      notificationForTransition("testing", { ...task, status: "review" }),
    ).toEqual({
      title: "开发与测试完成",
      body: "“Requirement”已通过必要检查，等待人工验收。",
    });
  });
  test("redacts known secrets and common authorization values", () => {
    expect(
      redact(
        "password=abc Authorization: Bearer abcdef https://me:secret@host",
        ["secret"],
      ),
    ).not.toMatch(/abc|abcdef|secret/);
  });
  test("settings rejects invalid colors and duplicate project IDs", () => {
    const settings = initialSettings();
    expect(() =>
      validateSettings({ ...settings, theme: "red;display:none" }),
    ).toThrow();
    expect(() =>
      validateSettings({
        ...settings,
        projects: [settings.projects[0], settings.projects[0]],
      }),
    ).toThrow();
  });
  test("settings accepts an additional frontend project", () => {
    const settings = initialSettings();
    const custom = {
      ...settings.projects[0],
      id: "rum-web",
      name: "RUM 前端",
      directory: "C:\\workspace\\rum-web",
      repository: "git@example.test:team/rum-web.git",
    };
    const result = validateSettings({
      ...settings,
      projects: [...settings.projects, custom],
      developer: { ...settings.developer, defaultProject: custom.id },
    });
    expect(result.projects.at(-1)).toEqual(custom);
    expect(result.developer.defaultProject).toBe("rum-web");
  });
  test("settings accepts ZenTao project mappings", () => {
    const settings = initialSettings();
    settings.zentao.mappings.explore = { productId: "12", projectId: "34" };
    expect(validateSettings(settings).zentao.mappings.explore).toEqual({
      productId: "12",
      projectId: "34",
    });
  });
});
describe("durable task store", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tyflow-store-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  test("preserves input across reopen, marks interrupted run stopped and bounds logs", () => {
    const store = new Store(dir);
    const task = store.saveTask(input);
    task.status = "developing";
    task.logs = Array.from({ length: 2100 }, (_, i) => ({
      time: "now",
      stage: "development" as const,
      level: "info" as const,
      message: String(i),
    }));
    store.putTask(task);
    const reopened = new Store(dir);
    const loaded = reopened.getTask(task.id);
    expect(loaded.status).toBe("stopped");
    expect(loaded.description).toBe(input.description);
    expect(loaded.logs.length).toBeLessThanOrEqual(2000);
  });
  test("changed requirement invalidates plan and cannot edit a frozen run", () => {
    const store = new Store(dir);
    const task = store.saveTask(input);
    task.status = "ready";
    task.plan = {
      summary: "A",
      steps: ["B"],
      risks: [],
      testCases: [{ id: "T1", title: "C", steps: ["D"], expected: "E" }],
      blockers: [],
    };
    store.putTask(task);
    const changed = store.saveTask(
      { ...input, description: "Different requirement" },
      task.id,
    );
    expect(changed.plan).toBeUndefined();
    expect(changed.status).toBe("draft");
    changed.status = "developing";
    store.putTask(changed);
    expect(() => store.saveTask(input, task.id)).toThrow();
  });
  test("renaming only the proposed new branch preserves the evaluated source and ready plan", () => {
    const store = new Store(dir);
    const task = store.saveTask(input);
    task.status = "ready";
    task.plan = { summary: "Evaluated source", steps: ["Implement"], risks: [], testCases: [{ id: "T1", title: "Behavior", steps: ["Verify"], expected: "Pass" }], blockers: [] };
    task.baseCommit = "a".repeat(40);
    task.targetCommit = "b".repeat(40);
    store.putTask(task);
    const renamed = store.saveTask({ ...input, branch: { ...input.branch, name: "feat/renamed" } }, task.id);
    expect(renamed.status).toBe("ready");
    expect(renamed.plan).toEqual(task.plan);
    expect(renamed.baseCommit).toBe(task.baseCommit);
    expect(renamed.targetCommit).toBe(task.targetCommit);
    expect(renamed.branch.name).toBe("feat/renamed");
    expect(new Store(dir).getTask(task.id).plan).toEqual(task.plan);
  });
  test.each(["base", "version"] as const)("changing source branch %s invalidates the plan and both assessed commits", field => {
    const store = new Store(dir);
    const task = store.saveTask(input);
    task.status = "ready";
    task.plan = { summary: "Original source", steps: ["Implement"], risks: [], testCases: [{ id: "T1", title: "Behavior", steps: ["Verify"], expected: "Pass" }], blockers: [] };
    task.baseCommit = "a".repeat(40);
    task.targetCommit = "b".repeat(40);
    store.putTask(task);
    const changed = store.saveTask({ ...input, branch: { ...input.branch, [field]: field === "base" ? "release" : "v2.0" } }, task.id);
    expect(changed.status).toBe("draft");
    expect(changed.plan).toBeUndefined();
    expect(changed.baseCommit).toBeUndefined();
    expect(changed.targetCommit).toBeUndefined();
  });
  test("corrupt persisted JSON is reported rather than silently reset", () => {
    fs.writeFileSync(path.join(dir, "state.json"), "{broken");
    expect(() => new Store(dir)).toThrow();
  });
});
