import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { StringDecoder } from "node:string_decoder";
export interface Command {
  executable: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}
export function which(name: string): string | undefined {
  return findCommands(name)[0];
}
export function findCommands(name: string): string[] {
  if (path.isAbsolute(name)) return fs.existsSync(name) ? [name] : [];
  const matches: string[] = [];
  const directories = (process.env.PATH ?? "").split(path.delimiter);
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
export function resolveCommand(command: string): Command {
  const executable = which(command);
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
    };
    const js = known[base];
    const node = which("node");
    if (js && node && fs.existsSync(js))
      return { executable: node, args: [js] };
    throw new Error(
      "请选择原生可执行文件，或受支持的 codex / npm 命令；不执行任意 shell 脚本",
    );
  }
  if (/\.m?js$/i.test(executable)) {
    const node = which("node");
    if (!node) throw new Error("请安装 Node.js");
    return { executable: node, args: [executable] };
  }
  return { executable, args: [] };
}
export function killTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => child.kill());
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
  env?: NodeJS.ProcessEnv;
  onLine?: (line: string, error: boolean) => void;
  onChild?: (child: ChildProcess) => void;
}
export async function runCommand(
  command: Command,
  args: string[],
  options: RunOptions,
): Promise<string> {
  if (options.signal?.aborted) throw new Error("任务已停止");
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
    let timedOut = false;
    let terminationTimer: NodeJS.Timeout | undefined;
    const buffers = ["", ""];
    const decoders = [new StringDecoder("utf8"), new StringDecoder("utf8")];
    const consume = (chunk: Buffer, index: number) => {
      if (settled) return;
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
      terminationTimer ??= setTimeout(
        () => finish(new Error(timedOut ? "命令执行超时" : "任务已停止")),
        5000,
      );
    };
    const abort = () => terminate();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, options.timeout ?? 600_000);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
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
    child.on("error", (e) => finish(e));
    child.on("close", (code) =>
      finish(
        options.signal?.aborted
          ? new Error("任务已停止")
          : timedOut
            ? new Error("命令执行超时")
            : code !== 0
              ? new Error(`命令退出码 ${code}: ${stderr.slice(-1500)}`)
              : undefined,
      ),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(options.input ?? "");
  });
}
