import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findDesktopCodex,
  findMacCodex,
  resolveCodex,
} from "../src/main/codex";
import { findCommands, resolveCommand, runCommand } from "../src/main/process";

jest.mock("../src/main/process", () => ({
  findCommands: jest.fn(),
  resolveCommand: jest.fn(),
  runCommand: jest.fn(),
}));
const run = jest.mocked(runCommand);
const compatibleHelp =
  "--ignore-user-config --ephemeral --output-schema --approve-for-me";

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(findCommands).mockReturnValue(["old-cli", "new-cli"]);
  jest.mocked(resolveCommand).mockImplementation((name) => ({
    executable: name === "codex" ? "old-cli" : name,
    args: [],
  }));
  run.mockImplementation(async (command, args) =>
    args[0] === "--version"
      ? command.executable === "new-cli"
        ? "codex-cli 0.154.0-alpha.6.2"
        : "codex-cli 0.141.0"
      : compatibleHelp,
  );
});

test("default Codex selects the newest compatible installation instead of the first PATH entry", async () => {
  const result = await resolveCodex("codex", { cwd: "fixture" });
  expect(result.command.executable).toBe("new-cli");
  expect(result.version).toBe("codex-cli 0.154.0-alpha.6.2");
  expect(result.fallback).toBe(true);
  expect(
    run.mock.calls.every(
      (call) =>
        call[1][0] === "--version" || call[1].join(" ") === "exec --help",
    ),
  ).toBe(true);
});

test("discovers the Codex Desktop executable outside PATH", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-desktop-find-"));
  const executable = path.join(
    root,
    "OpenAI",
    "Codex",
    "bin",
    "desktop-build",
    "codex.exe",
  );
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(executable, "fixture");
  expect(findDesktopCodex(root)).toContain(executable);
  fs.rmSync(root, { recursive: true, force: true });
});

test("discovers Codex installed by common macOS Node managers outside GUI PATH", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mac-find-"));
  const candidates = [
    path.join(home, ".nvm", "versions", "node", "v24.1.0", "bin", "codex"),
    path.join(home, ".fnm", "node-versions", "v24.1.0", "installation", "bin", "codex"),
    path.join(home, ".volta", "bin", "codex"),
    path.join(home, ".local", "bin", "codex"),
  ];
  for (const candidate of candidates) {
    fs.mkdirSync(path.dirname(candidate), { recursive: true });
    fs.writeFileSync(candidate, "fixture");
  }
  expect(findMacCodex(home)).toEqual(expect.arrayContaining(candidates));
  fs.rmSync(home, { recursive: true, force: true });
});

test("a single compatible default CLI is preserved", async () => {
  jest.mocked(findCommands).mockReturnValue(["old-cli"]);
  const result = await resolveCodex("codex", { cwd: "fixture" });
  expect(result.command.executable).toBe("old-cli");
  expect(result.fallback).toBe(false);
});

test("explicit CLI choices are never silently replaced", async () => {
  const result = await resolveCodex("custom-cli", { cwd: "fixture" });
  expect(result.command.executable).toBe("custom-cli");
  expect(run).toHaveBeenCalledTimes(2);
});

test("CLI without isolation support is skipped before a prompt is sent", async () => {
  run.mockImplementation(async (command, args) => {
    if (args[0] === "--version")
      return command.executable === "new-cli"
        ? "codex-cli 0.154.0"
        : "codex-cli 0.130.0";
    return command.executable === "new-cli"
      ? compatibleHelp
      : "--output-schema";
  });
  const result = await resolveCodex("codex", { cwd: "fixture" });
  expect(result.command.executable).toBe("new-cli");
});

test("all unsupported installations produce actionable diagnostics", async () => {
  run.mockImplementation(async (_command, args) =>
    args[0] === "--version" ? "codex-cli 0.130.0" : "--output-schema",
  );
  await expect(resolveCodex("codex", { cwd: "fixture" })).rejects.toThrow(
    /安全执行.*更新 Codex/s,
  );
});

test("abort during probing prevents selection", async () => {
  const controller = new AbortController();
  run.mockImplementation(async () => {
    controller.abort();
    throw new Error("stopped");
  });
  await expect(
    resolveCodex("codex", { cwd: "fixture", signal: controller.signal }),
  ).rejects.toThrow(/已停止/);
  expect(run).toHaveBeenCalledTimes(1);
});
