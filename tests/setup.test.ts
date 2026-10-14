import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setupChecks } from "../src/main/setup";
import { initialSettings } from "../src/main/store";

jest.setTimeout(30000);
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-setup-"));
  fs.copyFileSync(
    path.join(__dirname, "fixtures", "fake-codex.js"),
    path.join(root, "fake-codex.js"),
  );
});
afterEach(async () => {
  await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5 });
});
test("invalid login and missing skill return separate actionable checks without starting a task", async () => {
  fs.writeFileSync(path.join(root, "control.json"), '{"loggedOut":true}');
  const settings = initialSettings();
  settings.agent.command = path.join(root, "fake-codex.js");
  settings.agent.tyflowDirectory = path.join(root, "missing-tyflow");
  settings.agent.testSkill = path.join(root, "missing-skill.md");
  const checks = await setupChecks(settings, root);
  expect(checks.find((check) => check.id === "agent")).toMatchObject({
    state: "failed",
    remedy: expect.stringContaining("codex login"),
  });
  expect(checks.find((check) => check.id === "skill")).toMatchObject({
    state: "failed",
    remedy: expect.stringContaining("SKILL.md"),
  });
  expect(fs.existsSync(path.join(root, "calls.jsonl"))).toBe(false);
});
test("compatible signed-in CLI and valid skill paths pass independently of project setup", async () => {
  fs.writeFileSync(path.join(root, "control.json"), "{}");
  fs.mkdirSync(path.join(root, "tyflow", "shared"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tyflow", "shared", "WORKFLOW.md"),
    "fixture",
  );
  fs.writeFileSync(path.join(root, "SKILL.md"), "fixture");
  const settings = initialSettings();
  settings.agent = {
    command: path.join(root, "fake-codex.js"),
    tyflowDirectory: path.join(root, "tyflow"),
    testSkill: path.join(root, "SKILL.md"),
  };
  const checks = await setupChecks(settings, root, "missing-project");
  expect(checks.find((check) => check.id === "agent")?.state).toBe("passed");
  expect(checks.find((check) => check.id === "tyflow")?.state).toBe("passed");
  expect(checks.find((check) => check.id === "skill")?.state).toBe("passed");
  expect(checks.find((check) => check.id === "project")?.state).toBe("failed");
});
