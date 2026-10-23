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
  const required = new Set<TestBrowser>();
  for (const test of plan?.testCases ?? []) {
    if (test.browsers !== undefined) {
      test.browsers.forEach((browser) => required.add(browser));
      continue;
    }
    // Legacy plans did not carry a matrix. Ignore negative clauses, rather than
    // turning "no Firefox" or source-only copy assertions into browser consent.
    const clauses = [test.title, ...test.steps, test.expected]
      .join("\n")
      .split(/[，,。；;\n]/);
    const text = clauses
      .filter(
        (clause) =>
          !/(?:不需要|无需|不启动|不打开|不做|不使用|不要|without|\bno\b|do not).*(?:浏览器|Chrome|Firefox|browser)/i.test(
            clause,
          ),
      )
      .join("\n");
    const sourceOnly =
      /静态|源码|源文件|读取文件|\bsource[- ]?only\b|\bstatic\b|\bunit\b|单元/i.test(
        text,
      );
    const interaction =
      /点击|打开.*(?:页面|浏览器)|在\s*(?:Chrome|Firefox|浏览器)|\bclick\b|\bnavigate\b/i.test(
        text,
      );
    const chrome = /Chrome/i.test(text);
    const firefox = /Firefox/i.test(text);
    // A mixed legacy case may contain both static and explicitly named browser
    // checks. Do not silently drop that approved compatibility requirement.
    if (
      sourceOnly &&
      !interaction &&
      !chrome &&
      !firefox &&
      !/浏览器|\bbrowser\b/i.test(text)
    )
      continue;
    if (
      chrome ||
      (!firefox &&
        /浏览器|页面|保存|点击|browser|\bpage\b|\bclick\b/i.test(text))
    )
      required.add("chrome");
    if (firefox) required.add("firefox");
  }
  return (["chrome", "firefox"] as const).filter((browser) =>
    required.has(browser),
  );
}
