import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findCommands,
  resolveCommand,
  runCommand,
  type Command,
  type RunOptions,
} from "./process";

function existingFiles(values: string[]) {
  return values.filter((value) => {
    try {
      return fs.statSync(value).isFile();
    } catch {
      return false;
    }
  });
}

function versionedExecutables(root: string, suffix: string[]) {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name, ...suffix));
  } catch {
    return [];
  }
}

export function findMacCodex(home = os.homedir()): string[] {
  return existingFiles([
    "/Applications/Codex.app/Contents/Resources/codex",
    "/Applications/Codex.app/Contents/Resources/bin/codex",
    path.join(home, "Applications", "Codex.app", "Contents", "Resources", "codex"),
    path.join(home, "Applications", "Codex.app", "Contents", "Resources", "bin", "codex"),
    path.join(home, ".npm-global", "bin", "codex"),
    path.join(home, ".volta", "bin", "codex"),
    path.join(home, ".local", "bin", "codex"),
    path.join(home, ".asdf", "shims", "codex"),
    path.join(home, ".local", "share", "mise", "shims", "codex"),
    ...versionedExecutables(
      path.join(home, ".nvm", "versions", "node"),
      ["bin", "codex"],
    ),
    ...versionedExecutables(
      path.join(home, ".fnm", "node-versions"),
      ["installation", "bin", "codex"],
    ),
  ]);
}

export function withMacExecutablePath(command: Command): Command {
  if (process.platform !== "darwin" || !path.isAbsolute(command.executable))
    return command;
  const directory = path.dirname(command.executable);
  return {
    ...command,
    env: {
      ...command.env,
      PATH: [directory, command.env?.PATH, process.env.PATH]
        .filter(Boolean)
        .join(":"),
    },
  };
}

export function findDesktopCodex(
  localAppData = process.env.LOCALAPPDATA,
): string[] {
  const candidates: string[] = [];
  if (localAppData) {
    const root = path.join(localAppData, "OpenAI", "Codex", "bin");
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const executable = path.join(root, entry.name, "codex.exe");
        if (fs.existsSync(executable)) candidates.push(executable);
      }
    } catch {
      /* Codex Desktop is optional. */
    }
  }
  if (process.platform === "darwin") candidates.push(...findMacCodex());
  return candidates;
}

export async function resolveCodex(
  name: string,
  options: Pick<RunOptions, "cwd" | "signal">,
) {
  const candidates =
    name === "codex"
      ? [name, ...findCommands(name), ...findDesktopCodex()]
      : [name];
  const seen = new Set<string>();
  const compatible: {
    command: ReturnType<typeof resolveCommand>;
    version: string;
    order: number;
    numeric: number[];
  }[] = [];
  let lastError: Error | undefined;
  for (const [order, candidate] of candidates.entries()) {
    if (options.signal?.aborted) throw new Error("任务已停止");
    try {
      const command = withMacExecutablePath(resolveCommand(candidate));
      const identity = JSON.stringify([command.executable, command.args]);
      if (seen.has(identity)) continue;
      seen.add(identity);
      const version = await runCommand(command, ["--version"], {
        ...options,
        timeout: 15000,
      });
      const help = await runCommand(command, ["exec", "--help"], {
        ...options,
        timeout: 15000,
      });
      for (const flag of [
        "--ignore-user-config",
        "--ephemeral",
        "--output-schema",
        "--approve-for-me",
      ])
        if (!help.includes(flag))
          throw new Error(
            `Codex CLI ${version.trim()} 不支持安全执行参数 ${flag}`,
          );
      const match = version.match(/(\d+)\.(\d+)\.(\d+)(?:[-.]([\w.-]+))?/);
      compatible.push({
        command,
        version: version.trim(),
        order,
        numeric: match ? match.slice(1, 4).map(Number) : [0, 0, 0],
      });
    } catch (error) {
      if (options.signal?.aborted) throw new Error("任务已停止");
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  compatible.sort((a, b) => {
    for (let i = 0; i < 3; i++)
      if (a.numeric[i] !== b.numeric[i]) return b.numeric[i] - a.numeric[i];
    return a.order - b.order;
  });
  const selected = compatible[0];
  if (selected)
    return {
      command: selected.command,
      version: selected.version,
      fallback: selected.order > 0,
    };
  throw new Error(
    "没有找到支持隔离评估和安全执行的 Codex CLI：请更新 Codex，或在开发配置中填写新版 Codex CLI 完整路径。\n" +
      (lastError?.message ?? "未找到可用的 Codex CLI"),
  );
}
