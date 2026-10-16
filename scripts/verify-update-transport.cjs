// Real Electron network regression. Never imports the app entry or activates an update.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");

async function child() {
  const index = process.argv.indexOf("--child");
  const [runtime, reportFile, scratch, mode] = process.argv.slice(index + 1);
  const { app, net, session } = require("electron");
  const report = {
    passed: false,
    mode,
    electron: process.versions.electron,
    platform: process.platform,
    businessDataTouched: false,
  };
  fs.mkdirSync(path.join(scratch, "electron-data"), { recursive: true });
  app.setPath("userData", path.join(scratch, "electron-data"));
  try {
    await app.whenReady();
    const {
      createUpdateFetch,
      UpdateManager,
      initialSettings,
      zipFixture,
    } = require(runtime);
    const { createHash } = require("node:crypto");
    const transport = createUpdateFetch((options) => net.request(options));
    const settings = initialSettings();
    if (mode === "github") {
      settings.updates = {
        manifestUrl: "",
        githubRepository: "liukunxiaohuozi/tyflow-studio",
        checkOnLaunch: false,
      };
      const manager = new UpdateManager({
        directory: path.join(scratch, "live-download"),
        version: "0.3.5",
        platform: process.platform,
        arch: process.arch,
        executable: "fixture-only",
        settings: () => settings,
        secret: () => undefined,
        fetch: transport,
      });
      const checked = await manager.check();
      assert.equal(checked.status, "available", JSON.stringify(checked));
      const downloaded = await manager.download();
      assert.equal(downloaded.status, "downloaded", JSON.stringify(downloaded));
      const state = JSON.parse(
        fs.readFileSync(
          path.join(scratch, "live-download/updates/state.json"),
          "utf8",
        ),
      );
      const hash = createHash("sha256");
      for await (const chunk of fs.createReadStream(state.downloaded.file))
        hash.update(chunk);
      assert.equal(hash.digest("hex"), state.downloaded.asset.sha256);
      Object.assign(report, {
        passed: true,
        version: downloaded.version,
        downloadedBytes: fs.statSync(state.downloaded.file).size,
        hashVerified: true,
        activationPerformed: false,
      });
    } else {
      const http = require("node:http");
      const seen = [],
        closedBodies = [];
      const payload = zipFixture([
        { name: "TingYun Studio.exe", body: "fixture only" },
        { name: "resources/app.asar", body: "fixture only" },
        { name: "payload.bin", body: "x".repeat(2 * 1024 * 1024) },
      ]);
      const asset = {
        name: "fixture.zip",
        url: "https://updates.example.invalid/package-start",
        platform: process.platform,
        arch: process.arch,
        size: payload.length,
        sha256: createHash("sha256").update(payload).digest("hex"),
      };
      const manifest = { schemaVersion: 1, version: "0.3.99", assets: [asset] };
      const record = (request, origin) =>
        seen.push({
          origin,
          path: request.url,
          authorization: request.headers.authorization,
          cookie: request.headers.cookie,
        });
      const origin = http.createServer((request, response) => {
        record(request, "origin");
        const locations = {
          "/manifest-start": "https://updates.example.invalid/manifest-mid",
          "/manifest-mid": "https://cdn.example.invalid/manifest.json",
          "/package-start": "https://cdn.example.invalid/package.zip",
          "/downgrade": "http://cdn.example.invalid/unsafe",
          "/loop": "https://updates.example.invalid/loop",
        };
        if (locations[request.url]) {
          response.writeHead(request.url === "/manifest-mid" ? 307 : 302, {
            Location: locations[request.url],
          });
          response.end();
        } else if (request.url === "/wait") {
          /* AbortSignal must close this request. */
        } else if (request.url === "/body") {
          closedBodies.push(
            new Promise((resolve) => response.once("close", resolve)),
          );
          response.writeHead(200, {
            "Content-Type": "application/octet-stream",
          });
          response.flushHeaders();
          response.write(Buffer.alloc(1024, 1));
        } else {
          response.writeHead(404);
          response.end();
        }
      });
      const cdn = http.createServer((request, response) => {
        record(request, "cdn");
        if (request.url === "/manifest.json") {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(manifest));
        } else if (request.url === "/package.zip") {
          response.setHeader("Content-Type", "application/zip");
          response.end(payload);
        } else {
          response.writeHead(404);
          response.end();
        }
      });
      await Promise.all([
        new Promise((resolve) => origin.listen(0, "127.0.0.1", resolve)),
        new Promise((resolve) => cdn.listen(0, "127.0.0.1", resolve)),
      ]);
      const originalBase = `http://127.0.0.1:${origin.address().port}`;
      const cdnBase = `http://127.0.0.1:${cdn.address().port}`;
      try {
        await session.defaultSession.cookies.set({
          url: originalBase,
          name: "fixture_session",
          value: "must-not-send",
        });
        const map = (url) =>
          url
            .replace("https://updates.example.invalid", originalBase)
            .replace("https://cdn.example.invalid", cdnBase);
        const original = (input, init) => net.fetch(map(String(input)), init);
        const actual = createUpdateFetch((options) =>
          net.request({ ...options, url: map(options.url) }),
        );
        const selected = mode === "baseline" ? original : actual;
        const make = (name, url, current = "0.3.5") =>
          new UpdateManager({
            directory: path.join(scratch, name),
            version: current,
            platform: process.platform,
            arch: process.arch,
            executable: "fixture-only",
            settings: () => ({
              ...settings,
              updates: {
                manifestUrl: url,
                githubRepository: "",
                checkOnLaunch: false,
              },
            }),
            secret: () => "public-fixture-token",
            fetch: selected,
          });
        const manager = make(
          "success",
          "https://updates.example.invalid/manifest-start",
        );
        if (mode === "baseline") {
          try {
            await original("https://updates.example.invalid/manifest-start", {
              redirect: "manual",
            });
          } catch (error) {
            report.originalError = error.message;
          }
          const checked = await manager.check();
          report.checkStatus = checked.status;
          assert.equal(report.originalError, "Redirect was cancelled");
          assert.equal(checked.status, "failed");
          report.reproduced = true; // Deliberately non-passing baseline.
        } else {
          const checked = await manager.check();
          assert.equal(checked.status, "available", JSON.stringify(checked));
          const downloaded = await manager.download();
          assert.equal(
            downloaded.status,
            "downloaded",
            JSON.stringify(downloaded),
          );
          const state = JSON.parse(
            fs.readFileSync(
              path.join(scratch, "success/updates/state.json"),
              "utf8",
            ),
          );
          assert.deepEqual(fs.readFileSync(state.downloaded.file), payload);
          assert.ok(
            seen
              .filter((item) => item.origin === "origin")
              .every(
                (item) => item.authorization === "Bearer public-fixture-token",
              ),
          );
          assert.ok(
            seen
              .filter((item) => item.origin === "cdn")
              .every((item) => !item.authorization),
          );
          assert.ok(seen.every((item) => !item.cookie));
          const downgrade = await make(
            "downgrade",
            "https://updates.example.invalid/downgrade",
          ).check();
          assert.equal(downgrade.status, "failed");
          assert.match(downgrade.error, /HTTPS/);
          const before = seen.filter((item) => item.path === "/loop").length;
          const loop = await make(
            "loop",
            "https://updates.example.invalid/loop",
          ).check();
          assert.equal(loop.status, "failed");
          assert.match(loop.error, /重定向过多/);
          assert.equal(
            seen.filter((item) => item.path === "/loop").length - before,
            6,
          );
          const current = await make(
            "current",
            "https://updates.example.invalid/manifest-start",
            "0.3.99",
          ).check();
          assert.equal(current.status, "current");
          await assert.rejects(
            actual("https://updates.example.invalid/wait", {
              redirect: "manual",
              signal: AbortSignal.timeout(100),
            }),
          );
          const bodyAbort = new AbortController();
          const interrupted = await actual(
            "https://updates.example.invalid/body",
            { redirect: "manual", signal: bodyAbort.signal },
          );
          const bodyRead = interrupted.text();
          bodyAbort.abort();
          await assert.rejects(bodyRead);
          const cancelled = await actual(
            "https://updates.example.invalid/body",
            { redirect: "manual", signal: AbortSignal.timeout(5000) },
          );
          await cancelled.body.cancel();
          let closedTimer;
          try {
            await Promise.race([
              Promise.all(closedBodies),
              new Promise((_, reject) => {
                closedTimer = setTimeout(
                  () =>
                    reject(
                      Error("Cancelled response connection remained open"),
                    ),
                  2000,
                );
              }),
            ]);
          } finally {
            clearTimeout(closedTimer);
          }
          Object.assign(report, {
            passed: true,
            multiHopManifest: true,
            streamedZipBytes: payload.length,
            persistedBytesMatch: true,
            crossOriginTokenStripped: true,
            sessionCookiesOmitted: true,
            httpsDowngradeBlocked: true,
            sixHopLimit: true,
            currentVersionCorrect: true,
            abortAndBodyCancellation: true,
            activationPerformed: false,
          });
        }
      } finally {
        origin.closeAllConnections();
        cdn.closeAllConnections();
        await Promise.all([
          new Promise((resolve) => origin.close(resolve)),
          new Promise((resolve) => cdn.close(resolve)),
        ]);
      }
    }
  } catch (error) {
    report.error = error.message;
  } finally {
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    app.exit(report.passed || report.reproduced ? 0 : 1);
  }
}

function parent() {
  const root = path.resolve(__dirname, ".."),
    mode = process.argv.includes("--baseline")
      ? "baseline"
      : process.argv.includes("--github")
        ? "github"
        : "regression";
  const scratch = fs.mkdtempSync(
    path.join(os.tmpdir(), "studio-update-transport-"),
  );
  const reportFile = path.join(
    root,
    "test-results",
    mode === "baseline"
      ? "update-transport-electron-red.json"
      : mode === "github"
        ? "update-transport-github.json"
        : "update-transport-electron.json",
  );
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  try {
    const runtime = path.join(scratch, "runtime.cjs");
    require("esbuild").buildSync({
      stdin: {
        contents:
          'export {createUpdateFetch} from "./src/main/update-transport"; export {UpdateManager} from "./src/main/updates"; export {initialSettings} from "./src/main/store"; export {zipFixture} from "./tests/fixtures/zip";',
        resolveDir: root,
        loader: "ts",
      },
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: runtime,
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = require("node:child_process").spawnSync(
      require("electron"),
      [__filename, "--child", runtime, reportFile, scratch, mode],
      {
        cwd: root,
        env,
        windowsHide: true,
        encoding: "utf8",
        timeout: mode === "github" ? 240000 : 45000,
      },
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    console.log(JSON.stringify(report, null, 2));
    if (result.status !== 0 || (!report.passed && !report.reproduced))
      throw Error("Electron update regression failed");
  } finally {
    fs.rmSync(scratch, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}
if (process.argv.includes("--child")) child();
else {
  try {
    parent();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
