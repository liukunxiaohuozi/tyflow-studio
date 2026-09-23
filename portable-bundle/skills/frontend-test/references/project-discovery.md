# Project discovery

Read project-local `AGENTS.md` and other repository instructions first. Locate the exact checkout with `rg --files`, `package.json`, lock files, Git common-dir, remotes, and worktree metadata. Do not treat a directory containing multiple repositories as a monorepo unless its configuration proves that relationship.

Record three identities separately:

- `projectId`: logical application or component.
- `checkoutId`: concrete path plus Git common-dir/worktree identity.
- `runId`: one execution tied to source, environment, data, and plan.

Freeze `sourceSnapshot` before final execution: HEAD, staged and unstaged patches, relevant untracked source content or digests, lock/config digests, and generated artifact identity. If source changes while testing, mark dependent results `SOURCE_CHANGED` and rerun the new snapshot.

Inspect without assuming:

- package manager and authoritative lock;
- Node, Java, and browser compatibility;
- build, typecheck, lint, unit, e2e, and preview commands;
- scripts that write, format, upload, publish, reset, or delete;
- test discovery patterns and excluded business entry points;
- framework, aliases, generated directories, providers, router, i18n, CSS/assets, and ESM transforms;
- routes, API prefixes/proxies, service ownership, auth, tenant/role handling;
- existing specs, tests, fixtures, visual baselines, performance budgets, and CI files;
- host/micro-app links, nested legacy apps, component package/dist imports, and consumer versions.

Classify each capability as `discovered`, `configured`, `executed`, or `verified`. A script name or config target proves only discovery. Wrong port/app, stale `node_modules`, alternate worktree tests, or a locally different backend cannot satisfy final identity.

Prefer existing compatible tools and commands. Do not overwrite test config wholesale, silently run formatting with `--write`, publish artifacts, contact production sinks, or let a package runner download an unpinned tool as the stable path.

Use `node scripts/discover.mjs <root> [output.json]` for a reproducible inventory, then verify high-risk findings against the actual files.
