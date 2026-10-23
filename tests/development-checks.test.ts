import {
  evaluateDevelopmentChecks,
  unchangedQualityDiagnostics,
} from "../src/main/development-checks";
import type { CheckResult } from "../src/shared/contracts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  reconcileHistoricalLint,
  qualityEnvironmentIdentity,
} from "../src/main/development-checks";
import { EvidenceStore } from "../src/main/evidence";
import type { Task } from "../src/shared/contracts";
// Integration cases launch real Git/Node/ESLint children with 10s/30s bounds.
jest.setTimeout(45000);

const regression: CheckResult = {
  name: "metric retention regression",
  state: "passed",
  purpose: "regression",
  detail: "static to dynamic preserves metric",
  evidence: [
    {
      kind: "command",
      command: "node focused-regression.cjs",
      exitCode: 0,
      summary: "asserted expected metric",
    },
  ],
};
const lint: CheckResult = {
  name: "ESLint",
  state: "failed",
  purpose: "quality",
  detail: "one legacy diagnostic",
};
const diagnostic = {
  ruleId: "no-case-declarations",
  severity: 2,
  message: "Unexpected lexical declaration in case block",
  column: 3,
  source: "const value = 1;",
};

test("only identical narrow quality diagnostics are historical, not just equal counts", () => {
  expect(unchangedQualityDiagnostics([diagnostic], [diagnostic])).toBe(true);
  expect(
    unchangedQualityDiagnostics(
      [diagnostic],
      [{ ...diagnostic, source: "const other = 2;" }],
    ),
  ).toBe(false);
  expect(
    unchangedQualityDiagnostics([diagnostic], [diagnostic, diagnostic]),
  ).toBe(false);
  expect(unchangedQualityDiagnostics([], [diagnostic])).toBe(false);
  expect(
    unchangedQualityDiagnostics(
      [{ ...diagnostic, ruleId: "security/detect-eval-with-expression" }],
      [{ ...diagnostic, ruleId: "security/detect-eval-with-expression" }],
    ),
  ).toBe(false);
  expect(
    unchangedQualityDiagnostics(
      [{ ...diagnostic, fatal: true }],
      [{ ...diagnostic, fatal: true }],
    ),
  ).toBe(false);
});

test("a verified historical lint finding is a warning, never a passed check", () => {
  const historical = {
    ...lint,
    historical: { evidencePath: "proof.json", sha256: "abc", count: 1 },
  };
  expect(evaluateDevelopmentChecks([regression, historical])).toEqual({
    outcome: "completed",
    failures: [],
    pending: [],
  });
  expect(historical.state).toBe("failed");
});

test("syntax and whitespace alone cannot complete development", () => {
  expect(
    evaluateDevelopmentChecks([regression], ["uncovered-requirement"]).outcome,
  ).toBe("incomplete");
  expect(
    evaluateDevelopmentChecks([{ ...regression, purpose: "quality" }]).outcome,
  ).toBe("incomplete");
  expect(
    evaluateDevelopmentChecks([{ ...regression, evidence: [] }]).outcome,
  ).toBe("incomplete");
  expect(
    evaluateDevelopmentChecks([
      {
        ...regression,
        evidence: [
          {
            kind: "command",
            command: "git diff --check",
            exitCode: 0,
            summary: "whitespace",
          },
        ],
      },
    ]).outcome,
  ).toBe("incomplete");
});

test("real failures and unfinished regression checks block completion, manual acceptance does not", () => {
  expect(evaluateDevelopmentChecks([regression, lint]).outcome).toBe("failed");
  expect(
    evaluateDevelopmentChecks([regression, { ...lint, state: "blocked" }])
      .outcome,
  ).toBe("incomplete");
  expect(
    evaluateDevelopmentChecks([
      regression,
      { ...regression, state: "unexecuted" },
    ]).outcome,
  ).toBe("incomplete");
  expect(
    evaluateDevelopmentChecks([
      regression,
      {
        name: "browser",
        state: "unexecuted",
        purpose: "manual",
        detail: "user explicitly chose manual browser review",
      },
    ]).outcome,
  ).toBe("completed");
});

describe("production child-process lint baseline comparison", () => {
  let root: string;
  let task: Task;
  let evidence: EvidenceStore;
  const relative = "src/logic.js";
  const original =
    "switch (mode) {\ncase 1:\n  const oldValue = 1;\n  break;\n}\n";
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(os.tmpdir(), "studio-development-baseline-"),
    );
    fs.mkdirSync(path.join(root, "src"));
    fs.mkdirSync(path.join(root, "node_modules/eslint"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.writeFileSync(
      path.join(root, "node_modules/eslint/package.json"),
      JSON.stringify({
        main: "index.cjs",
        version: JSON.parse(
          fs.readFileSync(require.resolve("eslint/package.json"), "utf8"),
        ).version,
      }),
    );
    fs.writeFileSync(
      path.join(root, "node_modules/eslint/index.cjs"),
      `module.exports = require(${JSON.stringify(require.resolve("eslint"))});`,
    );
    fs.writeFileSync(
      path.join(root, "eslint.config.cjs"),
      'module.exports=[{rules:{"no-case-declarations":"error"}}];',
    );
    fs.writeFileSync(path.join(root, ".gitignore"), "node_modules/\n");
    fs.writeFileSync(path.join(root, relative), original);
    git("init", "--quiet");
    git("add", ".");
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    );
    task = {
      id: "00000000-0000-4000-8000-000000000015",
      snapshot: {
        project: { directory: root },
        baseCommit: git("rev-parse", "HEAD"),
      },
    } as Task;
    evidence = new EvidenceStore(path.join(root, "evidence"), (v) => v);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const check = (): CheckResult => ({
    ...lint,
    evidence: [
      {
        kind: "command",
        command: ".\\node_modules\\.bin\\eslint.cmd src/logic.js",
        exitCode: 1,
        summary: "lint failure",
      },
    ],
  });
  async function compare(
    identityBefore = qualityEnvironmentIdentity(root),
    checks = [check()],
  ) {
    return reconcileHistoricalLint({
      task,
      checks,
      changedFiles: [relative],
      identityBefore,
      evidence,
      signal: new AbortController().signal,
      preferredCommand: "",
    });
  }
  test("unchanged real ESLint diagnostics become evidence-linked historical warnings", async () => {
    fs.writeFileSync(
      path.join(root, relative),
      "// shifted lines\n" + original + "const fixedBehavior = true;\n",
    );
    const [result] = await compare();
    expect(result.state).toBe("failed");
    expect(result.historical?.count).toBe(1);
    expect(
      evidence.readResult(task, {
        path: result.historical!.evidencePath,
        sha256: result.historical!.sha256,
      }),
    ).toMatchObject({ tool: "eslint", files: [{ file: relative }] });
  });
  test("same error count on changed faulty code is not waived", async () => {
    fs.writeFileSync(
      path.join(root, relative),
      original.replace("oldValue", "newValue"),
    );
    expect((await compare())[0].historical).toBeUndefined();
  });
  test.each([0, 1])(
    "captured explore result %i triggers independent comparison without CLI wording",
    async (index) => {
      const reports = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "fixtures/development-lint-replay.json"),
          "utf8",
        ),
      ) as CheckResult[];
      fs.writeFileSync(
        path.join(root, relative),
        "// actual repair keeps old lint debt\n" + original,
      );
      const [result] = await compare(undefined, [reports[index]]);
      expect(result.historical?.count).toBe(1);
      expect(result.state).toBe("failed");
      expect(evaluateDevelopmentChecks([regression, result]).outcome).toBe(
        "completed",
      );
    },
  );
  test("configuration changes stay incomplete, never baseline-waived", async () => {
    const identity = qualityEnvironmentIdentity(root);
    fs.appendFileSync(
      path.join(root, "eslint.config.cjs"),
      "\n// configuration changed",
    );
    expect((await compare(identity))[0].historical).toBeUndefined();
    expect((await compare(identity))[0].state).toBe("blocked");
  });
  test("command injection text is never executed; only fixed ESLint adapter runs", async () => {
    const suspicious = check();
    suspicious.evidence![0].command +=
      "; node -e \"require('fs').writeFileSync('injected','bad')\"";
    expect((await compare(undefined, [suspicious]))[0].historical?.count).toBe(
      1,
    );
    expect(fs.existsSync(path.join(root, "injected"))).toBe(false);
  });
  test("a clean current file supersedes an old reported failure with real tool evidence", async () => {
    fs.writeFileSync(path.join(root, relative), "const repaired = true;\n");
    const [result] = await compare(undefined, [{ ...lint, evidence: [] }]);
    expect(result.state).toBe("passed");
    expect(result.historical).toBeUndefined();
    expect(result.evidence?.[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  test("a second changed file with new diagnostics cannot hide behind the reported first file", async () => {
    fs.writeFileSync(path.join(root, "src/second.js"), "const fine = true;\n");
    git("add", ".");
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "second baseline",
    );
    task.snapshot!.baseCommit = git("rev-parse", "HEAD");
    fs.writeFileSync(path.join(root, "src/second.js"), original);
    const [result] = await reconcileHistoricalLint({
      task,
      checks: [check()],
      changedFiles: [relative, "src/second.js"],
      identityBefore: qualityEnvironmentIdentity(root),
      evidence,
      signal: new AbortController().signal,
      preferredCommand: "",
    });
    expect(result.state).toBe("failed");
    expect(result.historical).toBeUndefined();
    expect(result.detail).toContain("src/second.js");
  });
  test("missing tools produce incomplete verification with a concrete reason", async () => {
    fs.renameSync(
      path.join(root, "node_modules/eslint"),
      path.join(root, "node_modules/eslint-disabled"),
    );
    const [result] = await compare(undefined, [{ ...lint, evidence: [] }]);
    expect(result.state).toBe("blocked");
    expect(result.historical).toBeUndefined();
    expect(result.detail).toContain("核对未完成");
    expect(evaluateDevelopmentChecks([regression, result]).outcome).toBe(
      "incomplete",
    );
  });
  test("forged history is removed even when the frozen baseline is missing", async () => {
    task.snapshot = undefined;
    const [result] = await compare(undefined, [
      {
        ...lint,
        historical: { evidencePath: "forged", sha256: "fake", count: 1 },
      },
    ]);
    expect(result.historical).toBeUndefined();
    expect(result.state).toBe("blocked");
  });
  test("regression failures named ESLint must not be converted into quality warnings", async () => {
    const [result] = await compare(undefined, [
      { ...lint, purpose: "regression" },
    ]);
    expect(result.state).toBe("failed");
    expect(result.historical).toBeUndefined();
  });
  test("aborted comparisons do not become warnings or incomplete successful returns", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      reconcileHistoricalLint({
        task,
        checks: [check()],
        changedFiles: [relative],
        identityBefore: qualityEnvironmentIdentity(root),
        evidence,
        signal: controller.signal,
        preferredCommand: "",
      }),
    ).rejects.toThrow();
  });
  test("a current syntax failure is not historical quality debt", async () => {
    fs.writeFileSync(path.join(root, relative), "const broken = ;\n");
    const [result] = await compare();
    expect(result.state).toBe("failed");
    expect(result.historical).toBeUndefined();
    expect(result.detail).toContain("Parsing error");
  });
  test.each([
    { files: ["../outside.js"] },
    { files: Array.from({ length: 21 }, (_, i) => `src/file${i}.js`) },
  ])("unverifiable changed scope %j remains incomplete", async ({ files }) => {
    const [result] = await reconcileHistoricalLint({
      task,
      checks: [check()],
      changedFiles: files,
      identityBefore: qualityEnvironmentIdentity(root),
      evidence,
      signal: new AbortController().signal,
      preferredCommand: "",
    });
    expect(result.state).toBe("blocked");
    expect(result.historical).toBeUndefined();
  });
  test.each([false, true])(
    "a new file uses an empty baseline, never inherits old errors (faulty=%s)",
    async (faulty) => {
      fs.writeFileSync(
        path.join(root, "src/new.js"),
        faulty ? original : "const clean = true;\n",
      );
      const [result] = await reconcileHistoricalLint({
        task,
        checks: [check()],
        changedFiles: ["src/new.js"],
        identityBefore: qualityEnvironmentIdentity(root),
        evidence,
        signal: new AbortController().signal,
        preferredCommand: "",
      });
      expect(result.state).toBe(faulty ? "failed" : "passed");
      expect(result.historical).toBeUndefined();
    },
  );
  test("installed ESLint identity changes invalidate the captured environment", async () => {
    const identity = qualityEnvironmentIdentity(root);
    fs.appendFileSync(path.join(root, "node_modules/eslint/package.json"), " ");
    const [result] = await compare(identity);
    expect(result.state).toBe("blocked");
    expect(result.historical).toBeUndefined();
  });
  test("combined-tool checks and genuine failures are not waived by successful ESLint comparison", async () => {
    const checks = [
      { ...lint, name: "ESLint + TypeScript" },
      { ...regression, state: "failed" as const },
      { ...lint, evidence: [] },
    ];
    const results = await compare(undefined, checks);
    expect(results[0].state).toBe("failed");
    expect(results[0].historical).toBeUndefined();
    expect(results[1].state).toBe("failed");
    expect(results[1].historical).toBeUndefined();
    expect(results[2].historical?.count).toBe(1);
    expect(evaluateDevelopmentChecks(results).outcome).toBe("failed");
  });
});
