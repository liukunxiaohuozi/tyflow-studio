# 0.3.4 internal trial release checks

Date: 2026-10-14. Scope: user requested uploading the current completed Studio changes and producing a new version for a colleague to test the update flow. Not a general production-readiness declaration. Version: 0.3.4; source commit and CI result are bound by the release tag v0.3.4.

## Frozen scope / independent Oracle

Include the previously requested stage checkpoints, classification, scoped recovery, supplementary context, execution timeouts, provider boundaries, and explicitly enabled local-encrypted WeCom milestone notifications. Preserve workflow approval, worktree isolation, no automatic commit/push, and no live test-group messages during automated checks. Exclude the cancelled richer notifications, GitLab MR/CI platform integration, ZenTao write-back, unrelated document-generator changes, local credentials, user tasks, test-result dumps and media experiments.

Repository precedence: this Electron/React application uses existing I18nT, settings/preload/main IPC, project providers, and GitHub main + vX.Y.Z release workflow. Those repository conventions override the company business-app release/x.y/tag-date convention. No dependency versions changed; package and lock versions both incremented to 0.3.4. Existing project wrapper/theme remains unchanged.

## Actual local evidence

- TypeScript, ESLint, i18n (656 calls / 588 keys) and production build passed.
- First complete regression: 21 suites, 201 passed / 2 platform-conditional skipped, 203 total. Native Jest output: test-results/release-0.3.4-unit.json.
- Release smoke exposed a pre-existing Windows shutdown race: asynchronous taskkill could be terminated with Electron before finishing, leaving the owned npm/Node preview process alive and blocking fixture removal. Owned leftover was identified by the disposable preview port/process and cleaned; no user preview process was stopped.
- Fix: finish bounded Windows taskkill synchronously before application exit. Added an independent nested-process liveness assertion and an Electron post-close preview-port assertion. POSIX behavior unchanged.
- Targeted post-fix regression: process + workflow + WeCom, 51 passed / 1 platform-conditional skipped, 52 total. Native output: test-results/release-0.3.4-process-retest.json. ESLint and production build passed again after source change.
- Electron UI evidence uses disposable data/projects, deterministic CLI, real OS safeStorage and isolated HTTP notification sink. Result paths: test-results/team-readiness-ui/result.json and test-results/wecom-ui/result.json. Final post-fix runs must exit zero and complete cleanup before tagging.
- Staged source, package/lock and release docs are checked with git diff --cached --check; explicit source allowlist excludes unrelated working-tree edits and all real secrets. The current workspace is intentionally not reset.

## Platform / release gates

Remote CI must execute full regression on Windows and macOS, package Windows x64 + macOS arm64/x64, perform packaged platform smoke, and upload three ZIPs plus update-manifest.json before publishing. Publication is not claimed just because push/tag succeeded. After CI, inspect published asset identities, sizes and manifest SHA-256 values against GitHub asset digests.

Risk: R3 credential/external write and substantial refactor; release candidate is for human internal testing. Code review covers host allowlist, IPC main-frame origin, secret persistence/read-back, safe error handling, dedupe-before-send, failure isolation, frozen scope and evidence hashes. No confirmed critical/high issue remains from local checks after the shutdown fix; this is agent review, not a claimed independent human code-review approval. Real group receipt, real Codex service behavior and colleague Mac GUI need human trial. Therefore broad integration/production verification remains INCOMPLETE / REVIEW_REQUIRED; publishing an explicitly requested trial does not reclassify those gaps as PASS.

## Update test

Older 0.3.x client: save the correct update source and access token if private, check manually or reopen with check-on-launch enabled. It should discover 0.3.4, download the platform-matched ZIP, verify size/hash, and only activate/restart with no active or queued tasks. Preserve task history and encrypted credentials. Group notification configuration is separate from update credentials.
