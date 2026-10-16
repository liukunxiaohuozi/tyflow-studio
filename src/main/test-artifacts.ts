import fs from "node:fs";
import path from "node:path";

// Only untracked, physically isolated files in this reserved root are evidence.
// Tracked/staged files, links and similarly named business directories stay protected.
export function isTestArtifact(root: string, file: string, changeType: string) {
  const normalized = file.replace(/\\/g, "/");
  const parts = normalized.split("/");
  if (
    changeType !== "untracked" ||
    parts[0] !== "test-results" ||
    parts.length < 2 ||
    parts.some(
      (part) => !part || part === "." || part === ".." || part.includes(":"),
    )
  )
    return false;
  try {
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return false;
      if (i < parts.length - 1 && !stat.isDirectory()) return false;
      if (i === parts.length - 1 && (!stat.isFile() || stat.nlink !== 1))
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isArtifactState(
  root: string,
  file: string,
  state: string | undefined,
) {
  return isTestArtifact(root, file, state?.split(":", 1)[0] ?? "");
}
