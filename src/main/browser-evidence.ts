import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { redact } from "./policy";

export function browserEvidence(
  root: string,
  runId: string,
  kind: string,
  data: unknown | Buffer,
) {
  if (!/^[\w-]+$/.test(runId) || !/^[\w-]+$/.test(kind))
    throw new Error("Invalid evidence identity");
  let directory = root;
  for (const name of ["test-results", `studio-browser-${runId}`]) {
    directory = path.join(directory, name);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
    const info = fs.lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("测试证据目录不能是链接，请使用普通的 test-results 目录");
  }
  const relative = `test-results/studio-browser-${runId}/${kind}-${randomUUID()}.${Buffer.isBuffer(data) ? "png" : "json"}`;
  const bytes = Buffer.isBuffer(data)
    ? data
    : Buffer.from(redact(JSON.stringify(data, null, 2)));
  fs.writeFileSync(path.join(root, relative), bytes, {
    flag: "wx",
    mode: 0o600,
  });
  return {
    path: relative,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
