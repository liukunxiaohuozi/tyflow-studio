# TingYun Studio 0.3.0 verification

Date: 2026-10-13. Checkout: `D:/C-Drive-Offload/Desktop/tyflow-studio`. Base commit: `f3a8eae7e3d8675a5d7ece218fab04c402d4db63`, plus the current feature changes. Oracle: the user's confirmed internal-distribution/parallel-task requirements and subsequent instruction to avoid opening three verification windows.

## Result and limits

Windows implementation and package checks passed. The final client is running from `release/build-0.3.0-final/win-unpacked/TingYun Studio.exe`; the desktop shortcut points to it. Older directories and shortcut backups remain intact. GitHub publication and native macOS execution have not been performed in this session. macOS regression, native extraction and packaged smoke are configured in CI. Cross-platform rollout is pending that execution and team review.

The frontend-test workflow informed the independent fixture assertions, retained evidence and separation of simulated Agent results from actual OS/Git/package checks. No real model-driven change, live SSO login or production-project acceptance is claimed by fixture success.

## Requirements and evidence

| Requirement | Independent checks | Result on Windows |
|---|---|---|
| Default two execution slots, excess tasks queue | TaskQueue completion/failure/cancellation tests; two real Git workspaces with controlled CLI processes | Passed |
| Preserve original uncommitted code | Compare independently written original/committed/task-A contents, actual Git branch and task-B contents | Passed |
| Stop one task without stopping another | Parallel repair lifecycle and queued cancellation; independent final states | Passed |
| Recover interrupted queued Bug repair | Persisted repair intent, explicit retry without a preexisting plan | Passed |
| No automatic preview windows during development | Real Electron/IPC window count is one after two repairs finish | Passed |
| Reuse one verification window | Explicitly start A then B; total windows remain two (Studio + verification), title identifies B | Passed |
| Keep existing browser/SSO option | Explicit external-opening intent; no automatic acceptance; reject an address owned by another task | Passed for routing/guards; live SSO not run |
| Actionable setup checks | Signed-in and logged-out CLI fixtures, missing skills/project, real local Node/npm/Git detection | Passed; no live-model claim |
| Safe update and rollback | Platform/size/hash/ZIP/redirect tests, native extraction, package marker/skills validation, unchanged user-data file, previous executable selection | Passed |
| Preserve custom paths on upgrade | Refresh package-owned skill paths, preserve custom paths and task history | Passed |
| Release distribution | Exact three-platform manifest with independently computed SHA-256; native-platform CI gates | Manifest passed; publication/native Mac pending |

## Executed checks

- Full regression: 19 suites, 149 passed, one Windows-inapplicable POSIX cancellation test skipped. Raw output: `test-results/team-readiness-tests.json`.
- Final service regression after adding browser routing: 34 cases passed (adds one new case). Raw output: `test-results/team-readiness-service-final.json`.
- Update/bundle/manifest supplemental run: 13 passed; the native macOS extraction case is excluded on Windows. The two platform-specific exclusions are not missing Windows required cases.
- Final type check, ESLint, i18n scan and production packaging: passed. i18n scan generated 549 translated keys, no Chinese residue in English values.
- Real Electron/IPC UI and normal Windows window-close lifecycle: passed. Evidence: `test-results/team-readiness-ui/result.json`, `setup.png`, `updates.png`, `workspace-choice.png`.
- Final packaged smoke: ready, bootstrap served, window visible and responsive. Smoke data: `D:/UserData/tingyun/Temp/tyflow-visible-smoke-9690d561-e770-4963-b286-ef5904a64ded/smoke.json`.
- Actual portable ZIP streamed through UpdateManager, checked, natively extracted side-by-side, skill/version validated and rollback selected: passed with fixture network. Evidence: `test-results/portable-update.json`.
- Disposable repository/app/upgrade test directories were cleaned by their test harnesses. Packaged smoke evidence is intentionally retained.

Final package: `release/TingYun-Studio-0.3.0-Windows-x64-portable.zip`, 175130258 bytes, SHA-256 `dfeed0d7d629d9ee8ee1aa4f392a102272ea70c9c662156178f72da2f8769f95`.

## Lightweight code review

Reviewed queue ownership, per-task aborts/logs, shared synchronization cancellation, exact worktree/common-dir identity, retry preservation, duplicate acceptance, preview origin/IPC isolation, server ownership, update token redaction and redirect handling, bounded archive extraction, architecture selection, side-by-side activation and package-path migration. Fixed issues found during review: cancelled queued Bug intent, paused/terminated state overwritten by run completion, legacy implicit current-directory comparison, reused-preview lifecycle, and preserving system-browser routing for ZenTao.

Operations touching credentials/Git/app activation warrant team review before broader rollout. No shared source directory is run concurrently by the queue, no automatic commit/merge/deploy is introduced, and no global OS security setting is disabled. macOS may still require the user's system approval for an unsigned/not-notarized internal app.

## Core source identities

| File | SHA-256 |
|---|---|
| src/main/service.ts | 7367ec510a84dad1603e6bdb875d89cca466489f294211455050207084fd89ef |
| src/main/task-queue.ts | a481f50db18c3b5195efd3c328157a920559c77547c2fe9173cb9c76f64ff0dd |
| src/main/workspaces.ts | eeb284647235bb7e60e43b0d1efb00a2e4564b7bff7b79206beed63006001cee |
| src/main/updates.ts | f9b68f84e63fcbcad730d6b2b21be9df398a9c8b6c85d1af12745939b210c621 |
| src/main/setup.ts | b7573bff14fd1f21faebf777fdf0097231ebd846dad96c013561b3e9a24adb44 |
| src/main/index.ts | 5ac753c76b603d0615623d3304b03e58bb9ece0e755c00c3145721240c55d53d |
| src/shared/contracts.ts | 8c078c1dcc3acad4fb446d934cbc6292ba7e469224ba80fca09d13493ce70e62 |
| src/renderer/MaintenancePanels.tsx | 961c58d3895a553478bd1e5e8d7dbc1266afb8cd0cd8092584a96b7536ae7873 |

Implementation API references: [Electron app.relaunch](https://www.electronjs.org/docs/latest/api/app#apprelaunchoptions), [Git worktree](https://git-scm.com/docs/git-worktree).

## Project navigation follow-up (source build, 2026-10-14)

Local 0.3.1 full regression: 19 suites passed, 150 tests passed, 2 platform-inapplicable cases skipped; completed in 225.98 seconds.

## Native macOS release follow-up (0.3.2)

The `v0.3.1` native Mac gate failed before publication: two assertions compared literal `/var` paths with the canonical `/private/var` paths returned by the CLI, and workspace reuse compared Git common directories before resolving filesystem aliases. Reproduced the real reuse failure on Windows with a source-directory junction. The new regression failed before the fix and passed afterward. Canonicalized common-directory identities without relaxing branch/commit/repository guards, and made CLI cwd assertions compare canonical directory identities. Four targeted cases, TypeScript and ESLint passed locally. Native macOS confirmation belongs to the `v0.3.2` release run; the failed tag was preserved rather than rewritten.

Sidebar projects now open a scoped project workspace instead of redirecting to settings. The selected project is highlighted, task tables and metrics are project-scoped, and task creation selects that project without altering the global default. Global records remain cross-project; directory indicators explicitly describe configuration rather than service health. TypeScript, ESLint, translation scan (559 keys) and production build passed. Real Electron/IPC navigation, cross-project exclusion, project-scoped creation with a different global default, return to global workspace/records, and existing parallel-task/preview checks passed. Screenshot: `test-results/team-readiness-ui/project-workspace.png`.

This follow-up was packaged locally as 0.3.1 on 2026-10-14; it has not been uploaded to GitHub. The 0.3.0 ZIP and hash above refer to the earlier package. The new package is `release/TingYun-Studio-0.3.1-Windows-x64-portable.zip`, 175130835 bytes, SHA-256 `0aa6cd4eb0cd952c8654a077c78d9239196149153d7f1f90abf699956244ac4a`. Packaged smoke confirmed readiness, bootstrap delivery, and a visible non-minimized window; evidence: `D:/UserData/tingyun/Temp/studio-031-smoke-edb468cb-8c34-4985-848a-734a9e39de21/smoke.json`. The desktop shortcut now points to `release/build-0.3.1-local/win-unpacked/TingYun Studio.exe`. The previous executable and a state/shortcut backup remain available; the existing 3 projects and 8 task records are retained.
