# Oracle and test data

An Oracle is the independently sourced expected result for a fixed input. Prefer confirmed examples, formulas, state transitions, invariants, contracts, permission matrices, approved designs, performance budgets, and confirmed defects. Record units, timezone, precision, tolerance, boundary inclusivity, source references, and revision.

Never calculate expected values by importing the tested service or function, copying its algorithm, reading the current DOM, replaying the current response, or asking a model to infer what looks reasonable.

For P0/P1 data flows, design this evidence chain where applicable:

```text
confirmed source
→ versioned fixture + fixed clock
→ independent Oracle
→ UI input/current state
→ captured request
→ response structure + business semantics
→ final visible state
→ persistence read-back / cross-view / export
→ evidence bound to runId/specRevision/sourceSnapshot
```

## Data lifecycle

Use fixed, versioned fixtures for key expected values. Random generators may fill irrelevant names or text, but record their seed and never use unstable random output as a business Oracle.

Namespace mutable resources with `runId`, worker, tenant, and fixture version. Prepare through a documented seed API, fixture loader, test service, or isolated store. Verify writes through an independent read API/store or a second business view. Clean only resources created by the run and produce `cleanup.json`.

Cleanup failure is `INCOMPLETE` unless a predeclared isolation lease or TTL has been observed to complete and guarantees no interference. Shared accounts, tenant state, revocation, notifications, report delivery, and exports need isolated identities, resource locks, or test sinks.

## Fixed time and concurrency

Freeze the clock for relative time tests. Assert epoch units and timezone explicitly. For request races, control response order and prove the final state follows the latest valid selection. Preserve both requests, response order, final UI, and fixture seed.

## Permissions

Exercise each relevant role and tenant through both UI and direct API. Verify server identity after cached session restoration. A hidden button is a UI assertion; server rejection and audit/read-back establish authorization and isolation.
