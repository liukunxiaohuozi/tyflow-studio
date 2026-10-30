import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  LogEntry,
  ResultReference,
  Stage,
  Task,
} from "../shared/contracts";
import { atomicJson } from "./store";
import { AssetManager } from "./imports";

export class EvidenceStore {
  readonly assets: AssetManager;
  constructor(
    private directory: string,
    private sanitize: (value: unknown) => unknown,
  ) {
    this.assets = new AssetManager(path.join(directory, "assets"));
  }
  runDirectory(taskId: string) {
    if (!/^[\da-f-]{36}$/i.test(taskId)) throw new Error("任务 ID 无效");
    const directory = path.join(this.directory, "runs", taskId, randomUUID());
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }
  saveResult(task: Task, value: unknown): ResultReference {
    const root = path.join(this.directory, "evidence", task.id);
    fs.mkdirSync(root, { recursive: true });
    const file = path.join(root, `${randomUUID()}.json`);
    atomicJson(file, this.sanitize(value ?? null));
    return {
      path: file,
      sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    };
  }
  saveSourceSnapshot(task: Task, source: string): ResultReference {
    const root = path.join(this.directory, "evidence", task.id);
    fs.mkdirSync(root, { recursive: true });
    const file = path.join(root, `${randomUUID()}.source`);
    fs.writeFileSync(file, source, { encoding: "utf8", mode: 0o600 });
    return {
      path: file,
      sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    };
  }
  readSourceSnapshot(task: Task, reference: ResultReference): string {
    const body = this.readEvidenceFile(task, reference, 500_000);
    return body.toString("utf8");
  }
  readResult<T>(task: Task, reference: ResultReference): T {
    const body = this.readEvidenceFile(task, reference, 2_000_000);
    return JSON.parse(body.toString("utf8")) as T;
  }
  private readEvidenceFile(
    task: Task,
    reference: ResultReference,
    maxBytes: number,
  ) {
    const root = path.join(this.directory, "evidence", task.id);
    const relative = path.relative(root, reference.path);
    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      !relative ||
      !fs.existsSync(reference.path) ||
      fs.lstatSync(reference.path).isSymbolicLink()
    )
      throw new Error("检查点证据缺失或路径无效");
    const physical = fs.realpathSync.native(reference.path),
      physicalRoot = fs.realpathSync.native(root);
    const physicalRelative = path.relative(physicalRoot, physical);
    if (physicalRelative.startsWith("..") || path.isAbsolute(physicalRelative))
      throw new Error("检查点证据越界");
    const body = fs.readFileSync(reference.path);
    if (
      body.length > maxBytes ||
      createHash("sha256").update(body).digest("hex") !== reference.sha256
    )
      throw new Error("检查点证据指纹不一致");
    return body;
  }
  appendLog(
    task: Task,
    stage: Stage,
    message: string,
    level: LogEntry["level"],
  ): LogEntry {
    const entry = {
      time: new Date().toISOString(),
      stage,
      message: this.sanitize(message) as string,
      level,
    };
    const directory = path.join(this.directory, "evidence", task.id);
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, "logs.jsonl");
    // Rotate rather than retaining unbounded process output in memory/state.json.
    if (fs.existsSync(file) && fs.statSync(file).size > 8_000_000)
      fs.renameSync(file, path.join(directory, `logs.${randomUUID()}.jsonl`));
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", { mode: 0o600 });
    return entry;
  }
}
