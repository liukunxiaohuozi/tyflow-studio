import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import {
  inspectRepository,
  prepareBranch,
  gitConnection,
  resolveTargetCommit,
  syncRepository,
} from "../src/main/git";

let directory: string;
const git = (...args: string[]) =>
  execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "tyflow-git-test-"));
  git("init", "-b", "main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      scripts: { test: "echo test", "start:dev": "echo start" },
    }),
  );
  git("add", ".");
  git("commit", "-m", "fixture");
  git("tag", "v1");
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
test("reads actual refs, scripts and dirty files", async () => {
  expect(await inspectRepository(directory)).toMatchObject({
    branch: "main",
    branches: ["main"],
    tags: ["v1"],
    dirty: false,
    scripts: ["start:dev", "test"],
  });
  await writeFile(join(directory, "new.txt"), "untracked");
  expect((await inspectRepository(directory)).dirty).toBe(true);
});
test("creates branch from selected tag without committing", async () => {
  const before = git("rev-parse", "HEAD");
  const result = await prepareBranch(
    directory,
    { mode: "new", base: "main", name: "feature/demo", version: "v1" },
    before,
  );
  expect(result).toEqual({ branch: "feature/demo", commit: before });
  expect(git("rev-list", "--count", "HEAD")).toBe("1");
});
test("rejects dirty, stale, invalid and conflicting branch requests", async () => {
  const before = git("rev-parse", "HEAD");
  const config = {
    mode: "new" as const,
    base: "main",
    name: "feature/new",
    version: "",
  };
  await expect(
    prepareBranch(directory, config, "0".repeat(40)),
  ).rejects.toThrow(/changed|变化/);
  await expect(
    prepareBranch(directory, { ...config, name: "-bad" }, before),
  ).rejects.toThrow();
  await expect(
    prepareBranch(directory, { ...config, name: "main" }, before),
  ).rejects.toThrow();
  await writeFile(join(directory, "dirty.txt"), "keep");
  await expect(prepareBranch(directory, config, before)).rejects.toThrow(
    /dirty|未提交/,
  );
  expect(git("branch", "--show-current")).toBe("main");
});
test("switches an existing branch and rejects option-like references", async () => {
  const before = git("rev-parse", "HEAD");
  git("branch", "existing");
  expect(
    (
      await prepareBranch(
        directory,
        { mode: "existing", base: "existing", name: "", version: "" },
        before,
      )
    ).branch,
  ).toBe("existing");
  await expect(
    prepareBranch(
      directory,
      { mode: "new", base: "--help", name: "safe", version: "" },
      before,
    ),
  ).rejects.toThrow();
});
test("resolves selected target independently of HEAD and blocks moved target refs", async () => {
  const first = git("rev-parse", "HEAD");
  git("branch", "base");
  await writeFile(join(directory, "new.txt"), "new");
  git("add", ".");
  git("commit", "-m", "second");
  const current = git("rev-parse", "HEAD");
  const config = {
    mode: "new" as const,
    base: "base",
    name: "feature/frozen",
    version: "",
  };
  expect(await resolveTargetCommit(directory, config)).toBe(first);
  expect(
    await resolveTargetCommit(directory, { ...config, version: "v1" }),
  ).toBe(first);
  git("branch", "-f", "base", current);
  await expect(
    prepareBranch(directory, config, current, first),
  ).rejects.toThrow(/target|目标/i);
  expect(git("branch", "--show-current")).toBe("main");
  expect(git("branch", "--list", "feature/frozen")).toBe("");
});
test("connection is read only and rejects credential-bearing URLs", async () => {
  const project = {
    id: "p",
    name: "p",
    directory,
    repository: directory,
    auth: "system" as const,
    username: "",
    startScript: "",
    targetUrl: "",
    defaultBranchMode: "new" as const,
  };
  expect((await gitConnection(project)).ok).toBe(true);
  const result = await gitConnection({
    ...project,
    repository: "https://user:TOPSECRET@example.invalid/repo",
  });
  expect(result.ok).toBe(false);
  expect(result.message).not.toContain("TOPSECRET");
  expect(
    (await gitConnection({ ...project, repository: "ext::malicious command" }))
      .ok,
  ).toBe(false);
});
test("does not overwrite ignored local work while switching refs", async () => {
  git("switch", "-c", "with-file");
  await writeFile(join(directory, "local.txt"), "tracked");
  git("add", ".");
  git("commit", "-m", "tracked on other branch");
  git("switch", "main");
  await writeFile(join(directory, ".gitignore"), "local.txt\n");
  git("add", ".gitignore");
  git("commit", "-m", "ignore local");
  await writeFile(join(directory, "local.txt"), "precious ignored content");
  const before = git("rev-parse", "HEAD");
  expect((await inspectRepository(directory)).dirty).toBe(false);
  await expect(
    prepareBranch(
      directory,
      { mode: "existing", base: "with-file", name: "", version: "" },
      before,
    ),
  ).rejects.toThrow();
  expect(await readFile(join(directory, "local.txt"), "utf8")).toBe(
    "precious ignored content",
  );
  expect(git("branch", "--show-current")).toBe("main");
});

test("HTTP credentials authenticate actual Git reads and remote synchronization without credential persistence", async () => {
  git("update-server-info");
  const username = "http-auth@example.invalid";
  const password = "fixture-only-p@ss%&!word";
  const authorization =
    "Basic " + Buffer.from(username + ":" + password).toString("base64");
  let authorized = 0;
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== authorization) {
      response.writeHead(401, { "WWW-Authenticate": 'Basic realm="fixture"' });
      response.end();
      return;
    }
    authorized++;
    const pathname = new URL(request.url!, "http://localhost").pathname;
    const relative = pathname.replace(/^\/repo\.git\//, "");
    if (
      !pathname.startsWith("/repo.git/") ||
      !/^[a-zA-Z0-9/._-]+$/.test(relative) ||
      relative.includes("..")
    ) {
      response.writeHead(404).end();
      return;
    }
    try {
      const content = await readFile(join(directory, ".git", relative));
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const repository = `http://127.0.0.1:${address.port}/repo.git`;
  const project = {
    id: "auth-fixture",
    name: "auth-fixture",
    directory,
    repository,
    auth: "password" as const,
    username,
    startScript: "",
    targetUrl: "",
    defaultBranchMode: "new" as const,
  };
  try {
    // Empty inherited helpers keep this test independent of the user's credential manager.
    git("config", "credential.helper", "");
    const system = await gitConnection({ ...project, auth: "system" });
    expect(system.ok).toBe(false);
    expect(system.message).toContain("系统 Git 凭据不可用");
    expect((await gitConnection(project)).message).toContain("请先填写并保存");
    expect(
      (await gitConnection({ ...project, username: "" }, password)).message,
    ).toContain("需要填写 Git 用户名");
    expect(
      (await gitConnection(project, "wrong-fixture-password")).message,
    ).toContain("Git 认证失败");
    expect((await gitConnection(project, password)).ok).toBe(true);
    expect(
      (await gitConnection({ ...project, auth: "token" }, password)).ok,
    ).toBe(true);
    const before = git("rev-parse", "HEAD");
    const synced = await syncRepository(project, password);
    expect(synced.remoteBranches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "origin/main", commit: before }),
      ]),
    );
    expect(authorized).toBeGreaterThan(0);
    expect(git("rev-parse", "HEAD")).toBe(before);
    expect(git("remote", "get-url", "origin")).toBe(repository);
    const config = await readFile(join(directory, ".git", "config"), "utf8");
    expect(config).not.toContain(password);
    expect(config).not.toContain(username);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 60000);
