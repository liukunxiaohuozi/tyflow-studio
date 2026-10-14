import { createHash, randomUUID } from "node:crypto";
import type {
  FailureCategory,
  Stage,
  Task,
  TaskAction,
  WorkflowCheckpoint,
} from "../../shared/contracts";
import { EvidenceStore } from "../evidence";
import { TaskQueue } from "../task-queue";
import { failureDetail, ProviderFailure } from "./failures";

export const fingerprint = (...values: unknown[]) =>
  createHash("sha256").update(JSON.stringify(values)).digest("hex");
export interface StepOptions {
  id: string;
  label: string;
  stage: Stage;
  category: FailureCategory;
  fingerprint: string;
  reuse?: boolean;
  after?: () => Promise<string>;
}
export class WorkflowEngine {
  private queue: TaskQueue;
  constructor(
    private hooks: {
      save: (task: Task) => void;
      log: (task: Task, stage: Stage, message: string) => void;
      sanitize: (message: string) => string;
    },
    private evidence: EvidenceStore,
    capacity: () => number,
  ) {
    this.queue = new TaskQueue(capacity);
  }
  get busy() {
    return this.queue.busy;
  }
  has(id: string) {
    return this.queue.has(id);
  }
  enqueue(id: string, resource: string, run: () => Promise<void>) {
    this.queue.enqueue(id, resource, run);
  }
  cancelWaiting(id: string) {
    this.queue.cancelWaiting(id);
  }
  close() {
    this.queue.close();
  }
  stageFor(task: Task, action: TaskAction): Stage {
    return action === "analyze"
      ? "analysis"
      : ["develop", "repair", "fix"].includes(action)
        ? "development"
        : action === "test"
          ? "test"
          : action === "start"
            ? "startup"
            : (task.stage ?? "analysis");
  }
  cached<T>(task: Task, id: string, key: string): T | undefined {
    const checkpoint = task.checkpoints?.find((item) => item.id === id);
    if (
      !checkpoint ||
      checkpoint.status !== "passed" ||
      checkpoint.fingerprint !== key ||
      !checkpoint.result
    )
      return;
    try {
      return this.evidence.readResult<T>(task, checkpoint.result);
    } catch {
      this.invalidate(task, [id], "检查点证据缺失或已变化");
      return;
    }
  }
  invalidate(task: Task, ids: string[], reason: string) {
    for (const item of task.checkpoints ?? [])
      if (ids.some((id) => item.id === id || item.id.startsWith(id + ":")))
        item.status = "invalidated";
    this.hooks.log(task, task.stage ?? "analysis", reason);
    this.hooks.save(task);
  }
  async step<T>(
    task: Task,
    options: StepOptions,
    signal: AbortSignal,
    work: () => Promise<T>,
  ): Promise<T> {
    if (signal.aborted)
      throw new ProviderFailure("interrupted", "CANCELLED", "任务已停止");
    const previous = task.checkpoints?.find((item) => item.id === options.id);
    const cached =
      options.reuse === false
        ? undefined
        : this.cached<T>(task, options.id, options.fingerprint);
    if (cached !== undefined && previous) {
      previous.reused++;
      this.hooks.log(task, options.stage, `复用已通过检查点：${options.label}`);
      this.hooks.save(task);
      return cached;
    }
    const checkpoint: WorkflowCheckpoint = {
      ...options,
      status: "running",
      attempts: (previous?.attempts ?? 0) + 1,
      reused: previous?.reused ?? 0,
      startedAt: new Date().toISOString(),
    };
    // Only durable data belongs in the ledger; callable options never reach state.json.
    delete (checkpoint as WorkflowCheckpoint & Partial<StepOptions>).after;
    delete (checkpoint as WorkflowCheckpoint & Partial<StepOptions>).reuse;
    task.checkpoints = [
      ...(task.checkpoints ?? []).filter((item) => item.id !== options.id),
      checkpoint,
    ].slice(-200);
    task.activity = {
      checkpointId: options.id,
      lastOutputAt: new Date().toISOString(),
    };
    this.hooks.save(task);
    try {
      const result = await work();
      if (signal.aborted)
        throw new ProviderFailure("interrupted", "CANCELLED", "任务已停止");
      checkpoint.result = this.evidence.saveResult(task, result);
      checkpoint.fingerprint = options.after
        ? await options.after()
        : options.fingerprint;
      checkpoint.status = "passed";
      checkpoint.finishedAt = new Date().toISOString();
      if (task.failure?.checkpointId === options.id) task.failure = undefined;
      this.hooks.save(task);
      return result;
    } catch (error) {
      checkpoint.status = signal.aborted ? "interrupted" : "failed";
      checkpoint.finishedAt = new Date().toISOString();
      checkpoint.failure = failureDetail(
        signal.aborted
          ? new ProviderFailure(
              "interrupted",
              "CANCELLED",
              "任务已暂停或停止，已有代码保留",
            )
          : error,
        options.stage,
        options.id,
        options.category,
        this.hooks.sanitize,
      );
      task.failure = checkpoint.failure;
      checkpoint.failure.impact.unshift(`检查点：${options.label} (${options.id})`);
      if (task.snapshot) checkpoint.failure.impact.push(`工作区：${task.snapshot.project.directory}`);
      this.hooks.save(task);
      throw error;
    }
  }
  async recorded(
    task: Task,
    stage: Stage,
    signal: AbortSignal,
    work: () => Promise<void>,
  ) {
    const startedAt = new Date().toISOString();
    task.stage = stage;
    let failure: unknown;
    try {
      await work();
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      task.runs = [
        ...(task.runs ?? []),
        {
          id: randomUUID(),
          stage,
          startedAt,
          finishedAt: new Date().toISOString(),
          status: failure
            ? signal.aborted
              ? ("stopped" as const)
              : ("failed" as const)
            : ("passed" as const),
          checks: structuredClone(task.checks),
          error: failure ? this.hooks.sanitize(String(failure)) : undefined,
        },
      ].slice(-50);
      this.hooks.save(task);
    }
  }
  async execute(
    task: Task,
    stage: Stage,
    signal: AbortSignal,
    handlers: Record<Stage, () => Promise<void>>,
    options: { forceTests: boolean },
  ) {
    await this.recorded(task, stage, signal, handlers[stage]);
    if (stage === "analysis" || stage === "startup") return;
    if (stage === "development") {
      if (task.kind === "bug" && !options.forceTests) {
        task.stage = "startup";
        task.status = "waiting-review";
      } else if (!task.autoTest && !options.forceTests)
        task.status = "waiting-test";
      else {
        stage = "test";
        await this.recorded(task, stage, signal, handlers.test);
        task.stage = "startup";
        task.status = "waiting-review";
      }
    } else {
      task.stage = "startup";
      task.status = "waiting-review";
    }
    this.hooks.log(
      task,
      task.stage ?? stage,
      task.status === "waiting-test"
        ? "开发完成，等待启动测试。"
        : "必要检查完成，可按需启动项目或自行验证。",
    );
    this.hooks.save(task);
  }
}
