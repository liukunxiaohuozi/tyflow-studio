# Orchestrated test contract V1

## Request

The orchestrator persists a `TestRequest V1` containing `contractVersion: 1`, `verificationMode: orchestrated`, project identity, `sourceSnapshot`, `planHash`, approved requirements, plan steps with `expectedFiles`, approved cases, changed files, and requested profile. These fields are frozen for the run.

## Result

Return a deterministic conclusion, one result per approved case, evidence references, skipped scope, and remaining risks. The orchestrator adds provider identity, unique run ID, unchanged `sourceSnapshot`, `planHash`, and Skill hash to the persisted envelope. A missing required case, changed source, missing evidence, or blocked required check is `INCOMPLETE`, not `VERIFIED`.

## Ownership

- Tyflow owns product specification, acceptance intent, and traceability.
- frontend-test owns test planning, execution, evidence, and deterministic conclusion.
- The orchestrator owns reuse, lifecycle gates, and persistence.

Development feedback output is not formal test evidence unless the frozen test plan explicitly imports and verifies it.

P0/P1 passed cases require structured evidence. The provider may add targeted test files and controlled evidence, but any business, dependency, route, permission, or configuration change invalidates the run and returns control to development.
