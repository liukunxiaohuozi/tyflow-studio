import fs from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import { atomicJson } from "./store";
export class Vault {
  private values: Record<string, string> = {};
  private file: string;
  constructor(directory: string) {
    this.file = path.join(directory, "credentials.json");
    if (fs.existsSync(this.file))
      this.values = JSON.parse(fs.readFileSync(this.file, "utf8"));
  }
  available() {
    return (
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== "linux" ||
        safeStorage.getSelectedStorageBackend() !== "basic_text")
    );
  }
  has(key: string) {
    return Boolean(this.values[key]);
  }
  get(key: string) {
    if (!this.values[key]) return "";
    if (!this.available()) throw new Error("系统凭据加密不可用");
    try {
      return safeStorage.decryptString(Buffer.from(this.values[key], "base64"));
    } catch {
      const next = { ...this.values };
      delete next[key];
      atomicJson(this.file, next);
      this.values = next;
      throw new Error(
        "已保存的加密凭据无法在当前 Windows 用户中读取，失效凭据已清除。请重新输入密码并保存配置后再试。",
      );
    }
  }
  setMany(values: Record<string, string>) {
    if (Object.values(values).some(Boolean) && !this.available())
      throw new Error("系统凭据加密不可用，无法保存密码");
    const next = { ...this.values };
    for (const [key, value] of Object.entries(values)) {
      if (value)
        next[key] = safeStorage.encryptString(value).toString("base64");
      else delete next[key];
    }
    atomicJson(this.file, next);
    this.values = next;
  }
  secrets() {
    return Object.keys(this.values).map((k) => this.get(k));
  }
}
