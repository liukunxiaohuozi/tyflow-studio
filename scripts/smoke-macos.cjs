const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
if (process.platform !== "darwin")
  throw new Error("macOS smoke must run on macOS");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "studio-mac-smoke-"));
const application = path.join(
  root,
  "release",
  process.arch === "arm64" ? "mac-arm64" : "mac",
  "TingYun Studio.app",
  "Contents",
  "MacOS",
  "TingYun Studio",
);
if (!fs.existsSync(application))
  throw new Error("Packaged app for runner architecture is missing");
const env = { ...process.env, STUDIO_SMOKE: "1", STUDIO_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(application, [], { env, cwd: root, stdio: "inherit" });
const timer = setTimeout(() => {
  child.kill("SIGKILL");
  console.error("Packaged macOS smoke timed out");
  process.exitCode = 1;
}, 45000);
child.on("error", (error) => {
  clearTimeout(timer);
  console.error(error);
  process.exitCode = 1;
});
child.on("close", (code) => {
  clearTimeout(timer);
  try {
    const report = JSON.parse(
      fs.readFileSync(path.join(directory, "smoke.json"), "utf8"),
    );
    if (
      code !== 0 ||
      !report.ready ||
      !report.bootstrapServed ||
      !report.visible ||
      report.minimized
    )
      throw new Error("Packaged macOS app did not become usable");
    console.log(
      JSON.stringify({
        ...report,
        architecture: process.arch,
        evidence: directory,
      }),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
});
