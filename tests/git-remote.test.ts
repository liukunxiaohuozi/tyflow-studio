import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  commitAndPush,
  syncRepository,
  inspectRepository,
  resolveTargetCommit,
  prepareBranch,
  repositoriesMatch,
} from "../src/main/git";
import type { Project } from "../src/shared/contracts";

jest.setTimeout(30000);
let root: string,
  upstream: string,
  seed: string,
  local: string,
  project: Project;
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function commit(cwd: string, file: string, content: string) {
  fs.writeFileSync(path.join(cwd, file), content);
  git(cwd, "add", file);
  git(cwd, "commit", "-m", file);
  return git(cwd, "rev-parse", "HEAD");
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tyflow-remote-test-"));
  upstream = path.join(root, "upstream.git");
  seed = path.join(root, "seed");
  local = path.join(root, "local");
  git(root, "init", "--bare", "--initial-branch=main", upstream);
  git(root, "clone", upstream, seed);
  git(seed, "config", "user.name", "Fixture");
  git(seed, "config", "user.email", "fixture@example.invalid");
  commit(seed, "base.txt", "base");
  git(seed, "push", "origin", "main");
  git(root, "clone", "--single-branch", "--branch", "main", upstream, local);
  git(local, "config", "user.name", "Fixture");
  git(local, "config", "user.email", "fixture@example.invalid");
  project = {
    id: "fixture",
    name: "Fixture",
    directory: local,
    repository: upstream,
    auth: "system",
    username: "",
    startScript: "start:dev",
    targetUrl: "http://localhost:8000",
    defaultBranchMode: "new",
  };
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test("recognizes the SSH and HTTPS forms commonly mixed on macOS as one repository", () => {
  expect(
    repositoriesMatch(
      "git@github.com:liukunxiaohuozi/tyflow-studio.git",
      "https://github.com/liukunxiaohuozi/tyflow-studio/",
    ),
  ).toBe(true);
  expect(
    repositoriesMatch(
      "ssh://git@git.example.test:22/team/app.git",
      "https://git.example.test/team/app",
    ),
  ).toBe(true);
  expect(
    repositoriesMatch(
      "https://git.example.test/team/app",
      "https://git.example.test/team/another-app",
    ),
  ).toBe(false);
});

test("records a local delivery commit before push and retries without a duplicate commit", async () => {
  const unavailable = path.join(root, "unavailable.git");
  const deliveryProject = { ...project, repository: unavailable };
  fs.writeFileSync(path.join(local, "delivery.txt"), "ready");
  let committed: { commit: string; branch: string; remote: string } | undefined;
  await expect(
    commitAndPush(
      deliveryProject,
      undefined,
      "main",
      "deliver fixture",
      { name: "Fixture", email: "fixture@example.invalid" },
      undefined,
      (value) => {
        committed = value;
      },
    ),
  ).rejects.toThrow();
  expect(committed?.commit).toBe(git(local, "rev-parse", "HEAD"));
  expect(git(local, "rev-list", "--count", "HEAD")).toBe("2");
  git(root, "init", "--bare", "--initial-branch=main", unavailable);
  const delivered = await commitAndPush(
    deliveryProject,
    undefined,
    "main",
    "deliver fixture",
    { name: "Fixture", email: "fixture@example.invalid" },
    committed?.commit,
  );
  expect(delivered.commit).toBe(committed?.commit);
  expect(git(local, "rev-list", "--count", "HEAD")).toBe("2");
  expect(git(unavailable, "rev-parse", "refs/heads/main")).toBe(
    committed?.commit,
  );
});

test("fetches every remote branch without letting conflicting remote tags block synchronization", async () => {
  const head = git(local, "rev-parse", "HEAD");
  git(seed, "branch", "feature/remote-only");
  git(seed, "push", "origin", "feature/remote-only");
  commit(seed, "remote-tag-target.txt", "remote tag target");
  git(seed, "tag", "v-conflict");
  git(seed, "push", "origin", "v-conflict");
  fs.writeFileSync(path.join(local, "base.txt"), "my edits");
  git(local, "tag", "local-only");
  git(local, "tag", "v-conflict");
  git(local, "config", "fetch.pruneTags", "true");
  const info = await syncRepository(project);
  expect(info.remoteBranches?.map((b) => b.name)).toEqual([
    "origin/feature/remote-only",
    "origin/main",
  ]);
  expect(info.tags).toEqual(["local-only", "v-conflict"]);
  expect(git(local, "rev-parse", "refs/tags/v-conflict")).toBe(head);
  expect(info.syncRemote).toBe("origin");
  expect(info.syncedAt).toBeTruthy();
  expect(git(local, "rev-parse", "HEAD")).toBe(head);
  expect(fs.readFileSync(path.join(local, "base.txt"), "utf8")).toBe(
    "my edits",
  );
  expect(info.dirty).toBe(true);
});

test("prunes removed remote refs without deleting local branches", async () => {
  git(seed, "branch", "obsolete");
  git(seed, "push", "origin", "obsolete");
  await syncRepository(project);
  git(local, "branch", "keep-local", "origin/obsolete");
  git(seed, "push", "origin", "--delete", "obsolete");
  const info = await syncRepository(project);
  expect(info.remoteBranches?.some((b) => b.name === "origin/obsolete")).toBe(
    false,
  );
  expect(info.branches).toContain("keep-local");
});

test("assesses the upstream tip without touching the checkout, then fast-forwards only after confirmation", async () => {
  const original = git(local, "rev-parse", "HEAD");
  const tip = commit(seed, "update.txt", "remote update");
  git(seed, "push", "origin", "main");
  const info = await syncRepository(project);
  expect(info.branchStates?.find((b) => b.name === "main")).toMatchObject({
    ahead: 0,
    behind: 1,
  });
  const config = {
    mode: "existing" as const,
    base: "main",
    name: "main",
    version: "",
  };
  expect(await resolveTargetCommit(local, config)).toBe(tip);
  expect(git(local, "rev-parse", "HEAD")).toBe(original);
  expect(await prepareBranch(local, config, original, tip)).toEqual({
    branch: "main",
    commit: tip,
  });
  expect(git(local, "rev-list", "--count", "HEAD")).toBe("2");
});

test("selecting a remote-only branch creates a local tracking branch at its assessed commit", async () => {
  git(seed, "switch", "-c", "feature/remote-only");
  const tip = commit(seed, "feature.txt", "remote feature");
  git(seed, "push", "origin", "feature/remote-only");
  const before = await syncRepository(project);
  const config = {
    mode: "existing" as const,
    base: "refs/remotes/origin/feature/remote-only",
    name: "feature/remote-only",
    version: "",
  };
  expect(await resolveTargetCommit(local, config)).toBe(tip);
  const prepared = await prepareBranch(local, config, before.commit, tip);
  expect(prepared).toEqual({ branch: "feature/remote-only", commit: tip });
  expect(git(local, "rev-parse", "--abbrev-ref", "@{upstream}")).toBe(
    "origin/feature/remote-only",
  );
});

test("new branches can use the latest remote commit without moving the old local branch", async () => {
  const original = git(local, "rev-parse", "HEAD");
  const tip = commit(seed, "update.txt", "new");
  git(seed, "push", "origin", "main");
  await syncRepository(project);
  const config = {
    mode: "new" as const,
    base: "main",
    name: "feature/new",
    version: "",
  };
  expect(await resolveTargetCommit(local, config)).toBe(tip);
  await prepareBranch(local, config, original, tip);
  expect(git(local, "rev-parse", "refs/heads/main")).toBe(original);
  expect(git(local, "rev-parse", "HEAD")).toBe(tip);
});

test("divergence, same-name untracked branches, and missing upstreams block instead of resetting work", async () => {
  const own = commit(local, "own.txt", "local");
  commit(seed, "remote.txt", "remote");
  git(seed, "push", "origin", "main");
  await syncRepository(project);
  const config = {
    mode: "existing" as const,
    base: "main",
    name: "main",
    version: "",
  };
  await expect(resolveTargetCommit(local, config)).rejects.toThrow(/分叉/);
  expect(git(local, "rev-parse", "HEAD")).toBe(own);
  git(local, "branch", "--unset-upstream", "main");
  await expect(
    resolveTargetCommit(local, { ...config, base: "refs/remotes/origin/main" }),
  ).rejects.toThrow(/同名/);
  git(local, "branch", "--set-upstream-to=origin/main", "main");
  git(upstream, "config", "receive.denyDeleteCurrent", "ignore");
  git(seed, "push", "origin", "--delete", "main");
  await syncRepository(project);
  await expect(resolveTargetCommit(local, config)).rejects.toThrow(
    /上游已删除/,
  );
});

test("an upstream update after assessment requires reassessment before touching the branch", async () => {
  const initial = await syncRepository(project);
  const config = {
    mode: "existing" as const,
    base: "main",
    name: "main",
    version: "",
  };
  const assessed = await resolveTargetCommit(local, config);
  commit(seed, "later.txt", "later");
  git(seed, "push", "origin", "main");
  await syncRepository(project);
  await expect(
    prepareBranch(local, config, initial.commit, assessed),
  ).rejects.toThrow(/changed since analysis/);
  expect(git(local, "rev-parse", "HEAD")).toBe(initial.commit);
});

test("dirty and ignored files are preserved when a fast-forward would overwrite them", async () => {
  commit(seed, ".gitignore", "private.txt\n");
  git(seed, "push", "origin", "main");
  await syncRepository(project);
  const config = {
    mode: "existing" as const,
    base: "main",
    name: "main",
    version: "",
  };
  await prepareBranch(
    local,
    config,
    git(local, "rev-parse", "HEAD"),
    await resolveTargetCommit(local, config),
  );
  fs.writeFileSync(path.join(local, "private.txt"), "precious");
  fs.writeFileSync(path.join(seed, "private.txt"), "tracked remote");
  git(seed, "add", "-f", "private.txt");
  git(seed, "commit", "-m", "track file");
  git(seed, "push", "origin", "main");
  await syncRepository(project);
  const head = git(local, "rev-parse", "HEAD");
  await expect(
    prepareBranch(
      local,
      config,
      head,
      await resolveTargetCommit(local, config),
    ),
  ).rejects.toThrow();
  expect(fs.readFileSync(path.join(local, "private.txt"), "utf8")).toBe(
    "precious",
  );
  expect(git(local, "rev-parse", "HEAD")).toBe(head);
  fs.writeFileSync(path.join(local, "base.txt"), "dirty");
  await expect(prepareBranch(local, config, head)).rejects.toThrow(/dirty/);
  await expect(
    prepareBranch(local, config, head, undefined, undefined, true),
  ).rejects.toThrow(/overwritten/);
  expect(fs.readFileSync(path.join(local, "private.txt"), "utf8")).toBe(
    "precious",
  );
});

test("explicit confirmation continues with non-conflicting uncommitted changes", async () => {
  const head = git(local, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(local, "local-work.txt"), "keep me");
  const config = {
    mode: "existing" as const,
    base: "main",
    name: "main",
    version: "",
  };
  await expect(prepareBranch(local, config, head)).rejects.toThrow(/dirty/);
  await expect(
    prepareBranch(local, config, head, undefined, undefined, true),
  ).resolves.toEqual({ branch: "main", commit: head });
  expect(fs.readFileSync(path.join(local, "local-work.txt"), "utf8")).toBe(
    "keep me",
  );
});

test("a configured repository that differs from origin gets an isolated Studio remote", async () => {
  const head = git(local, "rev-parse", "HEAD");
  const originalOrigin = git(local, "remote", "get-url", "origin");
  const info = await syncRepository({ ...project, repository: seed });
  expect(info.syncRemote).toBe("tingyun-studio");
  expect(info.remoteBranches?.map((branch) => branch.name)).toContain(
    "tingyun-studio/main",
  );
  expect(git(local, "remote", "get-url", "origin")).toBe(originalOrigin);
  expect(git(local, "remote", "get-url", "tingyun-studio")).toBe(seed);
  expect(git(local, "rev-parse", "HEAD")).toBe(head);
});

test("offline remotes and cancelled syncs do not report success or change HEAD", async () => {
  const head = git(local, "rev-parse", "HEAD");
  const controller = new AbortController();
  controller.abort();
  await expect(
    syncRepository(project, undefined, controller.signal),
  ).rejects.toThrow(/已停止/);
  const missing = path.join(root, "offline.git");
  git(local, "remote", "set-url", "origin", missing);
  await expect(
    syncRepository({ ...project, repository: missing }),
  ).rejects.toThrow();
  expect(git(local, "rev-parse", "HEAD")).toBe(head);
  expect((await inspectRepository(local)).branch).toBe("main");
});
