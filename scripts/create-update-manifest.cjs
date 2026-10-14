const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

async function main() {
  const directory = process.argv[2] || "release-artifacts";
  const repository =
    process.env.GITHUB_REPOSITORY || "liukunxiaohuozi/tyflow-studio";
  const tag = process.env.GITHUB_REF_NAME;
  if (!/^v\d+\.\d+\.\d+$/.test(tag || ""))
    throw new Error("A version tag is required");
  const assets = [];
  for (const name of fs
    .readdirSync(directory)
    .filter((name) => name.endsWith("-portable.zip"))) {
    const match =
      /^TingYun-Studio-(\d+\.\d+\.\d+)-(Windows|macOS)-(x64|arm64)-portable\.zip$/.exec(
        name,
      );
    if (!match || `v${match[1]}` !== tag)
      throw new Error(`Unexpected package ${name}`);
    const file = path.join(directory, name);
    const hash = createHash("sha256");
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    assets.push({
      platform: match[2] === "Windows" ? "win32" : "darwin",
      arch: match[3],
      name,
      url: `https://github.com/${repository}/releases/download/${tag}/${name}`,
      sha256: hash.digest("hex"),
      size: fs.statSync(file).size,
    });
  }
  if (assets.length !== 3)
    throw new Error("Expected Windows x64 and macOS x64/arm64 packages");
  const identities = new Set(
    assets.map((asset) => `${asset.platform}:${asset.arch}`),
  );
  if (
    !["win32:x64", "darwin:x64", "darwin:arm64"].every((identity) =>
      identities.has(identity),
    )
  )
    throw new Error("The expected platform/architecture matrix is incomplete");
  fs.writeFileSync(
    path.join(directory, "update-manifest.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        version: tag.slice(1),
        notes: `TingYun Studio ${tag}`,
        assets,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
