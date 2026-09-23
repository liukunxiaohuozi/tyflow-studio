import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const decryptString = jest.fn();
const encryptString = jest.fn((value: string) => Buffer.from(`encrypted:${value}`));
jest.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => "dpapi",
    decryptString,
    encryptString,
  },
}));

import { Vault } from "../src/main/vault";

test("clears an undecryptable credential and asks the user to save it again", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tyflow-vault-"));
  try {
    fs.writeFileSync(
      path.join(directory, "credentials.json"),
      JSON.stringify({ zentao: Buffer.from("old-ciphertext").toString("base64") }),
    );
    decryptString.mockImplementationOnce(() => {
      throw new Error("Error while decrypting the ciphertext");
    });
    const vault = new Vault(directory);
    expect(() => vault.get("zentao")).toThrow("请重新输入密码并保存配置");
    expect(vault.has("zentao")).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(directory, "credentials.json"), "utf8"))).toEqual({});
    vault.setMany({ zentao: "new-password" });
    expect(vault.has("zentao")).toBe(true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
