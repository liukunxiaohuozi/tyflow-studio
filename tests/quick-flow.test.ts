import {
  assertQuickChangeScope,
  developmentInstructions,
} from "../src/main/quick-flow";
import type { Task } from "../src/shared/contracts";

test("manual L1 handoff never promises a test provider or opens browser/dependency work", () => {
  const task = { workflowMode: "quick", autoTest: false } as Task;
  const prompt = developmentInstructions(task, true);
  expect(prompt).toContain("L1 QUICK MODIFICATION");
  expect(prompt).toContain("Automated testing is OFF");
  expect(prompt).toContain("Never install dependencies");
  expect(prompt).not.toContain(
    "Studio will run the professional test provider afterwards",
  );
  expect(developmentInstructions({ ...task, autoTest: true }, true)).toContain(
    "explicitly opted into automated testing",
  );
});

test("L1 copy/style changes pass but dependency/security/deletion changes stop without reverting", () => {
  const before = {
    "src/page.tsx": "old",
    "package.json": "user-dirty",
    ".env.local": "existing",
  };
  expect(() =>
    assertQuickChangeScope(before, {
      ...before,
      "src/page.tsx": "new",
      "src/locales/en-US.json": "new",
    }),
  ).not.toThrow();
  for (const file of [
    "package.json",
    "pnpm-lock.yaml",
    ".env.local",
    "src/permission.ts",
    "vite.config.ts",
  ]) {
    expect(() =>
      assertQuickChangeScope(before, { ...before, [file]: "new" }),
    ).toThrow("轻量修改触及");
  }
  expect(() =>
    assertQuickChangeScope(before, {
      "package.json": "user-dirty",
      ".env.local": "existing",
    }),
  ).toThrow("删除文件");
  expect(() =>
    assertQuickChangeScope({}, { "src/deleted.ts": "deleted:<missing>" }),
  ).toThrow("删除文件");
});
