import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { UpdateManager, newer, validateUpdateZip } from "../src/main/updates";
import { initialSettings } from "../src/main/store";
import { zipFixture } from "./fixtures/zip";

jest.setTimeout(30000);
let root: string;
const manifestUrl = "https://updates.example.invalid/manifest.json",
  packageUrl = "https://updates.example.invalid/studio.zip";
const payload = zipFixture([
  { name: "TingYun Studio.exe", body: "fixture executable" },
  { name: "resources/app.asar", body: "fixture app archive" },
  { name: "resources/studio-version.json", body: '{"version":"0.3.1"}' },
  {
    name: "resources/bundle/tyflow/shared/WORKFLOW.md",
    body: "fixture workflow",
  },
  {
    name: "resources/bundle/skills/frontend-test/SKILL.md",
    body: "fixture skill",
  },
]);
function fixture(
  overrides: Record<string, unknown> = {},
  transport?: typeof fetch,
) {
  const settings = initialSettings();
  settings.updates = {
    manifestUrl,
    githubRepository: "",
    checkOnLaunch: false,
  };
  const asset = {
    platform: "win32",
    arch: "x64",
    name: "studio.zip",
    url: packageUrl,
    sha256: createHash("sha256").update(payload).digest("hex"),
    size: payload.length,
    ...overrides,
  };
  const request =
    transport ??
    ((async (url: string | URL | Request) =>
      new Response(
        String(url) === manifestUrl
          ? JSON.stringify({
              schemaVersion: 1,
              version: "0.3.1",
              assets: [asset],
            })
          : new Uint8Array(payload),
      )) as typeof fetch);
  const original = path.join(root, "original.exe");
  fs.writeFileSync(original, "original fixture");
  return new UpdateManager({
    directory: root,
    version: "0.3.0",
    platform: "win32",
    arch: "x64",
    executable: original,
    settings: () => settings,
    secret: () => "fixture-private-token",
    fetch: request,
  });
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-updates-"));
});
afterEach(async () => {
  await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5 });
});

test("versions compare numeric components and do not downgrade", () => {
  expect(newer("0.3.10", "0.3.9")).toBe(true);
  expect(newer("0.3.0", "0.3.1")).toBe(false);
  expect(newer("0.3.0", "0.3.0")).toBe(false);
});
test("downloads a matching package and persists its verified identity across restarts", async () => {
  const manager = fixture();
  expect((await manager.check()).status).toBe("available");
  expect((await manager.download()).status).toBe("downloaded");
  expect((await fixture().check()).status).toBe("downloaded");
  const state = JSON.parse(
    fs.readFileSync(path.join(root, "updates", "state.json"), "utf8"),
  );
  expect(fs.readFileSync(state.downloaded.file)).toEqual(payload);
  expect(JSON.stringify(state)).not.toContain("fixture-private-token");
});
test("wrong architecture and checksum never produce an activatable download", async () => {
  expect((await fixture({ arch: "arm64" }).check()).status).toBe("failed");
  const manager = fixture({ sha256: "0".repeat(64) });
  expect((await manager.download()).status).toBe("failed");
  await expect(manager.prepareActivation()).rejects.toThrow("请先下载");
  expect(fs.readdirSync(path.join(root, "updates", "downloads"))).toEqual([]);
});
test("partial transfers cannot be mistaken for a complete package", async () => {
  const manager = fixture({ size: payload.length + 2 });
  expect((await manager.download()).error).toContain("完整性");
});
test("authenticated redirects never forward credentials to another origin", async () => {
  const seen: { url: string; authorization?: string }[] = [];
  const transport = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    seen.push({
      url: String(url),
      authorization:
        new Headers(init?.headers).get("Authorization") ?? undefined,
    });
    return seen.length === 1
      ? new Response(null, {
          status: 302,
          headers: { Location: "https://cdn.example.invalid/manifest.json" },
        })
      : new Response("{}", { status: 404 });
  }) as typeof fetch;
  const result = await fixture({}, transport).check();
  expect(result.status).toBe("failed");
  expect(seen[0].authorization).toBe("Bearer fixture-private-token");
  expect(seen[1].authorization).toBeUndefined();
});
test("ZIP traversal, duplicate paths and escaping links are rejected; contained macOS links work", async () => {
  for (const entries of [
    [{ name: "../outside", body: "bad" }],
    [
      { name: "a", body: "one" },
      { name: "A", body: "two" },
    ],
    [{ name: "app/link", body: "../../outside", mode: 0o120777 }],
  ]) {
    const file = path.join(root, "unsafe.zip");
    fs.writeFileSync(file, zipFixture(entries));
    await expect(validateUpdateZip(file)).rejects.toThrow();
  }
  const file = path.join(root, "mac.zip");
  fs.writeFileSync(
    file,
    zipFixture([
      { name: "App/Framework/Current", body: "Versions/A", mode: 0o120777 },
    ]),
  );
  await expect(validateUpdateZip(file)).resolves.toBeUndefined();
});
test("tampered downloads are rejected before OS extraction", async () => {
  const manager = fixture();
  await manager.download();
  const state = JSON.parse(
    fs.readFileSync(path.join(root, "updates", "state.json"), "utf8"),
  );
  fs.appendFileSync(state.downloaded.file, "tampered");
  await expect(manager.prepareActivation()).rejects.toThrow("已变化");
});
(process.platform === "win32" ? test : test.skip)(
  "activates side-by-side and rolls back without overwriting user configuration",
  async () => {
    const manager = fixture();
    await manager.download();
    fs.writeFileSync(
      path.join(root, "state.json"),
      "fixture user settings and tasks",
    );
    const installed = await manager.prepareActivation();
    expect(fs.existsSync(installed.executable)).toBe(true);
    manager.select(installed);
    expect(await manager.prepareActivation(true)).toEqual({
      executable: path.join(root, "original.exe"),
      version: "0.3.0",
    });
    expect(fs.readFileSync(path.join(root, "state.json"), "utf8")).toBe(
      "fixture user settings and tasks",
    );
    expect(manager.preferredExecutable()).toBe(installed.executable);
  },
);

(process.platform === "darwin" ? test : test.skip)(
  "macOS extracts the matching app with ditto and preserves rollback state",
  async () => {
    const macPayload = zipFixture([
      {
        name: "TingYun Studio.app/Contents/MacOS/TingYun Studio",
        body: "fixture binary",
        mode: 0o100755,
      },
      {
        name: "TingYun Studio.app/Contents/Resources/app.asar",
        body: "fixture archive",
      },
      {
        name: "TingYun Studio.app/Contents/Resources/studio-version.json",
        body: '{"version":"0.3.1"}',
      },
      {
        name: "TingYun Studio.app/Contents/Resources/bundle/tyflow/shared/WORKFLOW.md",
        body: "fixture workflow",
      },
      {
        name: "TingYun Studio.app/Contents/Resources/bundle/skills/frontend-test/SKILL.md",
        body: "fixture skill",
      },
    ]);
    const settings = initialSettings();
    settings.updates = {
      manifestUrl,
      githubRepository: "",
      checkOnLaunch: false,
    };
    const asset = {
      platform: "darwin",
      arch: process.arch,
      name: "studio.zip",
      url: packageUrl,
      size: macPayload.length,
      sha256: createHash("sha256").update(macPayload).digest("hex"),
    };
    const original = path.join(root, "previous-app");
    fs.writeFileSync(original, "previous");
    const transport = (async (url: string | URL | Request) =>
      new Response(
        String(url) === manifestUrl
          ? JSON.stringify({
              schemaVersion: 1,
              version: "0.3.1",
              assets: [asset],
            })
          : new Uint8Array(macPayload),
      )) as typeof fetch;
    const manager = new UpdateManager({
      directory: root,
      version: "0.3.0",
      platform: "darwin",
      arch: process.arch,
      executable: original,
      settings: () => settings,
      secret: () => undefined,
      fetch: transport,
    });
    expect((await manager.download()).status).toBe("downloaded");
    const next = await manager.prepareActivation();
    manager.select(next);
    expect(fs.existsSync(next.executable)).toBe(true);
    expect((await manager.prepareActivation(true)).executable).toBe(original);
  },
);
