/* eslint-disable @typescript-eslint/no-require-imports -- Electron's standalone fixture entry is CommonJS. */
// Only used by the isolated Electron regression; never included in packaged Studio.
const { net } = require("electron");
const { version } = require("../../package.json");
globalThis.updateCheckFixture = { mode: "current", requests: [] };
net.fetch = async (input) => {
  const url = String(input);
  const fixture = globalThis.updateCheckFixture;
  fixture.requests.push(url);
  if (fixture.mode === "offline") throw new TypeError("fetch failed");
  if (url.endsWith("/releases/latest"))
    return new Response(
      JSON.stringify({
        tag_name: `v${fixture.mode === "newer" ? "99.0.0" : version}`,
        assets: [
          {
            name: "update-manifest.json",
            url: "https://updates.example.invalid/manifest",
          },
          {
            name: "fixture.zip",
            url: "https://updates.example.invalid/package",
          },
        ],
      }),
    );
  if (
    url === "https://updates.example.invalid/manifest" &&
    fixture.mode === "newer"
  )
    return new Response(
      JSON.stringify({
        schemaVersion: 1,
        version: "99.0.0",
        assets: [
          {
            platform: process.platform,
            arch: process.arch,
            name: "fixture.zip",
            url: "https://updates.example.invalid/package",
            size: 100,
            sha256: "0".repeat(64),
          },
        ],
      }),
    );
  throw new Error(
    "Unexpected request: equal releases must not fetch a manifest or package",
  );
};
// An accidental regression to Node fetch must fail instead of reaching the internet.
globalThis.fetch = async () => {
  throw new Error("Studio must use the Electron update transport");
};
require("../../dist/main/index.cjs");
