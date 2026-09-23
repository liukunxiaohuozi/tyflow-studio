# Architecture
The renderer has no Node APIs. Its context-isolated preload exposes only the typed StudioAPI contract; every main IPC call verifies the sender/frame and validates input. Imported previews use separate sandboxed sessions, no preload or network, and can navigate only within known imported HTML pages.

Main service owns an explicit task state machine, one active command pipeline, immutable development snapshots and mutable launch-only settings. It records each stage result (last 50 runs) and bounded recent logs (last 2000 entries). A task cannot be accepted until required checks passed and an actual local HTTP server became ready. Restart retains data and marks interrupted work stopped.

Store uses schema-versioned atomic JSON. Credentials are separately encrypted with the OS account via safeStorage. ZIP import rejects traversal, symlinks, duplicate/case-colliding files, encryption, unsupported content and oversize streams. File hashes identify package versions; adoption invalidates prior analysis, while running snapshots remain unchanged.

Git and Codex use argv arrays with shell=false. Known Windows npm shims resolve to their Node entry files. Development/tests use Codex workspace-write; planning uses read-only. After manual acceptance, the service commits the task workspace and pushes the selected development branch through the configured Git credential path; it does not merge or deploy. The configured local AI CLI still needs authentication and project-specific environment access.

Windows and macOS share React/Electron source; packaging runs on the corresponding OS. macOS app launches can locate common Homebrew and ~/.local/bin CLI installs, or the user can supply an absolute Codex executable path. NVM-only GUI PATH setups may require launching from a configured shell or adjusting the system PATH.
