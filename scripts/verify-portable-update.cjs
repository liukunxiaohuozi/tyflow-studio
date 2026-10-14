const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { Readable } = require("node:stream");
const { createHash } = require("node:crypto");
const esbuild = require("esbuild");

async function main() {
  const root = path.resolve(__dirname, "..");
  const packageInfo = require(path.join(root, "package.json"));
  if (process.platform !== "win32")
    throw new Error("This verification targets the Windows portable package");
  const packageFile = path.join(
    root,
    "release",
    `TingYun-Studio-${packageInfo.version}-Windows-x64-portable.zip`,
  );
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "studio-real-update-"),
  );
  const evidence = path.join(root, "test-results", "portable-update.json");
  try {
    const hash = createHash("sha256");
    for await (const chunk of fs.createReadStream(packageFile))
      hash.update(chunk);
    const sha256 = hash.digest("hex"),
      size = fs.statSync(packageFile).size;
    esbuild.buildSync({
      entryPoints: [path.join(root, "src", "main", "updates.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: path.join(temporary, "updates.cjs"),
    });
    const { UpdateManager } = require(path.join(temporary, "updates.cjs"));
    const previous = path.join(temporary, "previous-client.exe");
    fs.writeFileSync(previous, "fixture previous client");
    const manifestUrl = "https://internal.example.invalid/manifest.json",
      archiveUrl = "https://internal.example.invalid/package.zip";
    const manifest = {
      schemaVersion: 1,
      version: packageInfo.version,
      assets: [
        {
          platform: "win32",
          arch: "x64",
          name: path.basename(packageFile),
          url: archiveUrl,
          sha256,
          size,
        },
      ],
    };
    const manager = new UpdateManager({
      directory: temporary,
      version: "0.2.17",
      platform: "win32",
      arch: "x64",
      executable: previous,
      settings: () => ({
        updates: { manifestUrl, githubRepository: "", checkOnLaunch: false },
      }),
      secret: () => undefined,
      fetch: async (url) =>
        String(url) === manifestUrl
          ? new Response(JSON.stringify(manifest))
          : new Response(Readable.toWeb(fs.createReadStream(packageFile))),
    });
    fs.writeFileSync(
      path.join(temporary, "state.json"),
      "retained user settings and tasks",
    );
    if ((await manager.check()).status !== "available")
      throw new Error("Candidate update was not recognized");
    const downloaded = await manager.download();
    if (downloaded.status !== "downloaded")
      throw new Error(downloaded.error || "Actual package download failed");
    const installed = await manager.prepareActivation();
    manager.select(installed);
    if (!fs.existsSync(installed.executable))
      throw new Error("Extracted application is missing");
    if ((await manager.prepareActivation(true)).executable !== previous)
      throw new Error("Rollback identity is missing");
    if (
      fs.readFileSync(path.join(temporary, "state.json"), "utf8") !==
      "retained user settings and tasks"
    )
      throw new Error("User data was overwritten");
    fs.mkdirSync(path.dirname(evidence), { recursive: true });
    fs.writeFileSync(
      evidence,
      JSON.stringify(
        {
          passed: true,
          mode: "real Windows package and native extraction; fixture network",
          version: packageInfo.version,
          size,
          sha256,
          checks: [
            "streamed download",
            "platform and hash verification",
            "ZIP validation",
            "native extraction",
            "app and skill versions",
            "side-by-side installation",
            "rollback selection",
            "user-data preservation",
          ],
        },
        null,
        2,
      ),
    );
    console.log(`Real portable update verified. Evidence: ${evidence}`);
  } finally {
    await fs.promises.rm(temporary, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
