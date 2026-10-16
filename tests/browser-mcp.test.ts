import { BrowserMcpServer } from "../src/main/browser-mcp";

test("MCP is loopback-only, authenticated, revocable and rejects browser-origin requests", async () => {
  let enabled = true;
  const invoke = jest.fn(async () => ({ observed: "fixture" }));
  const server = new BrowserMcpServer(
    [
      {
        name: "browser_snapshot",
        description: "fixture",
        inputSchema: { type: "object" },
      },
    ],
    (t) => enabled && t === "fixture-token",
    invoke,
  );
  const endpoint = await server.start();
  const call = (token: string, method = "tools/list", headers = {}) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params: {
          name: "browser_snapshot",
          arguments: {},
          protocolVersion: "2025-03-26",
        },
      }),
    });
  try {
    expect(new URL(endpoint).hostname).toBe("127.0.0.1");
    expect((await call("wrong")).status).toBe(403);
    expect(
      (
        await call("fixture-token", "tools/list", {
          Origin: "http://untrusted.invalid",
        })
      ).status,
    ).toBe(403);
    expect(
      await (await call("fixture-token", "initialize")).json(),
    ).toMatchObject({
      result: { protocolVersion: "2025-03-26", capabilities: { tools: {} } },
    });
    expect(
      await (await call("fixture-token", "tools/call")).json(),
    ).toMatchObject({
      result: { content: [{ type: "text", text: '{"observed":"fixture"}' }] },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    enabled = false;
    expect((await call("fixture-token")).status).toBe(403);
  } finally {
    server.close();
  }
});
