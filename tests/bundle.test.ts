import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defaultAgentPaths, resolveBundleRoot } from "../src/main/bundle";
import { Store } from "../src/main/store";

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
  const signing = script.indexOf("signMacApp(appPath)", injection);
  expect(injection).toBeGreaterThan(-1);
  expect(signing).toBeGreaterThan(injection);
  expect(script).toContain(
    'run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath])',
  );
});

test("upgrading refreshes bundled skill paths and retains custom paths and task history", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-bundle-upgrade-"));
  try {
    const create = (name: string) => {
      const resources = path.join(root, name, "resources");
      fs.mkdirSync(path.join(resources, "bundle", "tyflow", "shared"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(resources, "bundle", "skills", "frontend-test"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(resources, "bundle", "tyflow", "shared", "WORKFLOW.md"),
        name,
      );
      fs.writeFileSync(
        path.join(resources, "bundle", "skills", "frontend-test", "SKILL.md"),
        name,
      );
      return resources;
    };
    const previous = create("previous"),
      next = create("next");
    const store = new Store(path.join(root, "data"), {
      resourcesPath: previous,
    });
    store.saveSettings(store.settings());
    const task = store.saveTask({
      title: "Keep history",
      kind: "bug",
      size: "small",
      description: "retained request",
      projectId: "explore",
      assetIds: [],
      branch: { mode: "existing", base: "main", name: "main", version: "" },
      autoTest: false,
    });
    const upgraded = new Store(store.directory, { resourcesPath: next });
    expect(upgraded.getTask(task.id).description).toBe("retained request");
    expect(upgraded.settings().agent.tyflowDirectory).toBe(
      path.join(next, "bundle", "tyflow"),
    );
    expect(upgraded.settings().agent.testSkill).toBe(
      path.join(next, "bundle", "skills", "frontend-test", "SKILL.md"),
    );
    const custom = upgraded.settings();
    custom.agent.tyflowDirectory = path.join(root, "custom-tyflow");
    upgraded.saveSettings(custom);
    expect(
      new Store(store.directory, { resourcesPath: previous }).settings().agent
        .tyflowDirectory,
    ).toBe(custom.agent.tyflowDirectory);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});
