import { ProviderFailure } from "./workflow/failures";

const proxyKeys = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
];
export const agentNetworkMessage =
  "Codex 服务连接中断或工作区路由发现失败。请检查网络与系统代理后重试当前阶段；任务和已有代码会保留。";
export function isAgentNetworkFailure(message: string) {
  return /ECONNRESET|ENETUNREACH|ETIMEDOUT|EAI_AGAIN|socket hang up|connection (?:reset|closed)|workspace routing discovery (?:failed|timed out)|stream disconnected|error sending request|HTTP request failed|network/i.test(
    message,
  );
}

/** Read system/PAC routing, translating it only for the Codex child process. */
export async function agentEnvironment(
  resolveProxy: (url: string) => Promise<string>,
  inherited: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  // Explicit (including deliberately empty) environment configuration takes precedence.
  if (proxyKeys.some((key) => inherited[key] !== undefined)) return {};
  let timer: NodeJS.Timeout | undefined;
  let route: string;
  try {
    route = await Promise.race([
      resolveProxy("https://chatgpt.com"),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("proxy resolution timeout")),
          5000,
        );
      }),
    ]);
  } catch {
    throw new ProviderFailure(
      "environment",
      "AGENT_PROXY_UNAVAILABLE",
      "无法读取系统代理配置。请检查系统代理或 PAC 是否可用，再重试当前阶段。",
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
  const first = route.split(";")[0].trim();
  if (first === "DIRECT") return {};
  const match = /^(PROXY|HTTPS|SOCKS5)\s+([^\s]+)$/i.exec(first);
  try {
    if (!match || match[2].length > 2048) throw new Error("unsupported proxy");
    const protocol = { PROXY: "http", HTTPS: "https", SOCKS5: "socks5h" }[
      match[1].toUpperCase()
    ];
    const url = new URL(`${protocol}://${match[2]}`);
    if (
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname && url.pathname !== "/")
    )
      throw new Error("invalid proxy");
    const proxy = `${url.protocol}//${url.host}`;
    return {
      HTTP_PROXY: proxy,
      HTTPS_PROXY: proxy,
      ALL_PROXY: proxy,
      ...(inherited.NO_PROXY === undefined && inherited.no_proxy === undefined
        ? { NO_PROXY: "localhost,127.0.0.1,::1" }
        : {}),
    };
  } catch {
    throw new ProviderFailure(
      "environment",
      "AGENT_PROXY_UNSUPPORTED",
      "系统代理格式无法安全传给 Codex。请在启动环境中显式配置可用的 HTTP_PROXY / HTTPS_PROXY 后重试。",
    );
  }
}
