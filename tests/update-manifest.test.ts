import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

test("release manifest enumerates the three exact platforms with independent file hashes", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "studio-manifest-"));
  try {
    for (const identity of ["Windows-x64", "macOS-x64", "macOS-arm64"])
      fs.writeFileSync(
        path.join(directory, `TingYun-Studio-0.3.0-${identity}-portable.zip`),
        `fixture ${identity}`,
      );
    execFileSync(
      process.execPath,
      [
        path.join(__dirname, "..", "scripts", "create-update-manifest.cjs"),
        directory,
      ],
      {
        env: {
          ...process.env,
          GITHUB_REF_NAME: "v0.3.0",
          GITHUB_REPOSITORY: "fixture/studio",
        },
      },
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, "update-manifest.json"), "utf8"),
    );
    expect(manifest.version).toBe("0.3.0");
    expect(
      manifest.assets
        .map(
          (asset: { platform: string; arch: string }) =>
            `${asset.platform}:${asset.arch}`,
        )
        .sort(),
    ).toEqual(["darwin:arm64", "darwin:x64", "win32:x64"]);
    for (const asset of manifest.assets) {
      const file = fs.readFileSync(path.join(directory, asset.name));
      expect(asset.size).toBe(file.length);
      expect(asset.sha256).toBe(
        createHash("sha256").update(file).digest("hex"),
      );
      expect(asset.url).toContain(
        "https://github.com/fixture/studio/releases/download/v0.3.0/",
      );
    }
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
