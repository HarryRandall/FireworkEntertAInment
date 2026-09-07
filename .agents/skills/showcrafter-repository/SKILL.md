---
name: showcrafter-repository
description: Audit or reorganise ShowCrafter files, dependencies, scripts, CI and documentation. Use for workspace changes, package-manager updates, dead-code removal and repository cleanup.
---

# ShowCrafter repository

Inspect `git status`, the tracked file tree, workspace manifests, CI and callers
before proposing a move. Separate tracked source from generated local artefacts.
Follow [architecture](../../../docs/architecture.md) and
[development](../../../docs/development.md); keep the README a short entry point.

The root owns the pnpm lockfile, formatting, agent workflows and repository docs.
`apps/web` owns Next.js configuration, assets, environment files, tests and scripts.
`services` contains two active Python deployments, not Node workspace packages.
`supabase` owns migrations, templates, SQL tests and optional development seeds.
One JavaScript app does not justify placeholder packages or Turborepo.

Before deleting or merging a module, inspect imports, re-exports, route entry
points, dynamic references, scripts, CI, service consumers and migration history.
Prefer cohesive domain folders over parallel catch-all `utils` or `tooling` trees.
Remove compatibility forwarding files after migrating their callers. Comments
should explain a current constraint; remove ticket history and obsolete claims.

Move environment files without displaying their contents. Keep `.git`; it owns
history. Remove registered worktrees through Git only after checking their status.
Generated `.next`, `node_modules` and Supabase `.temp` may return after tooling runs.
The Supabase cache also holds local project-link metadata; clearing it does not
change the database, but linked CLI work then needs a fresh link.

For pnpm changes, declare directly imported dependencies in the owning package,
keep one lockfile and verify a clean frozen install. Update CI, working directories,
path-based tests and Vercel's documented app root together. Do not infer that a
local configuration edit has changed hosted project settings.

The import renderer fingerprints paths and source bytes. Read
[contracts](../showcrafter-contracts/SKILL.md) before moving its sources. Preserve
migration history and coordinate app/worker/database version changes explicitly.

Use focused commits at verified checkpoints. Run `pnpm check`, relevant service
suites and cross-language checks when boundaries move. Record concrete outcomes
and deployment requirements; do not replace verification with a large audit doc.
