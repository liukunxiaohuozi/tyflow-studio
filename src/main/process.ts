import { spawn, spawnSync, ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { StringDecoder } from "node:string_decoder";
export interface Command {
  executable: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}
function childDirectories(
  root: string,
  suffix: string[],
  paths: typeof path.posix | typeof path.win32 = path,
) {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => paths.join(root, entry.name, ...suffix));
  } catch {
    return [];
  }
}
export function executablePath(
  preferredCommand = "",
  current = process.env.PATH ?? "",
  platform = process.platform,
  home = os.homedir(),
) {
  const separator = platform === "win32" ? ";" : ":";
  const paths = platform === "win32" ? path.win32 : path.posix;
  const preferred = preferredCommand.trim();
  const directories = [
    paths.isAbsolute(preferred) ? paths.dirname(preferred) : "",
    ...current.split(separator),
  ];
  if (platform === "darwin")
    directories.push(
      "/opt/homebrew/bin",
      "/usr/local/bin",
      paths.join(home, ".npm-global", "bin"),
      paths.join(home, ".volta", "bin"),
      paths.join(home, ".local", "bin"),
      paths.join(home, ".asdf", "shims"),
      paths.join(home, ".local", "share", "mise", "shims"),
      ...childDirectories(
        paths.join(home, ".nvm", "versions", "node"),
        ["bin"],
        paths,
      ),
      ...childDirectories(
        paths.join(home, ".fnm", "node-versions"),
        ["installation", "bin"],
        paths,
      ),
    );
  return [...new Set(directories.filter(Boolean))].join(separator);
}
export function which(name: string, searchPath?: string): string | undefined {
  return findCommands(name, searchPath)[0];
}
export function findCommands(
  name: string,
  searchPath = executablePath(),
): string[] {
  if (path.isAbsolute(name)) return fs.existsSync(name) ? [name] : [];
  const matches: string[] = [];
  const directories = searchPath.split(path.delimiter);
  if (process.platform === "darwin")
    directories.push(
      "/opt/homebrew/bin",
      "/usr/local/bin",
      path.join(os.homedir(), ".local", "bin"),
    );
  const extensions =
    process.platform === "win32" ? [".exe", ".cmd", ".bat"] : [""];
  for (const dir of directories)
    for (const ext of extensions) {
      const candidate = path.join(
        dir,
        name.endsWith(ext) && ext ? name : name + ext,
      );
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile())
        matches.push(candidate);
    }
  return [...new Set(matches)];
}
export function resolveCommand(
  command: string,
  preferredCommand = "",
): Command {
  const searchPath = executablePath(preferredCommand);
  const executable = which(command, searchPath);
  if (!executable)
    throw new Error(`找不到命令 ${command}，请在开发配置中填写可执行文件路径`);
  if (/\.(cmd|bat|ps1)$/i.test(executable)) {
    // Resolve trusted npm shims to their Node entry without invoking cmd.exe or PowerShell.
    const dir = path.dirname(executable);
    const base = path.basename(executable).split(".")[0].toLowerCase();
    const known: Record<string, string> = {
      codex: path.join(
        dir,
        "node_modules",
        "@openai",
        "codex",
        "bin",
        "codex.js",
      ),
      npm: path.join(dir, "node_modules", "npm", "bin", "npm-cli.js"),
      pnpm: path.join(dir, "node_modules", "pnpm", "bin", "pnpm.cjs"),
      yarn: path.join(dir, "node_modules", "yarn", "bin", "yarn.js"),
    };
    const js = [
      known[base],
      ...(["pnpm", "yarn"].includes(base)
        ? [path.join(dir, "node_modules", "corepack", "dist", `${base}.js`)]
        : []),
    ].find((candidate) => candidate && fs.existsSync(candidate));
    const node = which("node", searchPath);
    if (js && node && fs.existsSync(js))
      return {
        executable: node,
        args: [js],
        ...(preferredCommand ? { env: { PATH: searchPath } } : {}),
      };
    throw new Error(
      "请选择原生可执行文件，或受支持的 codex / npm 命令；不执行任意 shell 脚本",
    );
  }
  if (/\.m?js$/i.test(executable)) {
    const node = which("node", searchPath);
    if (!node) throw new Error("请安装 Node.js");
    return {
      executable: node,
      args: [executable],
      ...(preferredCommand ? { env: { PATH: searchPath } } : {}),
    };
  }
  return {
    executable,
    args: [],
    ...(preferredCommand ? { env: { PATH: searchPath } } : {}),
  };
}
export function killTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    // Finish tree termination before Electron exits; an asynchronous taskkill
    // can itself be terminated with the app, leaving npm's Node descendants alive.
    const killer = spawnSync(
      "taskkill",
      ["/pid", String(child.pid), "/T", "/F"],
      {
        windowsHide: true,
        stdio: "ignore",
        timeout: 5000,
      },
    );
    if (killer.error) child.kill();
  } else {
    const group = child.pid;
    try {
      process.kill(-group, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
    setTimeout(() => {
      try {
        process.kill(-group, "SIGKILL");
      } catch {
        /* Process group has already exited. */
      }
    }, 1500).unref();
  }
}
export interface RunOptions {
  cwd: string;
  signal?: AbortSignal;
  input?: string;
  timeout?: number;
  idleTimeout?: number;
  idleWarningAfter?: number;
  onActivity?: (at: string) => void;
  onIdle?: (elapsedMs: number) => void;
  env?: NodeJS.ProcessEnv;
  onLine?: (line: string, error: boolean) => void;
  onChild?: (child: ChildProcess) => void;
}
export class ProcessExecutionError extends Error {
  constructor(
    public reason:
      | "START_FAILED"
      | "IDLE_TIMEOUT"
      | "TOTAL_TIMEOUT"
      | "NETWORK_LOST"
      | "ABNORMAL_EXIT"
      | "CANCELLED",
    message: string,
    public exitCode: number | null = null,
    public lastOutputAt = new Date().toISOString(),
    public durationMs = 0,
  ) {
    super(message);
    this.name = "ProcessExecutionError";
  }
}
export async function runCommand(
  command: Command,
  args: string[],
  options: RunOptions,
): Promise<string> {
  if (options.signal?.aborted)
    throw new ProcessExecutionError("CANCELLED", "任务已停止");
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, [...command.args, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...command.env, ...options.env },
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    options.onChild?.(child);
    let stdout = "";
    let stderr = "";
    let settled = false;
    const startedAt = Date.now();
    let lastActivity = startedAt;
    let timeoutReason: "IDLE_TIMEOUT" | "TOTAL_TIMEOUT" | undefined;
    let idleTimer: NodeJS.Timeout | undefined;
    let warningTimer: NodeJS.Timeout | undefined;
    let terminationTimer: NodeJS.Timeout | undefined;
    const buffers = ["", ""];
    const decoders = [new StringDecoder("utf8"), new StringDecoder("utf8")];
    const consume = (chunk: Buffer, index: number) => {
      if (settled) return;
      lastActivity = Date.now();
      options.onActivity?.(new Date(lastActivity).toISOString());
      resetIdle();
      const value = decoders[index].write(chunk);
      if (index === 0) stdout = (stdout + value).slice(-2_000_000);
      else stderr = (stderr + value).slice(-20_000);
      buffers[index] += value;
      const lines = buffers[index].split(/\r?\n/);
      buffers[index] = lines.pop() ?? "";
      for (const line of lines)
        options.onLine?.(line.slice(0, 12000), index === 1);
      if (buffers[index].length > 12000) {
        options.onLine?.(buffers[index].slice(0, 12000), index === 1);
        buffers[index] = "";
      }
    };
    child.stdout.on("data", (b) => consume(b, 0));
    child.stderr.on("data", (b) => consume(b, 1));
    const terminate = () => {
      killTree(child);
      terminationTimer ??= setTimeout(() => finish(processError()), 5000);
    };
    const abort = () => terminate();
    const processError = (code: number | null = null) => {
      const reason = options.signal?.aborted
        ? "CANCELLED"
        : (timeoutReason ??
          (/ECONNRESET|ENETUNREACH|ETIMEDOUT|EAI_AGAIN|socket hang up|connection (?:reset|closed)/i.test(
            stderr + stdout,
          )
            ? "NETWORK_LOST"
            : "ABNORMAL_EXIT"));
      const message =
        reason === "CANCELLED"
          ? "任务已停止"
          : reason === "IDLE_TIMEOUT"
            ? "命令长时间无输出，已暂停执行并保留当前代码；可检查日志后重试"
            : reason === "TOTAL_TIMEOUT"
              ? "命令执行超时"
              : `命令退出码 ${code}: ${stderr.slice(-1500)}`;
      return new ProcessExecutionError(
        reason,
        message,
        code,
        new Date(lastActivity).toISOString(),
        Date.now() - startedAt,
      );
    };
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (warningTimer) clearTimeout(warningTimer);
      if (options.idleTimeout)
        idleTimer = setTimeout(() => {
          timeoutReason ??= "IDLE_TIMEOUT";
          terminate();
        }, options.idleTimeout);
      if (options.idleWarningAfter && options.onIdle)
        warningTimer = setTimeout(
          () => options.onIdle?.(Date.now() - lastActivity),
          options.idleWarningAfter,
        );
    };
    resetIdle();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timeoutReason ??= "TOTAL_TIMEOUT";
      terminate();
    }, options.timeout ?? 600_000);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (idleTimer) clearTimeout(idleTimer);
      if (warningTimer) clearTimeout(warningTimer);
      if (terminationTimer) clearTimeout(terminationTimer);
      options.signal?.removeEventListener("abort", abort);
      buffers.forEach((s, i) => {
        const tail = decoders[i].end();
        if (i === 0) stdout += tail;
        const line = s + tail;
        if (line) options.onLine?.(line, i === 1);
      });
      if (error) reject(error);
      else resolve(stdout);
    };
    child.on("error", (e) =>
      finish(
        new ProcessExecutionError(
          "START_FAILED",
          e.message,
          null,
          new Date(lastActivity).toISOString(),
          Date.now() - startedAt,
        ),
      ),
    );
    child.on("close", (code) =>
      finish(
        options.signal?.aborted
          ? processError(code)
          : timeoutReason
            ? processError(code)
            : code !== 0
              ? processError(code)
              : undefined,
      ),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(options.input ?? "");
  });
}
