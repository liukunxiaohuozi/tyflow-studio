# Tingyun domain checks

Apply only to relevant modules.

- **Time/query:** milliseconds, seconds, minutes, relative/absolute time, timezone, granularity, URL/event/API mapping, latest-selection-wins, and stale response suppression.
- **Dashboards/charts/tables:** filter propagation, aggregation, legends/series, empty/partial data, pagination/count consistency, cross-view/drill-down consistency, and saved state.
- **Reports:** design/preview agreement, save/reopen, supported export types, text/numeric/time content, pages/records, scheduling timezone, recipients, retry/dedup, and test sinks.
- **RUM/session replay:** event ordering, route/session context, privacy masking, media/resource readiness, large sessions, seek/playback, and nested app behavior.
- **APM/infra/alarm:** topology/resource identity, unit conversion, query context, threshold/rule state, notification routing, retries, audit, and read-back.
- **User center:** roles, permission versions, tenant isolation, revoke/logout, direct API denial, and audit trail.
- **AI-assisted modules:** fixed prompts/inputs where possible, schema and tool-call contracts, deterministic guards, safety/error states, latency/cost evidence, and explicit nondeterministic tolerances.

For every saved configuration, prefer an independent read-back or second view. For every permission claim, exercise both UI and server. For every cross-product link, record host, child, backend, and shared component identities.
