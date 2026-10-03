---
name: showcrafter-repository
description: Audit or reorganise ShowCrafter files, dependencies, scripts, CI and documentation, and follow the rebuild's stacked pull request workflow. Use for workspace changes, package-manager updates, dead-code removal and repository cleanup.
---

# ShowCrafter repository

Inspect `git status`, the tracked tree, workspace manifests, CI and callers before
moving anything. Follow [architecture](../../../docs/architecture.md) and
[development](../../../docs/development.md); keep the README a short entry point.

Layout: the root owns the pnpm lockfile, formatting, CI and docs; `apps/web` is the
Next.js app; `packages/*` hold shared TypeScript (`fireworks`, `planner`); `services/*`
are Python workers deployed to Modal; `supabase/` holds the declarative schema, the
generated baseline, tests and seeds.

## Rebuild workflow

The rebuild follows a build plan kept outside this repository, as a stack of pull
requests on the long-lived `rebuild/main` branch:

- Each PR has its own `rebuild/NN-slug` branch and targets the PR below it.
- After a squash merge into `rebuild/main`, rebase the next branch with
  `git rebase --onto origin/rebuild/main <old-parent-tip>` and retarget its PR.
- Commits are small and frequent, one logical step each, with Conventional Commit
  messages.
- Nothing merges into `main` before the switch-over PR; `main` deploys to production.

## Housekeeping

Before deleting a module, check imports, route entry points, dynamic references,
scripts, CI and service consumers. Prefer cohesive domain folders over catch-all
`utils` trees. Comments explain current constraints, not history. Declare direct
dependencies in the owning package and verify a frozen install. Move environment files
without displaying their contents.

Run `pnpm check` and the relevant service suites before delivery.

## Agent handoff

Record the branch and dirty paths before editing. Codex proposes focused commits;
the composer stages, commits, rebases, pushes and opens PRs. Read-only Git commands
are available for inspection. Do not alter the index or history from Codex.

For .agents or .codex changes, supply exact proposed text or a patch in the handoff.
Do not claim those changes are applied. The composer applies and verifies them.
For overlapping commit file lists, identify the hunks or explain the dependency.

## Readability tooling

The root owns scripts/eslint/readability.mjs and its exact tool dependencies.
Package-local flat configs compose that factory with framework and boundary checks.
Every handwritten TypeScript package has lint, typecheck, test and check scripts,
and root pnpm check reaches them. Do not assume tests typecheck source files.

Keep Knip entry points limited to actual package APIs, scripts and tests; do not
mark all source files as entries. Keep Prettier separate from ESLint. Review tool
preset changes and peer compatibility when updating pinned dependencies.
