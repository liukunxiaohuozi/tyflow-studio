import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CodexAgentProvider,
  type AgentRequest,
} from "../src/main/providers/agent";
import { EvidenceStore } from "../src/main/evidence";
import { initialSettings, Store } from "../src/main/store";
import {
  ProcessExecutionError,
  runCommand,
  type RunOptions,
} from "../src/main/process";
import { resolveCodex } from "../src/main/codex";
import { validateSettings } from "../src/main/policy";

jest.mock("../src/main/process", () => ({
  ...jest.requireActual("../src/main/process"),
  runCommand: jest.fn(),
}));
jest.mock("../src/main/codex", () => ({ resolveCodex: jest.fn() }));
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-agent-idle-"));
  jest.clearAllMocks();
  jest.mocked(resolveCodex).mockResolvedValue({
    command: { executable: process.execPath, args: [] },
    version: "codex-cli fixture",
    fallback: false,
  } as Awaited<ReturnType<typeof resolveCodex>>);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test.each([undefined, 180000, 1000])(
  "Agent ignores legacy idle value %s and warns without a kill deadline or fake activity",
  async (legacy) => {
    const settings = initialSettings();
    settings.execution!.agentIdleTimeoutMs = legacy;
    let execution: RunOptions | undefined;
    jest
      .mocked(runCommand)
      .mockImplementation(async (_command, args, options) => {
        if (args[0] === "login") return "Logged in";
        execution = options;
        const output = args[args.indexOf("--output-last-message") + 1];
        fs.writeFileSync(
          output,
          JSON.stringify({ summary: "fixture complete", checks: [] }),
        );
        return "";
      });
    const request: AgentRequest = {
      taskId: "aabbccdd-1234-4321-aaaa-123456789012",
      directory: root,
      projectName: "Fixture",
      stage: "development",
      prompt: "fixture",
      schema: {},
      signal: new AbortController().signal,
      log: jest.fn(),
      activity: jest.fn(),
    };
    const provider = new CodexAgentProvider(
      () => settings,
      new EvidenceStore(root, (value) => value),
      (value) => value,
    );
    await expect(provider.invoke(request)).resolves.toMatchObject({
      summary: "fixture complete",
    });
    expect(execution?.idleTimeout ?? 0).toBe(0);
    expect(execution?.idleWarningAfter).toBe(60000);
    expect(execution?.timeout).toBeNull();
    expect(request.activity).toHaveBeenCalledWith(expect.any(String), 0);
    const before = jest.mocked(request.activity).mock.calls.length;
    execution!.onIdle!(180000);
    expect(request.log).toHaveBeenCalledWith(
      expect.stringContaining("不会仅因无输出停止"),
      undefined,
    );
    expect(jest.mocked(request.activity).mock.calls.length).toBe(before);
  },
);

test("legacy total limit is ignored and the Agent explicitly disables the process deadline", async () => {
  const settings = initialSettings();
  settings.execution!.agentTimeoutMs = 1200000;
  let observed: RunOptions | undefined;
  jest
    .mocked(runCommand)
    .mockImplementation(async (_command, args, options) => {
      if (args[0] === "login") return "Logged in";
      observed = options;
      fs.writeFileSync(args[args.indexOf("--output-last-message") + 1], "{}");
      return "";
    });
  const provider = new CodexAgentProvider(
    () => settings,
    new EvidenceStore(root, (value) => value),
    (value) => value,
  );
  await provider.invoke({
    taskId: "aabbccdd-1234-4321-aaaa-123456789012",
    directory: root,
    projectName: "Fixture",
    stage: "development",
    prompt: "fixture",
    schema: {},
    signal: new AbortController().signal,
    log: () => {},
    activity: () => {},
  });
  expect(observed?.timeout).toBeNull();
  expect(observed?.idleTimeout ?? 0).toBe(0);
});

test("old persisted Agent deadlines migrate to zero and stay zero on settings save/reopen", () => {
  const settings = initialSettings();
  settings.execution!.agentIdleTimeoutMs = 180000;
  settings.execution!.agentTimeoutMs = 2400000;
  fs.writeFileSync(
    path.join(root, "state.json"),
    JSON.stringify({ schemaVersion: 1, settings, tasks: [] }),
  );
  const store = new Store(root);
  expect(store.settings().execution).toMatchObject({
    agentIdleTimeoutMs: 0,
    agentTimeoutMs: 0,
  });
  const saved = store.settings();
  saved.execution!.agentIdleTimeoutMs = 1000;
  saved.execution!.agentTimeoutMs = 1000;
  store.saveSettings(saved);
  expect(new Store(root).settings().execution).toMatchObject({
    agentIdleTimeoutMs: 0,
    agentTimeoutMs: 0,
  });
  expect(() => validateSettings(store.settings())).not.toThrow();
});

test.each([
  { events: ["error", "turn.completed"], pass: true },
  { events: ["error"], pass: false },
  { events: ["turn.failed", "turn.completed"], pass: false },
  { events: ["turn.completed", "error"], pass: false },
])(
  "Codex lifecycle $events determines the final result without hiding a failed turn",
  async ({ events, pass }) => {
    jest
      .mocked(runCommand)
      .mockImplementation(async (_command, args, options) => {
        if (args[0] === "login") return "Logged in";
        for (const type of events)
          options.onLine?.(
            JSON.stringify({ type, message: "connection reset; retrying" }),
            false,
          );
        fs.writeFileSync(args[args.indexOf("--output-last-message") + 1], "{}");
        return "";
      });

    const provider = new CodexAgentProvider(
      initialSettings,
      new EvidenceStore(root, (value) => value),
      (value) => value,
    );
    const result = provider.invoke({
      taskId: "aabbccdd-1234-4321-aaaa-123456789012",
      directory: root,
      projectName: "Fixture",
      stage: "development",
      prompt: "fixture",
      schema: {},
      signal: new AbortController().signal,
      log: () => {},
      activity: () => {},
    });
    if (pass) await expect(result).resolves.toEqual({});
    else await expect(result).rejects.toMatchObject({ category: "agent" });
  },
);

test("a nonzero Codex exit still fails after turn.completed and valid output", async () => {
  jest
    .mocked(runCommand)
    .mockImplementation(async (_command, args, options) => {
      if (args[0] === "login") return "Logged in";
      fs.writeFileSync(
        args[args.indexOf("--output-last-message") + 1],
        "{}",
      );
      options.onLine?.(JSON.stringify({ type: "turn.completed" }), false);
      throw new ProcessExecutionError("ABNORMAL_EXIT", "fixture exit 7", 7);
    });
  const provider = new CodexAgentProvider(
    initialSettings,
    new EvidenceStore(root, (v) => v),
    (v) => v,
  );
  await expect(
    provider.invoke({
      taskId: "aabbccdd-1234-4321-aaaa-123456789012",
      directory: root,
      projectName: "Fixture",
      stage: "development",
      prompt: "fixture",
      schema: {},
      signal: new AbortController().signal,
      log: () => {},
      activity: () => {},
    }),
  ).rejects.toMatchObject({ category: "agent", code: "ABNORMAL_EXIT" });
});
