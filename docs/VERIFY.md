# Verification — 2026-09-16

- TypeScript: passed (`tsc --noEmit`).
- ESLint: passed (`eslint src tests`).
- Jest: 6 suites; 63 passed, 1 POSIX-only skipped on Windows; 64 total. Full final run 82.604s.
- i18n scan: 328 I18nT calls, 289 keys, Chinese/English locale files written, zero untranslated English entries.
- Production build: JS 305.31 kB / gzip 92.83 kB; CSS gzip 5.95 kB.
- Production browser review (Codex in-app Chromium): design/text/Bug tabs, configuration tabs, theme preview/revert, white primary labels, record empty state and navigation. Console error entries: zero. Read-only browser mode is explicit; does not prove native file/Git operations.
- Browser production FCP 220ms; DOMContentLoaded 162.1ms; load 177.7ms on local machine. No artificial network throttling. Two memory samples over the review session: JS used 6,444,160 → 6,899,336 bytes. These samples do not prove long-duration leak freedom. INP/TBT and large real-world task histories require further measurement.
- Integration fixtures use actual temporary Git repositories, actual npm subprocesses, bounded output/cancellation, temporary filesystem persistence and loopback HTTP startup. Agent itself is a deterministic local fixture. Includes full plan→branch→development→manual test→startup→manual acceptance, missing case evidence, secrets, recovery, same-project server replacement and foreign-service protection.
- Local Electron production boot passed: ready true, renderer title Tyflow Studio, preload bootstrap IPC served.
- Packaged Windows x64 boot passed from release/win-unpacked/resources/app.asar; ready true and bootstrapServed true; stderr empty. Evidence: D:/UserData/tingyun/Temp/tyflow-studio-packaged-smoke-1ca207a8-ac78-4452-87b8-069e14efa51d/smoke.json.
- NSIS Windows installer generated successfully. Client unsigned (development distribution). Installer itself has not been run through installation/uninstallation; packaged executable has been launched and validated. Desktop shortcut points to that executable.
- Production dependency audit: 0 vulnerabilities at check time.

Remaining validation boundaries: macOS Intel/Apple Silicon builds, signing/notarization and native behavior need a Mac runner. CI configuration is present but has not been published/run. Real authenticated Codex/Tyflow execution and live product browser checks have not run on explore/o11y-apm-ui; their code and branches were untouched. ZenTao discovery is contract-tested with fixture responses but still needs acceptance against the configured company instance; writeback is deferred. Native dialogs, drag/drop and protected OS vault behavior should receive manual acceptance in the installed application. Windows-only SIGTERM escalation test was skipped; Windows taskkill tests passed.

Conclusion: Windows first-version client is available for user acceptance. Do not label the macOS package or live business integration verified.
