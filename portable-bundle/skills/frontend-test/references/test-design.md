# Test design

Select the smallest set of layers that can independently prove the requirement and its main risks. Combine layers for critical workflows; do not replace behavioral coverage with code coverage.

| Layer | Validate | Typical tools |
|---|---|---|
| Static/build | types, imports, packaging, routes, side effects | project compiler/build/lint |
| Logic | parsing, formulas, time, units, serialization, permissions | Jest/Vitest/Karma |
| Property/model | invariants, boundaries, state sequences | fast-check or equivalent |
| Component | rendering, providers, events, loading/error states | project runner + MSW |
| API/contract | parameters, schema, business errors, auth, pagination | API client, OpenAPI diff, Schemathesis, conditional Pact |
| Browser | user actions, URL, refresh, back, deep link, download | Playwright |
| Integration | real service semantics, persistence, tenant isolation | Playwright/API + read-back |
| Host/cross-project | mount, context, navigation, version combinations | independent Playwright suite |
| Consumer/package | built artifact and real consumer behavior | pack/install + consumer tests |
| Visual/a11y | approved appearance, overflow, keyboard, focus, labels | screenshots/diff + axe + behavior |
| Performance | production build, business readiness, web vitals, interaction | browser metrics/Lighthouse |
| Security | passive/active web and API checks in an authorized test environment | ZAP or equivalent |
| Tyflow conformance | engineering baseline, service boundaries, i18n, token use, component selection | project commands + static audit + browser/computed style |

Always cover relevant happy, empty, loading, validation, boundary, business failure, HTTP failure, timeout, cancellation, retry, duplicate submit, stale response, refresh/reopen, permission, tenant, and cleanup states.

Use semantic locators first: role/name, label, stable test ID, then scoped structural locator. Avoid arbitrary sleeps. Wait for an observable state, request, event, or clock. Keep assertions on business outcomes and exact request/data semantics; visibility alone is rarely sufficient.

For visual tests fix OS, browser, fonts, DPR, viewport, theme, locale, time, and data. Baselines require a design or defect source and approval record. Dynamic masks cannot hide the value under test.

For performance use production builds, fixed data/network/CPU/device, repeated samples, and project budgets. Preserve every sample and dispersion. A load-only Lighthouse run cannot establish all interaction performance.

For established B2B projects, use [performance-gates.md](performance-gates.md): one warm-up plus three measured samples for change observation; provisional baseline needs at least 3 independent runs/15 samples/2 periods; formal reference needs 5 runs/25 samples/3 working days and variability at most 15%. A first candidate regression remains observation; require two independent reproductions before warning. Numeric regression blocks only against an approved project budget or demonstrated unusability.

For changed code, apply [code-review.md](code-review.md). Review all changed behavior lightly; require human review only for R3/R4, confirmed CRITICAL/HIGH findings, shared protocols, or configured large changes.

Use mutation testing selectively for critical Oracle and test code. Surviving meaningful mutants indicate weak assertions or missing scenarios.

For Tingyun projects, map every applicable `TYF-*` rule from [tyflow-standards.md](tyflow-standards.md) to a static command, unit/component case, browser assertion, visual comparison, or explicit review item. Do not collapse a company guideline and a product requirement into one assertion.
