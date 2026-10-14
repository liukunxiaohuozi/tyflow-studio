import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Settings, Task } from "../../shared/contracts";
import type { TaskNotification } from "./notification";
import { validateWeComWebhook } from "./wecom-webhook";
import { atomicJson } from "../store";

type Receipt = { state: "sending" | "sent" | "failed"; at: string };
class WeComError extends Error {}
export type WeComTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

function bounded(value: string, bytes: number) {
  let output = "";
  for (const char of value.replace(/[\u0000-\u001f\u007f]/g, " ")) {
    if (Buffer.byteLength(output + char, "utf8") > bytes) break;
    output += char;
  }
  return output;
}

/** Plain text only: no logs, description, evidence, paths, URLs, or mentions. */
export function wecomContent(
  message: TaskNotification,
  task: Task,
  settings: Settings,
  sanitize: (s: string) => string,
) {
  const field = (value: string, bytes = 240) =>
    bounded(sanitize(value).replace(/@/g, "＠"), bytes);
  const project =
    task.snapshot?.project ??
    settings.projects.find((p) => p.id === task.projectId);
  const branch =
    task.workspace?.branch ??
    task.delivery?.branch ??
    (task.branch.mode === "new" ? task.branch.name : task.branch.base);
  return [
    `TingYun Studio · ${field(message.title, 180)}`,
    `任务：${field(task.title, 420)}`,
    `项目：${field(project?.name ?? task.projectId)}`,
    `执行人：${field(settings.developer.name || "未填写", 120)}`,
    `分支：${field(branch)}`,
    `任务编号：${field(task.id, 80)}`,
    "请在执行人的 Studio 中查看详情。",
  ].join("\n");
}

export class WeComNotifier {
  private receipts: Record<string, Receipt> = {};
  private file: string;
  private requests: number[] = [];
  constructor(
    directory: string,
    private credential: () => string,
    private transport: WeComTransport = (url, init) => fetch(url, init),
  ) {
    this.file = path.join(directory, "notification-receipts.json");
    if (fs.existsSync(this.file)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new Error();
        for (const [key, receipt] of Object.entries(data)) {
          const item = receipt as Receipt;
          if (
            !/^[a-f0-9]{64}$/.test(key) ||
            !item ||
            !["sending", "sent", "failed"].includes(item.state) ||
            typeof item.at !== "string"
          )
            throw new Error();
        }
        this.receipts = data;
      } catch {
        // Do not replay potentially delivered messages when the dedupe journal is corrupt.
        throw new Error(
          "通知去重记录损坏，请检查本地 notification-receipts.json；不会自动重发群消息",
        );
      }
    }
  }
  private async post(url: string, content: string) {
    const now = Date.now();
    this.requests = this.requests.filter((at) => now - at < 60_000);
    if (this.requests.length >= 18)
      throw new WeComError("企业微信通知发送过于频繁，请稍后再试");
    this.requests.push(now);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.transport(url, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ msgtype: "text", text: { content } }),
      });
      if (!response.ok)
        throw new WeComError(`企业微信返回 HTTP ${response.status}`);
      const result = (await response.json()) as { errcode?: unknown };
      if (result?.errcode !== 0) {
        const code =
          typeof result?.errcode === "number" ? result.errcode : "响应格式异常";
        throw new WeComError(
          `企业微信未确认通知成功（${code}），请检查群机器人配置`,
        );
      }
    } catch (error) {
      // Fetch and server error strings may contain the secret URL. Never propagate them.
      if (error instanceof WeComError) throw error;
      throw new WeComError(
        "企业微信通知网络异常或超时，送达状态不确定；请先查看测试群，不会自动重发",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async test() {
    const url = validateWeComWebhook(this.credential());
    await this.post(
      url,
      "TingYun Studio 通知连接测试\n这是一条由本地配置页主动发送的测试消息，不包含项目或任务内容。",
    );
  }
  async send(
    message: TaskNotification,
    task: Task,
    settings: Settings,
    sanitize: (s: string) => string,
  ) {
    const url = validateWeComWebhook(this.credential());
    const stages =
      task.status === "ready"
        ? ["analysis"]
        : task.status === "failed"
          ? [task.failure?.stage ?? task.stage]
          : task.status === "review"
            ? ["development", "test"]
            : ["development"];
    // Preview/startup runs must not make an already-completed development event new.
    const runId = task.runs
      ?.filter((run) => stages.includes(run.stage))
      .at(-1)?.id;
    const event = JSON.stringify([
      url,
      task.id,
      task.status,
      task.planRevision,
      runId,
      task.status === "failed" ? task.failure?.at : undefined,
      task.status === "accepted" ? task.delivery?.commit : undefined,
    ]);
    const key = createHash("sha256").update(event).digest("hex");
    if (this.receipts[key]) return; // Including uncertain or failed attempts: no blind resend.
    const content = wecomContent(message, task, settings, sanitize);
    this.receipts[key] = { state: "sending", at: new Date().toISOString() };
    try {
      atomicJson(this.file, this.receipts); // Persist before side effect, fail closed.
      await this.post(url, content);
      this.receipts[key] = { state: "sent", at: new Date().toISOString() };
      atomicJson(this.file, this.receipts);
    } catch (error) {
      this.receipts[key] = { state: "failed", at: new Date().toISOString() };
      try {
        atomicJson(this.file, this.receipts);
      } catch {
        /* Notifications never stop workflow. */
      }
      if (error instanceof WeComError) throw error;
      throw new Error("企业微信通知记录保存失败，送达状态不确定；不会自动重发");
    }
  }
}
