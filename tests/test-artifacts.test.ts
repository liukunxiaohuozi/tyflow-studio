import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isTestArtifact, isArtifactState } from "../src/main/test-artifacts";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-artifacts-"));
  fs.mkdirSync(path.join(root, "test-results/run/scan-workspace/src"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "test-results/run/VERIFY.md"), "evidence");
  fs.writeFileSync(
    path.join(root, "test-results/run/scan-workspace/src/app.ts"),
    "copy",
  );
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test("only isolated untracked artifacts are allowed; source copies are not live business files", () => {
  expect(isTestArtifact(root, "test-results/run/VERIFY.md", "untracked")).toBe(
    true,
  );
  expect(
    isArtifactState(
      root,
      "test-results\\run\\scan-workspace\\src\\app.ts",
      "untracked:hash",
    ),
  ).toBe(true);
});
test.each(["modified", "added", "deleted", "renamed", "unknown"])(
  "%s files are never exempted by their evidence directory",
  (kind) => {
    expect(isTestArtifact(root, "test-results/run/VERIFY.md", kind)).toBe(
      false,
    );
  },
);
test.each([
  "src/test-results/run.ts",
  "test-results-old/run.ts",
  "test-results/../package.json",
  "/test-results/run/VERIFY.md",
  "test-results/./run/VERIFY.md",
  "test-results/run/missing.json",
  "test-results/run/scan-workspace",
  "test-results/run/C:escape",
])("invalid or non-reserved path %s stays protected", (file) => {
  expect(isTestArtifact(root, file, "untracked")).toBe(false);
});
test("hard links cannot disguise a live business file as evidence", () => {
  fs.writeFileSync(path.join(root, "business.ts"), "business");
  fs.linkSync(
    path.join(root, "business.ts"),
    path.join(root, "test-results/run/linked.ts"),
  );
  expect(isTestArtifact(root, "test-results/run/linked.ts", "untracked")).toBe(
    false,
  );
});
test("directory symlinks or Windows junctions cannot bypass source protection", () => {
  const business = path.join(root, "src");
  fs.mkdirSync(business);
  fs.writeFileSync(path.join(business, "app.ts"), "business");
  fs.symlinkSync(
    business,
    path.join(root, "test-results/run/live"),
    process.platform === "win32" ? "junction" : "dir",
  );
  expect(
    isTestArtifact(root, "test-results/run/live/app.ts", "untracked"),
  ).toBe(false);
});
