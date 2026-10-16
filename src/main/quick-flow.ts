import type { Task } from "../shared/contracts";
import { ProviderFailure } from "./workflow/failures";

export function developmentInstructions(task: Task, directFix: boolean) {
  const review = task.autoTest
    ? "The user explicitly opted into automated testing. Studio will run the professional test provider afterwards; do not duplicate its full suite."
    : "Automated testing is OFF. After focused checks, hand back for manual review in the user's already-running browser. Do not request browser login, install browsers, start a dev server, or claim formal acceptance.";
  if (task.workflowMode === "quick")
    return `L1 QUICK MODIFICATION, explicitly authorized by the user's Start modification action. Work only in this current checkout/branch so its existing dev server can hot reload. Locate the affected files with a narrow search, then implement the smallest change. Read applicable repository AGENTS.md and the relevant local conventions, not the entire workflow/manual/skill tree. No separate assessment, plan approval or final verification document. Never install dependencies, fetch/pull/checkout, run a full build/test suite, commit, push or open browsers. Reuse installed tools for focused incremental type/lint/syntax checks; for changed pure logic use a relevant existing unit test. For copy changes retain project i18n wrapping, run its configured scan once when applicable and preserve existing translations. Missing tools mean an honest unexecuted check, not an automatic installation. If the request requires permissions, API-contract changes, shared infrastructure, dependency/config changes or unclear business semantics, stop with a specific blocker rather than expanding scope. Return actual check evidence and a brief change summary. ${review}`;
  return `${directFix ? "The user explicitly chose direct Bug repair: diagnose and implement the smallest safe fix; no separate planning call." : "Implement the approved plan below. Assessment and file discovery already ran; start with expectedFiles and reuse that context. Do not reload the entire workflow or repeat the approval."} Preserve existing work. Run only focused low-cost development feedback, not a full completion-verification suite. Do not claim release readiness. ${review}`;
}

export function assertQuickChangeScope(
  before: Record<string, string>,
  after: Record<string, string>,
) {
  const changed = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].filter((file) => before[file] !== after[file]);
  const forbidden = changed.filter((raw) => {
    const file = raw.replace(/\\/g, "/");
    return (
      !file.startsWith("test-results/") &&
      (/(^|\/)(?:\.env(?:\..*)?|\.npmrc|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|[^/]*(?:auth|permission|router|route-config)[^/]*|tsconfig[^/]*|vite\.config\.[^/]+)$/i.test(
        file,
      ) ||
        /^(?:\.git\/|\.github\/|node_modules\/)/.test(file) ||
        (before[raw] !== undefined && after[raw] === undefined) ||
        /^deleted:/.test(after[raw] ?? ""))
    );
  });
  if (forbidden.length)
    throw new ProviderFailure(
      "policy",
      "QUICK_REQUIRES_STANDARD",
      `轻量修改触及依赖、权限、路由、敏感配置或删除文件：${forbidden.join(", ")}。已保留代码，请审查后改用标准流程；不会自动回滚你的代码。`,
    );
}
