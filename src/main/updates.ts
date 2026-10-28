import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import yauzl from "yauzl";
import type { Settings, UpdateInfo } from "../shared/contracts";
import { atomicJson } from "./store";
import { resolveCommand, runCommand } from "./process";
import { redact } from "./validation";

const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const assetSchema = z.object({
  platform: z.enum(["win32", "darwin"]),
  arch: z.enum(["x64", "arm64"]),
  name: z.string().regex(/^[\w.-]+\.zip$/),
  url: z.string().url(),
  sha256: z.string().regex(/^[a-f\d]{64}$/i),
  size: z.number().int().positive().max(2_000_000_000),
});
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  version,
  notes: z.string().max(20000).optional(),
  assets: z.array(assetSchema).min(1).max(10),
});
type Asset = z.infer<typeof assetSchema>;
interface Installed {
  executable: string;
  version: string;
}
interface UpdateState {
  active?: Installed;
  previous?: Installed;
  downloaded?: { version: string; asset: Asset; file: string };
}
function secureUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("更新地址必须使用 HTTPS");
  return url;
}
export function newer(candidate: string, current: string) {
  const a = version.parse(candidate).split(".").map(Number);
  const b = version.parse(current).split(".").map(Number);
  for (let index = 0; index < 3; index++)
    if (a[index] !== b[index]) return a[index] > b[index];
  return false;
}
export async function fileHash(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/** Validate paths and symlink targets before invoking the OS ZIP extractor. */
export async function validateUpdateZip(file: string) {
  await new Promise<void>((resolve, reject) =>
    yauzl.open(
      file,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) return reject(error ?? new Error("更新包无效"));
        let count = 0,
          total = 0;
        const seen = new Set<string>();
        const fail = (reason: unknown) => {
          zip.close();
          reject(reason);
        };
        zip.on("error", fail);
        zip.on("end", resolve);
        zip.on("entry", (entry) => {
          const name: string = entry.fileName;
          const key = name.replace(/\/$/, "").toLowerCase();
          if (
            ++count > 50000 ||
            (total += entry.uncompressedSize) > 4_000_000_000 ||
            name.includes("\\") ||
            /^[\/]|^[a-z]:/i.test(name) ||
            name.split("/").some((part) => part === "..") ||
            seen.has(key) ||
            entry.generalPurposeBitFlag & 1
          )
            return fail(new Error("更新包包含不安全或重复路径"));
          seen.add(key);
          const mode = entry.externalFileAttributes >>> 16;
          if ((mode & 0o170000) === 0o120000) {
            if (entry.uncompressedSize > 4096)
              return fail(new Error("更新包链接无效"));
            zip.openReadStream(entry, (streamError, stream) => {
              if (streamError || !stream) return fail(streamError);
              let target = "";
              stream.on("data", (chunk) => {
                target += chunk.toString("utf8");
              });
              stream.on("error", fail);
              stream.on("end", () => {
                const resolved = path.posix.normalize(
                  path.posix.join(path.posix.dirname(name), target),
                );
                if (
                  target.includes("\\") ||
                  path.posix.isAbsolute(target) ||
                  /^[a-z]:/i.test(target) ||
                  resolved === ".." ||
                  resolved.startsWith("../")
                )
                  return fail(new Error("更新包链接越出安装目录"));
                zip.readEntry();
              });
            });
          } else zip.readEntry();
        });
        zip.readEntry();
      },
    ),
  );
}

export class UpdateManager {
  private stateFile: string;
  private state: UpdateState;
  private info: UpdateInfo;
  private candidate?: { version: string; asset: Asset };
  private inFlight = false;
  constructor(
    private options: {
      directory: string;
      version: string;
      platform: string;
      arch: string;
      executable: string;
      settings: () => Settings;
      secret: () => string | undefined;
      fetch?: typeof fetch;
    },
  ) {
    this.stateFile = path.join(options.directory, "updates", "state.json");
    try {
      this.state = JSON.parse(fs.readFileSync(this.stateFile, "utf8"));
    } catch {
      this.state = {};
    }
    this.info = { status: "idle", currentVersion: options.version };
  }
  status(): UpdateInfo {
    return {
      ...this.info,
      previousAvailable: Boolean(
        this.state.previous && fs.existsSync(this.state.previous.executable),
      ),
    };
  }
  private save() {
    atomicJson(this.stateFile, this.state);
  }
  private safeError(error: unknown) {
    let secret = "";
    try {
      secret = this.options.secret() ?? "";
    } catch {
      /* Credential decryption itself may have failed. */
    }
    const message = error instanceof Error ? error.message : String(error);
    const english = this.options.settings().language === "en-US";
    // DOMException (AbortSignal.timeout) can cross an Electron/VM realm.
    const name =
      error && typeof error === "object" && "name" in error
        ? String(error.name)
        : "";
    if (/TimeoutError|AbortError/.test(name))
      return english
        ? "The update request timed out. Check your network or system proxy and try again; the latest version could not be confirmed."
        : "更新请求超时，请检查网络或系统代理后重试；本次未能确认是否为最新版本。";
    if (/Redirect was cancelled/i.test(message))
      return english
        ? "The client could not handle the update server redirect. Download the latest client from the release page and install it manually once."
        : "客户端未能处理更新服务器跳转，请从发布页手动下载并安装修复版一次；本次未能确认更新。";
    if (
      /fetch failed|failed to fetch|net::ERR_|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|terminated|interrupted|network/i.test(
        message,
      )
    )
      return english
        ? "Could not connect to the update server. Check your network, VPN or system proxy and try again; the latest version could not be confirmed."
        : "暂时无法连接更新服务器，请检查网络、VPN 或系统代理后重试；本次未能确认是否为最新版本。";
    return redact(message, [secret]);
  }
  private async request(
    url: string,
    accept = "application/json",
    timeout = 30 * 60_000,
  ) {
    const original = secureUrl(url);
    let next = original;
    for (let redirect = 0; redirect < 6; redirect++) {
      const token = this.options.secret();
      const response = await (this.options.fetch ?? fetch)(next.href, {
        headers: {
          Accept: accept,
          ...(token && next.origin === original.origin
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
        redirect: "manual",
        credentials: "omit",
        signal: AbortSignal.timeout(timeout),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("更新下载重定向缺少地址");
        next = secureUrl(new URL(location, next).href);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(
          `更新服务器返回 HTTP ${response.status}${[401, 403, 404].includes(response.status) ? "；请检查更新源、更新 Token、仓库访问权限或服务限流" : ""}`,
        );
      }
      return response;
    }
    throw new Error("更新服务器重定向过多");
  }
  private async json(url: string, accept?: string) {
    const response = await this.request(url, accept, 15_000);
    if (!response.body) throw new Error("更新服务器返回空内容");
    let text = "";
    const decoder = new TextDecoder();
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      text += decoder.decode(chunk, { stream: true });
      if (Buffer.byteLength(text) > 1_000_000) throw new Error("更新清单过大");
    }
    return JSON.parse(text + decoder.decode());
  }
  async check() {
    if (this.inFlight) return this.status();
    this.inFlight = true;
    this.candidate = undefined;
    this.info = { status: "checking", currentVersion: this.options.version };
    try {
      const settings = this.options.settings().updates;
      let manifest: unknown;
      let githubAssets: { name: string; url: string }[] | undefined;
      if (settings?.manifestUrl)
        manifest = await this.json(settings.manifestUrl);
      else {
        const repository = settings?.githubRepository;
        if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository))
          throw new Error("请配置内部更新清单或 GitHub 仓库");
        // Public repositories can fetch the stable release asset directly.
        // This avoids GitHub's low unauthenticated REST API rate limit, while
        // the API path remains available for private repositories and tokens.
        try {
          manifest = await this.json(
            `https://github.com/${repository}/releases/latest/download/update-manifest.json`,
            "application/octet-stream",
          );
        } catch {
          const release = await this.json(
            `https://api.github.com/repos/${repository}/releases/latest`,
          );
          const tag = z
            .object({ tag_name: z.string().optional() })
            .passthrough()
            .parse(release).tag_name;
          const publishedVersion = version.safeParse(tag?.replace(/^v/, ""));
          if (
            publishedVersion.success &&
            !newer(publishedVersion.data, this.options.version)
          ) {
            this.info = {
              status: "current",
              currentVersion: this.options.version,
            };
            return this.status();
          }
          githubAssets = z
            .array(z.object({ name: z.string(), url: z.string().url() }))
            .parse(release.assets);
          const entry = githubAssets.find(
            (asset) => asset.name === "update-manifest.json",
          );
          if (!entry)
            throw new Error(
              "此版本未提供更新清单，请从发布页下载，或发布带 update-manifest.json 的新版本",
            );
          manifest = await this.json(entry.url, "application/octet-stream");
        }
      }
      const parsed = manifestSchema.parse(manifest);
      if (!newer(parsed.version, this.options.version)) {
        this.info = { status: "current", currentVersion: this.options.version };
        return this.status();
      }
      const assets = parsed.assets.filter(
        (asset) =>
          asset.platform === this.options.platform &&
          asset.arch === this.options.arch,
      );
      if (assets.length !== 1) throw new Error("更新包平台或芯片类型不匹配");
      const asset = { ...assets[0] };
      // Private GitHub assets must go through the authenticated release-asset API.
      if (githubAssets) {
        const entry = githubAssets.find((entry) => entry.name === asset.name);
        if (!entry) throw new Error("发布页缺少更新包");
        asset.url = entry.url;
      }
      secureUrl(asset.url);
      this.candidate = { version: parsed.version, asset };
      this.info = {
        status: "available",
        currentVersion: this.options.version,
        version: parsed.version,
        notes: parsed.notes,
      };
      const saved = this.state.downloaded;
      if (
        saved?.version === parsed.version &&
        saved.asset.sha256 === asset.sha256 &&
        fs.existsSync(saved.file)
      )
        this.info.status = "downloaded";
    } catch (error) {
      this.info.status = "failed";
      this.info.error = this.safeError(error);
    } finally {
      this.inFlight = false;
    }
    return this.status();
  }
  async download() {
    if (this.inFlight) return this.status();
    if (!this.candidate) await this.check();
    if (!this.candidate) return this.status();
    this.inFlight = true;
    this.info = {
      ...this.info,
      status: "downloading",
      progress: 0,
      error: undefined,
    };
    const { asset, version: targetVersion } = this.candidate;
    const directory = path.join(this.options.directory, "updates", "downloads");
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `${randomUUID()}.zip`);
    let handle: fs.promises.FileHandle | undefined;
    try {
      const response = await this.request(
        asset.url,
        "application/octet-stream",
      );
      if (!response.body) throw new Error("更新包为空");
      handle = await fs.promises.open(file, "wx", 0o600);
      let size = 0;
      const hash = createHash("sha256");
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.byteLength;
        if (size > asset.size) throw new Error("更新包大小与清单不符");
        hash.update(chunk);
        const data = Buffer.from(chunk);
        for (let offset = 0; offset < data.length;)
          offset += (await handle.write(data, offset, data.length - offset))
            .bytesWritten;
        this.info.progress = Math.floor((size * 100) / asset.size);
      }
      await handle.close();
      handle = undefined;
      if (
        size !== asset.size ||
        hash.digest("hex") !== asset.sha256.toLowerCase()
      )
        throw new Error("更新包完整性校验失败，请重新下载");
      await validateUpdateZip(file);
      this.state.downloaded = { version: targetVersion, asset, file };
      this.save();
      this.info.status = "downloaded";
    } catch (error) {
      await handle?.close();
      if (fs.existsSync(file)) fs.unlinkSync(file);
      this.info.status = "failed";
      this.info.error = this.safeError(error);
    } finally {
      this.inFlight = false;
    }
    return this.status();
  }
  async prepareActivation(rollback = false): Promise<Installed> {
    if (this.inFlight) throw new Error("更新检查或下载中，请稍后重试");
    if (rollback) {
      const previous = this.state.previous;
      if (!previous || !fs.existsSync(previous.executable))
        throw new Error("没有可回退的上一版本");
      return previous;
    }
    const download = this.state.downloaded;
    if (
      !download ||
      download.asset.platform !== this.options.platform ||
      download.asset.arch !== this.options.arch
    )
      throw new Error("请先下载匹配平台的更新");
    if ((await fileHash(download.file)) !== download.asset.sha256.toLowerCase())
      throw new Error("更新文件已变化，请重新下载");
    await validateUpdateZip(download.file);
    const directory = path.join(
      this.options.directory,
      "updates",
      "versions",
      `${download.version}-${randomUUID()}`,
    );
    fs.mkdirSync(directory, { recursive: true });
    if (this.options.platform === "darwin")
      await runCommand(
        { executable: "/usr/bin/ditto", args: [] },
        ["-x", "-k", download.file, directory],
        { cwd: directory, timeout: 120_000 },
      );
    else if (this.options.platform === "win32") {
      const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
      await runCommand(
        resolveCommand("powershell"),
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Expand-Archive -LiteralPath ${quote(download.file)} -DestinationPath ${quote(directory)}`,
        ],
        { cwd: directory, timeout: 120_000 },
      );
    } else throw new Error("当前平台不支持内部更新");
    const executable =
      this.options.platform === "darwin"
        ? path.join(
            directory,
            "TingYun Studio.app",
            "Contents",
            "MacOS",
            "TingYun Studio",
          )
        : path.join(directory, "TingYun Studio.exe");
    const resources =
      this.options.platform === "darwin"
        ? path.join(directory, "TingYun Studio.app", "Contents", "Resources")
        : path.join(directory, "resources");
    if (
      !fs.existsSync(executable) ||
      !fs.existsSync(path.join(resources, "app.asar")) ||
      JSON.parse(
        fs.readFileSync(path.join(resources, "studio-version.json"), "utf8"),
      ).version !== download.version
    )
      throw new Error("更新包缺少应用文件或版本不符");
    if (
      !fs.existsSync(
        path.join(resources, "bundle", "tyflow", "shared", "WORKFLOW.md"),
      ) ||
      !fs.existsSync(
        path.join(resources, "bundle", "skills", "frontend-test", "SKILL.md"),
      )
    )
      throw new Error("更新包缺少配套技能");
    return { executable, version: download.version };
  }
  select(installed: Installed) {
    this.state.previous = {
      executable: this.options.executable,
      version: this.options.version,
    };
    this.state.active = installed;
    this.save();
  }
  preferredExecutable() {
    const active = this.state.active;
    if (
      !active ||
      active.version === this.options.version ||
      !version.safeParse(active.version).success ||
      !fs.existsSync(active.executable)
    )
      return undefined;
    if (newer(active.version, this.options.version)) return active.executable;

    // Only the exact runtime that explicitly selected a rollback may redirect
    // backwards. A manually installed newer app must not inherit stale selection.
    const previous = this.state.previous;
    const executableKey = (file: string) => {
      const resolved = fs.existsSync(file)
        ? fs.realpathSync(file)
        : path.resolve(file);
      return this.options.platform === "win32"
        ? resolved.toLowerCase()
        : resolved;
    };
    if (
      previous?.version === this.options.version &&
      executableKey(previous.executable) ===
        executableKey(this.options.executable)
    )
      return active.executable;
    this.state.previous = active;
    this.state.active = {
      executable: this.options.executable,
      version: this.options.version,
    };
    this.save();
    return undefined;
  }
}
