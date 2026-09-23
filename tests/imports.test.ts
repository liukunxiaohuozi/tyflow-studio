import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssetManager } from "../src/main/imports";

// Minimal stored ZIP fixtures with valid central-directory metadata and CRC32.
function zip(
  entries: {
    name: string;
    body: string;
    mode?: number;
    declaredSize?: number;
  }[],
) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const body = Buffer.from(entry.body);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.declaredSize ?? body.length, 22);
    local.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(0x0314, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(entry.declaredSize ?? body.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38);
    c.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    central.push(c, name);
    offset += local.length + name.length + body.length;
  }
  const c = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(c.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, c, end]);
}
let root: string;
let manager: AssetManager;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "tyflow-assets-test-"));
  manager = new AssetManager(join(root, "assets"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("pasted screenshots persist, deduplicate and reopen without a clipboard file path", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNu0AAAAASUVORK5CYII=",
    "base64",
  );
  const [first, duplicate] = await Promise.all([
    manager.importImage(png),
    manager.importImage(png),
  ]);
  expect(first.kind).toBe("attachment");
  expect(first.name).toMatch(/^截图-\d+\.png$/);
  expect(duplicate.id).toBe(first.id);
  expect(manager.all()).toHaveLength(1);
  const reopened = new AssetManager(join(root, "assets"));
  expect(reopened.get(first.id)).toEqual(first);
  expect(await readFile(reopened.filePath(first.id))).toEqual(png);
  await expect(
    manager.importImage(Buffer.from("not an image")),
  ).rejects.toThrow("截图无效");
  await expect(
    manager.importImage(Buffer.alloc(20 * 1024 * 1024 + 1)),
  ).rejects.toThrow("20 MB");
  expect(manager.all()).toHaveLength(1);
});
test("imports actual design pages and persists metadata", async () => {
  const input = join(root, "design.zip");
  await writeFile(
    input,
    zip([
      { name: "index.html", body: "<h1>Demo</h1>" },
      { name: "assets/style.css", body: "body{}" },
      { name: "page.html", body: "<p>two</p>" },
    ]),
  );
  const [asset] = await manager.importFiles([input], "design");
  expect(asset.pages).toEqual(["index.html", "page.html"]);
  expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(await readFile(manager.filePath(asset.id), "utf8")).toContain("Demo");
  expect(new AssetManager(join(root, "assets")).get(asset.id)).toEqual(asset);
  expect(() => manager.filePath(asset.id, "../outside")).toThrow();
});
test.each([
  "../outside.html",
  "/absolute.html",
  "C:/drive.html",
  "a\\backslash.html",
  "a/../../escape.html",
  "CON.html",
])("rejects unsafe ZIP path %s", async (name) => {
  const input = join(root, "bad.zip");
  await writeFile(input, zip([{ name, body: "x" }]));
  await expect(manager.importFiles([input], "design")).rejects.toThrow();
  expect(manager.all()).toEqual([]);
});
test("rejects symlink entries and excessive declared size", async () => {
  const input = join(root, "bad.zip");
  await writeFile(
    input,
    zip([{ name: "link.html", body: "../target", mode: 0o120777 }]),
  );
  await expect(manager.importFiles([input], "design")).rejects.toThrow();
  await writeFile(
    input,
    zip([{ name: "index.html", body: "", declaredSize: 100 * 1024 * 1024 }]),
  );
  await expect(manager.importFiles([input], "design")).rejects.toThrow();
});
test("deduplicates same content and validates attachment extensions", async () => {
  const input = join(root, "error.log");
  await writeFile(input, "actual log");
  const [asset] = await manager.importFiles([input, input], "attachment");
  expect(manager.all()).toHaveLength(1);
  expect(await readFile(manager.filePath(asset.id), "utf8")).toBe("actual log");
  expect((await manager.importFiles([input], "attachment"))[0].id).toBe(
    asset.id,
  );
  const bad = join(root, "run.exe");
  await writeFile(bad, "executable");
  await expect(manager.importFiles([bad], "attachment")).rejects.toThrow();
});
test("rejects design bundles with no HTML and oversized standalone files", async () => {
  const input = join(root, "empty.zip");
  await writeFile(input, zip([{ name: "readme.md", body: "text only" }]));
  await expect(manager.importFiles([input], "design")).rejects.toThrow();
});
test("compares relative paths and actual content for design pages and resources", async () => {
  const beforePath = join(root, "before.zip");
  const afterPath = join(root, "after.zip");
  await writeFile(
    beforePath,
    zip([
      { name: "index.html", body: "<h1>Before</h1>" },
      { name: "assets/style.css", body: "body{color:red}" },
      { name: "assets/app.js", body: "window.demo = true;" },
      { name: "removed.html", body: "<p>Removed</p>" },
    ]),
  );
  await writeFile(
    afterPath,
    zip([
      { name: "index.html", body: "<h1>After</h1>" },
      { name: "assets/style.css", body: "body{color:blue}" },
      { name: "assets/app.js", body: "window.demo = true;" },
      { name: "added.html", body: "<p>Added</p>" },
    ]),
  );
  const [before, after] = await manager.importFiles(
    [beforePath, afterPath],
    "design",
  );
  expect(await manager.compareDesigns(before.id, after.id)).toEqual({
    added: ["added.html"],
    removed: ["removed.html"],
    changed: ["assets/style.css", "index.html"],
    unchanged: 1,
  });
  expect(await manager.compareDesigns(before.id, before.id)).toEqual({
    added: [],
    removed: [],
    changed: [],
    unchanged: 4,
  });
});
test("design comparison reads current file content and rejects attachments", async () => {
  const beforePath = join(root, "before.zip");
  const afterPath = join(root, "after.zip");
  await writeFile(beforePath, zip([{ name: "index.html", body: "one" }]));
  await writeFile(afterPath, zip([{ name: "index.html", body: "two" }]));
  const [before, after] = await manager.importFiles(
    [beforePath, afterPath],
    "design",
  );
  await writeFile(manager.filePath(after.id), "one");
  expect(await manager.compareDesigns(before.id, after.id)).toEqual({
    added: [],
    removed: [],
    changed: [],
    unchanged: 1,
  });
  const logPath = join(root, "error.log");
  await writeFile(logPath, "log");
  const [attachment] = await manager.importFiles([logPath], "attachment");
  await expect(
    manager.compareDesigns(before.id, attachment.id),
  ).rejects.toThrow(/design/i);
  await expect(manager.compareDesigns("unknown", after.id)).rejects.toThrow();
});
