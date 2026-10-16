// Explicit live-service smoke: real Electron system proxy + production AgentProvider.
// Uses an empty disposable directory and a constant prompt; no business project or notification.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const esbuild = require("esbuild");
const { randomUUID } = require("node:crypto");
async function main() {
  const root = path.resolve(__dirname, "..");
  const readOnly = process.env.STUDIO_PROBE_READ_ONLY === "1";
  const token = randomUUID();
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), "studio-real-agent-network-"),
  );
  const runtime = path.join(fixture, "runtime.cjs"),
    entry = path.join(fixture, "entry.cjs"),
    report = path.join(fixture, "report.json");
  const evidence = path.join(
    root,
    readOnly
      ? "test-results/agent-readonly-real.json"
      : "test-results/agent-network-real.json",
  );
  try {
    execFileSync("git", ["init", "--quiet", "--initial-branch=main"], {
      cwd: fixture,
      windowsHide: true,
      stdio: "ignore",
    });
    if (readOnly) {
      fs.writeFileSync(path.join(fixture, "source-proof.txt"), token);
      execFileSync("git", ["add", "source-proof.txt"], {
        cwd: fixture,
        windowsHide: true,
      });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Studio probe",
          "-c",
          "user.email=probe@invalid.example",
          "-c",
          "core.hooksPath=/dev/null",
          "commit",
          "--quiet",
          "-m",
          "read-only fixture",
        ],
        { cwd: fixture, windowsHide: true },
      );
    }
    esbuild.buildSync({
      stdin: {
        contents:
          'export { CodexAgentProvider } from "./providers/agent"; export { agentEnvironment } from "./agent-network"; export { standaloneCodexEnvironment } from "./agent-execution"; export { resolveCodex } from "./codex"; export { EvidenceStore } from "./evidence"; export { initialSettings } from "./store";',
        loader: "ts",
        resolveDir: path.join(root, "src/main"),
      },
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: runtime,
      external: ["electron"],
    });
    fs.writeFileSync(
      entry,
      `
const { app, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
app.setPath('userData', ${JSON.stringify(path.join(fixture, "user-data"))});
app.whenReady().then(async () => {
  const { CodexAgentProvider, agentEnvironment, EvidenceStore, initialSettings, resolveCodex, standaloneCodexEnvironment } = require(${JSON.stringify(runtime)});
  const settings = initialSettings();
  settings.agent.command = process.env.STUDIO_PROBE_CODEX || 'codex';
  settings.execution = { concurrency: 1, previewMode: 'single', agentTimeoutMs: 45000, agentIdleTimeoutMs: 40000 };
  let proxyApplied = false, version = '';
  const logs = [];
  const evidence = new EvidenceStore(${JSON.stringify(path.join(fixture, "evidence"))}, (value) => value);
  const provider = new CodexAgentProvider(() => settings, evidence, (value) => value, async () => {
    const env = await agentEnvironment((url) => session.defaultSession.resolveProxy(url));
    proxyApplied = Boolean(env.HTTPS_PROXY);
    return env;
  });
  const result = await provider.invoke({ taskId: randomUUID(), directory: ${JSON.stringify(fixture)}, projectName: 'Empty connectivity probe', stage: 'analysis', signal: new AbortController().signal,
    prompt: ${JSON.stringify(readOnly ? "Read-only source access verification. This disposable Git repository is the only project in scope. Read source-proof.txt using a shell read command, then execute git ls-tree -r --name-only HEAD. Do not write files, do not use network tools, do not inspect other directories. Return fileToken as the exact file content and gitFile as the filename actually observed in git ls-tree. If a command is blocked report BLOCKED in those fields; do not invent results." : "Connectivity verification only. Do not read files, use tools, or run commands. Return marker STUDIO_NETWORK_OK in the supplied schema.")},
    schema: ${JSON.stringify(readOnly ? { type: "object", additionalProperties: false, properties: { fileToken: { type: "string" }, gitFile: { type: "string" } }, required: ["fileToken", "gitFile"] } : { type: "object", additionalProperties: false, properties: { marker: { type: "string", enum: ["STUDIO_NETWORK_OK"] } }, required: ["marker"] })},
    log: (message) => { logs.push(message); const match = message.match(/^codex-cli ([^ ]+)/); if (match) version = match[1]; }, activity: () => {} });
  let writeDenied = null;
  if (${readOnly} && process.platform === 'win32') {
    const { spawnSync } = require('node:child_process');
    const agent = await resolveCodex(settings.agent.command, { cwd: ${JSON.stringify(fixture)} });
    const sentinel = path.join(${JSON.stringify(fixture)}, 'must-not-be-written.txt');
    const write = spawnSync(agent.command.executable, [...agent.command.args, 'sandbox', '-c', 'sandbox_mode="read-only"', '-c', 'windows.sandbox="elevated"', process.env.SystemRoot + '/System32/WindowsPowerShell/v1.0/powershell.exe', '-NoProfile', '-Command', "Set-Content -LiteralPath './must-not-be-written.txt' -Value denied -ErrorAction Stop"], { cwd: ${JSON.stringify(fixture)}, env: { ...process.env, ...standaloneCodexEnvironment() }, windowsHide: true, encoding: 'utf8', timeout: 20000 });
    writeDenied = write.status !== null && write.status !== 0 && !fs.existsSync(sentinel) && /denied|UnauthorizedAccess|拒绝访问/i.test(write.stderr || '');
  }
  const passed = ${readOnly ? `result?.fileToken?.trim() === ${JSON.stringify(token)} && result?.gitFile?.trim() === 'source-proof.txt' && (process.platform !== 'win32' || writeDenied === true)` : "result?.marker === 'STUDIO_NETWORK_OK'"};
  fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify({ passed, mode: ${JSON.stringify(readOnly ? "real Electron production provider read-only file and git reads" : "real Electron system routing and production CodexAgentProvider; empty directory")}, systemProxyApplied: proxyApplied, codexVersion: version, realStructuredResponse: true, businessProjectTouched: false, persistentProxyChanged: false, ...(${readOnly} ? { logs, result, writeDenied } : {}) }, null, 2));
  if (!passed) { app.exit(2); return; }
  app.quit();
}).catch((error) => {
  fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify({ passed: false, code: error.code || 'LIVE_AGENT_CHECK_FAILED', businessProjectTouched: false }, null, 2));
  console.error(error.code || 'LIVE_AGENT_CHECK_FAILED'); app.exit(1);
});
`,
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.STUDIO_SMOKE;
    delete env.STUDIO_UI_TEST;
    delete env.STUDIO_TEST_DATA;
    const executable = path.join(
      root,
      "node_modules/electron/dist",
      process.platform === "win32"
        ? "electron.exe"
        : "Electron.app/Contents/MacOS/Electron",
    );
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(executable, [entry], {
          cwd: fixture,
          env,
          windowsHide: true,
          stdio: ["ignore", "ignore", "pipe"],
        });
        let errorTail = "";
        child.stderr.on("data", (chunk) => {
          errorTail = (errorTail + chunk).slice(-500);
        });
        const timer = setTimeout(() => {
          if (process.platform === "win32")
            execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              windowsHide: true,
              stdio: "ignore",
            });
          else child.kill("SIGKILL");
          reject(new Error("Live Agent verification timed out"));
        }, 80000);
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("exit", (code) => {
          clearTimeout(timer);
          code === 0
            ? resolve()
            : reject(
                new Error(
                  `Live Agent verification exited ${code}: ${errorTail}`,
                ),
              );
        });
      });
    } finally {
      if (fs.existsSync(report)) {
        fs.mkdirSync(path.dirname(evidence), { recursive: true });
        fs.copyFileSync(report, evidence);
      }
    }
    const result = JSON.parse(fs.readFileSync(report, "utf8"));
    fs.mkdirSync(path.dirname(evidence), { recursive: true });
    fs.copyFileSync(report, evidence);
    console.log(
      JSON.stringify({ ...result, logs: undefined, result: undefined }),
    );
  } finally {
    await fs.promises.rm(fixture, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
