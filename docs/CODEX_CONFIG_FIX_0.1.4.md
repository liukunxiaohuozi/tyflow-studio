# v0.1.4 — Codex configuration compatibility

The failed assessment in o11y-apm-ui was caused by the first `codex` entry on PATH, CLI 0.130.0. It rejects the shared config's `service_tier = "priority"` before executing the assessment. The npm CLI 0.141.0 and desktop CLI 0.154.0-alpha.6.2 already installed on this machine can load that configuration.

The default command now probes configuration with `features list` before sending any task prompt. For this specific unsupported priority/fast/flex configuration error, it checks the remaining installed PATH entries and selects one that loads the config. Explicit executable paths are respected and never silently substituted. Other errors are reported directly; cancellation stops discovery. The chosen version and command are recorded in task logs. Connection testing uses the same probe instead of trusting `--version` alone. Windows discovery excludes extensionless Unix npm shims.

Validation:

- Reproduced the exact config error with CLI 0.130.0.
- New resolver selected CLI 0.141.0 and loaded the config successfully in the actual o11y-apm-ui working directory. No model request was made by the probe.
- Global config SHA256 remained `8FF3949BA39135BF2F28B5164BCA19D9E28D47864C329DB79A710B3DDC0F26E0` before and after the probe.
- Regression tests first reproduced failed selection. Final runs: service suite passed (19 tests); CLI/process suites passed (14 tests, 1 POSIX-only test skipped).
- TypeScript, ESLint, and production build passed.
- Packaged Windows startup passed: ready, bootstrapServed, and visible true; minimized false. Evidence: `D:\UserData\tingyun\Temp\tyflow-visible-smoke-ee6309e6-588c-4b44-b8ed-f6b6bc656e54\smoke.json`.

The desktop shortcut now targets `release/0.1.4/win-unpacked/Tyflow Studio.exe`.

Full authenticated assessment completion is not established by these local configuration checks. The existing failed task can be retried after reopening the updated desktop client.
