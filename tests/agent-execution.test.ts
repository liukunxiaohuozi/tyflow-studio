import {
  codexExecutionArgs,
  standaloneCodexEnvironment,
  isReadExecutionBlocked,
} from "../src/main/agent-execution";

test.each(["win32", "darwin", "linux"] as const)(
  "%s assessment stays read-only without bypassing command rules",
  (platform) => {
    const args = codexExecutionArgs("analysis", platform);
    expect(args).toEqual(
      expect.arrayContaining([
        "--ignore-user-config",
        "--sandbox",
        "read-only",
        'approval_policy="never"',
      ]),
    );
    expect(args.includes('windows.sandbox="elevated"')).toBe(
      platform === "win32",
    );
    expect(args).not.toContain("--ignore-rules");
    expect(args).not.toContain("--approve-for-me");
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  },
);

test("development retains automatic approval review, never inherits assessment's never policy", () => {
  const args = codexExecutionArgs("development", "win32");
  expect(args).toContain("--approve-for-me");
  expect(args).not.toContain('approval_policy="never"');
  expect(args).not.toContain("read-only");
});

test("standalone child drops desktop package identity without mutating its parent", () => {
  const original = process.env.CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY;
  expect(standaloneCodexEnvironment()).toEqual({
    CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY: undefined,
  });
  expect(process.env.CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY).toBe(original);
});

test.each([
  "rejected: blocked by policy",
  "sandbox provisioning failed: helper_sandbox_lock_failed",
  "windows sandbox failed",
])("recognizes execution rejection: %s", (message) => {
  expect(isReadExecutionBlocked(message)).toBe(true);
});

test.each([
  "workspace routing discovery failed",
  "Not logged in",
  "Array must contain at least 1 element",
  "file not found",
])("does not misclassify other failures: %s", (message) => {
  expect(isReadExecutionBlocked(message)).toBe(false);
});
