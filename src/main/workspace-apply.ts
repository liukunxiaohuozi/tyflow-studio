import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Task } from "../shared/contracts";
import { resolveCommand } from "./process";
import { isTestArtifact } from "./test-artifacts";

const canonical = (directory: string) => {
  const value = fs.realpathSync.native(directory);
  return process.platform === "win32" ? value.toLowerCase() : value;
};
const sameContent = (a: Buffer | undefined, b: Buffer | undefined) => {
  if (!a || !b) return a === b;
  if (a.equals(b)) return true;
  // Git can check out the same text blob with platform-specific line endings.
  return (
    !a.includes(0) &&
    !b.includes(0) &&
    Buffer.from(a.toString("utf8"), "utf8").equals(a) &&
    Buffer.from(b.toString("utf8"), "utf8").equals(b) &&
    a.toString("utf8").replace(/\r\n/g, "\n") ===
      b.toString("utf8").replace(/\r\n/g, "\n")
  );
};
const exactContent = (a: Buffer | undefined, b: Buffer | undefined) =>
  a === undefined || b === undefined ? a === b : a.equals(b);

/** Explicit copy-back only. Never modifies a Git index, branch, commit or task snapshot. */
export async function applyWorkspace(
  workspace: NonNullable<Task["workspace"]>,
  configuredSource: string,
  dataRoot: string,
  id: string,
  signal: AbortSignal,
  allowedFiles?: string[],
) {
  if (
    !/^[\da-f-]{36}$/i.test(id) ||
    !/^[a-f\d]{40,64}$/i.test(workspace.baseCommit)
  )
    throw new Error("任务工作区身份无效");
  const owned = path.join(dataRoot, "workspaces", id);
  if (
    fs.lstatSync(owned).isSymbolicLink() ||
    canonical(workspace.directory) !== canonical(owned) ||
    canonical(workspace.sourceDirectory) !== canonical(configuredSource) ||
    canonical(configuredSource) === canonical(owned)
  )
    throw new Error("任务工作区或原项目目录已变化，请核对配置");
  const command = resolveCommand("git");
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith("GIT_")) delete env[key];
  const git = (cwd: string, args: string[]) =>
    new Promise<Buffer>((resolve, reject) => {
      execFile(
        command.executable,
        [
          ...command.args,
          "--no-optional-locks",
          "--literal-pathspecs",
          "-c",
          "core.fsmonitor=false",
          ...args,
        ],
        {
          cwd,
          env,
          encoding: "buffer",
          timeout: 20000,
          maxBuffer: 8 * 1024 * 1024,
          windowsHide: true,
          signal,
        },
        (error, stdout) => (error ? reject(error) : resolve(stdout)),
      );
    });
  const common = async (cwd: string) =>
    canonical(
      path.resolve(
        cwd,
        (await git(cwd, ["rev-parse", "--git-common-dir"])).toString().trim(),
      ),
    );
  if ((await common(configuredSource)) !== (await common(owned)))
    throw new Error("任务工作区不属于原项目仓库");
  for (const cwd of [configuredSource, owned])
    if (
      canonical(
        (await git(cwd, ["rev-parse", "--show-toplevel"])).toString().trim(),
      ) !== canonical(cwd)
    )
      throw new Error("工作目录不是预期的仓库根目录");
  if (
    (await git(owned, ["branch", "--show-current"])).toString().trim() !==
    workspace.branch
  )
    throw new Error("任务工作区分支已变化");
  const head = (await git(configuredSource, ["rev-parse", "HEAD"]))
    .toString()
    .trim();
  const branch = (await git(configuredSource, ["branch", "--show-current"]))
    .toString()
    .trim();
  if (!branch) throw new Error("原项目处于游离提交，请先选择开发分支");
  const names = new Set(
    [
      ...(
        await git(owned, [
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          "--no-renames",
          "--name-only",
          "-z",
          workspace.baseCommit,
          "--",
        ])
      )
        .toString()
        .split("\0"),
      ...(
        await git(owned, ["ls-files", "--others", "--exclude-standard", "-z"])
      )
        .toString()
        .split("\0")
        .filter((file) => !isTestArtifact(owned, file, "untracked")),
    ].filter(Boolean),
  );
  if (!names.size || names.size > 100)
    throw new Error(
      "没有可应用的改动，或改动超过 100 个文件，请先审查任务工作区",
    );
  if (allowedFiles && [...names].some((file) => !allowedFiles.includes(file)))
    throw new Error("任务文件范围在审查后发生变化，未应用改动");
  let total = 0;
  const read = (root: string, file: string) => {
    let cursor = root;
    const parts = file.split("/");
    for (const [index, part] of parts.entries()) {
      cursor = path.join(cursor, part);
      if (!fs.existsSync(cursor)) {
        // lstat catches dangling links too.
        try {
          fs.lstatSync(cursor);
          throw new Error("文件路径包含符号链接");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return undefined;
      }
      const stat = fs.lstatSync(cursor);
      if (
        stat.isSymbolicLink() ||
        (index < parts.length - 1
          ? !stat.isDirectory()
          : !stat.isFile() || stat.nlink !== 1)
      )
        throw new Error(`不支持链接或特殊文件：${file}`);
      if (index === parts.length - 1 && stat.size > 2 * 1024 * 1024)
        throw new Error(`文件超过 2 MB，请手动审查：${file}`);
    }
    return fs.readFileSync(cursor);
  };
  const entries: {
    file: string;
    before?: Buffer;
    after?: Buffer;
    mode: number;
  }[] = [];
  for (const file of names) {
    if (
      file.includes("\\") ||
      file.includes(":") ||
      file.startsWith("/") ||
      file
        .split("/")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part === ".." ||
            /[\x00-\x1f]/.test(part) ||
            /[. ]$/.test(part) ||
            /^(\.git|node_modules|\.env(?:\..*)?|\.npmrc)$/i.test(part),
        )
    )
      throw new Error(`不支持自动应用此路径：${file}`);
    const tree = (
      await git(owned, ["ls-tree", "-z", workspace.baseCommit, "--", file])
    ).toString();
    const match = tree.match(/^(100644|100755) blob ([a-f\d]+)\t/);
    if (tree && !match) throw new Error(`不支持链接或子模块：${file}`);
    const base = match
      ? await git(owned, ["cat-file", "blob", match[2]])
      : undefined;
    if (base && base.length > 2 * 1024 * 1024)
      throw new Error(`基线文件超过 2 MB：${file}`);
    const before = read(configuredSource, file),
      after = read(owned, file);
    total += (base?.length ?? 0) + (before?.length ?? 0) + (after?.length ?? 0);
    if (total > 20 * 1024 * 1024)
      throw new Error("改动内容超过 20 MB，请手动审查");
    if (!sameContent(before, after) && !sameContent(before, base))
      throw new Error(`原项目文件与任务基线冲突，未应用任何改动：${file}`);
    entries.push({
      file,
      before,
      after,
      mode: match?.[1] === "100755" ? 0o755 : 0o644,
    });
  }
  const backup = path.join(
    dataRoot,
    "workspace-applications",
    id,
    randomUUID(),
  );
  if (entries.every((entry) => sameContent(entry.before, entry.after)))
    return {
      files: [...names],
      backup: "",
      alreadyApplied: true,
      branch,
      sourceHead: head,
    };
  const status = (
    await git(configuredSource, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ])
  ).toString();
  if (status)
    throw new Error(
      "原项目存在未提交修改，请先提交或暂存到安全位置后再应用；不会覆盖现有修改",
    );
  fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
  entries.forEach((entry, index) => {
    if (entry.before)
      fs.writeFileSync(path.join(backup, `${index}.before`), entry.before, {
        flag: "wx",
        mode: 0o600,
      });
  });
  const receipt = {
    source: configuredSource,
    branch,
    head,
    files: entries.map(({ file, before, after }) => ({
      file,
      existed: before !== undefined,
      deleted: after === undefined,
    })),
  };
  fs.writeFileSync(
    path.join(backup, "receipt.json"),
    JSON.stringify(receipt, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  // Recheck after asynchronous Git work, then perform the bounded local transaction without yielding.
  if (
    (await git(configuredSource, ["rev-parse", "HEAD"])).toString().trim() !==
      head ||
    (await git(configuredSource, ["branch", "--show-current"]))
      .toString()
      .trim() !== branch ||
    (
      await git(configuredSource, [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
      ])
    ).toString()
  )
    throw new Error("原项目在准备过程中发生变化，未应用改动");
  for (const entry of entries)
    if (
      !exactContent(read(configuredSource, entry.file), entry.before) ||
      !exactContent(read(owned, entry.file), entry.after)
    )
      throw new Error(`文件在准备过程中发生变化，未应用改动：${entry.file}`);
  if (signal.aborted) throw new Error("应用已取消，未修改原项目");
  const written: typeof entries = [],
    createdDirectories: string[] = [];
  const replace = (file: string, bytes: Buffer, mode: number) => {
    const temporary = `${file}.studio-${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, bytes, { flag: "wx", mode });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  };
  try {
    for (const entry of entries) {
      const file = path.join(configuredSource, entry.file);
      let parent = path.dirname(file);
      const missing: string[] = [];
      while (!fs.existsSync(parent)) {
        missing.unshift(parent);
        parent = path.dirname(parent);
      }
      for (const dir of missing) {
        fs.mkdirSync(dir);
        createdDirectories.push(dir);
      }
      if (entry.after) replace(file, entry.after, entry.mode);
      else if (fs.existsSync(file)) fs.unlinkSync(file);
      written.push(entry);
    }
  } catch (error) {
    let restored = true;
    for (const entry of written.reverse()) {
      try {
        const file = path.join(configuredSource, entry.file);
        if (!sameContent(read(configuredSource, entry.file), entry.after)) {
          restored = false;
          continue;
        }
        if (entry.before) replace(file, entry.before, entry.mode);
        else fs.unlinkSync(file);
      } catch {
        restored = false;
      }
    }
    for (const dir of createdDirectories.reverse()) {
      try {
        fs.rmdirSync(dir);
      } catch {
        /* Never delete nonempty directories. */
      }
    }
    throw new Error(
      `${restored ? "应用失败，已撤回本次写入" : "应用中断，请先检查原项目与备份，勿直接重试"}；备份：${backup}；${(error as Error).message}`,
    );
  }
  return {
    files: [...names],
    backup,
    alreadyApplied: false,
    branch,
    sourceHead: head,
  };
}
