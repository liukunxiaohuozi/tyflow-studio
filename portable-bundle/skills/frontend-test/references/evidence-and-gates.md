# Evidence and gates

Create `test-results/<runId>/` with the strongest available subset of:

```text
run.json
environment-manifest.json
standards-snapshot.json
execution-plan.json
execution-plan.sha256
raw-results.json
results.json / JUnit
coverage.json
defects.json
assertions.jsonl
requests.jsonl
b2b-gates.json
code-review.json
network-summary.json
performance-observation.json
debt-baseline.json
cleanup.json
VERIFY.md
traces/ screenshots/ visual-diffs/ downloads/ logs/
```

Bind evidence to `runId`, project/checkout, source snapshot, spec revisions, plan hash, fixture seed, frontend/backend/contract identity, gateway, role/tenant anonymity, browser/tool versions, mode, and time. Redact shared artifacts; keep sensitive raw evidence in controlled storage.

For Tingyun projects, also bind the Tyflow knowledge-base file paths, revisions or hashes, project-level rules, actual theme source, component registry, and approved design/OD references. A standards conflict remains visible in the report and cannot be resolved by current UI behavior.

For applicable B2B projects, bind the R1–R4 risk level, B-01–B-12 findings, baseline identity, code-review evidence, performance sample conditions, and release recommendation. If the frozen plan requires `b2b-gates`, missing `b2b-gates.json` is incomplete evidence.

## Case status

- `PASS`: all required assertions and evidence passed for the declared mode.
- `FAIL`: actual behavior contradicts a confirmed Oracle or required technical invariant.
- `FLAKY`: attempts disagree; retain the first failure.
- `BLOCKED`: a prerequisite prevented the case.
- `NOT_RUN`: a planned case did not execute.
- `NOT_APPLICABLE`: the frozen plan contains an independently supported reason.

## Run conclusion

| Conclusion | Rule | Exit |
|---|---|---:|
| VERIFIED | every required planned case/check passed, with complete evidence and cleanup | 0 |
| FAILED | required confirmed mismatch or prohibited gate/scope change | 1 |
| INCOMPLETE | required blocked/not-run/flaky, or identity/source/evidence/shard/cleanup incomplete | 2 |
| NEEDS_DECISION | critical expected behavior conflicts or lacks an independent source | 3 |

Deterministic precedence is `FAILED > NEEDS_DECISION > INCOMPLETE > VERIFIED`, while retaining every secondary reason. Do not infer VERIFIED merely from zero failures.

## B2B gate class and release recommendation

- BLOCK maps a confirmed required mismatch to `FAILED` and `NO_GO`.
- WARN preserves `VERIFIED` when all required checks pass, but returns `GO_WITH_RISK` and lists every warning.
- OBSERVE records a trend without changing the run conclusion.
- Missing risk classification, Oracle, required human review, comparable baseline, or required evidence maps to `NEEDS_DECISION` or `INCOMPLETE`, with `REVIEW_REQUIRED`.

Use [b2b-practical-gates.md](b2b-practical-gates.md) for exact B-01–B-12 scope. Do not turn existing comparable lint/type/test debt into a change failure when it is unchanged; do not baseline-waive security, tenant, sensitive data, irreversible data damage, confirmed core calculation errors, or total unavailability.

## Required anti-misclassification checks

Reject zero-test success, wrong app/port, stale dependency identity, source changes, missing untracked work, `skip`/`only`, weakened assertions, mock leakage, HTTP-200 business failure, wrong unit/field, request race, missing shard, mismatched evidence run, incorrect screenshot update, uninstalled package candidate, write without read-back, permission without server check, cleanup failure, and reporter/result-contract disagreement.

`VERIFY.md` must state what was tested, what was proved per mode, failures, blocked or undecided scope, coverage denominator, flaky/waivers, evidence paths, cleanup, and practical next action. Allure or another UI may display results but cannot override the result contract.
