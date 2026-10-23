import {
  browserUrl,
  safeBrowserUrl,
  testOrigins,
  allowedBrowserRequest,
  safeAssertionKeys,
} from "../src/main/browser-policy";
import {
  requiredTestBrowsers,
  validationPending,
} from "../src/shared/browser-test";

test.each([
  "file:///C:/secret",
  "http://user:password@localhost:8000",
  "http://localhost/?token=private",
])("rejects unsafe test address %s", (url) =>
  expect(() => browserUrl(url)).toThrow(),
);
test("limits automation to confirmed origins, write permission and non-destructive operations", () => {
  const origins = testOrigins("http://localhost:8000/rum/", [
    "https://test.example.invalid",
  ]);
  expect(
    allowedBrowserRequest("http://localhost:8000/save", "POST", origins, false),
  ).toBe(false);
  expect(
    allowedBrowserRequest("http://localhost:8000/save", "POST", origins, true),
  ).toBe(true);
  expect(
    allowedBrowserRequest(
      "https://production.invalid/save",
      "POST",
      origins,
      true,
    ),
  ).toBe(false);
  expect(
    allowedBrowserRequest(
      "http://localhost:8000/delete/app",
      "POST",
      origins,
      true,
    ),
  ).toBe(false);
  expect(
    allowedBrowserRequest("http://localhost:8000/app", "DELETE", origins, true),
  ).toBe(false);
  expect(() =>
    testOrigins("http://localhost", ["https://example.invalid/path"]),
  ).toThrow();
});
test("credentials never appear in public URLs or assertion fields", () => {
  expect(
    safeBrowserUrl("http://u:private@localhost/login?token=private&appId=5"),
  ).not.toContain("private");
  expect(() => safeAssertionKeys(["Authorization"])).toThrow();
  expect(() => safeAssertionKeys(["productType"])).not.toThrow();
});
test("preparation requirements preserve the approved browser matrix", () => {
  expect(requiredTestBrowsers()).toEqual([]);
  expect(
    requiredTestBrowsers({
      summary: "",
      steps: [],
      risks: [],
      blockers: [],
      testCases: [
        {
          id: "T7",
          title: "国际化",
          steps: ["在 Chrome 和 Firefox 验证页面"],
          expected: "正常",
        },
      ],
    }),
  ).toEqual(["chrome", "firefox"]);
  expect(validationPending("TEST_BROWSER_PREPARATION")).toBe(true);
  expect(validationPending("CASE_FAILED")).toBe(false);
});

test("static checks and excluded browser names do not request a login session", () => {
  const plan = (
    title: string,
    steps: string[],
    browsers?: ("chrome" | "firefox")[],
  ) => ({
    summary: "",
    steps: [],
    risks: [],
    blockers: [],
    testCases: [
      {
        id: "T1",
        title,
        steps,
        expected: "符合需求",
        ...(browsers === undefined ? {} : { browsers }),
      },
    ],
  });
  expect(
    requiredTestBrowsers(
      plan("静态源码检查保存文案", ["只读取文件，不启动浏览器"]),
    ),
  ).toEqual([]);
  expect(
    requiredTestBrowsers(
      plan("静态检查", ["不需要 Chrome 或 Firefox，不做浏览器测试"]),
    ),
  ).toEqual([]);
  expect(
    requiredTestBrowsers(plan("保存文案检查", ["读取页面文件"], [])),
  ).toEqual([]);
  expect(
    requiredTestBrowsers(plan("Firefox 兼容", ["验证保存成功"], ["firefox"])),
  ).toEqual(["firefox"]);
  expect(
    requiredTestBrowsers(
      plan("兼容测试", ["无需 Firefox，在 Chrome 点击保存并检查页面"]),
    ),
  ).toEqual(["chrome"]);
  expect(
    requiredTestBrowsers(plan("保存设置", ["保存设置并验证成功"])),
  ).toEqual(["chrome"]);
  expect(
    requiredTestBrowsers(
      plan("静态检查及兼容验证", ["Chrome 和 Firefox 可读性验证"]),
    ),
  ).toEqual(["chrome", "firefox"]);
  expect(
    requiredTestBrowsers(plan("静态检查及浏览器兼容验证", ["验证浏览器渲染"])),
  ).toEqual(["chrome"]);
});
