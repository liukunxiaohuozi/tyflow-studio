# AI and A2A

AI may extract draft specifications, expand candidate scenarios, generate test code, inspect traces/logs/screenshots, cluster failures, propose minimal regressions, and repair authorized test mechanics.

Keep logical roles separated even when one agent performs them sequentially:

- Spec Agent creates sourced drafts but cannot confirm critical business expectations.
- Clarifier exposes conflicts, units, permissions, boundaries, and missing Oracle.
- Planner consumes confirmed specs and risk/dependency information.
- Generator writes tests but cannot alter spec, Oracle, or required scope.
- Executor consumes a frozen plan and emits raw results.
- Investigator minimizes and classifies failures.
- Healer may repair equivalent locators, waits, fixtures, or adapters; it cannot skip, weaken, update baselines, or change expected behavior to get green.
- Reviewer compares spec/source/test/plan diffs independently.
- Reporter summarizes machine results and cannot rewrite logs.

Use deterministic scripts for schema validation, plan hashing, test execution status, evidence reconciliation, and final exit codes. Model judgment may explain a result but cannot promote it.

A2A is conditional. Enable it for cross-team/vendor agents, remote device farms, long asynchronous tasks, or separately deployed workers. Exchange `taskId`, project/checkout, source snapshot, spec revisions, plan hash, requested capabilities, state, artifacts, result, and reason codes. Local SDD validation and deterministic testing must continue when A2A is unavailable. A2A never owns business Oracle, credentials, authorization, or release gates.
