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
if (process.argv.slice(2).join(" ") === "login status") {
  console.log(
    config.loggedOut ? "Not logged in" : "Logged in with fixture credentials",
  );
  process.exit(config.loggedOut ? 1 : 0);
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
      sandboxPackageFamily: process.env.CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY,
      proxyConfigured: Boolean(
        process.env.HTTPS_PROXY || process.env.https_proxy,
      ),
      proxyMatchesExpected: config.requireProxy
        ? (process.env.HTTPS_PROXY || process.env.https_proxy) ===
          config.requireProxy
        : undefined,
    }) + "\n",
  );
  if (config.readBlocked)
    console.error(
      "ERROR codex_core::tools::router: exec_command failed: CreateProcess Rejected: blocked by policy",
    );
  if (
    config.requireProxy &&
    (process.env.HTTPS_PROXY || process.env.https_proxy) !== config.requireProxy
  ) {
    console.error("workspace routing discovery failed");
    process.exitCode = 1;
    return;
  }
  console.log(
    JSON.stringify({
      type: "item.completed",
      item: { text: config.log || "fixture agent evidence" },
    }),
  );
  if (config.transientError)
    console.log(
      JSON.stringify({ type: "error", message: config.transientError }),
    );
  setTimeout(async () => {
    try {
      if (config.eventError)
        console.log(
          JSON.stringify({
            type: "turn.failed",
            error: { message: config.eventError },
          }),
        );
      if (config.fail === stage) {
        console.error("fixture deliberate failure");
        process.exitCode = 7;
        return;
      }
      if (config.missingOutput) return;
      if (stage === "development") {
        for (const [file, contents] of Object.entries(
          config.developmentFiles || {},
        )) {
          const target = path.join(process.cwd(), file);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, contents);
        }
      }
      if (stage === "test") {
        for (const [file, contents] of Object.entries(config.testFiles || {})) {
          const target = path.join(process.cwd(), file);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, contents);
        }
      }
      const results = {
        analysis: {
          summary: "Fixture assessment",
          deliveryLevel: prompt.includes('"mode":"existing"') ? "L1" : "L2",
          orchestration: {
            useTyflow: !prompt.includes('"mode":"existing"'),
            useAutomatedTests: false,
            verificationScope: "Run focused requirement and regression checks",
            reason: "Fixture-selected delivery scope",
          },
          requirements: [
            {
              id: "REQ-001",
              text: "Fixture behavior",
              priority: "P0",
              source: "description",
            },
          ],
          planSteps: [
            {
              id: "PLAN-001",
              title: "Implement fixture",
              covers: ["REQ-001"],
              expectedFiles: ["**"],
            },
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
              purpose: "regression",
              covers: [
                ...new Set(
                  [...prompt.matchAll(/"id"\s*:\s*"([\w-]+)"/g)].map(
                    (match) => match[1],
                  ),
                ),
              ],
              state: "passed",
              detail: "Fixture subprocess returned its controlled result",
              evidence: [
                {
                  kind: "command",
                  command: "node fixture-regression.cjs",
                  exitCode: 0,
                  summary: "Independent fixture requirement assertion passed",
                },
              ],
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
                {
                  kind: "command",
                  command: "fixture-check",
                  exitCode: 0,
                  summary: "Fixture command exited successfully",
                },
              ],
            },
          ],
        },
      };
      const stageCalls = fs
        .readFileSync(path.join(directory, "calls.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((call) => call.stage === stage).length;
      if (stage === "test" && config.browserTest) {
        const setting = args.find((arg) =>
          arg.startsWith("mcp_servers.studio_browser.url="),
        );
        if (!setting || !process.env.STUDIO_BROWSER_TOKEN)
          throw new Error("Fixture did not receive scoped browser capability");
        const endpoint = JSON.parse(setting.slice(setting.indexOf("=") + 1));
        let rpcId = 0;
        const tool = async (name, argumentsValue) => {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.STUDIO_BROWSER_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: ++rpcId,
              method: "tools/call",
              params: { name, arguments: argumentsValue },
            }),
          });
          const body = await response.json();
          if (!response.ok || body.result?.isError)
            throw new Error(
              body.result?.content?.[0]?.text ||
                "Fixture browser operation failed",
            );
          return JSON.parse(body.result.content[0].text);
        };
        await tool("browser_fill", {
          role: "textbox",
          name: "Setting value",
          text: "controlled",
        });
        await tool("browser_click", { role: "button", name: "Save" });
        const assertion = await tool("browser_assert", {
          caseId: "CASE-001",
          selector: "#result",
          assertion: "text",
          expected: "Fixture saved: controlled",
        });
        if (!assertion.passed)
          throw new Error("Fixture real browser assertion failed");
        results.test = {
          summary: "Fixture browser verification",
          checks: [
            {
              name: "CASE-001",
              state: "passed",
              detail: "Real fixture browser save assertion",
              evidence: [
                {
                  kind: "dom",
                  summary: "Actual browser assertion",
                  ...assertion.evidence,
                },
              ],
            },
          ],
        };
      }
      const sequenceResult =
        stage === "analysis" && config.analysisResults?.[stageCalls - 1];
      const diagnosisResult = schema.properties?.rootCause
        ? {
            summary: "Fixture root-cause investigation",
            rootCause:
              "The fixture call path returns the wrong controlled value.",
            evidence: [
              "Read-only fixture source inspection confirmed the call path.",
            ],
            affectedFiles: ["verify.cjs"],
            recommendation: "Authorize a focused repair in the same task.",
            confidence: "high",
            introducedAt: "2026-10-01T10:00:00+08:00",
            introducingCommit: {
              hash: "abc1234",
              author: "Fixture Author",
              committedAt: "2026-10-01T10:00:00+08:00",
              message: "Introduce fixture regression",
            },
            versionInfo: "v1.2.3",
            traceabilityNotes: "Confirmed from fixture git history.",
          }
        : undefined;
      fs.writeFileSync(
        output,
        JSON.stringify(
          sequenceResult || config.result || diagnosisResult || results[stage],
        ),
      );
      if (config.completedEvent)
        console.log(JSON.stringify({ type: "turn.completed", usage: {} }));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }, config.delay || 0);
});
