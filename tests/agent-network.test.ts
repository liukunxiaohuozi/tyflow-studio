import {
  agentEnvironment,
  isAgentNetworkFailure,
} from "../src/main/agent-network";

test("system HTTP proxy is scoped to the Codex child, with loopback bypass", async () => {
  const inherited = { PATH: "fixture-path" },
    resolve = jest.fn(async () => "PROXY 127.0.0.1:7897; DIRECT");
  expect(await agentEnvironment(resolve, inherited)).toEqual({
    HTTP_PROXY: "http://127.0.0.1:7897",
    HTTPS_PROXY: "http://127.0.0.1:7897",
    ALL_PROXY: "http://127.0.0.1:7897",
    NO_PROXY: "localhost,127.0.0.1,::1",
  });
  expect(resolve).toHaveBeenCalledWith("https://chatgpt.com");
  expect(inherited).toEqual({ PATH: "fixture-path" });
});
test.each([
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
])("explicit %s wins, even if deliberately empty", async (key) => {
  const resolve = jest.fn(async () => "PROXY ignored:7897");
  expect(
    await agentEnvironment(resolve, { [key]: "http://explicit.invalid:1234" }),
  ).toEqual({});
  expect(await agentEnvironment(resolve, { [key]: "" })).toEqual({});
  expect(resolve).not.toHaveBeenCalled();
});
test.each(["NO_PROXY", "no_proxy"])(
  "preserves explicit %s bypass rules without global mutation",
  async (key) => {
    const result = await agentEnvironment(async () => "PROXY localhost:7897", {
      [key]: "internal.example.invalid",
    });
    expect(result.NO_PROXY).toBeUndefined();
    expect(result.HTTPS_PROXY).toBe("http://localhost:7897");
  },
);
test("DIRECT first route is respected instead of selecting a later proxy", async () => {
  expect(
    await agentEnvironment(async () => "DIRECT; PROXY localhost:7897", {}),
  ).toEqual({});
});
test.each([
  ["HTTPS proxy.example.invalid:443", "https://proxy.example.invalid"],
  ["SOCKS5 [::1]:1080", "socks5h://[::1]:1080"],
])(
  "translates supported route %s without disclosing endpoints in logs",
  async (route, expected) => {
    expect((await agentEnvironment(async () => route, {})).HTTPS_PROXY).toBe(
      expected,
    );
  },
);
test.each([
  "PROXY user:password@host:7897",
  "PROXY host:7897/path",
  "PROXY host:7897?x=1",
  "garbage",
  "",
  "SOCKS4 localhost:1080",
])(
  "unsupported/unsafe route is actionable and not silently replaced: %s",
  async (route) => {
    await expect(agentEnvironment(async () => route, {})).rejects.toMatchObject(
      { code: "AGENT_PROXY_UNSUPPORTED" },
    );
  },
);
test("failed PAC lookup is distinct from an absent proxy", async () => {
  await expect(
    agentEnvironment(async () => {
      throw new Error("secret-containing PAC error");
    }, {}),
  ).rejects.toMatchObject({ code: "AGENT_PROXY_UNAVAILABLE" });
});
test("hanging PAC lookup is bounded and does not leave a timer behind", async () => {
  jest.useFakeTimers();
  try {
    const request = agentEnvironment(() => new Promise(() => {}), {});
    const rejected = expect(request).rejects.toMatchObject({
      code: "AGENT_PROXY_UNAVAILABLE",
    });
    await jest.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});
test("route-discovery and stream failures are network errors, not schema or login errors", () => {
  for (const message of [
    "workspace routing discovery failed",
    "workspace routing discovery timed out",
    "stream disconnected",
    "HTTP request failed",
    "error sending request",
    "ECONNRESET",
  ])
    expect(isAgentNetworkFailure(message)).toBe(true);
  for (const message of [
    "invalid_json_schema",
    "workspace routing discovery unauthorized",
    "not logged in",
    "command not found",
  ])
    expect(isAgentNetworkFailure(message)).toBe(false);
});
