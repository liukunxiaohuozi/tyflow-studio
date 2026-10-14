import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../src/main/store";
import { EvidenceStore } from "../src/main/evidence";
import { WorkflowEngine, fingerprint } from "../src/main/workflow/engine";
import { ProviderFailure } from "../src/main/workflow/failures";
import { NotificationProvider } from "../src/main/providers/notification";
let root: string;
let store: Store;
let evidence: EvidenceStore;
let workflow: WorkflowEngine;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-recovery-"));
  store = new Store(root);
  evidence = new EvidenceStore(root, (v) => v);
  workflow = new WorkflowEngine(
    {
      save: (t) => {
        store.putTask(t);
      },
      log: () => {},
      sanitize: (s) => s,
    },
    evidence,
    () => 1,
  );
});
afterEach(() => {
  workflow.close();
  fs.rmSync(root, { recursive: true, force: true });
});
function task() {
  return store.saveTask({
    projectId: "fixture",
    title: "Recovery",
    description: "Preserve completed stages",
    kind: "text",
    size: "small",
    branch: { mode: "existing", base: "main", name: "", version: "" },
    assetIds: [],
    autoTest: false,
  });
}
const step = {
  id: "test:case:CASE-1",
  label: "Case one",
  stage: "test" as const,
  category: "test" as const,
  fingerprint: fingerprint("source", "plan"),
};
test("passed checkpoint survives restart and only failed checkpoint is executed again", async () => {
  const t = task(),
    signal = new AbortController().signal;
  const passed = jest.fn(async () => ({ proof: "case-one" }));
  await workflow.step(t, step, signal, passed);
  await expect(
    workflow.step(t, { ...step, id: "test:case:CASE-2" }, signal, async () => {
      throw new ProviderFailure("test", "CASE_FAILED", "case two mismatch");
    }),
  ).rejects.toThrow("mismatch");
  const restored = new Store(root).getTask(t.id);
  expect(restored.failure?.category).toBe("test");
  await workflow.step(restored, step, signal, passed);
  expect(passed).toHaveBeenCalledTimes(1);
  expect(restored.checkpoints?.find((c) => c.id === step.id)?.reused).toBe(1);
  await workflow.step(
    restored,
    { ...step, id: "test:case:CASE-2" },
    signal,
    async () => "repaired",
  );
  expect(restored.failure).toBeUndefined();
});
test("source drift or evidence tampering prevents checkpoint reuse", async () => {
  const t = task(),
    signal = new AbortController().signal,
    work = jest.fn(async () => ({ result: 1 }));
  await workflow.step(t, step, signal, work);
  fs.writeFileSync(
    t.checkpoints![0].result!.path,
    JSON.stringify({ result: 999 }),
  );
  await workflow.step(t, step, signal, work);
  await workflow.step(
    t,
    { ...step, fingerprint: fingerprint("different-source") },
    signal,
    work,
  );
  expect(work).toHaveBeenCalledTimes(3);
});
test("client restart interrupts running checkpoints without replaying code or Git", () => {
  const t = task();
  t.status = "developing";
  t.stage = "development";
  t.checkpoints = [
    {
      ...step,
      status: "running",
      attempts: 1,
      reused: 0,
      startedAt: new Date().toISOString(),
    },
  ];
  store.putTask(t);
  const restored = new Store(root).getTask(t.id);
  expect(restored.status).toBe("stopped");
  expect(restored.failure?.code).toBe("CLIENT_RESTARTED");
  expect(restored.checkpoints![0].status).toBe("interrupted");
});
test("aborted step never records a successful checkpoint", async () => {
  const t = task(),
    controller = new AbortController();
  await expect(
    workflow.step(t, step, controller.signal, async () => {
      controller.abort();
      return "not complete";
    }),
  ).rejects.toThrow();
  expect(t.checkpoints![0].status).toBe("interrupted");
  expect(t.checkpoints![0].result).toBeUndefined();
});

test("a notification channel failure cannot fail an otherwise recorded task transition", async () => {
  const t = task();
  t.status = "failed";
  const provider = new NotificationProvider([
    {
      channel: "desktop",
      enabled: () => true,
      send: async () => {
        throw new Error("channel unavailable");
      },
    },
  ]);
  const settings = store.settings();
  settings.notifications.enabled = true;
  settings.notifications.milestones.failed = true;
  await expect(
    provider.dispatch("developing", t, settings, false),
  ).resolves.toEqual([{ channel: "desktop", sent: false }]);
  expect(t.status).toBe("failed");
});
