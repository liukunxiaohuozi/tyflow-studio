# v0.1.9 — Isolated Codex assessment startup

Bug assessment failed before producing a plan because Tyflow Studio selected the first configuration-compatible Codex installation on PATH: npm CLI 0.141.0. The current desktop CLI 0.154.0-alpha.6.2 had written a newer models_cache.json shape. CLI 0.141.0 rejected that cache with `missing field base_instructions`, attempted a model metadata refresh, loaded unrelated user MCP/plugin configuration, and encountered the Figma MCP HTTP 401. Skill loader errors were separate startup noise.

The resolver now inspects every discovered Codex installation using only `--version` and `exec --help`, requires the non-interactive isolation flags used by the application, and selects the greatest semantic version. Explicit executable paths remain explicit and are never substituted. The real machine probe selected desktop CLI 0.154.0-alpha.6.2 instead of PATH CLI 0.130.0 or npm CLI 0.141.0.

Every assessment, development and testing invocation now includes `--ignore-user-config` and `--ephemeral`. It continues to use the user's existing Codex authentication and account default model, while excluding config.toml, MCP servers and plugins from this desktop workflow. The app supplies its own sandbox, working directory, structured output schema and task instructions. This prevents unrelated Figma authentication or user plugin configuration from blocking a local Tyflow task. The user's global config and models cache were not deleted or rewritten.

Development and testing use the current CLI's `--approve-for-me` mode, which provides its workspace-write sandbox and automatic approval review as one combined option. Read-only assessment continues to use `--sandbox read-only`. These options cannot be combined. Agent runs use an application-local `CODEX_HOME` containing only a synchronized authentication file, so an incompatible global `models_cache.json` cannot break or pollute task logs.

When the configured command is `codex`, resolution scans both PATH and the Codex Desktop installation (`%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe` on Windows, common application locations on macOS), probes supported flags, and selects the highest compatible semantic version. This keeps an older npm CLI on PATH from masking a newer desktop CLI.

Three local skill files reported in the failure were normalized separately: the UTF-8 BOM was removed from api-contract-generator; tyflow-do received valid YAML frontmatter and no BOM; explore's dashboard-doc description was quoted to make the embedded colon valid YAML. A direct isolated CLI startup in explore no longer emitted the model-cache, Figma or skill-loader errors from the report. The model request later timed out in this diagnostic shell, so a live AI plan completion is not claimed here; deterministic subprocess integration verifies the entire application command and structured-result path.

Validation:

- Exact 0.141.0 failure reproduced with model-cache, three skill-loader errors and Figma 401.
- Direct 0.154.0 isolated startup retained the signed-in account/default gpt-6-astra and did not load the failing cache, Figma MCP or invalid skills.
- Installed resolver probe selected `C:\Users\tingyun\AppData\Local\OpenAI\Codex\bin\bffc5354119c8421\codex.exe`, version 0.154.0-alpha.6.2.
- Resolver/process/service focused tests passed: newest-version selection, explicit path preservation, flag capability checks, cancellation, read-only assessment and structured plan persistence.
- Full regression passed: 9 suites, 91 tests passed, 1 POSIX-only test skipped on Windows. TypeScript, ESLint, production build and localization scan (382 keys) passed.
- Packaged Windows startup passed with ready/bootstrapServed/visible true and minimized false. Evidence: `D:\UserData\tingyun\Temp\tyflow-visible-smoke-7e5a5930-3127-4bb8-8f66-0fade6e7c96a\smoke.json`. Desktop shortcut points to `release/0.1.9/win-unpacked/Tyflow Studio.exe`; installer: `release/0.1.9/Tyflow-Studio-0.1.9-Windows-x64.exe`.

Official OpenAI documentation identifies gpt-6-astra as a valid Responses model; exact isolation flag behavior was verified from the installed CLI's `exec --help`, which is the authoritative reference for the installed alpha build: https://developers.openai.com/api/reference/cli/resources/responses/methods/create
