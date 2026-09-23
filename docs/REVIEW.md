# Code review and corrections
Date: 2026-09-16. Reviewed source, approved OpenDesign handoff and independent disposable-fixture outcomes.

Fixed: strict renderer input DTO accidentally carrying task output fields; draft active-id undefined equality; stale branch/ref planning and moved refs; ignored files being overwritten during checkout; interrupted branch creation losing the snapshot; frozen task reanalysis; incomplete testcase coverage accepted as passed; UTF-8 process stream decoding; credentials present in structured Agent results; failed raw result cleanup; isolated multipage design navigation; old server logs reverting manual acceptance; same-project server replacement; runtime-only launch recovery; bounded POSIX process cancellation; new design package comparison; first failure history retained.

Validation boundaries: execution fixtures substitute the Agent response only. Git, npm subprocess, HTTP startup, filesystem persistence, timeout and cancellation use actual local OS operations in disposable directories. No real Codex development or authenticated product/browser test ran on explore or o11y-apm-ui. macOS runtime/signing remains pending a macOS runner.

Current adapters intentionally target local Codex CLI, existing local Git checkouts, package.json scripts, and loopback preview URLs. ZenTao integration performs authenticated read-only discovery for the verified legacy contract, provides name-based project mapping, assigned task/Bug linkage and safe navigation; writeback remains deferred.
