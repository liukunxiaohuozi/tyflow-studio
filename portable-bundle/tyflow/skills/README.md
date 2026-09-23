# Tyflow Skills

This directory vendors the reusable dependency skills that Tyflow uses, so the workflow can be shared with fewer setup steps.

`tyflow-do` is the workflow entrypoint skill. It is not vendored here as a dependency because it owns the workflow itself and should be installed as the top-level trigger skill.

## Vendored Skills (actually present in this directory)

- `context7`: Looks up current framework and library documentation.
- `frontend-developer-skill`: Frontend implementation, interaction, and performance reference.
- `skill-creator`: Turns stable workflow knowledge into reusable skills.

## External Dependency Skills (NOT vendored here)

These are referenced by the workflow but are **not** copied into `.tyflow/skills`. Read them from the machine's own skill directories (`.codex/skills`, `.claude/skills`, or `.agents/skills`):

- `api-contract-generator`: Generates frontend API contract/service/integration artifacts.
- `api-intelligent-integration`: Integrates real APIs through contract/service mapping.

> Keep this list in sync with `shared/WORKFLOW.md` (Skills 体系) and `REMADE.md`. After editing the skill list, the AI re-checks that all three lists agree and that every vendored skill folder actually exists.

## Usage

When sharing Tyflow with another machine, install `tyflow-do` as the entrypoint skill, then copy `.tyflow/skills/*` into that user's skill directory, and separately install the two external dependency skills above from the source skill directories.

Tyflow itself should still be triggered through:

```text
$tyflow-do ...
Tyflow, ...
听云前端工作流, ...
```

## Source Snapshot

These skills were copied from the local Codex/agent skill directories. If the source skills are updated later, refresh this directory before sharing the workflow.
