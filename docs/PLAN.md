# PLAN
1. Establish typed desktop IPC, persistent task/settings/asset storage, encrypted credential vault, validation and lifecycle tests before implementation.
2. Implement safe ZIP/HTML import and repository inspection/branch handling with temporary repository tests.
3. Rebuild confirmed OpenDesign visual design as React views: task intake, confirmation, run/acceptance, records, developer settings and themes.
4. Connect Codex read-only assessment / workspace-write development, test skill, controlled package scripts, log stream and restart recovery.
5. Integrate Electron shell/preload, isolated preview, external browser readiness, Windows/macOS builder and CI.
6. Typecheck, Jest, lint, i18n scan, production build, browser interactions, Electron smoke, Windows package and code review. Record unavailable platform/runtime evidence accurately.

Reuse decisions: original OpenDesign tokens/layout only (demo handlers are simulated and not reused); React state + semantic browser controls/lucide icons instead of copying business project modules; Electron safeStorage for OS encryption; yauzl lazy ZIP extraction; Node child_process argument arrays for Git/agent; no remote API contract invented.
Parallel ownership under WORKFLOW §Parallel Agent: renderer worker owns src/renderer and locales only; IO worker owns src/main/git.ts, imports.ts and their tests only; root owns shared contract, orchestration, security, packaging and integration.
