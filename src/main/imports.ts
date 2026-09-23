import { createHash, randomUUID } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  lstatSync,
} from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as yauzl from "yauzl";
import type { AssetDiff, FileAsset } from "../shared/contracts";

const MAX_INPUT = 100 * 1024 * 1024;
const MAX_FILE = 50 * 1024 * 1024;
const MAX_TOTAL = 200 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const ATTACHMENTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".txt",
  ".log",
]);
const DESIGN_FILES = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".map",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ico",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".md",
  ".txt",
]);
function safeName(name: string): string {
  if (
    !name ||
    /[\x00-\x1f\\:]/.test(name) ||
    name.startsWith("/") ||
    isAbsolute(name)
  )
    throw new Error("Unsafe file path in design package");
  const parts = name.replace(/\/$/, "").split("/");
  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
    )
  )
    throw new Error("Unsafe file path in design package");
  return name;
}
function inside(root: string, target: string) {
  const rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel))
    throw new Error("Asset path is outside its content directory");
  return target;
}
async function sha256(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
function clone(asset: FileAsset): FileAsset {
  return structuredClone(asset);
}

export class AssetManager {
  private root: string;
  private assets: FileAsset[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  constructor(root: string) {
    mkdirSync(resolve(root), { recursive: true });
    this.root = realpathSync(resolve(root));
    const index = join(this.root, "assets.json");
    if (existsSync(index)) {
      const raw = readFileSync(index, "utf8");
      if (raw.length > 10 * 1024 * 1024)
        throw new Error("Asset metadata is too large");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Invalid asset metadata");
      this.assets = parsed.map((value) => {
        const asset = value as FileAsset;
        if (
          !asset ||
          !/^[a-f0-9-]{36}$/.test(asset.id) ||
          !["design", "attachment"].includes(asset.kind) ||
          typeof asset.name !== "string" ||
          !Number.isSafeInteger(asset.size) ||
          asset.size < 0 ||
          !/^[a-f0-9]{64}$/.test(asset.sha256) ||
          !Array.isArray(asset.entries) ||
          !asset.entries.length ||
          asset.entries.length > MAX_ENTRIES
        )
          throw new Error("Invalid asset metadata");
        asset.entries.forEach(safeName);
        asset.pages?.forEach((page) => {
          safeName(page);
          if (!asset.entries!.includes(page))
            throw new Error("Invalid asset page");
        });
        return asset;
      });
    }
  }
  all(): FileAsset[] {
    return this.assets.map(clone);
  }
  get(id: string): FileAsset {
    const asset = this.assets.find((item) => item.id === id);
    if (!asset) throw new Error("Attachment does not exist");
    return clone(asset);
  }
  rootPath(id: string): string {
    this.get(id);
    return inside(this.root, realpathSync(join(this.root, id, "content")));
  }
  async compareDesigns(beforeId: string, afterId: string): Promise<AssetDiff> {
    const before = this.get(beforeId);
    const after = this.get(afterId);
    if (before.kind !== "design" || after.kind !== "design")
      throw new Error("Only design assets can be compared");
    const beforeEntries = new Set(before.entries ?? []);
    const afterEntries = new Set(after.entries ?? []);
    const result: AssetDiff = {
      added: [...afterEntries]
        .filter((entry) => !beforeEntries.has(entry))
        .sort(),
      removed: [...beforeEntries]
        .filter((entry) => !afterEntries.has(entry))
        .sort(),
      changed: [],
      unchanged: 0,
    };
    // Metadata describes imported paths. Content hashes are recomputed from the
    // actual files, including styles/scripts/images, without loading or executing them.
    for (const entry of result.added) this.filePath(afterId, entry);
    for (const entry of result.removed) this.filePath(beforeId, entry);
    for (const entry of [...beforeEntries].sort()) {
      if (!afterEntries.has(entry)) continue;
      const beforeHash = await sha256(this.filePath(beforeId, entry));
      const afterHash = await sha256(this.filePath(afterId, entry));
      if (beforeHash === afterHash) result.unchanged++;
      else result.changed.push(entry);
    }
    return result;
  }
  filePath(id: string, page?: string): string {
    const asset = this.get(id);
    const entry = page || asset.pages?.[0] || asset.entries?.[0];
    if (!entry || !asset.entries?.includes(entry))
      throw new Error("The requested asset file does not exist");
    safeName(entry);
    const assetRoot = join(this.root, id, "content");
    const target = inside(assetRoot, resolve(assetRoot, entry));
    // Recheck physical containment as well as lexical paths, including symlinked ancestors.
    const physicalRoot = realpathSync(assetRoot);
    inside(this.root, physicalRoot);
    const physicalTarget = realpathSync(target);
    inside(physicalRoot, physicalTarget);
    if (!lstatSync(physicalTarget).isFile())
      throw new Error("The asset is not a regular file");
    return physicalTarget;
  }
  importFiles(
    paths: string[],
    kind: "design" | "attachment",
  ): Promise<FileAsset[]> {
    const operation = this.queue.then(() => this.importBatch(paths, kind));
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  importImage(png: Buffer): Promise<FileAsset> {
    if (
      !Buffer.isBuffer(png) ||
      !png.length ||
      png.length > 20 * 1024 * 1024 ||
      !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return Promise.reject(new Error("截图无效或超过 20 MB"));
    // Main IPC decodes and normalizes the clipboard image before reaching storage.
    const operation = this.queue.then(async () => {
      const temporary = join(this.root, `clipboard-${randomUUID()}`);
      await mkdir(temporary);
      const file = join(temporary, `截图-${Date.now()}.png`);
      try {
        await writeFile(file, png, { mode: 0o600 });
        return (await this.importBatch([file], "attachment"))[0];
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  private async importBatch(
    paths: string[],
    kind: "design" | "attachment",
  ): Promise<FileAsset[]> {
    if (
      !Array.isArray(paths) ||
      !paths.length ||
      paths.length > 20 ||
      !["design", "attachment"].includes(kind)
    )
      throw new Error("Choose between 1 and 20 supported files");
    const result: FileAsset[] = [];
    for (const path of paths) {
      if (typeof path !== "string" || !isAbsolute(path))
        throw new Error("An absolute input path is required");
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink())
        throw new Error("Only regular files may be imported");
      if (info.size > MAX_INPUT) throw new Error("Input file exceeds 100 MB");
      const extension = extname(path).toLowerCase();
      if (
        kind === "design"
          ? ![".html", ".htm", ".zip"].includes(extension)
          : !ATTACHMENTS.has(extension)
      )
        throw new Error("Unsupported file type");
      const hash = await sha256(path);
      const prior = this.assets.find(
        (asset) => asset.sha256 === hash && asset.kind === kind,
      );
      if (prior) {
        if (!result.some((asset) => asset.id === prior.id))
          result.push(clone(prior));
        continue;
      }
      const id = randomUUID();
      const assetDirectory = join(this.root, id);
      const content = join(assetDirectory, "content");
      await mkdir(content, { recursive: true });
      try {
        let entries: string[];
        if (extension === ".zip") entries = await this.extract(path, content);
        else {
          if (info.size > MAX_FILE)
            throw new Error("Individual file exceeds 50 MB");
          const name = safeName(basename(path));
          await copyFile(path, join(content, name));
          entries = [name];
        }
        const pages = entries
          .filter((name) => /\.html?$/i.test(name))
          .sort(
            (a, b) =>
              (basename(a).toLowerCase() === "index.html" ? -1 : 0) -
                (basename(b).toLowerCase() === "index.html" ? -1 : 0) ||
              a.localeCompare(b),
          );
        if (kind === "design" && !pages.length)
          throw new Error("No HTML page was found in the design package");
        const asset: FileAsset = {
          id,
          name: basename(path),
          size: info.size,
          kind,
          entries,
          pages: kind === "design" ? pages : undefined,
          sha256: hash,
          summary:
            kind === "design"
              ? `${entries.length} files; ${pages.length} HTML pages. File facts only; requirements must be confirmed.${extension !== ".zip" ? " Standalone HTML: external assets are not included." : ""}`
              : `${info.size} bytes; ${extension.slice(1).toUpperCase()} attachment`,
        };
        this.assets.push(asset);
        try {
          await this.persist();
        } catch (error) {
          this.assets = this.assets.filter((item) => item.id !== id);
          throw error;
        }
        result.push(clone(asset));
      } catch (error) {
        await rm(assetDirectory, { recursive: true, force: true });
        throw error;
      }
    }
    return result;
  }
  private async persist() {
    const temp = join(this.root, `assets-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(this.assets, null, 2), {
      mode: 0o600,
    });
    await rename(temp, join(this.root, "assets.json"));
  }
  private async extract(input: string, destination: string): Promise<string[]> {
    const zip = await new Promise<yauzl.ZipFile>((resolveZip, reject) =>
      yauzl.open(
        input,
        {
          lazyEntries: true,
          autoClose: true,
          validateEntrySizes: true,
          strictFileNames: true,
        },
        (error, file) =>
          error || !file
            ? reject(error || new Error("Invalid ZIP"))
            : resolveZip(file),
      ),
    );
    return new Promise<string[]>((resolveEntries, reject) => {
      const entries: string[] = [];
      const names = new Set<string>();
      let count = 0;
      let total = 0;
      let ended = false;
      const fail = (error: unknown) => {
        if (ended) return;
        ended = true;
        zip.close();
        reject(error);
      };
      zip.on("error", fail);
      zip.on("end", () => {
        if (!ended) {
          ended = true;
          resolveEntries(entries);
        }
      });
      zip.on("entry", (entry: yauzl.Entry) => {
        void (async () => {
          if (++count > MAX_ENTRIES)
            throw new Error("Design package exceeds 2000 entries");
          const name = safeName(entry.fileName);
          const identity = name.replace(/\/$/, "").toLowerCase();
          if (names.has(identity))
            throw new Error("Duplicate or case-colliding ZIP entry");
          names.add(identity);
          const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (mode && mode !== 0o100000 && mode !== 0o040000)
            throw new Error("ZIP links and special files are not supported");
          if (entry.generalPurposeBitFlag & 1)
            throw new Error("Encrypted ZIP entries are not supported");
          if (
            entry.uncompressedSize > MAX_FILE ||
            total + entry.uncompressedSize > MAX_TOTAL
          )
            throw new Error("ZIP exceeds safe uncompressed size limits");
          const target = inside(destination, resolve(destination, name));
          if (name.endsWith("/")) {
            await mkdir(target, { recursive: true });
            zip.readEntry();
            return;
          }
          if (
            !DESIGN_FILES.has(extname(name).toLowerCase()) &&
            !/^(README|LICENSE)$/i.test(basename(name))
          )
            throw new Error("Unsupported file in design package");
          await mkdir(dirname(target), { recursive: true });
          const stream = await new Promise<import("node:stream").Readable>(
            (resolveStream, rejectStream) =>
              zip.openReadStream(entry, (error, inputStream) =>
                error || !inputStream
                  ? rejectStream(error || new Error("Invalid ZIP stream"))
                  : resolveStream(inputStream),
              ),
          );
          let bytes = 0;
          const limiter = new Transform({
            transform(chunk: Buffer, _encoding, done) {
              bytes += chunk.length;
              total += chunk.length;
              if (bytes > MAX_FILE || total > MAX_TOTAL)
                done(new Error("ZIP stream exceeded extraction limit"));
              else done(null, chunk);
            },
          });
          await pipeline(
            stream,
            limiter,
            createWriteStream(target, { flags: "wx", mode: 0o600 }),
          );
          if (bytes !== entry.uncompressedSize)
            throw new Error("ZIP file size mismatch");
          entries.push(name);
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
  }
}
