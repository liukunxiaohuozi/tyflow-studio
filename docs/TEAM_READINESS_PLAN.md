# Internal distribution and parallel tasks

Scope agreed on 2026-10-13: unsigned internal distribution, update checks/downloads/integrity verification/rollback, actionable setup checks, isolated task workspaces and a configurable queue (default two slots).

## Behavior

- New tasks default to an isolated Git worktree. Existing tasks retain their original working-directory behavior. Each isolated task uses its own branch; the selected existing branch is its baseline, never silently overwritten.
- A task's processes, logs, evidence, snapshot and cancellation belong to that task. Tasks queue when slots are occupied. Tasks sharing the original directory cannot execute concurrently.
- Development and automated checks do not automatically open previews. Runtime review starts on demand. Default preview policy keeps one Studio-managed development server and one reusable verification window; additional concurrent previews are opt-in.
- Interrupted and queued work is preserved on restart and requires explicit retry. No automatic replay of a push or human acceptance.
- Updates use a configurable HTTPS manifest (or authenticated GitHub releases), SHA-256 and architecture checks. Downloading is allowed while tasks run; activation waits for work to stop. Versions install side-by-side in user data; settings/history are not overwritten, and a previous application remains available for rollback.
- No paid certificate or notarization is required. macOS system approval can still be required. No global security policy is disabled.

## Verification

Use actual disposable Git repositories to verify isolation and preservation of dirty source trees; deterministic subprocesses to verify queue/cancellation/recovery; local HTTP fixtures to verify update integrity/failure/rollback; existing full regression/type/lint/scan/build checks; desktop smoke test after packaging. Real macOS execution is validated in CI and must not be represented as locally tested on Windows.
