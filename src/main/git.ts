import { spawn } from "node:child_process";
import {
  readFile,
  realpath,
  stat,
  mkdtemp,
  writeFile,
  rm,
} from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { killTree } from "./process";
import type {
  RepositoryInfo,
  BranchConfig,
  Project,
} from "../shared/contracts";

const LIMIT = 2 * 1024 * 1024;
async function run(
  directory: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
  timeout = 15000,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error("任务已停止");
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: directory,
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
        LC_ALL: "C",
        ...env,
      },
    });
    let output = "";
    let errors = "";
    let size = 0;
    let failure: Error | undefined;
    const timer = setTimeout(() => {
      failure = new Error("Git command timed out");
      killTree(child);
    }, timeout);
    const abort = () => {
      failure = new Error("任务已停止");
      killTree(child);
    };
    signal?.addEventListener("abort", abort, { once: true });
    const collect = (chunk: Buffer, error: boolean) => {
      size += chunk.length;
      if (size > LIMIT) {
        failure = new Error("Git output exceeded safe limit");
        killTree(child);
        return;
      }
      if (error) errors += chunk.toString("utf8");
      else output += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk: Buffer) => collect(chunk, false));
    child.stderr.on("data", (chunk: Buffer) => collect(chunk, true));
    child.on("error", (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0)
        reject(new Error(errors.trim() || `Git exited ${code}`));
      else resolve(output.trimEnd());
    });
  });
}
async function repositoryRoot(directory: string) {
  if (!directory || !isAbsolute(directory))
    throw new Error("Select an absolute project directory");
  const resolved = await realpath(directory);
  if (!(await stat(resolved)).isDirectory())
    throw new Error("Project directory is unavailable");
  if (
    (await run(resolved, ["rev-parse", "--is-inside-work-tree"])).trim() !==
    "true"
  )
    throw new Error("Project is not a Git working tree");
  const top = await realpath(
    (await run(resolved, ["rev-parse", "--show-toplevel"])).trim(),
  );
  if (
    process.platform === "win32"
      ? top.toLowerCase() !== resolved.toLowerCase()
      : top !== resolved
  )
    throw new Error("Choose the repository root directory");
  return resolved;
}
function lines(value: string) {
  return value.split(/\r?\n/).filter(Boolean);
}
export async function inspectRepository(
  directory: string,
): Promise<RepositoryInfo> {
  const cwd = await repositoryRoot(directory);
  const [branch, refs, tags, commit, porcelain, remoteRefs, remotes] =
    await Promise.all([
      run(cwd, ["branch", "--show-current"]),
      run(cwd, [
        "for-each-ref",
        "--format=%(refname)%09%(objectname)%09%(upstream)%09%(upstream:track)",
        "refs/heads",
      ]),
      run(cwd, ["tag", "--list"]),
      run(cwd, ["rev-parse", "--verify", "HEAD"]),
      run(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=normal"]),
      run(cwd, [
        "for-each-ref",
        "--format=%(refname)%09%(objectname)%09%(symref)",
        "refs/remotes",
      ]),
      run(cwd, ["remote"]),
    ]);
  const remoteNames = lines(remotes).sort((a, b) => b.length - a.length);
  const remoteBranches = lines(remoteRefs).flatMap((line) => {
    const [ref, hash, symbolic] = line.split("\t");
    if (symbolic) return [];
    const name = ref.slice("refs/remotes/".length);
    const remote = remoteNames.find((r) => name.startsWith(r + "/"));
    return remote
      ? [
          {
            ref,
            name,
            remote,
            branch: name.slice(remote.length + 1),
            commit: hash,
          },
        ]
      : [];
  });
  const branchStates = lines(refs).map((line) => {
    const [ref, hash, upstream, track = ""] = line.split("\t");
    return {
      name: ref.slice("refs/heads/".length),
      commit: hash,
      upstream: upstream || undefined,
      ahead: Number(track.match(/ahead (\d+)/)?.[1] || 0),
      behind: Number(track.match(/behind (\d+)/)?.[1] || 0),
      upstreamMissing: track.includes("gone"),
    };
  });
  let scripts: string[] = [];
  try {
    const contents = await readFile(join(cwd, "package.json"), "utf8");
    if (contents.length < LIMIT) {
      const pkg = JSON.parse(contents);
      scripts = Object.keys(pkg.scripts || {})
        .filter((key) => typeof pkg.scripts[key] === "string")
        .sort();
    }
  } catch {
    /* Non-Node repositories have no npm scripts. */
  }
  return {
    branch: branch.trim(),
    branches: branchStates.map((b) => b.name).sort(),
    branchStates,
    remoteBranches,
    remotes: lines(remotes).sort(),
    tags: lines(tags).sort(),
    commit: commit.trim(),
    dirty: porcelain.length > 0,
    changes: porcelain.split("\0").filter(Boolean),
    scripts,
  };
}
function safeReference(value: string) {
  if (
    !value ||
    value.startsWith("-") ||
    /[\x00-\x20~^:?*\[\\]/.test(value) ||
    value.includes("..") ||
    value.includes("@{") ||
    value.endsWith("/") ||
    value.endsWith(".")
  )
    throw new Error("Invalid Git reference");
}
function selectedRemote(config: BranchConfig, info: RepositoryInfo) {
  return info.remoteBranches?.find(
    (remote) =>
      remote.ref === config.base ||
      (!info.branches.includes(config.base) && remote.name === config.base),
  );
}
function effectiveLocal(name: string, info: RepositoryInfo): string {
  const local = info.branchStates?.find((branch) => branch.name === name);
  if (!local) throw new Error("所选本地分支不存在，请同步远程后重新选择");
  if (local.upstreamMissing)
    throw new Error("所选分支的上游已删除，请重新选择分支或处理上游配置");
  if (local.ahead && local.behind)
    throw new Error("本地分支与上游已分叉，请先自行解决合并或变基，再重新评估");
  if (local.behind) {
    const remote = info.remoteBranches?.find(
      (branch) => branch.ref === local.upstream,
    );
    if (!remote) throw new Error("无法读取上游分支，请先同步远程");
    return remote.commit;
  }
  return local.commit;
}
async function resolveRef(
  cwd: string,
  config: BranchConfig,
  info: RepositoryInfo,
  validateNewName = true,
): Promise<string> {
  safeReference(config.base);
  if (config.mode !== "new" && config.mode !== "existing")
    throw new Error("Select new or existing branch");
  const remote = selectedRemote(config, info);
  if (!remote && !info.branches.includes(config.base))
    throw new Error("所选分支已不存在，请同步远程并重新选择");
  if (config.mode === "new" && validateNewName) {
    safeReference(config.name);
    await run(cwd, ["check-ref-format", "--branch", config.name]);
    if (info.branches.includes(config.name))
      throw new Error("The new branch already exists");
  }
  let target: string;
  if (remote) {
    target = remote.commit;
    if (config.mode === "existing" && info.branches.includes(remote.branch)) {
      const local = info.branchStates!.find(
        (branch) => branch.name === remote.branch,
      )!;
      if (local.upstream !== remote.ref)
        throw new Error(
          "同名本地分支跟踪关系不同，请选择本地分支或新建其他名称的分支",
        );
      target = effectiveLocal(remote.branch, info);
    }
  } else target = effectiveLocal(config.base, info);
  if (config.version) {
    safeReference(config.version);
    if (!info.tags.includes(config.version))
      throw new Error("Selected version tag does not exist");
    const tag = (
      await run(cwd, [
        "rev-parse",
        "--verify",
        "refs/tags/" + config.version + "^{commit}",
      ])
    ).trim();
    if (config.mode === "existing" && target !== tag)
      throw new Error(
        "Existing branch differs from selected version; clear version or create a new branch",
      );
    target = tag;
  }
  return target;
}
export async function resolveTargetCommit(
  directory: string,
  config: BranchConfig,
): Promise<string> {
  const cwd = await repositoryRoot(directory);
  return resolveRef(cwd, config, await inspectRepository(cwd), false);
}
export async function prepareBranch(
  directory: string,
  config: BranchConfig,
  expectedCommit: string,
  expectedTargetCommit?: string,
  signal?: AbortSignal,
): Promise<{ branch: string; commit: string }> {
  const cwd = await repositoryRoot(directory);
  const info = await inspectRepository(cwd);
  if (info.dirty)
    throw new Error(
      "Working tree has uncommitted changes (dirty); preserve or commit them before development",
    );
  if (
    !/^[a-f0-9]{40,64}$/i.test(expectedCommit) ||
    info.commit !== expectedCommit
  )
    throw new Error(
      "Repository HEAD changed since analysis; analyze the task again",
    );
  const targetCommit = await resolveRef(cwd, config, info);
  if (
    expectedTargetCommit !== undefined &&
    (!/^[a-f0-9]{40,64}$/i.test(expectedTargetCommit) ||
      targetCommit !== expectedTargetCommit)
  )
    throw new Error(
      "Selected target branch/tag changed since analysis; analyze again",
    );
  if (signal?.aborted) throw new Error("任务已停止");
  const remote = selectedRemote(config, info);
  const localName = remote?.branch ?? config.base;
  // Resolve refs to assessed commits and never discard user work.
  if (config.mode === "new")
    await run(cwd, [
      "switch",
      "--no-guess",
      "--no-overwrite-ignore",
      "-c",
      config.name,
      targetCommit,
    ]);
  else if (remote && !info.branches.includes(localName)) {
    await run(cwd, [
      "switch",
      "--no-guess",
      "--no-overwrite-ignore",
      "-c",
      localName,
      targetCommit,
    ]);
    await run(cwd, [
      "config",
      "--local",
      `branch.${localName}.remote`,
      remote.remote,
    ]);
    await run(cwd, [
      "config",
      "--local",
      `branch.${localName}.merge`,
      `refs/heads/${remote.branch}`,
    ]);
  } else {
    await run(cwd, [
      "switch",
      "--no-guess",
      "--no-overwrite-ignore",
      localName,
    ]);
    const current = (await run(cwd, ["rev-parse", "HEAD"])).trim();
    if (current !== targetCommit) {
      if (signal?.aborted) throw new Error("任务已停止");
      await run(cwd, [
        "merge",
        "--ff-only",
        "--no-autostash",
        "--no-overwrite-ignore",
        "--",
        targetCommit,
      ]);
    }
  }
  const result = await inspectRepository(cwd);
  if (result.commit !== targetCommit)
    throw new Error("分支在准备期间发生变化，请重新评估");
  return { branch: result.branch, commit: result.commit };
}
async function withGitAccess<T>(
  project: Project,
  secret: string | undefined,
  work: (
    cwd: string,
    repository: string,
    env: NodeJS.ProcessEnv,
    prefix: string[],
  ) => Promise<T>,
): Promise<T> {
  let helperDirectory: string | undefined;
  try {
    const cwd = await repositoryRoot(project.directory);
    let repository =
      project.repository.trim() ||
      (await run(cwd, ["remote", "get-url", "origin"])).trim();
    if (
      !repository ||
      repository.startsWith("-") ||
      /[\r\n\0]/.test(repository)
    )
      throw new Error("Invalid repository address");
    if (
      /^[a-z][a-z0-9+.-]*::/i.test(repository) ||
      (/^[a-z][a-z0-9+.-]*:\/\//i.test(repository) &&
        !/^(https?|ssh|git|file):\/\//i.test(repository))
    )
      throw new Error("Unsupported repository transport");
    if (/^https?:\/\//i.test(repository)) {
      const url = new URL(repository);
      if (url.username || url.password)
        throw new Error(
          "Use the separate credential fields; repository URLs must not contain credentials",
        );
    }
    const env: NodeJS.ProcessEnv = {};
    if (project.auth !== "system") {
      if (!/^https?:\/\//i.test(repository))
        throw new Error(
          "用户名、密码或 Token 认证需要 HTTP/HTTPS 仓库地址；SSH 地址请选择系统 Git 凭据 / SSH",
        );
      if (!secret)
        throw new Error("请先填写并保存 Git 密码或访问令牌，再测试连接");
      if (project.auth === "password" && !project.username.trim())
        throw new Error(
          "用户名与密码认证需要填写 Git 用户名，请填写并保存后重试",
        );
      if (/[\r\n\0]/.test(project.username) || /[\r\n\0]/.test(secret))
        throw new Error("Credential fields must be single line");
      const url = new URL(repository);
      url.username = project.username || "oauth2";
      repository = url.toString();
      helperDirectory = await mkdtemp(join(tmpdir(), "tyflow-askpass-"));
      const helper = join(helperDirectory, "askpass.cjs");
      await writeFile(
        helper,
        "process.stdout.write(process.env.TYFLOW_GIT_SECRET || '');",
        { mode: 0o600 },
      );
      const wrapper = join(
        helperDirectory,
        process.platform === "win32" ? "askpass.cmd" : "askpass",
      );
      // Username is already in the HTTP(S) URL. Ignore Git's prompt entirely so no remote-controlled prompt enters a shell command.
      await writeFile(
        wrapper,
        process.platform === "win32"
          ? '@echo off\r\n"%TYFLOW_NODE_EXECUTABLE%" "%TYFLOW_ASKPASS_SCRIPT%"\r\n'
          : '#!/bin/sh\n"$TYFLOW_NODE_EXECUTABLE" "$TYFLOW_ASKPASS_SCRIPT"\n',
        { mode: 0o700 },
      );
      Object.assign(env, {
        GIT_ASKPASS: wrapper,
        TYFLOW_NODE_EXECUTABLE: process.execPath,
        ELECTRON_RUN_AS_NODE: "1",
        TYFLOW_ASKPASS_SCRIPT: helper,
        TYFLOW_GIT_SECRET: secret,
      });
    }
    return await work(
      cwd,
      repository,
      env,
      project.auth === "system" ? [] : ["-c", "credential.helper="],
    );
  } catch (error) {
    let message =
      error instanceof Error ? error.message : "Git connection failed";
    if (secret) message = message.split(secret).join("[REDACTED]");
    message = message.replace(
      /https?:\/\/[^\s/@]+:[^\s/@]+@/gi,
      "https://[REDACTED]@",
    );
    if (
      project.auth === "system" &&
      /Cannot prompt|could not read Username|could not read Password|terminal prompts disabled|Authentication failed/i.test(
        message,
      )
    ) {
      message =
        "系统 Git 凭据不可用或已失效。请将 Git 认证方式改为「用户名与密码」或「访问令牌 Token」，填写凭据并保存后重试；使用 SSH 时请配置 SSH 仓库地址和本机密钥。客户端不会弹出终端要求输入账号密码。";
    } else if (
      project.auth !== "system" &&
      /Authentication failed|HTTP Basic: Access denied|returned error: (401|403)|could not read Username|could not read Password/i.test(
        message,
      )
    ) {
      message =
        "Git 认证失败，请检查用户名、密码或 Token 以及该仓库的访问权限；若服务器禁用账号密码，请改用访问令牌 Token。";
    }
    throw new Error(message);
  } finally {
    if (helperDirectory)
      await rm(helperDirectory, { recursive: true, force: true });
  }
}

export async function gitConnection(
  project: Project,
  secret?: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    await withGitAccess(project, secret, (cwd, repository, env, prefix) =>
      run(
        cwd,
        [...prefix, "ls-remote", "--heads", "--tags", "--", repository],
        env,
        30000,
      ),
    );
    return {
      ok: true,
      message:
        "Repository connection succeeded (read-only; no branch, commit or push)",
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
function normalizedRepository(value: string) {
  const normalized = value.trim().replaceAll("\\", "/");
  const scp = normalized.includes("://")
    ? null
    : normalized.match(/^(?:[^@/:]+@)?([^/:]+):(.+)$/);
  if (scp && !/^[a-z]:\//i.test(normalized))
    return `${scp[1].toLowerCase()}/${scp[2]}`
      .replace(/\/+$/, "")
      .replace(/\.git$/i, "");
  try {
    const url = new URL(normalized);
    if (["http:", "https:", "ssh:", "git:"].includes(url.protocol)) {
      const port =
        (url.protocol === "ssh:" && url.port === "22") ||
        (url.protocol === "http:" && url.port === "80") ||
        (url.protocol === "https:" && url.port === "443")
          ? ""
          : url.port;
      return `${url.hostname.toLowerCase()}${port ? `:${port}` : ""}/${url.pathname.replace(/^\/+/, "")}`
        .replace(/\/+$/, "")
        .replace(/\.git$/i, "");
    }
  } catch {
    /* Local paths and non-URL Git syntax use normalized text comparison. */
  }
  return normalized.replace(/\/+$/, "").replace(/\.git$/i, "");
}
export function repositoriesMatch(left: string, right: string) {
  return normalizedRepository(left) === normalizedRepository(right);
}
function availableStudioRemote(names: string[]) {
  let candidate = "tingyun-studio";
  let suffix = 2;
  while (names.includes(candidate)) candidate = `tingyun-studio-${suffix++}`;
  return candidate;
}
export async function syncRepository(
  project: Project,
  secret?: string,
  signal?: AbortSignal,
): Promise<RepositoryInfo> {
  const before = await inspectRepository(project.directory);
  if (!project.repository.trim() && !before.remotes?.length) return before;
  if (signal?.aborted) throw new Error("任务已停止");
  return withGitAccess(
    project,
    secret,
    async (cwd, repository, env, prefix) => {
      const names = before.remotes ?? [];
      let remote: string | undefined;
      let addRemote = false;
      const requested = project.repository.trim();
      if (requested) {
        for (const name of names) {
          const url = (await run(cwd, ["remote", "get-url", name])).trim();
          if (repositoriesMatch(url, requested)) {
            remote = name;
            break;
          }
        }
        if (!remote) {
          remote = names.length ? availableStudioRemote(names) : "origin";
          addRemote = true;
        }
      } else remote = "origin";
      if (!names.includes(remote) && !requested)
        throw new Error("未找到 origin，请填写需要同步的仓库地址");
      if (signal?.aborted) throw new Error("任务已停止");
      // An explicit heads refspec fetches all accessible branches, even for single-branch clones.
      // Tags are not part of task targeting. Never let a moved or conflicting tag block branch sync.
      await run(
        cwd,
        [
          ...prefix,
          "fetch",
          "--atomic",
          "--prune",
          "--no-prune-tags",
          "--no-tags",
          "--no-recurse-submodules",
          "--",
          repository,
          "+refs/heads/*:refs/remotes/" + remote + "/*",
        ],
        env,
        120000,
        signal,
      );
      if (signal?.aborted) throw new Error("任务已停止");
      if (addRemote) await run(cwd, ["remote", "add", remote, requested]);
      const mapping = "+refs/heads/*:refs/remotes/" + remote + "/*";
      let mappings = "";
      try {
        mappings = await run(cwd, [
          "config",
          "--get-all",
          `remote.${remote}.fetch`,
        ]);
      } catch {
        /* Remote may have no fetch mapping yet. */
      }
      if (!lines(mappings).includes(mapping))
        await run(cwd, ["config", "--add", `remote.${remote}.fetch`, mapping]);
      const info = await inspectRepository(cwd);
      return {
        ...info,
        syncRemote: remote,
        syncedAt: new Date().toISOString(),
      };
    },
  );
}

export async function commitAndPush(
  project: Project,
  secret: string | undefined,
  branch: string,
  message: string,
  developer: { name: string; email: string },
  existingCommit?: string,
  onCommitted?: (value: {
    commit: string;
    branch: string;
    remote: string;
  }) => void,
): Promise<{ commit: string; branch: string; remote: string }> {
  safeReference(branch);
  const subject = message
    .replace(/[\r\n\0]+/g, " ")
    .trim()
    .slice(0, 200);
  if (!subject) throw new Error("提交说明不能为空");
  return withGitAccess(
    project,
    secret,
    async (cwd, repository, env, prefix) => {
      let info = await inspectRepository(cwd);
      if (info.branch !== branch)
        throw new Error(
          `当前分支为 ${info.branch || "分离 HEAD"}，不是本次开发分支 ${branch}`,
        );
      let commit = existingCommit;
      if (commit) {
        if (info.commit !== commit || info.dirty)
          throw new Error("本地提交后工作区又发生变化，请先核对改动再重试推送");
      } else {
        if (!info.dirty) throw new Error("本次开发没有可提交的代码修改");
        await run(cwd, ["add", "--all"]);
        const staged = await run(cwd, ["diff", "--cached", "--name-only"]);
        if (!staged.trim()) throw new Error("本次开发没有可提交的代码修改");
        const identity = [
          ...(developer.name.trim()
            ? ["-c", `user.name=${developer.name.trim()}`]
            : []),
          ...(developer.email.trim()
            ? ["-c", `user.email=${developer.email.trim()}`]
            : []),
        ];
        await run(cwd, [...identity, "commit", "-m", subject], env, 120000);
        info = await inspectRepository(cwd);
        commit = info.commit;
      }
      const remoteNames = info.remotes ?? [];
      let remote = "origin";
      for (const name of remoteNames) {
        try {
          const url = await run(cwd, ["remote", "get-url", name]);
          if (repositoriesMatch(url, repository)) {
            remote = name;
            break;
          }
        } catch {
          /* Ignore malformed local remote entries and push to the configured URL. */
        }
      }
      onCommitted?.({ commit, branch, remote });
      await run(
        cwd,
        [
          ...prefix,
          "push",
          "--porcelain",
          "--",
          repository,
          `HEAD:refs/heads/${branch}`,
        ],
        env,
        120000,
      );
      if (remoteNames.includes(remote)) {
        await run(cwd, [
          "config",
          "--local",
          `branch.${branch}.remote`,
          remote,
        ]);
        await run(cwd, [
          "config",
          "--local",
          `branch.${branch}.merge`,
          `refs/heads/${branch}`,
        ]);
      }
      return { commit, branch, remote };
    },
  );
}

export async function changedFilesSince(
  directory: string,
  baseCommit: string,
): Promise<
  {
    path: string;
    changeType: "added" | "modified" | "deleted" | "renamed" | "untracked" | "unknown";
  }[]
> {
  const cwd = await repositoryRoot(directory);
  if (!/^[a-f0-9]{40,64}$/i.test(baseCommit))
    throw new Error("Invalid change review base commit");
  const diff = await run(cwd, [
    "diff",
    "--name-status",
    "--find-renames",
    `${baseCommit}..HEAD`,
  ]);
  const porcelain = await run(cwd, [
    "status",
    "--porcelain=v1",
    "--untracked-files=normal",
  ]);
  const result = new Map<
    string,
    "added" | "modified" | "deleted" | "renamed" | "untracked" | "unknown"
  >();
  for (const line of lines(diff)) {
    const [status, first, second] = line.split("\t");
    const file = second || first;
    if (!file) continue;
    result.set(
      file,
      status.startsWith("A")
        ? "added"
        : status.startsWith("M")
          ? "modified"
          : status.startsWith("D")
            ? "deleted"
            : status.startsWith("R")
              ? "renamed"
              : "unknown",
    );
  }
  for (const line of lines(porcelain)) {
    const status = line.slice(0, 2);
    const file = line.slice(3).trim();
    if (!file) continue;
    if (status === "??") result.set(file, "untracked");
    else if (!result.has(file)) result.set(file, "modified");
  }
  return [...result.entries()].map(([file, changeType]) => ({
    path: file,
    changeType,
  }));
}
