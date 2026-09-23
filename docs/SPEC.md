# TingYun Studio desktop — SPEC
Date: 2026-09-16. L3 / T1. Source: approved OpenDesign v1.7.0.
Authorization: user explicitly requested implementation based on current design and Windows/macOS clients. This technical plan is prepared under that authorization; no claim that user separately reviewed its individual steps.

R01 Desktop: Electron application, independent source at Desktop/tyflow-studio, Windows installer and macOS native build configuration.
R02 Intake: design ZIP/HTML or text or Bug with drag/drop screenshots/logs. Archive bounds, path containment, editable summary, provenance and immutable asset hashes.
R03 Analysis: local Codex CLI reads Tyflow workflow, repository and requirement, emits structured plan and test cases. Read-only sandbox. Clear failures, no simulated results.
R04 Configuration: real projects explore/o11y-apm-ui, repository refs/tags, explicit new/existing branch selected before assessment. Dirty worktree blocks initial assessment/development. Base commit is checked again before execution. Manual acceptance commits and pushes the selected development branch; merge and deployment remain outside the client.
R05 Execution: one confirmation after plan preview; freeze settings/ref/plan/assets; actual agent logs and stage progress, stop/retry. App restart marks interrupted operations stopped.
R06 Tests: automatic checkbox or manual intervention, configured frontend-test skill, actual npm checks and agent verification; failures block delivery, evidence retained.
R07 Delivery: configured start script, HTTP readiness, system browser target URL, manual acceptance distinct from automated checks.
R08 Records: persisted task list, search/filter/detail, bounded logs and export; attachments retained.
R09 Settings: developer, repositories, Git credentials, optional ZenTao, local agent/Tyflow/test-skill paths; secrets encrypted by OS safeStorage, not returned to renderer. ZenTao performs authenticated read-only discovery of visible products, projects, assigned tasks and bugs; names are selected in the UI while IDs remain internal. Per-task linkage and safe external navigation are supported; writeback remains deferred.
R10 Theme: presets/custom color, preview/save/reset, primary button white text with contrast-safe background, readable logs.
R11 Security: sandboxed renderer, narrow validated IPC and sender checking, isolated prototype browser, command arguments shell-free, no imported files can request privileged actions. No automatic remote changes.

Excluded: original prototype sample business page (alarm rule filtering); multiuser server; remote publishing; authenticated ZenTao import/writeback; signing credentials; verified macOS runtime on this Windows host.
New standalone application has no inherited SaaS/private release branch. Use local new repository, no changes to target product repositories during verification.
