# WeCom notifications verification — 2026-10-14

Verdict: LOCAL PASS / REAL GROUP AND MACOS PENDING. Risk R3: encrypted credentials and external message writes; real group acceptance needs the configuring human. This is local 0.3.3 source, not a new published release or installed-client replacement.

## Scope and independent Oracle

Source of intent: user explicitly chose GitLab, a WeCom internal test group, notifications first, later MR/CI/ZenTao writes, credentials only in local settings. Details and data boundaries: docs/WECOM_NOTIFICATIONS.md.

Oracle axes are independent assertions against user constraints, persisted configuration/OS ciphertext, POST payload/transport outcomes, and workflow state. Expected fixed test payload is declared separately in tests. No conclusion uses screenshot appearance alone or agent self-report. Server business refusal is injected as a counterexample to HTTP success.

| Requirement | Actual evidence | Result |
| --- | --- | --- |
| Local encrypted secret; no settings read-back | Electron IPC save; actual Windows safeStorage ciphertext; bootstrap and state.json exclude fixture key | Passed |
| No send on edit/save; deliberate test send | Real UI disabled while dirty; sink request count zero before explicit test, one after | Passed |
| HTTP 200 is insufficient | Unit errcode numeric-zero assertions; UI rejects errcode 93000 | Passed |
| Minimal bounded payload | Independent unit byte bound, Unicode validity, redaction and sensitive-field omission assertions | Passed |
| Timeout, no blind retry, safe host | 10-second abort test; twelve invalid endpoint cases; redirects forbidden | Passed |
| Durable dedupe and safe recovery | Concurrent/restarted sender has one request; interrupted/corrupt/unwritable journal tests | Passed |
| Notification cannot fail task | Provider exception isolation; parallel Electron tasks reach waiting-review and each emits one development summary | Passed |
| No misleading delivery status | Accepted without pushedAt produces no notification; actual push confirmation emits explicitly non-merge/deploy message | Passed |
| Retain/delete secret explicitly | IPC/unit read-back; UI Clear+Save disables test send | Passed |
| No real remote writes during checks | Main-process isolated sink; no real Webhook supplied; Git fixtures disposable | Passed |
| Real internal group receives notification | No real group credential or human read-back available | Pending |
| macOS GUI/network/vault smoke | Executed on Windows only; script supports macOS but not run there | Pending |

## Commands and outputs

- npm run typecheck: passed; npm run lint: passed.
- npm run scan: 656 I18nT calls / 588 keys; zero untranslated English.
- npm run build: passed TypeScript, Vite and main/preload bundle.
- npm test: 21 suites passed; 199 passed, 2 platform-conditional skipped, 201 total.
- Notification-specific Jest run initially had 31 passed; two additional regression cases cover preview switching without duplicate development notices and actual Worktree branch identity. Final three-suite rerun: 55 passed, including all 33 notification cases plus core/workflow checks; machine-readable output: test-results/wecom-regression.json. Core expected notification title intentionally updated to “必要检查完成”, avoiding a false claim that every task ran automated tests.
- node scripts/verify-wecom-ui.cjs: real Electron/IPC UI passed; test-results/wecom-ui/result.json and configured.png / business-rejection.png. Configured screenshot inspected for layout.
- node scripts/verify-team-ui.cjs: final parallel workflow/recovery and automatic-notification smoke passed; test-results/team-readiness-ui/result.json and screenshots. Asserted exactly two development notifications even after switching preview between tasks; summaries identify actual studio/task-* branches. Initial harness revision attempted to read a closed Electron app while writing its report; fixed to snapshot messages before close. Another run encountered the legitimate initial repository-sync configuration lock; fixture now waits for initial sync before configuration. Only successful final runs are counted as passing evidence.
- git diff --check: passed (existing CRLF conversion warnings only).

## Residual risks and review

No generic external POST target, redirected endpoint, server errmsg echo, plaintext persisted Webhook, group @all, workflow-state mutation, production message, MR or issue write added. Retry/idempotency cannot guarantee exactly-once over unreliable networks: failed or unknown messages deliberately are not replayed. Rate guard is process-local, not a coordinator across team computers. Known configured secrets are redacted, but arbitrary secrets typed into a task title cannot all be detected; use a permitted internal group and non-sensitive titles.

Transport mocks are not proof of vendor service availability. Before distribution: human group smoke and a macOS run; then package/publish only on explicit request. GitLab MR, CI and ZenTao permission work remains intentionally separate.
