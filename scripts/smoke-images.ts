import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app, nativeImage } from "electron";
import { normalizeScreenshot, screenshotThumbnail } from "../src/main/images";
import { AssetManager } from "../src/main/imports";

void app
  .whenReady()
  .then(async () => {
    const root = await mkdtemp(join(tmpdir(), "tyflow-native-images-"));
    try {
      const source = nativeImage.createFromBitmap(
        Buffer.alloc(800 * 600 * 4, 180),
        { width: 800, height: 600 },
      );
      const manager = new AssetManager(root);
      const png = normalizeScreenshot(new Uint8Array(source.toPNG()));
      const first = await manager.importImage(png);
      const duplicate = await manager.importImage(png);
      assert.equal(duplicate.id, first.id);
      const restored = new AssetManager(root);
      const thumbnail = nativeImage.createFromDataURL(
        screenshotThumbnail(restored.filePath(first.id)),
      );
      assert.deepEqual(thumbnail.getSize(), { width: 427, height: 320 });
      assert.deepEqual(
        nativeImage
          .createFromBuffer(normalizeScreenshot(source.toJPEG(85)))
          .getSize(),
        { width: 800, height: 600 },
      );
      assert.throws(
        () => normalizeScreenshot(Buffer.from("<svg></svg>")),
        /无法识别/,
      );
      assert.throws(() => normalizeScreenshot("not bytes"), /截图无效/);
      assert.throws(
        () => normalizeScreenshot(new Uint8Array(20 * 1024 * 1024 + 1)),
        /20 MB/,
      );
      console.log(
        "PASS native screenshot decoding (PNG/JPEG), validation, persistence, deduplication and thumbnail read-back",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
