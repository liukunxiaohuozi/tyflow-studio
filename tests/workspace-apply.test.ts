import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { applyWorkspace } from "../src/main/workspace-apply";
import type { Task } from "../src/shared/contracts";

jest.setTimeout(60000);
let root: string, source: string, directory: string, id: string, base: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-apply-"));
  source = path.join(root, "source");
  fs.mkdirSync(source);
  git(source, "init", "--initial-branch=main");
  git(source, "config", "user.name", "Fixture");
  git(source, "config", "user.email", "fixture@example.invalid");
  git(source, "config", "core.autocrlf", "false");
  fs.writeFileSync(path.join(source, "edit.ts"), "export const value = 1;\n");
  fs.writeFileSync(path.join(source, "delete.txt"), "remove me\n");
  git(source, "add", ".");
  git(source, "commit", "-m", "base");
  base = git(source, "rev-parse", "HEAD");
  id = randomUUID();
  directory = path.join(root, "data", "workspaces", id);
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  git(source, "worktree", "add", "-b", "task", directory, base);
});
afterEach(async () => {
  await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5 });
});
function workspace(): NonNullable<Task["workspace"]> {
  return {
    directory,
    sourceDirectory: source,
    branch: "task",
    baseCommit: base,
  };
}
const apply = () =>
  applyWorkspace(
    workspace(),
    source,
    path.join(root, "data"),
    id,
    new AbortController().signal,
  );

test("explicit apply exposes update/add/delete as editor-visible unstaged changes, without switching or committing", async () => {
  fs.writeFileSync(
    path.join(directory, "edit.ts"),
    "export const value = 2;\n",
  );
  fs.unlinkSync(path.join(directory, "delete.txt"));
  fs.writeFileSync(
    path.join(directory, "new.ts"),
    "export const added = true;\n",
  );
  const result = await apply();
  expect(result.files.sort()).toEqual(["delete.txt", "edit.ts", "new.ts"]);
  expect(fs.readFileSync(path.join(source, "edit.ts"), "utf8")).toContain(
    "= 2",
  );
  expect(fs.existsSync(path.join(source, "delete.txt"))).toBe(false);
  expect(fs.readFileSync(path.join(source, "new.ts"), "utf8")).toContain(
    "true",
  );
  expect(git(source, "status", "--porcelain")).toContain("M edit.ts");
  expect(git(source, "diff", "--cached", "--name-only")).toBe("");
  expect(git(source, "rev-parse", "HEAD")).toBe(base);
  expect(git(source, "branch", "--show-current")).toBe("main");
  expect(fs.existsSync(result.backup)).toBe(true);
  expect(fs.readFileSync(path.join(directory, "edit.ts"), "utf8")).toContain(
    "= 2",
  );
});

test("dirty original refuses all writes and retains user's changes", async () => {
  fs.writeFileSync(path.join(directory, "edit.ts"), "task edit\n");
  fs.writeFileSync(path.join(source, "user.txt"), "user work\n");
  await expect(apply()).rejects.toThrow(/未提交/);
  expect(fs.readFileSync(path.join(source, "edit.ts"), "utf8")).toContain(
    "= 1",
  );
  expect(fs.readFileSync(path.join(source, "user.txt"), "utf8")).toBe(
    "user work\n",
  );
});

test("committed source conflict is not overwritten even though Git status is clean", async () => {
  fs.writeFileSync(path.join(directory, "edit.ts"), "task edit\n");
  fs.writeFileSync(path.join(source, "edit.ts"), "new committed source\n");
  git(source, "add", ".");
  git(source, "commit", "-m", "other work");
  await expect(apply()).rejects.toThrow(/冲突/);
  expect(fs.readFileSync(path.join(source, "edit.ts"), "utf8")).toBe(
    "new committed source\n",
  );
});

test("repeat apply is harmless when the complete target is already present", async () => {
  fs.writeFileSync(path.join(directory, "edit.ts"), "task edit\n");
  await apply();
  const result = await apply();
  expect(result.alreadyApplied).toBe(true);
  expect(git(source, "rev-parse", "HEAD")).toBe(base);
});

test("different configured source repository and outside-owned workspace are refused", async () => {
  await expect(
    applyWorkspace(
      workspace(),
      directory,
      path.join(root, "data"),
      id,
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  await expect(
    applyWorkspace(
      { ...workspace(), directory: source },
      source,
      path.join(root, "data"),
      id,
      new AbortController().signal,
    ),
  ).rejects.toThrow();
});

test("CRLF checkouts and binary files retain exact target bytes; test evidence is not copied", async () => {
  fs.writeFileSync(path.join(source, "edit.ts"), "export const value = 1;\r\n");
  git(source, "config", "core.autocrlf", "true");
  git(source, "add", "--renormalize", "edit.ts");
  expect(git(source, "status", "--porcelain")).toBe("");
  fs.writeFileSync(
    path.join(directory, "edit.ts"),
    "export const value = 2;\r\n",
  );
  fs.writeFileSync(
    path.join(directory, "image.bin"),
    Buffer.from([0, 1, 255, 3]),
  );
  fs.mkdirSync(path.join(directory, "test-results"));
  fs.writeFileSync(path.join(directory, "test-results", "proof.json"), "{}");
  const result = await apply();
  expect(result.files).not.toContain("test-results/proof.json");
  expect(fs.existsSync(path.join(source, "test-results"))).toBe(false);
  expect(fs.readFileSync(path.join(source, "edit.ts"), "utf8")).toBe(
    "export const value = 2;\r\n",
  );
  expect(fs.readFileSync(path.join(source, "image.bin"))).toEqual(
    Buffer.from([0, 1, 255, 3]),
  );
});

test("hardlinked original file and linked task directory cannot escape the write boundary", async () => {
  const outside = path.join(root, "outside.ts");
  fs.linkSync(path.join(source, "edit.ts"), outside);
  fs.writeFileSync(path.join(directory, "edit.ts"), "task edit\n");
  await expect(apply()).rejects.toThrow(/链接/);
  expect(fs.readFileSync(outside, "utf8")).toContain("= 1");
  fs.unlinkSync(outside);
  const nested = path.join(directory, "nested");
  fs.symlinkSync(
    source,
    nested,
    process.platform === "win32" ? "junction" : "dir",
  );
  // Git sees the link itself, which must never be copied as a source file.
  await expect(apply()).rejects.toThrow(/链接|路径/);
});

test("a mid-application write error restores prior writes and retains an auditable backup", async () => {
  fs.writeFileSync(path.join(directory, "edit.ts"), "task edit\n");
  fs.writeFileSync(path.join(directory, "new.ts"), "new file\n");
  const rename = fs.renameSync;
  const spy = jest.spyOn(fs, "renameSync").mockImplementation((from, to) => {
    if (String(to) === path.join(source, "new.ts"))
      throw new Error("fixture write failure");
    rename(from, to);
  });
  try {
    await expect(apply()).rejects.toThrow(/已撤回本次写入/);
  } finally {
    spy.mockRestore();
  }
  expect(git(source, "status", "--porcelain")).toBe("");
  expect(fs.readFileSync(path.join(source, "edit.ts"), "utf8")).toContain(
    "= 1",
  );
  const backups = path.join(root, "data", "workspace-applications", id);
  expect(fs.readdirSync(backups).length).toBe(1);
  expect(
    fs.existsSync(
      path.join(backups, fs.readdirSync(backups)[0], "receipt.json"),
    ),
  ).toBe(true);
});

test("new filenames outside the reviewed scope are rejected before writes", async () => {
  fs.writeFileSync(path.join(directory, "new.ts"), "new file\n");
  await expect(
    applyWorkspace(
      workspace(),
      source,
      path.join(root, "data"),
      id,
      new AbortController().signal,
      ["edit.ts"],
    ),
  ).rejects.toThrow(/范围/);
  expect(git(source, "status", "--porcelain")).toBe("");
});
