# Capability manifest

Reconcile all rows when onboarding a project, assessing the test system, or claiming complete Skill support. Use `implemented`, `configured`, `blocked`, or `conditional`; include evidence or a reason. A mention in documentation is not implementation.

| ID | Capability | Skill status | Delivery route |
|---|---|---|---|
| CAP-01 | Cross-project and checkout discovery | implemented | discover script + project inspection |
| CAP-02 | Source snapshot freeze | implemented | Git/config digests + run manifest |
| CAP-03 | SDD discovery and draft extraction | implemented | SDD workflow |
| CAP-04 | SDD schema/reference/conflict validation | implemented | spec validator |
| CAP-05 | Spec diff plus Git impact | implemented | spec diff + dependency inspection |
| CAP-06 | Confirmed-spec compilation and frozen plan | implemented | compiler + plan hash |
| CAP-07 | Independent Oracle | implemented | sourced Oracle assets or project SDK |
| CAP-08 | Fixed data lifecycle | implemented | fixtures + project seed/query/read-back/cleanup adapter |
| CAP-09 | Environment/deployment/identity fingerprint | implemented | discovery + project environment manifest |
| CAP-10 | Unit/property/mutation tests | implemented | project runners + selective tools |
| CAP-11 | Component integration and mock | implemented | project runner + MSW/route |
| CAP-12 | API and contract semantics | implemented | API checks + real backend |
| CAP-13 | OpenAPI/GraphQL drift and generated tests | conditional | schema tools when an authoritative schema exists |
| CAP-14 | Browser end-to-end | implemented | Playwright or equivalent existing asset |
| CAP-15 | Host/cross-project/consumer testing | implemented | independent integration suite |
| CAP-16 | Data correctness evidence chain | implemented | Oracle/request/response/UI/read-back comparison |
| CAP-17 | Auth, role, permission, and tenant | implemented | UI + direct API + identity check |
| CAP-18 | Network/race/error/recovery | implemented | controlled response order and fault adapters |
| CAP-19 | Disposable dependencies and fault injection | conditional | containers/service virtualization when available |
| CAP-20 | Visual regression | implemented | sourced baseline + diff |
| CAP-21 | Accessibility | implemented | axe + keyboard/focus behavior |
| CAP-22 | Performance | implemented | observation, reproducible baseline, trend warning, and approved project budgets |
| CAP-23 | Security automation | conditional | authorized scanner lane only |
| CAP-24 | Cross-browser and real devices | conditional | product support matrix and device lane |
| CAP-25 | Evidence, reports, and exit codes | implemented | result contract + deterministic summary |
| CAP-26 | Failure classification and minimal reproduction | implemented | diagnostic workflow |
| CAP-27 | Limited automatic maintenance | implemented | guarded healer rules |
| CAP-28 | CI profiles, sharding, and merge | implemented | stable CLI + expected shard accounting |
| CAP-29 | Flaky, waiver, and history governance | implemented | retained attempts and expiring records |
| CAP-30 | Test-system challenge set | implemented | isolated evaluation + project historical defects |
| CAP-31 | AI assistance and role separation | implemented | agent boundaries + deterministic gates |
| CAP-32 | A2A-compatible protocol | conditional | task/artifact adapter when remote workers exist |
| CAP-33 | Tyflow engineering/design standard conformance | implemented | standards snapshot + static/behavior/visual gates |
| CAP-34 | Practical B2B tiered gates | implemented | R1–R4 risk, BLOCK/WARN/OBSERVE evaluator, and release recommendation |
| CAP-35 | Independent code review | implemented | lightweight changed-code review plus risk-triggered human review |
| CAP-36 | Performance baseline and regression classification | implemented | sample/variance readiness, typed thresholds, repeat confirmation, and project budget |

For the workspace-wide design and test challenge cases, consult:

- `C:/Users/tingyun/Desktop/project/output/frontend-test-strategy-2026-09-08/PLAN.md`
- `C:/Users/tingyun/Desktop/project/output/frontend-test-strategy-2026-09-08/SDD-SPEC.md`
- `C:/Users/tingyun/Desktop/project/output/frontend-test-strategy-2026-09-08/COVERAGE-MATRIX.md`
- `C:/Users/tingyun/Desktop/project/output/frontend-test-strategy-2026-09-08/PROJECTS.md`
- `C:/Users/tingyun/Desktop/project/output/frontend-test-strategy-2026-09-08/SKILL-BUILD-SPEC.md`
