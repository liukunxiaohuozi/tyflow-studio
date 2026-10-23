import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Settings, Stage } from "../../shared/contracts";
import { resolveCodex } from "../codex";
import { ProcessExecutionError, runCommand } from "../process";
import { EvidenceStore } from "../evidence";
import { ProviderFailure } from "../workflow/failures";
import { agentNetworkMessage, isAgentNetworkFailure } from "../agent-network";
import { redact } from "../policy";
import {
  codexExecutionArgs,
  standaloneCodexEnvironment,
  isReadExecutionBlocked,
  readExecutionBlockedMessage,
} from "../agent-execution";

export interface AgentRequest {
  tools?: { args: string[]; env: NodeJS.ProcessEnv; secrets: string[] };
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
    private environment: () => Promise<NodeJS.ProcessEnv> = async () => ({}),
  ) {}
  clear(taskId: string) {
    this.cache.delete(taskId);
  }
  private async compatibleAgent(request: AgentRequest, env: NodeJS.ProcessEnv) {
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
          env,
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
    const secrets = request.tools?.secrets ?? [];
    const log = request.log;
    request = {
      ...request,
      log: (message, error) => log(redact(message, secrets), error),
    };
    // Follow Codex's lifecycle, including reasoning and reconnects. Neither
    // legacy idle nor total settings may kill a still-running Agent.
    const idle = 0;
    request.activity(new Date().toISOString(), idle);
    const directory = this.evidence.runDirectory(request.taskId);
    const schema = path.join(directory, "schema.json"),
      output = path.join(directory, "result.json");
    fs.writeFileSync(schema, JSON.stringify(request.schema), { mode: 0o600 });
    request.log(
      `Codex · ${request.stage === "analysis" ? "只读评估" : "工作区执行"} · ${request.projectName}`,
    );
    let eventFailure = "";
    let failedTurn = false;
    let readBlocked = false;
    try {
      const networkEnvironment = await this.environment();
      const env = {
        ...networkEnvironment,
        ...standaloneCodexEnvironment(),
        CODEX_HOME:
          process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex"),
        ...request.tools?.env,
      };
      if (Object.keys(networkEnvironment).some((key) => /proxy/i.test(key)))
        request.log(
          "已为 Codex 子进程应用系统代理；未修改系统配置或其他项目连接。",
        );
      const agent = await this.compatibleAgent(request, env);
      request.log(
        `${agent.version} · ${agent.command.executable} ${agent.command.args.join(" ")}${agent.fallback ? " · 已跳过旧版 CLI，使用检测到的最新兼容版本" : ""}`,
      );
      await runCommand(
        agent.command,
        [
          ...codexExecutionArgs(request.stage),
          ...(request.tools?.args ?? []),
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
          env,
          timeout: null,
          idleTimeout: idle,
          idleWarningAfter: 60_000,
          onActivity: (at) => request.activity(at, idle),
          onIdle: (elapsed) =>
            request.log(
              `Agent 已 ${Math.floor(elapsed / 1000)} 秒无输出，暂未收到新输出，继续等待；不会仅因无输出停止。Studio 跟随 Codex 执行与重连，不设置总执行时限；可手动暂停或终止。`,
            ),
          onLine: (line, error) => {
            try {
              const event = JSON.parse(line);
              if (event.type === "item.completed" && event.item) {
                const item = event.item;
                if (
                  request.stage === "analysis" &&
                  item.type === "command_execution" &&
                  item.status === "failed" &&
                  isReadExecutionBlocked(item.aggregated_output ?? "")
                )
                  readBlocked = true;
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
                if (event.type === "turn.failed") failedTurn = true;
                request.log(eventFailure, true);
              } else if (event.type === "turn.completed" && !failedTurn) {
                // A retry diagnostic is not a final failure when Codex later
                // completes. Never clear an explicit failed turn, however.
                eventFailure = "";
              }
            } catch {
              if (
                request.stage === "analysis" &&
                error &&
                /exec_command failed|sandbox provisioning failed/i.test(line) &&
                isReadExecutionBlocked(line)
              )
                readBlocked = true;
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
          isAgentNetworkFailure(eventFailure)
            ? "NETWORK_LOST"
            : "AGENT_EVENT_FAILED",
          isAgentNetworkFailure(eventFailure)
            ? agentNetworkMessage
            : eventFailure,
        );
      if (readBlocked)
        throw new ProviderFailure(
          "environment",
          "AGENT_READ_BLOCKED",
          readExecutionBlockedMessage,
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
      const clean = JSON.parse(
        redact(JSON.stringify(this.sanitize(parsed)), secrets),
      );
      fs.writeFileSync(output, JSON.stringify(clean, null, 2), { mode: 0o600 });
      return clean;
    } catch (error) {
      if (error instanceof Error)
        error.message = redact(error.message, secrets);
      if (fs.existsSync(output)) fs.unlinkSync(output);
      if (error instanceof ProcessExecutionError) {
        if (
          request.stage === "analysis" &&
          error.reason === "ABNORMAL_EXIT" &&
          (readBlocked || isReadExecutionBlocked(error.message))
        )
          throw new ProviderFailure(
            "environment",
            "AGENT_READ_BLOCKED",
            readExecutionBlockedMessage,
          );
        const network =
          ["ABNORMAL_EXIT", "NETWORK_LOST"].includes(error.reason) &&
          isAgentNetworkFailure(error.message + eventFailure);
        throw new ProviderFailure(
          error.reason === "CANCELLED"
            ? "interrupted"
            : error.reason === "START_FAILED"
              ? "environment"
              : "agent",
          network ? "NETWORK_LOST" : error.reason,
          network
            ? agentNetworkMessage
            : `${error.message}${eventFailure ? `\n${eventFailure}` : ""}`,
        );
      }
      throw error;
    }
  }
}
