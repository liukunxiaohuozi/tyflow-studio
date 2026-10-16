import http from "node:http";
import type { AddressInfo } from "node:net";

export interface BrowserToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
// Stateless Streamable HTTP. Credentials live only in a short-lived child env.
export class BrowserMcpServer {
  private server?: http.Server;
  private endpoint?: string;
  private starting?: Promise<string>;
  constructor(
    private tools: BrowserToolDefinition[],
    private authorized: (token: string) => boolean,
    private invoke: (
      token: string,
      name: string,
      args: unknown,
    ) => Promise<unknown>,
  ) {}
  async start() {
    if (this.endpoint) return this.endpoint;
    if (this.starting) return this.starting;
    this.starting = this.listen();
    try {
      return await this.starting;
    } finally {
      this.starting = undefined;
    }
  }
  private async listen() {
    this.server = http.createServer(async (request, response) => {
      const token =
        request.headers.authorization?.replace(/^Bearer /, "") ?? "";
      const respond = (status: number, value?: unknown) => {
        if (response.destroyed) return;
        response.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        response.end(value === undefined ? undefined : JSON.stringify(value));
      };
      if (
        request.url !== "/mcp" ||
        request.headers.origin ||
        !this.authorized(token)
      ) {
        respond(403, {
          error: "Browser test authorization is missing or expired",
        });
        return;
      }
      if (request.method !== "POST") {
        respond(405);
        return;
      }
      let raw = "";
      try {
        for await (const chunk of request) {
          raw += chunk.toString();
          if (Buffer.byteLength(raw) > 65536) {
            respond(413);
            return;
          }
        }
        const message: unknown = JSON.parse(raw);
        if (!message || typeof message !== "object" || Array.isArray(message))
          throw new Error("Invalid JSON-RPC request");
        const rpc = message as {
          id?: string | number;
          method?: string;
          params?: {
            protocolVersion?: string;
            name?: string;
            arguments?: unknown;
          };
        };
        if (rpc.id === undefined) {
          respond(202);
          return;
        }
        let result: unknown;
        if (rpc.method === "initialize")
          result = {
            protocolVersion: [
              "2024-11-05",
              "2025-03-26",
              "2025-06-18",
              "2025-11-25",
            ].includes(rpc.params?.protocolVersion ?? "")
              ? rpc.params!.protocolVersion
              : "2024-11-05",
            serverInfo: { name: "tingyun-studio-browser", version: "1.0.0" },
            capabilities: { tools: {} },
          };
        else if (rpc.method === "ping") result = {};
        else if (rpc.method === "tools/list") result = { tools: this.tools };
        else if (rpc.method === "tools/call") {
          try {
            if (!this.tools.some((tool) => tool.name === rpc.params?.name))
              throw new Error("Unknown browser tool");
            const value = await this.invoke(
              token,
              rpc.params!.name!,
              rpc.params?.arguments ?? {},
            );
            result = {
              content: [{ type: "text", text: JSON.stringify(value) }],
            };
          } catch (error) {
            result = {
              isError: true,
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "Browser action failed",
                },
              ],
            };
          }
        } else {
          respond(200, {
            jsonrpc: "2.0",
            id: rpc.id,
            error: { code: -32601, message: "Method not found" },
          });
          return;
        }
        respond(200, { jsonrpc: "2.0", id: rpc.id, result });
      } catch {
        respond(400, { error: "Invalid browser protocol request" });
      }
    });
    this.server.requestTimeout = 30000;
    this.server.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", resolve);
    });
    this.endpoint = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/mcp`;
    return this.endpoint;
  }
  close() {
    this.server?.closeAllConnections();
    this.server?.close();
    this.endpoint = undefined;
  }
}
