# Recoverable execution and provider seams

## Delivery contract

- Durable checkpoints for assessment preparation/output, workspace preparation, dependency installation, development Agent output, code/policy checks, each engineering command and approved test case, runtime startup and delivery.
- Typed environment/Agent/code/test/Git/policy/interruption failures, with exact checkpoint, scope and recovery actions. Process stalls and network/abnormal exits are explicit reasons, not generic errors.
- Resume only incomplete/invalid checkpoints; preserve user code. Passed evidence is reused only for the same source, approved scope, skill, runtime configuration and verified evidence files. Never automatically replay commit/push after interruption.
- Supplemental context is append-only and available at every active/awaiting key stage. Original approved scope remains frozen; expanding it requires new approval/task, not silently bypassing policy.
- Backward-compatible task migration; no forced restart or automatic execution of older tasks.

## Modules

Workflow Engine owns scheduling, transitions, checkpoint persistence and recovery. Agent Provider owns CLI discovery/login/version compatibility, transport and structured output. Test Provider owns engineering-command and case-level reuse plus Skill orchestration. SCM Provider owns Git operations (including GitHub/GitLab remotes). Issue Provider owns ZenTao parsing/session access. Notification Provider owns channels and transition eligibility. Evidence Store owns redacted logs and hash-verified result artifacts. Policy Engine owns state/action rules and the three hard gates.

Existing adapters remain operational. This change does not enable unconfigured external issue systems or group robots, nor introduce automatic external writes.

## Verification

Checkpoint restart/reuse/invalidation/tampering; environment and Agent failure separation; partial command and case reuse; supplement/pause across assessment/development/test/startup; Git delivery retry without re-development; raw-output idle watchdog, partial UTF-8 activity, total timeout, network exit; scope and evidence safety; existing regression and real Electron UI.
