import { z } from "zod";
import { redact } from "./policy";

const secretKey =
  /password|passwd|secret|token|authorization|cookie|session|credential|ticket|^code$|api[-_]?key/i;
export function browserUrl(value: string) {
  const u = new URL(value);
  if (
    !/^https?:$/.test(u.protocol) ||
    u.username ||
    u.password ||
    value.length > 2048
  )
    throw new Error("测试地址必须是无账号密码的 HTTP(S) 地址");
  if ([...u.searchParams.keys()].some((k) => secretKey.test(k)))
    throw new Error("测试地址不能包含登录凭据；请在专用测试浏览器中手动登录");
  return u;
}
export function safeBrowserUrl(value: string) {
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol)) return "";
    u.username = "";
    u.password = "";
    for (const key of [...u.searchParams.keys()])
      if (secretKey.test(key)) u.searchParams.set(key, "[redacted]");
    if (/token|secret|password|code=/i.test(u.hash)) u.hash = "";
    return redact(u.href);
  } catch {
    return "";
  }
}
export const browserInputSchema = z
  .object({
    browser: z.enum(["chrome", "firefox"]).optional(),
    url: z.string().max(2048).optional(),
    nonProduction: z.boolean().optional(),
    sourceConfirmed: z.boolean().optional(),
    allowWrites: z.boolean().optional(),
    scope: z.string().max(1200).optional(),
    allowedOrigins: z.array(z.string().max(300)).max(8).optional(),
  })
  .strict();

export function testOrigins(target: string, additional: string[] = []) {
  return [
    ...new Set([
      new URL(browserUrl(target)).origin,
      ...additional.map((value) => {
        const u = browserUrl(value);
        if (u.pathname !== "/" || u.search || u.hash)
          throw new Error("额外测试域名只填写协议、主机和端口，不包含路径");
        return u.origin;
      }),
    ]),
  ];
}
export function allowedBrowserRequest(
  url: string,
  method: string,
  origins: string[],
  writes: boolean,
) {
  try {
    const u = browserUrl(url);
    return (
      origins.includes(u.origin) &&
      !/^(DELETE|CONNECT|TRACE)$/i.test(method) &&
      !/(?:^|\/)(?:delete|remove|publish|deploy)(?:\/|$)/i.test(u.pathname) &&
      (/^(GET|HEAD|OPTIONS)$/i.test(method) || writes)
    );
  } catch {
    return false;
  }
}
export function safeAssertionKeys(keys: string[]) {
  if (keys.some((key) => secretKey.test(key)))
    throw new Error("不能读取或断言密码、Cookie、Token 等凭据字段");
}
