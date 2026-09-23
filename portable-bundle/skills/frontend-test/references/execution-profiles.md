# Execution profiles

| Profile | Expected scope |
|---|---|
| change | affected static/logic/component checks, lightweight code review, critical page/API/error path, and performance observation |
| integration | change plus affected build, real contract/read-back, permissions, and required cross-project path |
| nightly | connected P0/P1, full contract/negative paths, browser candidates, performance trends, visual/a11y, and selected security |
| release | frozen version matrix, all release-required cases, permissions/writes/export, and approved project budgets |
| periodic | large data, longevity, lifecycle/memory, mutation, dependency upgrade, active security, and AI challenge set |

Derive scope from the union of confirmed spec change and code/dependency impact. If dependency knowledge is incomplete, widen to project smoke plus the related domain suite and report the uncertainty.

## B2B risk routing

- R1: changed static checks plus target render/visual structure.
- R2: R1 plus logic/component, critical browser interaction, affected API parameters/mapping, loading/empty/error/recovery, and request race.
- R3: R2 plus UI/direct-API permission checks, write read-back/idempotency, real host/consumer integration, lifecycle loops, fault injection, and human review.
- R4: release matrix with approved compatibility/performance budgets, large data, longevity, and full P0/P1 regression.

For Tingyun/Guanyun, compile `b2bGates.enabled: true` and the selected risk level into the frozen plan. The 10–40 minute change target is a project-configurable efficiency goal, never a reason to remove required cases.

Unchanged comparable baseline debt is WARN; new or touched-and-worsened debt is evaluated by B-01–B-12. Security, cross-tenant exposure, sensitive-data leakage, irreversible data damage, confirmed core calculation errors, and total release unavailability cannot be baseline-waived.

## Modes

- `mock`: deterministic UI or component behavior for supplied inputs.
- `integration`: deployed or local real service, version identified, data read-back available.
- `host`: real shell/sub-app/navigation/context and pinned participating versions.
- `device`: named real browser, device, and environment.

Report each mode separately. A UI journey does not compensate for an unidentified backend or missing provider verification.

## Execution controls

Before running, freeze project/checkouts, source snapshot, spec revisions, cases, profile, modes, roles, parameter combinations, Oracle versions, evidence, expected shards, and cleanup. Hash the plan.

Use isolated browser contexts per worker. Destructive session changes require dedicated identities or resource locks. Start apps with verified commands and readiness plus app identity checks. Record ports and URLs without assuming defaults.

Run independent checks in parallel only when their data, sessions, and services are isolated. Merge all expected shards, including failures and timeouts. Keep first-failure artifacts and every retry. A retry success is `FLAKY`, not a clean pass.

Conditional infrastructure:

- Testcontainers/Compose for disposable databases, caches, queues, and object stores.
- WireMock/MockServer for explicit service virtualization.
- Toxiproxy/network adapter for recorded latency, disconnect, and jitter.
- BrowserStack/Sauce/enterprise grid when product support requires real devices.
- ZAP only against an authorized non-production target defined by environment policy.
