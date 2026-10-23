import {
  deriveExecutionPolicy,
  inferTaskIntent,
} from "../src/shared/task-intent";

test.each([
  "xxx bug，你先给我分析原因，我没让改",
  "先排查一下根因，不要修改代码",
  "我只想知道为什么追踪列表打不开",
  "analyze this first, do not modify files",
])("explicit diagnosis language prevents modification: %s", (description) => {
  expect(inferTaskIntent({ kind: "bug", description }).mode).toBe(
    "diagnose",
  );
});
test.each([
  "点击追踪列表打不开",
  "页面保存时报错",
  "微应用无法跳转",
])("every Bug report defaults to diagnosis before repair: %s", (description) => {
  const intent = inferTaskIntent({ kind: "bug", description });
  expect(intent.mode).toBe("diagnose");
  expect(intent.source).toBe("inferred");
});

test("Bug wording cannot skip the mandatory diagnosis gate", () => {
  expect(
    inferTaskIntent({
      kind: "bug",
      description: "找到原因后直接修复这个跳转问题",
    }).mode,
  ).toBe("diagnose");
});

test("planning and verification requests are not mistaken for implementation", () => {
  expect(
    inferTaskIntent({ kind: "text", description: "先给我出一个方案，先别开发" })
      .mode,
  ).toBe("plan");
  expect(
    inferTaskIntent({ kind: "text", description: "只验证一下当前代码修改" })
      .mode,
  ).toBe("verify");
});

test("execution policy is inferred instead of selected by the user", () => {
  expect(
    deriveExecutionPolicy({
      kind: "bug",
      size: "small",
      description: "先分析原因，不要修改代码",
      branch: { mode: "existing", base: "main", name: "main", version: "" },
      workspaceMode: "current",
    }),
  ).toMatchObject({ workflowMode: "quick", autoTest: false });
  expect(
    deriveExecutionPolicy({
      kind: "design",
      size: "medium",
      description: "按设计稿完成页面",
      branch: { mode: "existing", base: "main", name: "main", version: "" },
      workspaceMode: "current",
    }),
  ).toMatchObject({ workflowMode: "standard", autoTest: true });
});

test("an explicitly selected standard branch workflow is preserved", () => {
  expect(
    deriveExecutionPolicy({
      kind: "text",
      size: "small",
      description: "修改当前页面文案",
      branch: {
        mode: "existing",
        base: "refs/remotes/origin/feature/remote-only",
        name: "feature/remote-only",
        version: "",
      },
      workspaceMode: "current",
      workflowMode: "standard",
    }),
  ).toMatchObject({ workflowMode: "standard", autoTest: false });
});

