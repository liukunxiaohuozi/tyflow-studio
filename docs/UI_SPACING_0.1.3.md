# v0.1.3 — 8px task intake spacing

Task intake uses 8px outer gutters, card padding, form gaps, upload-area padding, attachment padding, and footer spacing. Its fixed action bar aligns to the same 8px gutters at all existing sidebar breakpoints. Bottom content clearance is retained so the fixed actions cannot obscure the last fields while scrolling. Settings, records, and execution layouts retain their existing spacing.

Validation: TypeScript, ESLint, and production build passed. The production browser preview confirmed computed 8px padding/gaps for the intake card, toolbar, fields, title row, upload area, attachments, and action bar. The packaged Windows startup smoke confirmed ready=true, bootstrapServed=true, visible=true, minimized=false.

Smoke evidence: `D:\UserData\tingyun\Temp\tyflow-visible-smoke-81dd5957-435e-4539-a29a-75a1f09b419b\smoke.json`.

Desktop shortcut points to `release/0.1.3/win-unpacked/Tyflow Studio.exe`. Close an older running instance and reopen the desktop shortcut to see the update.
