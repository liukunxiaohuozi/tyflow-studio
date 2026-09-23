import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function resolveBundleRoot(resourcesPath?: string): string | undefined {
  const candidates = [
    resourcesPath ? path.join(resourcesPath, "bundle") : "",
    typeof process !== "undefined" && process.resourcesPath
      ? path.join(process.resourcesPath, "bundle")
      : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "tyflow", "shared", "WORKFLOW.md"))
    )
      return candidate;
  }
  return undefined;
}

export function defaultAgentPaths(
  home = os.homedir(),
  resourcesPath?: string,
): { tyflowDirectory: string; testSkill: string } {
  const bundle = resolveBundleRoot(resourcesPath);
  const bundledTyflow = bundle
    ? path.join(bundle, "tyflow")
    : path.join(home, ".tyflow");
  const bundledSkill = bundle
    ? path.join(bundle, "skills", "frontend-test", "SKILL.md")
    : path.join(home, ".codex", "skills", "frontend-test", "SKILL.md");
  const tyflowDirectory =
    bundle && fs.existsSync(path.join(bundledTyflow, "shared", "WORKFLOW.md"))
      ? bundledTyflow
      : path.join(home, ".tyflow");
  const testSkill = fs.existsSync(bundledSkill)
    ? bundledSkill
    : path.join(home, ".codex", "skills", "frontend-test", "SKILL.md");
  return { tyflowDirectory, testSkill };
}
