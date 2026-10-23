const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const resultDirectory = path.join(process.cwd(), "test-results");
const resultFile = path.join(resultDirectory, "jest-ci.json");
fs.mkdirSync(resultDirectory, { recursive: true });

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const run = spawnSync(
  command,
  ["test", "--", "--json", `--outputFile=${resultFile}`],
  { cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true },
);

if (run.status) {
  let summary = "Jest failed before a structured result was written.";
  if (fs.existsSync(resultFile)) {
    const report = JSON.parse(fs.readFileSync(resultFile, "utf8"));
    const failures = (report.testResults || [])
      .filter((suite) => suite.status === "failed")
      .map((suite) => {
        const names = (suite.assertionResults || [])
          .filter((test) => test.status === "failed")
          .map((test) => test.fullName)
          .join("; ");
        return `${path.relative(process.cwd(), suite.name)}: ${names || "suite failed"}`;
      });
    if (failures.length) summary = failures.join(" | ");
  }
  const annotation = summary
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
  console.error(`::error title=Cross-platform regression failed::${annotation}`);
  process.exit(run.status);
}

