import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Settings, Stage } from "../../shared/contracts";
import { resolveCodex } from "../codex";
import { ProcessExecutionError, runCommand } from "../process";
import { EvidenceStore } from "../evidence";
import { ProviderFailure } from "../workflow/failures";

export interface AgentRequest {
  taskId: string;
  directory: string;
  projectName: string;
  stage: Stage;
  prompt: string;
  schema: unknown;
  signal: AbortSignal;
  log: (message: string, error?: boolean) => void;
  activity: (at: string, idleTimeoutMs: number) => void;
}
export interface AgentProvider {
  invoke(request: AgentRequest): Promise<unknown>;
  clear(taskId: string): void;
}
export class CodexAgentProvider implements AgentProvider {
  private cache = new Map<string, Awaited<ReturnType<typeof resolveCodex>>>();
  constructor(
    private settings: () => Settings,
    private evidence: EvidenceStore,
    private sanitize: (value: unknown) => unknown,
  ) {}
  clear(taskId: string) {
    this.cache.delete(taskId);
  }
  private async compatibleAgent(request: AgentRequest) {
    const cached = this.cache.get(request.taskId);
    if (cached) return cached;
    try {
      const agent = await resolveCodex(this.settings().agent.command, {
        cwd: request.directory,
        signal: request.signal,
      });
      try {
        await runCommand(agent.command, ["login", "status"], {
          cwd: request.directory,
          signal: request.signal,
          env: {
            CODEX_HOME:
              process.env.CODEX_HOME?.trim() ||
              path.join(os.homedir(), ".codex"),
          },
          timeout: 15_000,
        });
      } catch (error) {
        if (request.signal.aborted) throw error;
        throw new ProviderFailure(
          "environment",
          "AGENT_LOGIN",
          `Codex 登录检查未通过，请在终端执行 codex login 后重试。${(error as Error).message}`,
        );
      }
      this.cache.set(request.taskId, agent);
      return agent;
    } catch (error) {
      if (error instanceof ProviderFailure || request.signal.aborted)
        throw error;
      throw new ProviderFailure(
        "environment",
        "AGENT_UNAVAILABLE",
        (error as Error).message,
      );
    }
  }
  async invoke(request: AgentRequest) {
    const settings = this.settings();
    const idle = settings.execution?.agentIdleTimeoutMs ?? 180_000;
    const directory = this.evidence.runDirectory(request.taskId);
    const schema = path.join(directory, "schema.json"),
      output = path.join(directory, "result.json");
    fs.writeFileSync(schema, JSON.stringify(request.schema), { mode: 0o600 });
    request.log(
      `Codex · ${request.stage === "analysis" ? "只读评估" : "工作区执行"} · ${request.projectName}`,
    );
    let eventFailure = "";
    try {
      const agent = await this.compatibleAgent(request);
      request.log(
        `${agent.version} · ${agent.command.executable} ${agent.command.args.join(" ")}${agent.fallback ? " · 已跳过旧版 CLI，使用检测到的最新兼容版本" : ""}`,
      );
      await runCommand(
        agent.command,
        [
          "exec",
          "--ignore-user-config",
          ...(request.stage === "analysis"
            ? ["--sandbox", "read-only"]
            : ["--approve-for-me"]),
          "--json",
          "--ephemeral",
          "--cd",
          request.directory,
          "--output-schema",
          schema,
          "--output-last-message",
          output,
          "-",
        ],
        {
          cwd: request.directory,
          signal: request.signal,
          input: request.prompt,
          env: {
            CODEX_HOME:
              process.env.CODEX_HOME?.trim() ||
              path.join(os.homedir(), ".codex"),
          },
          timeout: settings.execution?.agentTimeoutMs ?? 30 * 60_000,
          idleTimeout: idle,
          idleWarningAfter: Math.min(60_000, Math.floor(idle / 2)),
          onActivity: (at) => request.activity(at, idle),
          onIdle: (elapsed) =>
            request.log(
              `Agent 已 ${Math.floor(elapsed / 1000)} 秒无输出，正在等待；达到无输出超时后将保留代码并停止，可从当前检查点恢复。`,
            ),
          onLine: (line, error) => {
            try {
              const event = JSON.parse(line);
              if (event.type === "item.completed" && event.item) {
                const item = event.item;
                request.log(
                  typeof item.text === "string"
                    ? item.text
                    : typeof item.aggregated_output === "string"
                      ? `${item.command ?? ""}\n${item.aggregated_output}`
                      : JSON.stringify(item),
                  item.status === "failed",
                );
              } else if (
                event.type === "error" ||
                event.type === "turn.failed"
              ) {
                eventFailure = JSON.stringify(event);
                request.log(eventFailure, true);
              }
            } catch {
              if (line.trim()) request.log(line, error);
            }
          },
        },
      );
      if (request.signal.aborted)
        throw new ProviderFailure("interrupted", "CANCELLED", "任务已停止");
      if (eventFailure)
        throw new ProviderFailure(
          "agent",
          /ECONNRESET|ENETUNREACH|ETIMEDOUT|EAI_AGAIN|socket hang up|connection (reset|closed)|network/i.test(
            eventFailure,
          )
            ? "NETWORK_LOST"
            : "AGENT_EVENT_FAILED",
          eventFailure,
        );
      if (!fs.existsSync(output))
        throw new ProviderFailure(
          "agent",
          "AGENT_OUTPUT_MISSING",
          "Agent 未生成结构化结果，不能继续下一阶段",
        );
      if (fs.statSync(output).size > 2_000_000)
        throw new ProviderFailure(
          "agent",
          "AGENT_OUTPUT_OVERSIZED",
          "Agent 结果过大",
        );
      const body = fs.readFileSync(output, "utf8");
      fs.unlinkSync(output);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new ProviderFailure(
          "agent",
          "AGENT_OUTPUT_INVALID",
          "Agent 返回的结构化结果不是有效 JSON",
        );
      }
      const clean = this.sanitize(parsed);
      fs.writeFileSync(output, JSON.stringify(clean, null, 2), { mode: 0o600 });
      return clean;
    } catch (error) {
      if (fs.existsSync(output)) fs.unlinkSync(output);
      if (error instanceof ProcessExecutionError) {
        const network =
          /ECONNRESET|ENETUNREACH|ETIMEDOUT|EAI_AGAIN|socket hang up|connection (reset|closed)|network/i.test(
            eventFailure,
          );
        throw new ProviderFailure(
          error.reason === "CANCELLED"
            ? "interrupted"
            : error.reason === "START_FAILED"
              ? "environment"
              : "agent",
          network ? "NETWORK_LOST" : error.reason,
          `${error.message}${eventFailure ? `\n${eventFailure}` : ""}`,
        );
      }
      throw error;
    }
  }
}
