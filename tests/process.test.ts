import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { findCommands, resolveCommand, runCommand } from "../src/main/process";

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

(process.platform === "win32" ? test : test.skip)("Windows CLI discovery skips extensionless Unix shims and preserves PATH priority", () => {
  const second = path.join(root, "second");
  fs.mkdirSync(second);
  fs.writeFileSync(path.join(root, "codex"), "#!/bin/sh");
  fs.writeFileSync(path.join(root, "codex.cmd"), "@echo off");
  fs.writeFileSync(path.join(second, "codex.exe"), "fixture");
  const previous = process.env.PATH;
  process.env.PATH = [root, second, root].join(path.delimiter);
  try {
    expect(findCommands("codex")).toEqual([path.join(root, "codex.cmd"), path.join(second, "codex.exe")]);
  } finally {
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
  }
});

(process.platform === "win32" ? test.skip : test)("POSIX cancellation escalates an ignored SIGTERM to SIGKILL within a bounded time", async () => {
  const controller = new AbortController();
  let child: ChildProcess | undefined;
  let abortedAt = 0;
  await expect(runCommand(script("process.on('SIGTERM',()=>{});console.log('signal-handler-ready');setInterval(()=>{},1000);"), [], {
    cwd: root,
    signal: controller.signal,
    onChild: spawned => { child = spawned; },
    onLine: line => { if (line === "signal-handler-ready") { abortedAt = Date.now(); controller.abort(); } },
    timeout: 10000,
  })).rejects.toThrow(/已停止/);
  expect(abortedAt).toBeGreaterThan(0);
  expect(Date.now() - abortedAt).toBeLessThan(6000);
  expect(child?.signalCode).toBe("SIGKILL");
});
