# v0.1.6 — Remote branch synchronization

Project configuration saves and task project selection now synchronize the configured remote. A compact status row shows the remote, last successful synchronization time, branch count, and a manual synchronization button. Selectors group local and remote branches; remote selections use full refs to avoid collisions. Fetching covers all accessible heads, including repositories originally cloned with a single-branch refspec. Deleted remote branches are pruned without pruning local branches or local tags.

Synchronization only updates remote refs. Assessment pins the effective target commit without changing the working tree. Immediately before development, the service fetches again and checks the assessment target and original HEAD. A changed target invalidates the plan and requires reassessment. Existing branches update with fast-forward only; remote-only selections create a corresponding local tracking branch. New branches start at the assessed commit. Dirty worktrees, diverged branches, missing upstreams, incompatible same-name local branches, and ignored-file overwrite collisions block execution without force/reset/stash. Local commits ahead of the upstream are preserved.

Authentication reuses the configured Git credentials through an ephemeral askpass helper. A configured repository URL must match an existing remote, or can initialize origin when there are no remotes. Synchronization failures remain visible and block assessment/development; cached branches are not presented as a successful fresh sync. Successful synchronization metadata persists across app restarts. Concurrent synchronization of the same directory is deduplicated.

Validation:

- Full regression: 9 suites passed, 88 tests passed, 1 POSIX-specific test skipped on Windows.
- Nine new isolated bare-remote tests cover full branch discovery, deleted refs, safe fast-forward, remote-only tracking, new branch bases, divergence/upstream failures, stale assessment targets, dirty/ignored-file preservation, mismatched URLs, unavailable remotes, and cancellation.
- Service tests verify persistent sync timestamps, invalidation when the remote moves after assessment, and frozen local branch identity for subsequent testing.
- TypeScript, ESLint, localization scan (372 keys), and production build passed. The final assessment-completion UI refresh also passed TypeScript and targeted ESLint.
- Production browser walkthrough confirmed grouped branch options, sync timestamp, remote-only tracking notice, reassessment, and entry into development on feature/demo-remote. No browser console errors were observed. UI walkthrough uses the explicitly labeled in-memory demo; real Git semantics are verified by isolated repository tests.
- Packaged Windows startup passed: ready/bootstrapServed/visible true, minimized false. Evidence: D:\UserData\tingyun\Temp\tyflow-visible-smoke-12637a9f-67eb-43c3-b5dd-f2173e43e98b\smoke.json. Smoke mode uses isolated unconfigured projects, avoiding network operations against business repositories.

Desktop shortcut points to release/0.1.6/win-unpacked/Tyflow Studio.exe. Installer: release/0.1.6/Tyflow-Studio-0.1.6-Windows-x64.exe. Close an already running older version before reopening the desktop shortcut.

Scope: synchronization lists accessible branches from the configured remote; it does not clone a missing local repository. A non-origin remote requires an explicit matching repository URL. Windows packaging was verified locally; macOS packaging was not run on this Windows host.

Git behavior references: [fetch](https://git-scm.com/docs/git-fetch), [merge](https://git-scm.com/docs/git-merge), [switch](https://git-scm.com/docs/git-switch).
