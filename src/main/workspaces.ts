import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Project, Task } from "../shared/contracts";
import { inspectRepository } from "./git";
import { resolveCommand, runCommand } from "./process";

export async function prepareWorkspace(
  project: Project,
  task: Task,
  root: string,
  signal: AbortSignal,
) {
  if (!task.targetCommit || !/^[a-f0-9]{40,64}$/i.test(task.targetCommit))
    throw new Error("任务评估版本缺失");
  if (!/^[\da-f-]{36}$/i.test(task.id)) throw new Error("任务 ID 无效");
  const directory = path.join(root, "workspaces", task.id);
  // Each task owns a new branch, including when the user chose an existing branch as its baseline.
  const branch =
    task.branch.mode === "new" ? task.branch.name : `studio/task-${task.id}`;
  if (fs.existsSync(directory)) {
    const common = async (cwd: string) =>
      fs.realpathSync.native(
        path.resolve(
          cwd,
          (
            await runCommand(
              resolveCommand("git"),
              ["rev-parse", "--git-common-dir"],
              { cwd, signal },
            )
          ).trim(),
        ),
      );
    const info = await inspectRepository(directory);
    if (
      (await common(directory)) !== (await common(project.directory)) ||
      info.branch !== branch ||
      info.commit !== task.targetCommit
    )
      throw new Error("任务工作区与评估快照不一致，请检查后重试");
  } else {
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    await runCommand(
      resolveCommand("git"),
      ["worktree", "add", "-b", branch, directory, task.targetCommit],
      { cwd: project.directory, signal },
    );
  }
  // Carry only ignored local runtime configuration, never source modifications or dependency links.
  for (const name of [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".npmrc",
  ]) {
    const source = path.join(project.directory, name),
      destination = path.join(directory, name);
    if (
      !fs.existsSync(source) ||
      fs.existsSync(destination) ||
      !fs.lstatSync(source).isFile()
    )
      continue;
    try {
      await runCommand(
        resolveCommand("git"),
        ["check-ignore", "-q", "--", name],
        { cwd: directory, signal },
      );
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    } catch {
      if (signal.aborted) throw new Error("任务已停止");
    }
  }
  return {
    directory,
    sourceDirectory: project.directory,
    branch,
    baseCommit: task.targetCommit,
  };
}

export async function installWorkspaceDependencies(
  directory: string,
  signal: AbortSignal,
  log: (line: string) => void,
  preferredCommand = "",
) {
  const file = path.join(directory, "package.json");
  if (!fs.existsSync(file)) return;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length)
    return;
  const hash = createHash("sha256").update(fs.readFileSync(file));
  for (const lock of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"])
    if (fs.existsSync(path.join(directory, lock)))
      hash.update(fs.readFileSync(path.join(directory, lock)));
  const identity = hash.digest("hex");
  const marker = path.join(directory, "node_modules", ".studio-dependencies");
  if (fs.existsSync(marker) && fs.readFileSync(marker, "utf8") === identity)
    return;
  const manager =
    pkg.packageManager?.split("@")[0] ||
    (fs.existsSync(path.join(directory, "pnpm-lock.yaml"))
      ? "pnpm"
      : fs.existsSync(path.join(directory, "yarn.lock"))
        ? "yarn"
        : "npm");
  if (!["npm", "pnpm", "yarn"].includes(manager))
    throw new Error(`请在任务工作目录中安装依赖：${directory}`);
  const args =
    manager === "npm"
      ? fs.existsSync(path.join(directory, "package-lock.json"))
        ? ["ci", "--no-audit", "--no-fund"]
        : ["install", "--package-lock=false", "--no-audit", "--no-fund"]
      : [
          "install",
          manager === "pnpm" || /^yarn@1\./.test(pkg.packageManager ?? "")
            ? "--frozen-lockfile"
            : "--immutable",
        ];
  log(`为任务安装独立依赖：${manager} ${args.join(" ")}`);
  await runCommand(resolveCommand(manager, preferredCommand), args, {
    cwd: directory,
    signal,
    timeout: 15 * 60_000,
    onLine: (line) => log(line),
  });
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, identity);
}
