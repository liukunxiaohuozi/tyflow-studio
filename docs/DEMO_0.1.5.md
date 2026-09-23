# v0.1.5 — Interactive demo example

The upper-right Demo example button starts a preloaded alert-rule filtering requirement. It reuses the task editor and execution view with an explicitly injected in-memory API; the real desktop API remains the default outside the demo. Exiting restores the previous view and preserves unsaved task inputs.

The walkthrough supports assessment, plan and test-case previews, both branch modes, version selection and reassessment, automatic or manual test intervention, stage progress and simulated logs, stop/retry, delivery preview, and acceptance. The delivery page has working keyword/status filters, reset, and an empty state. Restart creates a fresh session; exit cancels all timers. The demo performs no AI or native filesystem/Git operations and does not add real task records. Simulation is labeled in the banner, action hint, progress description, logs, and check details.

Validation:

- TypeScript, ESLint, localization scan (354 keys), and production build passed.
- Six demo lifecycle/isolation tests passed, including manual tests, stop/retry, disposal, revision invalidation, and refusing real file import/export.
- Production browser walkthrough completed assessment, plan/test previews, new-branch automatic testing, interactive delivery filtering (3 → 1 → 0 → 3 results), acceptance, and exit with the original unsaved draft preserved.
- A second walkthrough selected existing branch `develop`, version `v1.0.0`, reassessed, disabled automatic testing, and then successfully invoked manual automated testing and opened the delivery page.
- Browser console errors: none observed.
- Packaged Windows startup passed with ready/visible/bootstrapServed true and minimized false. Evidence: `D:\UserData\tingyun\Temp\tyflow-visible-smoke-957f391c-241c-4582-b54f-3ee6609b2199\smoke.json`.

Desktop shortcut points to `release/0.1.5/win-unpacked/Tyflow Studio.exe`; installer is `release/0.1.5/Tyflow-Studio-0.1.5-Windows-x64.exe`.
