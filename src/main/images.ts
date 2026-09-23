import { nativeImage } from "electron";
export function normalizeScreenshot(bytes: unknown): Buffer {
  if (
    !(bytes instanceof Uint8Array) ||
    !bytes.byteLength ||
    bytes.byteLength > 20 * 1024 * 1024
  )
    throw new Error("截图无效或超过 20 MB");
  const image = nativeImage.createFromBuffer(Buffer.from(bytes));
  const size = image.getSize();
  if (image.isEmpty() || size.width * size.height > 40_000_000)
    throw new Error("无法识别截图，或图片尺寸过大，请使用 PNG/JPG 截图重试");
  const png = image.toPNG();
  if (png.length > 20 * 1024 * 1024) throw new Error("截图超过 20 MB");
  return png;
}
export function screenshotThumbnail(file: string): string {
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) throw new Error("无法预览该图片");
  const size = image.getSize();
  const scale = Math.min(1, 480 / size.width, 320 / size.height);
  return image
    .resize({
      width: Math.max(1, Math.round(size.width * scale)),
      height: Math.max(1, Math.round(size.height * scale)),
    })
    .toDataURL();
}
