import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import {
  executablePath,
  findCommands,
  resolveCommand,
  runCommand,
  ProcessExecutionError,
  killTree,
} from "../src/main/process";

jest.setTimeout(15000);
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tyflow-process-test-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
function script(source: string) {
  const file = path.join(root, "command.js");
  fs.writeFileSync(file, source);
  return resolveCommand(file);
}

test("streams separate stdout/stderr lines, including unterminated final lines, and passes stdin literally", async () => {
  const lines: [string, boolean][] = [];
  const command = script(
    "let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',()=>{process.stdout.write('first\\r\\n'+input);process.stderr.write('diagnostic\\nlast error');});",
  );
  const input = "literal $(no-shell) & data";
  const output = await runCommand(command, [], {
    cwd: root,
    input,
    onLine: (line, error) => lines.push([line, error]),
  });
  expect(output).toBe("first\r\n" + input);
  expect(lines).toEqual(
    expect.arrayContaining([
      ["first", false],
      [input, false],
      ["diagnostic", true],
      ["last error", true],
    ]),
  );
});

test("nonzero exit reports captured stderr rather than a successful result", async () => {
  await expect(
    runCommand(
      script(
        "console.error('independent failure evidence');process.exitCode=23;",
      ),
      [],
      { cwd: root },
    ),
  ).rejects.toThrow(/退出码 23.*independent failure evidence/s);
});

test("timeout terminates a running process and reports the timeout", async () => {
  await expect(
    runCommand(script("setInterval(()=>{},1000);"), [], {
      cwd: root,
      timeout: 700,
    }),
  ).rejects.toThrow(/超时/);
});

test("explicit null deadline installs no fallback timer while ordinary commands retain theirs", async () => {
  const timers = jest.spyOn(global, "setTimeout");
  try {
    const command = script("setTimeout(()=>console.log('complete'),150)");
    await expect(
      runCommand(command, [], { cwd: root, timeout: null }),
    ).resolves.toContain("complete");
    expect(timers.mock.calls.some(([, ms]) => ms === 600000)).toBe(false);
    timers.mockClear();
    await runCommand(command, [], { cwd: root });
    expect(timers.mock.calls.some(([, ms]) => ms === 600000)).toBe(true);
  } finally {
    timers.mockRestore();
  }
});

test("no-deadline execution still obeys manual cancellation during reconnect", async () => {
  const controller = new AbortController();
  await expect(
    runCommand(script("console.log('retrying');setInterval(()=>{},1000)"), [], {
      cwd: root,
      timeout: null,
      idleTimeout: 0,
      signal: controller.signal,
      onLine: (line) => {
        if (line === "retrying") controller.abort();
      },
    }),
  ).rejects.toMatchObject({ reason: "CANCELLED" });
});

test("idle watchdog warns and terminates silent commands with a recoverable reason", async () => {
  const warnings: number[] = [];
  await expect(
    runCommand(script("setInterval(()=>{},1000)"), [], {
      cwd: root,
      idleWarningAfter: 200,
      idleTimeout: 700,
      onIdle: (ms) => warnings.push(ms),
    }),
  ).rejects.toMatchObject({ reason: "IDLE_TIMEOUT" });
  expect(warnings.length).toBeGreaterThan(0);
});

test("partial stdout chunks reset idle timeout even without line breaks", async () => {
  const activity: string[] = [];
  const output = await runCommand(
    script(
      "const timer=setInterval(()=>process.stdout.write('.'),100);setTimeout(()=>{clearInterval(timer)},1100)",
    ),
    [],
    {
      cwd: root,
      idleTimeout: 500,
      onActivity: (at) => activity.push(at),
    },
  );
  expect(output.length).toBeGreaterThan(5);
  expect(activity.length).toBeGreaterThan(5);
});

test("connection loss is classified separately from abnormal exit", async () => {
  try {
    await runCommand(
      script("console.error('ECONNRESET socket hang up');process.exitCode=7"),
      [],
      { cwd: root },
    );
    throw new Error("Expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(ProcessExecutionError);
    expect(error).toMatchObject({ reason: "NETWORK_LOST", exitCode: 7 });
  }
});

test("abort after output stops the subprocess and reports cancellation", async () => {
  const controller = new AbortController();
  await expect(
    runCommand(script("console.log('ready');setInterval(()=>{},1000);"), [], {
      cwd: root,
      signal: controller.signal,
      onLine: (line) => {
        if (line === "ready") controller.abort();
      },
    }),
  ).rejects.toThrow(/已停止/);
});

test("already-cancelled execution never launches its command", async () => {
  const marker = path.join(root, "must-not-exist");
  const controller = new AbortController();
  controller.abort();
  await expect(
    runCommand(
      script(
        `require('node:fs').writeFileSync(${JSON.stringify(marker)},'launched')`,
      ),
      [],
      { cwd: root, signal: controller.signal },
    ),
  ).rejects.toThrow(/已停止/);
  expect(fs.existsSync(marker)).toBe(false);
});

test("chunk boundaries preserve non-ASCII process logs", async () => {
  const lines: string[] = [];
  const output = await runCommand(
    script(
      "const b=Buffer.from('测试日志\\n');process.stdout.write(b.subarray(0,1));setTimeout(()=>process.stdout.write(b.subarray(1)),80);",
    ),
    [],
    { cwd: root, onLine: (line) => lines.push(line) },
  );
  expect(output).toBe("测试日志\n");
  expect(lines).toEqual(["测试日志"]);
});

test("unrecognized shell scripts cannot be used as executable configuration", () => {
  const file = path.join(root, "arbitrary.cmd");
  fs.writeFileSync(file, "@echo off");
  expect(() => resolveCommand(file)).toThrow(/不执行任意 shell 脚本/);
});

test("macOS child PATH includes the configured Agent's Node bin and common GUI-missing locations", () => {
  const home = "/Users/fixture";
  const nodeBin = path.posix.join(
    home,
    ".nvm",
    "versions",
    "node",
    "v22.21.0",
    "bin",
  );
  const value = executablePath(
    path.posix.join(nodeBin, "codex"),
    "/usr/bin:/bin",
    "darwin",
    home,
  ).split(":");
  expect(value[0]).toBe(nodeBin);
  expect(value).toEqual(
    expect.arrayContaining([nodeBin, "/usr/bin", "/opt/homebrew/bin"]),
  );
  expect(value.filter((entry) => entry === nodeBin)).toHaveLength(1);
});

(process.platform === "win32" ? test : test.skip)(
  "Windows shutdown finishes killing the owned Node descendants before returning",
  async () => {
    const child = spawn(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process');const nested=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});console.log(nested.pid);setInterval(()=>{},1000);",
      ],
      { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      const descendant = await new Promise<number>((resolve, reject) => {
        child.once("error", reject);
        child.stdout!.once("data", (value) =>
          resolve(Number(value.toString().trim())),
        );
      });
      expect(descendant).toBeGreaterThan(0);
      killTree(child);
      expect(() => process.kill(descendant, 0)).toThrow();
    } finally {
      killTree(child);
    }
  },
);

(process.platform === "win32" ? test : test.skip)(
  "Windows CLI discovery skips extensionless Unix shims and preserves PATH priority",
  () => {
    const second = path.join(root, "second");
    fs.mkdirSync(second);
    fs.writeFileSync(path.join(root, "codex"), "#!/bin/sh");
    fs.writeFileSync(path.join(root, "codex.cmd"), "@echo off");
    fs.writeFileSync(path.join(second, "codex.exe"), "fixture");
    const previous = process.env.PATH;
    process.env.PATH = [root, second, root].join(path.delimiter);
    try {
      expect(findCommands("codex")).toEqual([
        path.join(root, "codex.cmd"),
        path.join(second, "codex.exe"),
      ]);
    } finally {
      if (previous === undefined) delete process.env.PATH;
      else process.env.PATH = previous;
    }
  },
);

(process.platform === "win32" ? test.skip : test)(
  "POSIX cancellation escalates an ignored SIGTERM to SIGKILL within a bounded time",
  async () => {
    const controller = new AbortController();
    let child: ChildProcess | undefined;
    let abortedAt = 0;
    await expect(
      runCommand(
        script(
          "process.on('SIGTERM',()=>{});console.log('signal-handler-ready');setInterval(()=>{},1000);",
        ),
        [],
        {
          cwd: root,
          signal: controller.signal,
          onChild: (spawned) => {
            child = spawned;
          },
          onLine: (line) => {
            if (line === "signal-handler-ready") {
              abortedAt = Date.now();
              controller.abort();
            }
          },
          timeout: 10000,
        },
      ),
    ).rejects.toThrow(/已停止/);
    expect(abortedAt).toBeGreaterThan(0);
    expect(Date.now() - abortedAt).toBeLessThan(6000);
    expect(child?.signalCode).toBe("SIGKILL");
  },
);
