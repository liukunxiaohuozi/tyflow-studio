# Update-check recovery — 2026-10-15

Verdict: scoped LOCAL PASS; colleague macOS network acceptance and distribution pending. No version bump, remote push, published package, installed-client replacement or real credential change in this task.

## Scope / independent Oracle

User reports macOS 0.3.4 shows raw `fetch failed` when checking again and requests a clear already-current prompt. Expected outcomes come from the user request and explicit remote fixture responses, not the implementation: only a successful authoritative version response can establish current; an unavailable server must never be represented as current. Newer releases must still require a valid platform package and integrity metadata.

## Findings and implementation

- Confirmed ordering defect: GitHub manifest retrieval and platform matching occurred before version comparison. An equal release therefore depended on an unnecessary asset request. Compare a valid stable GitHub tag first; for explicit manifests compare version before platform selection. Invalid/missing tags still use the manifest path; genuinely newer releases retain all package checks.
- Confirmed transport choice: the desktop updater used Node global fetch. Inject Electron net.fetch after app readiness so Chromium system proxy/PAC support applies. Preserve manual redirects, HTTPS, same-origin bearer forwarding and explicit cookie omission. Official reference: https://www.electronjs.org/docs/latest/api/net . Screenshot alone does not identify the colleague's DNS, proxy, TLS or transient network failure.
- Separate 15-second metadata timeout from the unchanged package-download timeout. Map transport/timeout errors to actionable localized guidance; keep HTTP permission/rate errors distinct and credential redaction intact. Handle cross-realm DOMException timeout names.
- Manual successful current checks display an existing-style success toast plus inline current status. Failed checks replace stale success toasts with the real failure; no false latest result. Retry and recovery clear stale errors/version candidates.

## Evidence

| Check | Result / evidence |
| --- | --- |
| Before production changes | Four new Jest assertions failed: redundant equal-release manifest fetch; unnecessary equal-manifest architecture failure; raw network error; 30-minute metadata timeout. 8 existing passed / 1 macOS conditional skip. test-results/update-check-before.json |
| Timeout edge counterexample | DOMException timeout classification initially failed in the test VM; fixed by structural error-name inspection. test-results/update-check-timeout-before.json |
| Scoped final Jest | 14 passed / 1 macOS conditional skip. Covers version comparisons, equal GitHub/manifest, network failure, permission/timeout, failure after prior current, download identity, checksum, redirects/auth isolation, unsafe ZIPs and Windows activation/rollback. test-results/update-check-after.json |
| Real Electron renderer/preload/main | scripts/verify-update-check-ui.cjs passed on Windows. Equal release checked twice without manifest requests; offline remains failed and replaces success toast; newer remains available; recovery clears errors. Actual main-process transport injection is exercised; net.fetch responses are deterministic fixtures and Node global fetch deliberately rejects. test-results/update-check-ui/result.json |
| Visual feedback | test-results/update-check-ui/current.png inspected: toast and inline latest text visible; no raw error. offline.png records actionable network feedback. |
| Static/build | TypeScript, ESLint, i18n scan and production build passed. No dependencies changed. |

Reproduce after `npm run build`: run `npm test -- --runTestsByPath tests/updates.test.ts`, then `node scripts/verify-update-check-ui.cjs` with Playwright available through the workspace runtime NODE_PATH. Uses disposable data only; no GitHub writes, real messages, credentials, downloads or installed-client shutdown.

## Review and boundaries

Self-review covered early-return state cleanup, no downgrade, retaining stricter newer-version validation, timeout bounds, redirect bearer isolation, cookie omission, redaction, retry state and renderer success/failure separation. No independent human approval is claimed. Transport fixtures are not proof of real GitHub availability or the colleague's macOS proxy setup. macOS native extraction test skipped on Windows; existing platform CI remains required before a distributed release. Startup check retry/activation timing, scheduled polling, signing/notarization and broader task functionality are not changed. Risk R3 due to the updater/authenticated download boundary; general release readiness remains REVIEW_REQUIRED until platform CI and a real Mac check.
