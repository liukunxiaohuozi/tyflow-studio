import { DemoSession } from "../src/renderer/demo";
import { initialSettings } from "../src/main/store";
import type { TaskInput } from "../src/shared/contracts";

let session: DemoSession;
let preview: jest.Mock;
beforeEach(() => {
  jest.useFakeTimers();
  preview = jest.fn();
  session = new DemoSession(initialSettings(), preview);
});
afterEach(() => {
  session.dispose();
  jest.useRealTimers();
});
async function assess() {
  await session.api.taskAction("demo-task", "analyze");
  jest.advanceTimersByTime(1400);
  expect(session.getTask().status).toBe("ready");
}

test("plan revision notes regenerate the demo plan without changing the requirement", async () => {
  await assess();
  const before = session.getTask();
  await session.api.taskAction("demo-task", "analyze", {
    planFeedback: "不要改公共组件，并补充权限验收",
  });
  jest.advanceTimersByTime(1400);
  const revised = session.getTask();
  expect(revised.status).toBe("ready");
  expect(revised.description).toBe(before.description);
  expect(revised.plan?.summary).toContain("已按意见修订");
  expect(revised.plan?.summary).toContain("不要改公共组件，并补充权限验收");
  expect(revised.plan?.testCases.some((item) => item.id === "CASE-REV")).toBe(
    true,
  );
  expect(revised.planRevision).toBe(before.planRevision + 1);
  expect(revised.planFeedback).toBeUndefined();
});

test("the complete sample lifecycle remains local and produces clearly simulated results", async () => {
  expect(typeof window).toBe("undefined");
  await assess();
  expect(session.getTask().plan?.testCases).toHaveLength(3);
  await session.api.taskAction("demo-task", "develop");
  jest.runAllTimers();
  expect(session.getTask().status).toBe("review");
  expect(session.getTask().checks).toHaveLength(3);
  expect(
    session.getTask().checks.every((check) => check.detail.includes("模拟")),
  ).toBe(true);
  expect(
    session
      .getTask()
      .logs.every((log) => log.message.startsWith("【模拟日志】")),
  ).toBe(true);
  expect(preview).toHaveBeenCalledTimes(1);
  await session.api.taskAction("demo-task", "accept");
  expect(session.getTask().status).toBe("accepted");
});

test("manual testing waits for intervention and preserves the selected existing branch", async () => {
  const input: TaskInput = {
    ...session.getTask(),
    autoTest: false,
    branch: {
      mode: "existing",
      base: "develop",
      name: "develop",
      version: "v1.0.0",
    },
  };
  await session.api.saveTask(input);
  await assess();
  await session.api.taskAction("demo-task", "develop");
  jest.runAllTimers();
  expect(session.getTask().status).toBe("waiting-test");
  expect(preview).not.toHaveBeenCalled();
  expect(session.getTask().snapshot?.branch).toEqual(input.branch);
  await session.api.taskAction("demo-task", "test");
  jest.runAllTimers();
  expect(session.getTask().status).toBe("review");
});

test("stopping cancels progress and retry resumes the interrupted stage", async () => {
  await assess();
  await session.api.taskAction("demo-task", "develop");
  jest.advanceTimersByTime(2500);
  expect(session.getTask().status).toBe("testing");
  await session.api.taskAction("demo-task", "stop");
  jest.runAllTimers();
  expect(session.getTask().status).toBe("stopped");
  expect(preview).not.toHaveBeenCalled();
  await session.api.taskAction("demo-task", "retry");
  jest.runAllTimers();
  expect(session.getTask().status).toBe("review");
});

test("exiting or restarting cancels every pending callback and does not mutate real settings", async () => {
  const settings = initialSettings();
  const original = structuredClone(settings);
  const isolated = new DemoSession(settings, preview);
  const updates = jest.fn();
  isolated.subscribe(updates);
  await isolated.api.taskAction("demo-task", "analyze");
  isolated.dispose();
  updates.mockClear();
  jest.runAllTimers();
  expect(updates).not.toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();
  expect(settings).toEqual(original);
  expect(isolated.settings.projects[0].directory).toBe("demo://explore");
});

test("changes to the target revision invalidate the sample plan before development", async () => {
  await assess();
  const task = session.getTask();
  await session.api.saveTask({
    ...task,
    branch: { ...task.branch, version: "v1.1.0" },
  });
  expect(session.getTask().plan).toBeUndefined();
  await expect(session.api.taskAction("demo-task", "develop")).rejects.toThrow(
    /先完成评估/,
  );
});

test("sample import does not accept local files or export simulated evidence", async () => {
  const files = await session.api.importFiles("attachment");
  expect(files[0].name).toBe("demo-browser.log");
  await expect(
    session.api.importFiles("design", ["C:/private/file.zip"]),
  ).rejects.toThrow(/内置素材/);
  await expect(session.api.exportTask("demo-task")).rejects.toThrow(/不导出/);
});
