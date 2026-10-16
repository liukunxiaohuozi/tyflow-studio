import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialSettings } from "../src/main/store";
import type { EnvironmentInfo } from "../src/shared/contracts";
import TaskEditor from "../src/renderer/TaskEditor";
import SettingsView from "../src/renderer/SettingsView";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
beforeAll(() =>
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  }),
);
afterAll(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
function legacySettings() {
  const settings = initialSettings();
  settings.zentao = {
    enabled: true,
    url: "https://legacy.example.invalid",
    username: "legacy-fixture",
    hasSecret: true,
    mappings: {},
  };
  return settings;
}
const environment: EnvironmentInfo = {
  platform: "win32",
  version: "0.3.12",
  dataDirectory: "fixture",
  agentAvailable: true,
  gitAvailable: true,
  tyflowAvailable: true,
  testSkillAvailable: true,
  credentialStorage: true,
};

test("new-task editor has no ZenTao association even with enabled legacy settings", () => {
  const html = renderToStaticMarkup(
    createElement(TaskEditor, {
      settings: legacySettings(),
      onTask: jest.fn(),
      report: jest.fn(),
      openSettings: jest.fn(),
    }),
  );
  expect(html).toContain("所属项目");
  expect(html).toContain("文字需求");
  expect(html).not.toMatch(/禅道|ZenTao/i);
});

test.each([
  "developer",
  "runtime",
  "updates",
  "notifications",
  "appearance",
  "zentao",
])(
  "settings %s retains normal content but exposes no ZenTao controls or credentials",
  (initialTab) => {
    const html = renderToStaticMarkup(
      createElement(SettingsView, {
        settings: legacySettings(),
        environment,
        initialTab,
        onSave: jest.fn(),
        report: jest.fn(),
      }),
    );
    expect(html).toContain("客户端更新");
    expect(html).toContain("完成通知");
    expect(html).not.toMatch(/禅道|ZenTao|legacy\.example|legacy-fixture/i);
    if (initialTab === "zentao") expect(html).toContain("开发者身份");
  },
);

test("retired catalog/navigation IPC and preload methods are no longer exposed", () => {
  for (const file of [
    "src/main/index.ts",
    "src/main/preload.ts",
    "src/shared/contracts.ts",
    "src/renderer/demo.ts",
  ]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    expect(source).not.toMatch(
      /open-zentao|zentao-catalog|openZentao|zentaoCatalog/,
    );
  }
  for (const file of [
    "src/renderer/TaskEditor.tsx",
    "src/renderer/SettingsView.tsx",
  ]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    expect(source).not.toMatch(/loadZentao|zentaoCatalog|openZentao/);
  }
});
