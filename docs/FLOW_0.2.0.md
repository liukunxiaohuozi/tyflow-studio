# v0.2.0 — Branch-first execution and delivery

- OpenDesign, text requirements, and Bug fixes now select the project and development branch on the intake screen before any repository assessment.
- The assessment preview shows the selected project and branch as a locked execution target. Ordinary branch selection no longer creates a second reassessment step.
- Bug fixes use one “Start fixing” action and call Codex directly on the selected branch. There is no separate Tyflow planning checkpoint; Codex diagnoses, applies the smallest safe fix, and reports actual checks. Automated testing remains optional.
- Write-capable Codex stages use `--approve-for-me`; read-only stages use `--sandbox read-only`. The client keeps a separate Codex cache while synchronizing the user's authentication, preventing stale global model-cache schemas from interrupting a repair.
- The automated-testing option remains attached to the selected execution target, with plan, test cases, checks, and logs retained in the task record.
- “Accept, commit and push” commits the task changes and pushes the checked-out development branch through the configured Git authentication. A push failure leaves the local commit recorded so the same action can retry the push without creating a duplicate commit.
