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
