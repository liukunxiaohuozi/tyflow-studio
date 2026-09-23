import { createHash } from "node:crypto";
import type { ZenTaoCatalog, ZenTaoItem, ZenTaoOption } from "../shared/contracts";

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}
function passwordStrength(password: string) {
  if (!password) return 0;
  let unique = "";
  const complexity = new Map<number, number>();
  for (const character of password) {
    const code = character.charCodeAt(0);
    if (code >= 48 && code <= 57) complexity.set(2, 2);
    else if (code >= 65 && code <= 90) complexity.set(1, 2);
    else if (code >= 97 && code <= 122) complexity.set(0, 1);
    else complexity.set(3, 3);
    if (!unique.includes(character)) unique += character;
  }
  let strength = Math.max(0, unique.length - 4);
  strength += [...complexity.values()].reduce((a, b) => a + b, 0);
  strength += 2 * (complexity.size - 1);
  if (password.length < 6 && strength >= 10) strength = 9;
  return Math.floor(Math.min(strength, 29) / 10);
}
function text(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function anchors(source: string) {
  return [...source.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)].map(
    (match) => {
      const attrs = match[1] + match[3];
      const title = attrs.match(/\btitle=["']([^"']*)["']/i)?.[1] || "";
      return { href: match[2], name: text(title || match[4]) };
    },
  );
}
function options(source: string, pattern: RegExp): ZenTaoOption[] {
  const found = new Map<string, string>();
  const generic = new Set(["查看全部", "全部", "view all", "all"]);
  for (const anchor of anchors(source)) {
    const match = anchor.href.match(pattern);
    if (
      match &&
      anchor.name &&
      !/^\d+$/.test(anchor.name) &&
      !generic.has(anchor.name.toLowerCase())
    )
      found.set(match[1], anchor.name);
  }
  return [...found].map(([id, name]) => ({ id, name }));
}
function items(source: string, type: "task" | "bug"): ZenTaoItem[] {
  return options(source, new RegExp(`/${type}-view-(\\d+)\\.html`, "i")).map((item) => ({
    ...item,
    type,
  }));
}
function isLoginPage(source: string) {
  const lower = source.toLowerCase();
  return (
    lower.includes("name='verifyrand'") ||
    lower.includes('name="verifyrand"') ||
    /self\.location\s*=\s*["'][^"']*user-login-/i.test(source)
  );
}
function modelPairs(source: string): ZenTaoOption[] {
  try {
    const outer = JSON.parse(source) as { status?: string; data?: string | Record<string, string> };
    if (outer.status !== "success" || !outer.data) return [];
    const data = typeof outer.data === "string" ? JSON.parse(outer.data) : outer.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    return Object.entries(data).map(([id, name]) => ({ id, name: String(name) }));
  } catch {
    return [];
  }
}

export function normalizeZenTaoBaseUrl(value: string) {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname
    .replace(/\/my(?:\/|\.html)?$/i, "/")
    .replace(/\/?$/, "/");
  return url.href;
}

export async function loadZenTaoCatalog(
  baseUrl: string,
  username: string,
  password: string,
): Promise<ZenTaoCatalog> {
  if (!username || !password) throw new Error("请填写并保存禅道账号和密码");
  const base = normalizeZenTaoBaseUrl(baseUrl);
  const cookies = new Map<string, string>();
  async function request(endpoint: string, init: RequestInit = {}) {
    const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(new URL(endpoint, base), {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { ...init.headers, ...(cookie ? { Cookie: cookie } : {}) },
    });
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies =
      headers.getSetCookie?.() ||
      (headers.get("set-cookie")?.split(/,(?=\s*[^;,=\s]+=[^;,]*)/) ?? []);
    for (const setCookie of setCookies) {
      const pair = setCookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0)
        cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
    if (response.status >= 400) throw new Error(`禅道返回 HTTP ${response.status}`);
    return response.text();
  }
  async function optionalRequest(endpoint: string) {
    try {
      return await request(endpoint);
    } catch {
      return "";
    }
  }
  const loginPage = await request("user-login.html");
  const verifyRand = loginPage.match(/name=["']verifyRand["'][^>]*value=["']([^"']+)/i)?.[1];
  if (!verifyRand) throw new Error("禅道登录页未提供校验参数，请检查地址或禅道版本");
  const body = new URLSearchParams({
    account: username,
    password: md5(md5(password) + verifyRand),
    passwordStrength: String(passwordStrength(password)),
    referer: new URL("my.html", base).pathname,
    verifyRand,
    keepLogin: "0",
  });
  const loginResult = await request("user-login.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  let result: { status?: string };
  try {
    result = JSON.parse(loginResult) as { status?: string };
  } catch {
    throw new Error("禅道登录接口返回格式不兼容");
  }
  if (result.status !== "success") throw new Error("禅道登录失败，请检查账号和密码");
  const [home, taskPage, bugPage, productPage, projectPage] = await Promise.all([
    request("my.html?onlybody=yes"),
    request("my-task-assignedTo-id_asc-0-100-1.html?onlybody=yes"),
    request("my-bug-assignedTo-id_asc-0-100-1.html?onlybody=yes"),
    optionalRequest("product-all.html?onlybody=yes"),
    optionalRequest("project-all.html?onlybody=yes"),
  ]);
  if (/my-changepassword/i.test(home)) throw new Error("禅道要求先修改密码，请在禅道中完成后重试");
  if ([home, taskPage, bugPage].some(isLoginPage))
    throw new Error("禅道登录状态未建立，请检查账号、密码或登录策略");
  const combined = home + taskPage + bugPage + productPage + projectPage;
  let products = modelPairs(await optionalRequest("api-getmodel-product-getPairs.json"));
  let projects = modelPairs(await optionalRequest("api-getmodel-project-getPairs.json"));
  if (!products.length)
    products = options(
      combined,
      /(?:^|\/)product-(?:index|browse|view|all)-(\d+)/i,
    );
  if (!projects.length)
    projects = options(
      combined,
      /(?:^|\/)project-(?:index|task|view|browse|all)-(\d+)/i,
    );
  return {
    products,
    projects,
    items: [...items(taskPage, "task"), ...items(bugPage, "bug")],
  };
}
