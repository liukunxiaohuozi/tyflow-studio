# Tyflow engineering and design standards

Apply this reference to Tingyun/Guanyun frontend projects. The company engineering baseline explicitly targets React + TypeScript; apply React-specific directory, hook, and service rules to that stack. For Angular or other legacy stacks, use the common behavior, design, quality, accessibility, i18n, and evidence principles plus the target repository's explicit conventions.

## Authoritative sources

Start from `C:/Users/tingyun/Desktop/project/web-skills/tyflow/baseline/观云 知识库/knowledge-base-entry.md`, then read only the task-relevant files:

- Engineering entry: `engineering/engineering-overview.md`
- Structure and routing: `engineering/structure-and-routing.md`
- Request, service, mapping, and page state: `engineering/request-and-service.md`
- Code quality, i18n, and delivery gates: `engineering/quality-and-delivery.md`
- Full React + TypeScript baseline: `engineering/engineering-full-reference.md`
- Project adaptation template: `engineering/project-standards-template.md`
- Design entry and rules: `design/design-overview.md`, `design/design-tokens-and-theme.md`, `design/typography-and-color.md`, `design/layout-and-spacing.md`, `design/implementation-checklist.md`
- Component policy: `components/component-reuse-overview.md`, `components/component-selection-flow.md`, and, when a specific component is involved, `components/component-library-index.md`
- Tyflow release evidence: `C:/Users/tingyun/Desktop/project/web-skills/tyflow/shared/VERIFICATION.md`

Save the selected paths, modification times or content hashes, applicability, project override, and unresolved conflicts in `standards-snapshot.json`. Do not copy every knowledge-base rule into each feature spec.

## Precedence and conflict handling

Use separate precedence for separate questions:

- Product behavior and business data: latest explicit user decision → confirmed SDD/PRD/contract → approved design or OD acceptance → project documentation → provisional observation.
- Engineering convention: target repository instructions and mature project architecture → project-level standards → applicable Tyflow company baseline.
- Token value and theme behavior: target repository's actual theme source (`theme.ts`, `css-var.css`, or equivalent) → version-matched Tyflow token reference → approved design exception.
- Component choice: target project's existing wrapper and real usage → Tingyun component library → Ant Design → justified local component.

Current implementation may establish paths, selectors, component availability, and theme-source values. It cannot override a confirmed product Oracle. If authoritative sources conflict, record both and mark the dependent rule `NEEDS_DECISION`.

One known conflict must be checked rather than silently chosen: the current Tyflow token reference lists `--ty-font-size: 12px`, while an older interaction acceptance checklist states common body/form/button/table text as `14px / 22px`. Use the target theme source and version-matched approved baseline; otherwise keep typography conformance undecided.

## Three validation layers

### L1 machine gates

Run the target project's verified commands and keep raw output:

- TypeScript/type checking.
- ESLint without introducing errors or hiding them with unexplained `eslint-disable`.
- Unit/component tests with real assertions and discovered-test counts.
- Production build.
- i18n scan.

Tyflow i18n passes only when changed Chinese UI strings are wrapped by the project's i18n mechanism, the real scan command has run, locale files were updated, and the related English values contain no Chinese residue. Text search is discovery evidence, not a substitute for the scan.

Also inspect newly changed code for `any`, `as any`, `@ts-ignore`, deprecated APIs, un-narrowed `unknown`, nullable handling, unknown enum handling, duplicate mapping layers, temporary compatibility logic, side-effecting scripts, and files whose growing responsibility warrants review. Some are review findings rather than automatic failures; preserve the exact file and rule.

### L2 behavior and contract gates

For applicable modules verify:

- routes are registered through the project convention and deep links, refresh, back, and forward work;
- pages expose loading, success, empty, error, and no-permission behavior as applicable;
- HTTP success and business success are distinguished;
- requests live in the service layer for React projects, with typed input/output and business names;
- backend DTO/response shapes do not leak into the page;
- backend-to-UI mapping has one `mapToXxx`/`normalizeXxx` point, with mapper tests for normal, empty, null/undefined, unknown enum, long, and special-character input;
- mock data matches the UI contract and does not pretend to prove real integration;
- errors remain observable and recoverable; loading closes through a reliable common path;
- filters, sorting, pagination, search, time, tabs, charts, tables, drawers, modals, and saves produce the expected state and request/data effects;
- stale requests cannot overwrite the latest state; duplicate submit is prevented;
- initialization is idempotent and listeners/connections clean up;
- saved state is read back and permissions are checked at both UI and service boundaries.

### L3 design and semantic gates

When approved Figma, OD handoff, design acceptance, or a confirmed standards baseline exists, automate stable assertions and retain reviewable images:

- semantic token use for color, spacing, radius, shadow, typography, and light/dark themes;
- default typography inheritance and paired font-size/line-height for non-default text;
- common radius near 6px, spacing on the 8px/16px system, and version-matched token values;
- hover, active, selected, disabled, loading, empty, error, and permission-limited feedback;
- layout regions, table/form alignment, chart structure/palette/legend, drawer/modal/dropdown geometry;
- minimum widths, overflow/scroll behavior, zoom, and required responsive breakpoints;
- Chrome and Firefox critical paths for Tyflow pre-test readiness;
- accessible names, keyboard operation, focus containment/restoration, and status announcements.

Use computed styles and token resolution for exact machine checks, Playwright behavior assertions for state, and screenshots/diffs for review. A screenshot alone cannot prove token use, data mapping, keyboard behavior, or business meaning. Without an approved visual/semantic baseline, report evidence and an explicit review item instead of a false PASS.

## Component reuse gates

Search the target project before the central library. Record existing wrappers, real import paths, props, storage naming, style wrappers, and consumer version. Common candidates include `TyPageContainer`, `TyTable`, `TyCustomTableHeader`, `TySearch`, `TyFilterSelect`, `TimeRangePicker`, `TyDrawer`, `TyDrawerUltra`, `TyEmpty`, chart/topology components, and `TyExportData`.

A static import check may flag likely duplication, but component suitability needs context. Fail only when an applicable project/company rule and an equivalent verified component prove the custom implementation violates policy. Otherwise create a review item with the candidate and evidence.

## TYF rule families

- `TYF-SOURCE`: standards snapshot, applicability, precedence, conflict visibility.
- `TYF-CODE`: type, lint, structure, responsibility, suppression, deprecation, and performance review.
- `TYF-SERVICE`: request placement, typed contract, single mapping point, shape drift, errors, and page states.
- `TYF-I18N`: wrapper, scan, locale generation, and translation completion.
- `TYF-COMP`: project wrapper and Tingyun component reuse evidence.
- `TYF-DESIGN`: tokens, typography, color, spacing, radius, shadow, themes, and approved visual baseline.
- `TYF-INTERACTION`: trigger, state, feedback, data effect, boundary, persistence, keyboard, and focus.
- `TYF-BROWSER`: Chrome/Firefox, responsive, overflow, zoom, and resource errors.
- `TYF-OBSERVE`: error boundaries, async observability, APM marks/instrumentation, and complete chart/table states.
- `TYF-EVIDENCE`: raw commands, input/expected/actual, coverage scope, skipped items, and traceability.

Run `node scripts/tyflow-standards-snapshot.mjs <project-root> [standards-snapshot.json]` first, then `node scripts/tyflow-audit.mjs <project-root> [output.json]` as a deterministic candidate scan. The audit findings supplement the project's real lint/type/test/build/i18n commands and browser tests; regex findings are not an independent product Oracle.
