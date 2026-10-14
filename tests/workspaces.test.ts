import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { prepareWorkspace } from "../src/main/workspaces";
import { initialSettings, Store } from "../src/main/store";
import type { Task } from "../src/shared/contracts";

jest.setTimeout(30000);
let root: string, repository: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-workspaces-"));
  repository = path.join(root, "source");
  fs.mkdirSync(repository);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Fixture");
  git(repository, "config", "user.email", "fixture@example.invalid");
  fs.writeFileSync(path.join(repository, "source.txt"), "committed source");
  fs.writeFileSync(
    path.join(repository, ".gitignore"),
    ".env.local\nnode_modules/\n",
  );
  git(repository, "add", ".");
  git(repository, "commit", "-m", "fixture base");
});
afterEach(async () => {
  await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5 });
});
function task(): Task {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: "Fixture",
    kind: "bug",
    size: "small",
    description: "Fixture",
    projectId: "fixture",
    assetIds: [],
    branch: { mode: "existing", base: "main", name: "main", version: "" },
    autoTest: false,
    workspaceMode: "isolated",
    targetCommit: git(repository, "rev-parse", "HEAD"),
    status: "developing",
    createdAt: now,
    updatedAt: now,
    planRevision: 0,
    logs: [],
    checks: [],
    assets: [],
  };
}

test("parallel workspaces leave the dirty original and each other's source untouched", async () => {
  fs.writeFileSync(
    path.join(repository, "source.txt"),
    "user unfinished source",
  );
  fs.writeFileSync(
    path.join(repository, ".env.local"),
    "FIXTURE_TOKEN=local-only",
  );
  const project = { ...initialSettings().projects[0], directory: repository };
  const [a, b] = await Promise.all([
    prepareWorkspace(project, task(), root, new AbortController().signal),
    prepareWorkspace(project, task(), root, new AbortController().signal),
  ]);
  expect(a.directory).not.toBe(b.directory);
  expect(a.branch).not.toBe(b.branch);
  expect(git(repository, "branch", "--show-current")).toBe("main");
  expect(fs.readFileSync(path.join(a.directory, "source.txt"), "utf8")).toBe(
    "committed source",
  );
  fs.writeFileSync(
    path.join(a.directory, "source.txt"),
    "task A implementation",
  );
  expect(fs.readFileSync(path.join(b.directory, "source.txt"), "utf8")).toBe(
    "committed source",
  );
  expect(fs.readFileSync(path.join(repository, "source.txt"), "utf8")).toBe(
    "user unfinished source",
  );
  expect(fs.readFileSync(path.join(a.directory, ".env.local"), "utf8")).toBe(
    "FIXTURE_TOKEN=local-only",
  );
  expect(git(a.directory, "status", "--porcelain")).not.toContain(".env.local");
});
test("retries reuse the same workspace but refuse an unrelated replacement repository", async () => {
  const project = { ...initialSettings().projects[0], directory: repository },
    input = task(),
    signal = new AbortController().signal;
  const first = await prepareWorkspace(project, input, root, signal);
  fs.writeFileSync(
    path.join(first.directory, "source.txt"),
    "keep retry changes",
  );
  expect(await prepareWorkspace(project, input, root, signal)).toEqual(first);
  const wrongProject = { ...project, directory: path.join(root, "other") };
  fs.mkdirSync(wrongProject.directory);
  git(wrongProject.directory, "init");
  await expect(
    prepareWorkspace(wrongProject, input, root, signal),
  ).rejects.toThrow("不一致");
  expect(
    fs.readFileSync(path.join(first.directory, "source.txt"), "utf8"),
  ).toBe("keep retry changes");
});
test("restarting converts interrupted and queued tasks into explicit resumable states", () => {
  const store = new Store(path.join(root, "data")),
    active = task(),
    queued = {
      ...task(),
      status: "queued" as const,
      stage: "development" as const,
      queued: { action: "fix" as const, at: new Date().toISOString() },
    };
  store.putTask(active);
  store.putTask(queued);
  const reopened = new Store(store.directory);
  expect(reopened.getTask(active.id).status).toBe("stopped");
  expect(reopened.getTask(queued.id).status).toBe("stopped");
  expect(reopened.getTask(queued.id).queued).toBeUndefined();
  expect(reopened.getTask(queued.id).stage).toBe("development");
});
