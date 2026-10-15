# Plan-contract repair — 2026-10-15

Scope: Studio's assessment-plan contract and recovery only. User explicitly requested fixing the reported `planSteps[5].expectedFiles` failure. No business-project copy changes, desktop-client replacement, GitHub push, version bump or release in this task. This report consolidates the planned assertions and observed evidence; it is not a claim that this document was frozen before execution.

## Confirmed requirements / Oracle

1. Agent output and local parsing must agree that implementation steps have non-empty file scopes; do not manufacture paths or silently fill `**`.
2. Pure verification belongs to existing `testCases`, linked to implementation steps, rather than an implementation step with no file scope. No new PlanStep kind or stored-data migration is introduced.
3. One invalid structured plan may receive one read-only, field-specific correction. Valid plans use one call; transport errors and cancellation are not automatically replayed. Correction must remain on the selected project/commit and preserve requirement intent.
4. Invalid correction must stop assessment, identify the field/step, retain checkpoints, and offer accurate recovery actions. No execution approval, development snapshot or automatic business-code writes.
5. Same-task retry remains possible; successful assessment still requires the user's existing approval before development. Existing traceability/diff/evidence gates remain unchanged.

Oracle provenance: the user's screenshot, explicit request to fix the diagnosed contract mismatch, and preservation of existing approval/scope hard gates. Test fixture paths and exact expected outcomes are declared independently; test fixtures do not represent actual customer source paths.

## Implementation

- providers/agent-schemas.ts aligns plan array/string cardinality constraints with local policy.ts; strict required object fields retained. minItems/maxItems compatibility checked against the official Structured Outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs . Fine-tuned/custom service compatibility is not established by documentation or mocks.
- providers/plan.ts owns bounded structural validation/correction; at most two Agent calls per checkpoint and a 64,000-character invalid-output repair-prompt bound. No fallback plan generation, guessed scope, blank array exemption or gate changes. Corrected output must pass the original local validator.
- service.ts uses the helper inside the existing analysis:agent checkpoint and read-only Agent sandbox. Both calls retain original context, project and target commit; correction feedback asks to reuse findings rather than repeat full exploration.
- workflow/failures.ts gives AGENT_PLAN_INVALID specific actions, replacing unrelated network/quota guidance for this failure only. Existing RecoveryPanel renders the precise message without a new UI framework.

## Evidence

| Layer | Actual result |
| --- | --- |
| Before fix | Three targeted assertions failed: missing non-empty output-schema bounds; invalid plan not corrected; persistent failure had only one call and generic classification. Native Jest: test-results/plan-contract-before.json. |
| Targeted subprocess integration after fix | 4 passed (targeted selection), including network failures not replayed. test-results/plan-contract-after.json. Real disposable Git repo + deterministic Codex subprocess, no AI service. |
| Logic / protocol / recovery | 32 passed across plan, schema, workflow and core suites. Includes one-call valid output; bounded repair; persistent failure; abort before/after invocation; network identity retained; oversized/missing output; original gates and checkpoint recovery. test-results/plan-contract-unit.json. |
| Electron / preload / IPC / UI | scripts/verify-plan-recovery-ui.cjs passed on Windows. Repeated invalid plan renders AGENT_PLAN_INVALID + step 6/file scope, not network/quota guidance. Clicking actual Direct retry recovers the same task to ready; four read-only subprocess calls total, no development snapshot, Git clean, zero page errors. test-results/plan-recovery-ui/result.json. |
| Visual | invalid-plan.png inspected: readable precise recovery panel and retained retry/supplement controls. ready-plan.png records successful recovery. |
| Static/build | TypeScript, ESLint, i18n scan (657 calls, 588 keys, zero untranslated) and production build passed. |
| Full regression | 22 suites passed; 218 tests passed / 2 platform-conditional skipped / 220 total, 287.751 seconds. test-results/plan-contract-full.json. Targeted deselection above is not interpreted as full-suite coverage. |

UI runs use temporary isolated settings, fixture workflow/skill, Git repository and CLI. No real credentials, GitHub operations, group notifications, user tasks or installed app process touched. Owned fixtures cleaned and Electron exited zero. Reproduce: `npm run build`, `npm test`, then `node scripts/verify-plan-recovery-ui.cjs` with the workspace Playwright runtime in NODE_PATH.

## Source / review / boundaries

Checkout: D:/C-Drive-Offload/Desktop/tyflow-studio. Base HEAD: cf17c72d9fcc4bcd0016809a677f77785d86fd7a plus the scoped uncommitted source/test changes. Existing unrelated documentation-generator edits and earlier unpublished update-check fixes are retained, not reset. No dependencies changed. Uses existing Electron/React/Jest/provider/checkpoint architecture; those project conventions override company business-app directory rules.

Tested production-source SHA-256 identities (source unchanged during the final full run):

| Source | SHA-256 |
| --- | --- |
| src/main/providers/plan.ts | E6735F2C1F74ECEE884358951BC5A78CB5F253A264584E3AB9177509F5B4515F |
| src/main/providers/agent-schemas.ts | 8A911DD8E01B3367F3EEF8F8D81E4A3DE4803A1907BB19F630D2964D34869ACB |
| src/main/service.ts | 7D30990506E0A168AF0AB3B91B44CDC3A3D1A92CEE79ECCCD7DBE7E450D0FB35 |
| src/main/workflow/failures.ts | 0A8B9FF45D737E543427616C0CFD5F8CD3ED690EF8D44BD8C66769A7AB3B8F13 |

Lightweight self-review: schema required-field completeness, unchanged local constraints/gates, approval boundary, bounded attempts/prompt size, cancellation, no retry of transport errors, failure code/actions, preservation of selected commit/context and no broad-scope fallback. New helper keeps retry/validation mechanics out of the already large service module. Invalid/valid per-call artifacts remain in separate existing EvidenceStore run directories.

R3 protocol/agent-boundary change: independent human review, real Codex service invocation and macOS native run remain pending. Local fixture success does not establish real-model behavior, semantic correctness of a regenerated plan, or the colleague's business task completion. Production/release recommendation remains REVIEW_REQUIRED, not general readiness. The user's APP/WEB/MP copy requirement was not executed against their project in this task. Earlier startup-check retry and interrupted update-download recovery are separate outstanding work.
