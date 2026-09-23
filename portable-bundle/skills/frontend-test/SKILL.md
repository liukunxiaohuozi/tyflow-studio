---
name: frontend-test
description: Validate newly developed or changed frontend modules across React, Umi, Vite, Angular, host/micro-app, and shared-component projects using SDD, independent oracles, deterministic tests, real evidence, and explicit release gates. Use for module verification, test onboarding, regression, defect reproduction, or frontend test capability assessment.
---

# Frontend Test

Turn requirements and confirmed behavior into repeatable tests, execute the strongest available verification, and report exactly what is proved. Continue useful checks when some business details or environments are missing; isolate only the dependent conclusions.

## Route the request

### Orchestrated invocation

When Studio or another orchestrator supplies `verificationMode: orchestrated`, treat its approved requirements, cases, source snapshot, and plan hash as the frozen request contract. Do not reinterpret the product requirement or repeat development-stage feedback checks merely because they appear in logs. Execute the formal test plan once, retain evidence, and return one check per approved case.

For every passed P0/P1 case, emit structured evidence. Command evidence includes the exact command and exit code zero; file evidence includes an in-scope path and content hash when supplied. Prose-only success is invalid. Do not edit business, dependency, route, permission, or configuration files during formal testing.

Return the requested checks, evidence, and deterministic conclusion; the orchestrator wraps them with `provider`, `runId`, `sourceSnapshot`, `planHash`, and Skill hash to form the persisted result envelope. Use `VERIFIED`, `FAILED`, `INCOMPLETE`, or `NEEDS_DECISION` when the caller schema supports those conclusions. Never claim reuse yourself: the orchestrator decides reuse by comparing the identities and evidence. If the source changes during execution, return `INCOMPLETE`.

See [orchestrated-contract.md](references/orchestrated-contract.md) for the V1 interchange contract.

1. Identify the target project, checkout, module, change, requested profile, and available requirement sources.
2. Read [project-discovery.md](references/project-discovery.md) before choosing commands or modifying test configuration.
3. For new modules, requirements, or changed behavior, read [sdd-routing.md](references/sdd-routing.md) and [oracle-and-data.md](references/oracle-and-data.md).
4. Read [test-design.md](references/test-design.md) to select test layers. Read [adapters.md](references/adapters.md) for the detected stack. For Tingyun/Guanyun or another established B2B project, always read [b2b-practical-gates.md](references/b2b-practical-gates.md). For code changes also read [code-review.md](references/code-review.md); when performance applies read [performance-gates.md](references/performance-gates.md). For Tingyun/Guanyun additionally read [tyflow-standards.md](references/tyflow-standards.md) and [domains.md](references/domains.md).
5. Before execution and reporting, read [execution-profiles.md](references/execution-profiles.md) and [evidence-and-gates.md](references/evidence-and-gates.md).
6. For generated/healed tests, multi-agent work, or remote workers, read [ai-and-a2a.md](references/ai-and-a2a.md).
7. Use [capability-manifest.md](references/capability-manifest.md) when onboarding a project, assessing coverage, or claiming the skill/toolchain is complete.

## Core workflow

Follow this state chain and retain the input/output of each completed stage:

`Discover → Specify → Clarify → ValidateSpec → Assess → Prepare → CompilePlan → Generate → Execute → Diagnose → Retest → Report → Learn`

- **Discover:** inspect repository instructions, package/lock files, existing tests, routes, APIs, dependencies, Git state, runtime, and side-effecting scripts. Freeze a `sourceSnapshot` that includes relevant uncommitted work.
- **Specify:** convert requirements, interaction/design sources, contracts, business rules, and confirmed defects into versioned SDD. When only a requirement document exists, confirm explicit business behavior and mark inferred interaction details provisional.
- **Clarify:** ask only for information that changes a critical expected result and cannot be inferred from an authoritative source. Continue independent build, static, component, API, and exploratory checks.
- **ValidateSpec:** validate schema, references, status transitions, conflicts, testability, and Oracle provenance. Current UI, API output, or implementation cannot be the sole expected result.
- **ValidatePolicy:** for Tingyun projects, freeze the applicable Tyflow company baseline, project rules, theme source, component registry, and any approved design/OD acceptance as `standardsSnapshot`; resolve or expose conflicts before using them as gates.
- **Assess:** combine spec diff and Git diff; select the union of requirement risk and code dependency impact. Classify B2B changes as R1–R4; permissions, tenant, writes, shared packages, and cross-app protocols are at least R3.
- **Prepare:** establish exact app identity, environment, auth/tenant/role, fixed data, clock, mocks, read-back, cleanup, and required services.
- **CompilePlan:** freeze cases, projects, modes, roles, Oracle revisions, required checks, evidence, shards, and cleanup into `execution-plan.json`; hash it before execution.
- **Generate:** add maintainable tests in repository conventions. Prefer role/label/test-id locators and observable business outcomes. Do not rewrite product code unless the user requested a fix.
- **Execute:** run deterministic project commands and applicable browser/API checks. For applicable B2B changes, produce the frozen gate observations and run the practical gate evaluator. Separate mock, integration, host, security, performance, and real-device conclusions.
- **Diagnose:** classify product, test, specification, environment, data, and flaky failures; minimize the reproduction while preserving the first failure.
- **Retest:** rerun the failure plus affected checks. Never replace an earlier failure with a retry success.
- **Report:** generate evidence-linked statuses and coverage gaps. Only deterministic machine results determine the status.
- **Learn:** write confirmed defects back as behavior/Oracle/test traceability candidates; do not auto-confirm business decisions.

## Non-negotiable judgment rules

- A test expected value must cite a confirmed requirement, contract, independent example/formula/invariant, approved design baseline, permission matrix, or confirmed defect.
- For data-bearing P0/P1 flows, compare `Oracle → request → response semantics → UI → read-back/cross-view/export` as applicable.
- A success toast does not prove persistence. A hidden control does not prove server authorization. HTTP 200 does not prove business success.
- Mock success proves only behavior for the supplied mock. It cannot establish real integration, persistence, tenant isolation, or provider compatibility.
- Missing Oracle becomes `NEEDS_DECISION`; missing environment/evidence/required execution becomes `INCOMPLETE`; confirmed mismatch becomes `FAILED`.
- Any required flaky test keeps the run `INCOMPLETE`. Zero discovered required tests, missing shards, missing evidence, source changes, and cleanup failures cannot pass.
- Generator or healer changes to Oracle, required scope, visual baseline, permission expectation, or gate need an independently sourced specification change.
- In established B2B projects, block confirmed new core function/data/API/permission/write/race/stability regressions. Keep comparable unchanged lint/type/test debt as warnings. Performance starts as observation, becomes warning only after reproducible baseline comparison, and blocks only against an approved project budget or demonstrated unusability.
- All R1–R3 code changes receive lightweight review. R3, confirmed CRITICAL/HIGH findings, shared protocol changes, and configured large changes require human review; missing required review makes the run `INCOMPLETE`.

## Deterministic helpers

Use the Node scripts when their operation applies:

```text
node scripts/discover.mjs <root> [output.json]
node scripts/spec-validate.mjs <spec-path>
node scripts/spec-diff.mjs <before> <after> [output.json]
node scripts/spec-compile.mjs <spec-path> <execution-plan.json> [profile]
node scripts/plan-freeze.mjs <execution-plan.json> <run-dir>
node scripts/run.mjs <execution-plan.json> <run-dir>
node scripts/evidence-verify.mjs <run-dir>
node scripts/result-summarize.mjs <run-dir>
node scripts/tyflow-standards-snapshot.mjs <project-root> [standards-snapshot.json]
node scripts/tyflow-audit.mjs <project-root> [output.json]
node scripts/b2b-gates.mjs <gate-input.json> <run-dir>
```

These helpers do not install dependencies. JSON-formatted YAML works without packages; ordinary YAML requires a compatible `yaml` or `js-yaml` package available from the target project. Report `NEEDS_SETUP` when parsing support is absent.

## Completion

Return the tested source snapshot, requirement/spec revision, standards snapshot when applicable, layers and modes executed, exact result, failures, blocked or undecided checks, evidence paths, cleanup result, and remaining coverage. Use `VERIFIED`, `FAILED`, `INCOMPLETE`, or `NEEDS_DECISION` according to [evidence-and-gates.md](references/evidence-and-gates.md). Do not claim project or skill completeness without reconciling [capability-manifest.md](references/capability-manifest.md).
