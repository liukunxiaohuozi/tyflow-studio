# SDD routing

Use these versioned objects under `.testing/specs/<feature>/` when persistent project specs are appropriate:

- `requirement.yaml`: scope, goals, exclusions, acceptance statements, priority, source references.
- `behavior.yaml`: actors, preconditions, actions, states, outcomes, failures, permissions, and boundaries.
- `contract.yaml`: requests, responses, events, units, business status, pagination, errors, auth, and context.
- `oracle.yaml`: independent examples, formulas, invariants, tolerances, visual/performance baselines, and provenance.
- `test-plan.yaml`: scenarios, layers, modes, data, roles, evidence, and required/optional status.
- `traceability.yaml`: source → requirement → behavior/contract/oracle → case → run → defect.

For Tingyun/Guanyun or another adopted B2B project, `test-plan` also declares:

```yaml
b2bGates:
  enabled: true
  riskLevel: R2
  efficiencyTargetMinutes: 40
```

`riskLevel` is R1–R4 from [b2b-practical-gates.md](b2b-practical-gates.md). The compiler adds `b2b-gates` to required checks when enabled. The efficiency target is project-configurable and never removes required cases.

Lifecycle: `draft → clarified → confirmed → implemented → verified → superseded`.

- `draft/clarified` may guide exploration and candidate tests.
- Only `confirmed` can define a release-blocking business Oracle.
- `implemented` says code exists; it does not say the code is correct.
- `verified` must bind the current spec revision, source snapshot, environment, and valid run.

## Source confidence

Use explicit product decisions, approved requirements, authoritative contracts, domain rules, independent examples, approved designs, and confirmed defects. Record author, location, version/date, scope, and confidence. Existing code, tests, and current UI are discovery sources and regression observations; they cannot independently confirm intended behavior.

## Requirement document without interaction documentation

Split behavior into:

1. Explicit business behavior: eligible for `confirmed` when the requirement is authoritative and testable.
2. Standards-derived quality behavior: accessibility, keyboard operation, focus safety, duplicate-submit prevention, crash resistance, and browser semantics; cite the applicable standard or policy.
3. Product interaction choice: modal versus drawer, exact feedback pattern, confirmation timing, filter persistence, animations, and layout preference. Mark `provisional` or `NEEDS_DECISION` unless another source confirms it.

Explore the current page to learn selectors and observed behavior, but label it `observed-current-implementation`; never promote it to the expected result automatically.

## Change classification

- editorial: wording or metadata only, with no behavioral expectation change.
- behavioral: default, unit, state, permission, boundary, error, or interaction semantics changed; revise Oracle and affected cases.
- breaking: consumer or protocol behavior invalidated; expand provider and consumer regression.

Run `spec-validate` before compilation. Run `spec-diff` and Git diff together. If critical sources conflict, emit the exact question and `NEEDS_DECISION` for dependent checks while continuing unrelated verification.
