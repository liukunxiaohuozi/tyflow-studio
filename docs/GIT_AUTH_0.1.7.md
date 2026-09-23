# v0.1.7 — HTTP repository authentication

The reported connection failure used system Git authentication, which could not obtain a username without an interactive prompt. The HTTP warning was not itself proof of a network failure. Explicit password/token authentication previously rejected every non-HTTPS URL, preventing configuration of the user's HTTP intranet repository.

Explicit authentication now supports HTTP and HTTPS through the existing ephemeral askpass helper. Password mode requires a username; both explicit modes require a saved secret. The helper receives the secret through the child environment, and configured credentials bypass unrelated system credential helpers only for that Git invocation. System mode continues to use existing system credentials or SSH. No global Git settings or TLS verification settings are changed.

Errors now distinguish unavailable system credentials from rejected explicit credentials and give configuration instructions. Settings explain the system mode requirement and visibly describe unencrypted credential transmission for HTTP URLs. Prefer HTTPS or SSH when the repository supports it. The app does not silently change the selected authentication mode or copy credentials from another account.

Validation:

- TypeScript, ESLint, production builds, and localization scan passed (374 translated keys).
- 17 Git tests passed across two suites, including a new real loopback HTTP fixture requiring Basic authentication. It checks missing system credentials, missing password/username, rejected credentials, successful password and token reads, remote synchronization, unchanged HEAD, and absence of credentials in the repository configuration.
- The HTTP fixture uses synthetic credentials and isolated repositories. No real user credentials were accessed and the corporate server was not authenticated by this verification.
- Browser verification was unavailable because the browser connector could not connect during this turn; the UI changes are limited to explanatory text.
- The HTTP authentication regression also passed using the packaged Windows executable as the askpass runtime, verifying Electron's Node execution path. A first startup smoke exited before its final report; a separate retry passed with ready/bootstrapServed/visible true and minimized false. Evidence: D:\UserData\tingyun\Temp\tyflow-visible-smoke-8d8403ae-996a-4f53-b809-a1f5253e0656\smoke.json.

Windows installer: release/0.1.7/Tyflow-Studio-0.1.7-Windows-x64.exe. Desktop shortcut updated to release/0.1.7/win-unpacked/Tyflow Studio.exe.

User action after updating: select Username and password or Access token in the project's Git authentication settings, enter credentials, save, then test the connection. System mode requires a previously configured working system credential or SSH key.

Reference: [Git credential resolution and askpass](https://git-scm.com/docs/gitcredentials).
