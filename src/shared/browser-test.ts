import type { Plan } from "./contracts";

export type TestBrowser = "chrome" | "firefox";
export type BrowserTestAction =
  "status" | "open" | "home" | "confirm" | "close" | "install";
export interface BrowserTestInput {
  browser?: TestBrowser;
  url?: string;
  nonProduction?: boolean;
  sourceConfirmed?: boolean;
  allowWrites?: boolean;
  scope?: string;
  allowedOrigins?: string[];
}
export interface BrowserTestState {
  url: string;
  workspace: string;
  required: TestBrowser[];
  ready: boolean;
  scope?: string;
  browsers: {
    browser: TestBrowser;
    phase: "closed" | "opening" | "login" | "ready" | "error" | "installing";
    url?: string;
    title?: string;
    httpStatus?: number;
    detail?: string;
    version?: string;
  }[];
}
export interface BrowserTestConfig {
  url: string;
  scope: string;
  allowedOrigins: string[];
}
export const validationPending = (code?: string) =>
  code === "TEST_INCOMPLETE" || code === "TEST_BROWSER_PREPARATION";

export function requiredTestBrowsers(plan?: Plan): TestBrowser[] {
  const text = (plan?.testCases ?? [])
    .map((c) => [c.title, ...c.steps, c.expected].join("\n"))
    .join("\n");
  const browsers: TestBrowser[] = [];
  if (
    /浏览器|页面|保存|点击|Chrome|Firefox|browser|\bpage\b|\bclick\b/i.test(
      text,
    )
  )
    browsers.push("chrome");
  if (/Firefox/i.test(text)) browsers.push("firefox");
  return browsers;
}
