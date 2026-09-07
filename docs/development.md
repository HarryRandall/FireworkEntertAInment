# Development

Follow the [README](../README.md#development) to install Node 24, the pinned pnpm
version and application dependencies. All commands below run from the repository
root unless a working directory is shown.

## Workspace

`apps/web/package.json` owns web dependencies and app scripts. The root manifest
owns formatting and forwards common commands to `@showcrafter/web`. Add a web
dependency with `pnpm --filter @showcrafter/web add <package>`. Keep one
`pnpm-lock.yaml`; use `pnpm install --frozen-lockfile` in clean checkouts and CI.

Next.js reads environment files from `apps/web/`. Start with
`apps/web/.env.example`; keep credentials in ignored local files. Service-role
keys must never enter client code or `NEXT_PUBLIC_*` variables.

`pnpm dev` uses the established Webpack development path. `pnpm dev:turbo` selects
Next.js Turbopack for an explicit trial. Turbopack is the app bundler; Turborepo is
a separate task orchestrator and is not part of this workspace.

## Python services

Each service uses Python 3.11 and its own virtual environment:

```bash
python3.11 -m venv services/music-analyser/.venv
services/music-analyser/.venv/bin/python -m pip install -r services/music-analyser/requirements.txt
python3.11 -m venv services/firework-import-worker/.venv
services/firework-import-worker/.venv/bin/python -m pip install -r services/firework-import-worker/requirements.txt
```

The import worker also needs FFmpeg and Playwright Chromium. Its
[service guide](../services/firework-import-worker/README.md) owns those details.
`pnpm worker:firework-import` loads `apps/web/.env.local` (or `.env` as a fallback).

## Verification

Run focused checks during development and `pnpm check` before delivery. The web
suite runs from `apps/web`, so runtime source paths and renderer fingerprints
stay relative to the app. Cross-service tests use explicit repository paths.

```bash
pnpm --filter @showcrafter/web exec node --experimental-strip-types --test tests/auth/auth-flow-correctness.test.mjs
pnpm test:analyser
pnpm test:worker
SHOWCRAFTER_RUN_CROSS_LANGUAGE_CONTRACT=1 services/music-analyser/.venv/bin/python services/music-analyser/tests/test_schema_validation.py
```

Use `pnpm audit:ui` when adding or moving pages/components. Candidates need review
before deletion. Check rendered light/dark, mobile and interaction states when
shared UI behaviour changes. Keep servers stopped while builds replace their
output, or use an isolated `NEXT_DIST_DIR`.

CI runs web checks, both Python suites, and the Python-to-Zod-to-planner contract.
The scheduled analyser regression uses the checked-in real-audio fixtures.

## Database

Run Supabase CLI commands from the repository root. Keep existing migrations
immutable and add migrations for intentional schema changes. Regenerate
`apps/web/lib/database.types.ts` after a schema change. Exercise the relevant
SQL under `supabase/tests/`, including denied access and ownership cases.

The catalogue generator is app-owned tooling in
`apps/web/scripts/generate-firework-catalogue-migration.mjs`; inspect its target
before running it because it writes migration SQL. Seeds and local fixtures are
not production migration instructions.

## Deployment

For Vercel, set the project Root Directory to `apps/web` and include files outside
the root directory so the workspace lockfile and root formatting package are
available. Use Node 24, install with `pnpm install --frozen-lockfile`, and build
with `pnpm build`. The checked-in `apps/web/vercel.json` declares those commands.
Environment variables remain configured in Vercel; local environment files are
not uploaded. Changing the hosted project's Root Directory is required before
releasing this layout; a local refactor does not update that setting.

Modal services retain their existing deployment roots and manifests under
`services/`. A web release does not deploy Python services or apply migrations.

## Changes and reviews

Use focused `feat:`, `fix:` or `refactor:` commits. Explain the changed behaviour,
validation and any unresolved limitation. [Architecture](architecture.md) owns
placement and UI conventions. Agent workflows live in `.agents/skills`; the root
`AGENTS.md` supplies only routing and rules that apply to every task.
