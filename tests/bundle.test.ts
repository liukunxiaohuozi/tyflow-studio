import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defaultAgentPaths, resolveBundleRoot } from "../src/main/bundle";

test("falls back to home paths when bundle is absent", () => {
  const home = path.join(os.tmpdir(), `studio-home-${process.pid}`);
  fs.mkdirSync(home, { recursive: true });
  const paths = defaultAgentPaths(home, path.join(home, "missing-resources"));
  expect(paths.tyflowDirectory).toBe(path.join(home, ".tyflow"));
  expect(paths.testSkill).toBe(
    path.join(home, ".codex", "skills", "frontend-test", "SKILL.md"),
  );
});

test("prefers packaged bundle paths when present", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-bundle-"));
  const resources = path.join(root, "resources");
  const bundle = path.join(resources, "bundle");
  fs.mkdirSync(path.join(bundle, "tyflow", "shared"), { recursive: true });
  fs.mkdirSync(path.join(bundle, "skills", "frontend-test"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(bundle, "tyflow", "shared", "WORKFLOW.md"),
    "workflow",
  );
  fs.writeFileSync(
    path.join(bundle, "skills", "frontend-test", "SKILL.md"),
    "skill",
  );
  expect(resolveBundleRoot(resources)).toBe(bundle);
  const paths = defaultAgentPaths(path.join(root, "home"), resources);
  expect(paths.tyflowDirectory).toBe(path.join(bundle, "tyflow"));
  expect(paths.testSkill).toBe(
    path.join(bundle, "skills", "frontend-test", "SKILL.md"),
  );
});

test("macOS portable bundle is re-signed and strictly verified after bundle injection", () => {
  const script = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "pack-portable.cjs"),
    "utf8",
  );
  const injection = script.indexOf(
    'injectBundle(path.join(appPath, "Contents", "Resources"))',
  );
  const signing = script.indexOf('signMacApp(appPath)', injection);
  expect(injection).toBeGreaterThan(-1);
  expect(signing).toBeGreaterThan(injection);
  expect(script).toContain(
    'run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath])',
  );
});
