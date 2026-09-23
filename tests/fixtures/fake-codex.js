// A deterministic subprocess boundary for tests. This never invokes an AI service.
/* eslint-disable @typescript-eslint/no-require-imports -- This standalone Node subprocess intentionally uses CommonJS. */
const fs = require("node:fs");
const path = require("node:path");
const directory = __dirname;
const config = JSON.parse(
  fs.readFileSync(path.join(directory, "control.json"), "utf8"),
);
if (process.argv.includes("--version")) {
  console.log("codex-cli fixture");
  process.exit(0);
}
if (process.argv.slice(2).join(" ") === "exec --help") {
  console.log(
    config.unsupported
      ? "--ephemeral --output-schema"
      : "--ignore-user-config --ephemeral --output-schema --approve-for-me",
  );
  process.exit(0);
}
let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  prompt += chunk;
});
process.stdin.on("end", () => {
  const args = process.argv.slice(2);
  const output = args[args.indexOf("--output-last-message") + 1];
  const schemaPath = args[args.indexOf("--output-schema") + 1];
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const stage =
    args[args.indexOf("--sandbox") + 1] === "read-only"
      ? "analysis"
      : prompt.includes("User requested automated testing intervention")
        ? "test"
        : "development";
  fs.appendFileSync(
    path.join(directory, "calls.jsonl"),
    JSON.stringify({
      args,
      prompt,
      schema,
      stage,
      cwd: process.cwd(),
      codexHome: process.env.CODEX_HOME,
    }) + "\n",
  );
  console.log(
    JSON.stringify({
      type: "item.completed",
      item: { text: config.log || "fixture agent evidence" },
    }),
  );
  setTimeout(() => {
    if (config.fail === stage) {
      console.error("fixture deliberate failure");
      process.exitCode = 7;
      return;
    }
    if (config.missingOutput) return;
    const results = {
      analysis: {
        summary: "Fixture assessment",
        requirements: [
          { id: "REQ-001", text: "Fixture behavior", priority: "P0", source: "description" },
        ],
        planSteps: [
          { id: "PLAN-001", title: "Implement fixture", covers: ["REQ-001"], expectedFiles: ["**"] },
        ],
        steps: ["Implement the isolated fixture"],
        risks: [],
        blockers: [],
        testCases: [
          {
            id: "CASE-1",
            title: "Expected behavior",
            covers: ["REQ-001"],
            verifies: ["PLAN-001"],
            priority: "P0",
            steps: ["Run the fixture check"],
            expected: "Exit code zero",
          },
        ],
      },
      development: {
        summary: "Fixture implementation completed",
        checks: [
          {
            name: "fixture developer check",
            state: "passed",
            detail: "Fixture subprocess returned its controlled result",
          },
        ],
      },
      test: {
        summary: "Fixture verification",
        checks: [
          {
            name: "CASE-1",
            state: "passed",
            detail: "Fixture controlled evidence for CASE-1",
            evidence: [
              { kind: "command", command: "fixture-check", exitCode: 0, summary: "Fixture command exited successfully" },
            ],
          },
        ],
      },
    };
    fs.writeFileSync(output, JSON.stringify(config.result || results[stage]));
  }, config.delay || 0);
});
