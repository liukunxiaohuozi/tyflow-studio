# v0.1.2 — Simplified task intake

Removed the global breadcrumb/developer bar and the task editor's introductory heading, description, and three-step strip, as requested from the supplied screenshot. The task form now begins directly within the main content padding. The execution view retains its actual progress display.

Validation: TypeScript, ESLint, localization scan (285 translated keys), and production build passed. Browser preview at http://127.0.0.1:5179/ visually confirmed the removed sections and the raised intake form. Packaged Windows smoke passed with ready, bootstrapServed, and visible all true; minimized false.

Smoke evidence: `D:\UserData\tingyun\Temp\tyflow-visible-smoke-9f18cd73-1cb1-4dd5-b114-2a63632b8857\smoke.json`.

The desktop shortcut now targets `release/0.1.2/win-unpacked/Tyflow Studio.exe`. An already running older instance must be closed before reopening the shortcut to display this update.
