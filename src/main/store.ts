import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { Settings, Task, TaskInput } from "../shared/contracts";
import { validateTaskInput } from "./validation";
import { defaultAgentPaths } from "./bundle";

export function initialSettings(resourcesPath?: string): Settings {
  const home = os.homedir();
  const agentPaths = defaultAgentPaths(home, resourcesPath);
  return {
    developer: { name: "", email: "", defaultProject: "explore" },
    projects: ["explore", "o11y-apm-ui"].map((id) => ({
      id,
      name: id,
      directory: path.join(home, "Desktop", "project", id),
      repository: "",
      auth: "system",
      username: "",
      startScript: "start:dev",
      targetUrl: "http://localhost:8000",
      defaultBranchMode: "new",
    })),
    agent: {
      command: "codex",
      tyflowDirectory: agentPaths.tyflowDirectory,
      testSkill: agentPaths.testSkill,
    },
    zentao: { enabled: false, url: "", username: "", mappings: {} },
    notifications: {
      enabled: true,
      desktop: true,
      milestones: {
        planReady: true,
        developmentComplete: true,
        acceptanceReady: true,
        failed: true,
      },
    },
    theme: "#1677FF",
    language: "zh-CN",
  };
}
export function atomicJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
interface State {
  schemaVersion: 1;
  settings: Settings;
  tasks: Task[];
}
export class Store {
  private state: State;
  private file: string;
  constructor(
    public directory: string,
    options: { resourcesPath?: string } = {},
  ) {
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, "state.json");
    if (fs.existsSync(this.file)) {
      this.state = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (
        this.state.schemaVersion !== 1 ||
        !Array.isArray(this.state.tasks) ||
        !this.state.settings
      )
        throw new Error("Unsupported or corrupt state file: " + this.file);
      this.state.settings.notifications ??=
        initialSettings(options.resourcesPath).notifications;
      this.state.settings.zentao.mappings ??= {};
    } else
      this.state = {
        schemaVersion: 1,
        settings: initialSettings(options.resourcesPath),
        tasks: [],
      };
    let changed = false;
    for (const task of this.state.tasks)
      if (
        ["analyzing", "developing", "testing", "starting"].includes(task.status)
      ) {
        task.status = "stopped";
        task.error = "客户端关闭导致任务中断，请查看日志后重试。";
        changed = true;
      }
    if (changed) this.flush();
  }
  private flush() {
    atomicJson(this.file, this.state);
  }
  settings(): Settings {
    return structuredClone(this.state.settings);
  }
  saveSettings(settings: Settings) {
    this.state.settings = structuredClone(settings);
    this.flush();
  }
  tasks(): Task[] {
    return structuredClone(this.state.tasks).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  getTask(id: string): Task {
    const t = this.state.tasks.find((t) => t.id === id);
    if (!t) throw new Error("任务不存在");
    return structuredClone(t);
  }
  putTask(task: Task) {
    task.updatedAt = new Date().toISOString();
    task.logs = task.logs.slice(-2000);
    const i = this.state.tasks.findIndex((t) => t.id === task.id);
    if (i < 0) this.state.tasks.push(structuredClone(task));
    else this.state.tasks[i] = structuredClone(task);
    this.flush();
    return structuredClone(task);
  }
  saveTask(raw: TaskInput, id?: string): Task {
    const input = validateTaskInput(raw);
    if (id) {
      const previous = this.getTask(id);
      if (
        previous.snapshot ||
        ["analyzing", "developing", "testing", "starting", "accepted"].includes(
          previous.status,
        )
      )
        throw new Error("执行快照已冻结，请新建后续任务");
      const sourceChanged =
        ["title", "description", "projectId", "assetIds", "kind"].some(
          (k) =>
            JSON.stringify(input[k as keyof TaskInput]) !==
            JSON.stringify(previous[k as keyof TaskInput]),
        ) ||
        ["mode", "base", "version"].some(
          (k) =>
            input.branch[k as keyof typeof input.branch] !==
            previous.branch[k as keyof typeof input.branch],
        );
      const next = {
        ...previous,
        ...input,
        planRevision: previous.planRevision + 1,
        error: undefined,
      };
      if (sourceChanged) {
        next.plan = undefined;
        next.planFeedback = undefined;
        next.status = "draft";
        next.baseCommit = undefined;
        next.targetCommit = undefined;
      }
      return this.putTask(next);
    }
    const now = new Date().toISOString();
    return this.putTask({
      ...input,
      id: randomUUID(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      planRevision: 0,
      logs: [],
      checks: [],
      assets: [],
    });
  }
}
