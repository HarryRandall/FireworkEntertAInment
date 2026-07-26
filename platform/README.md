# ShowCrafter Platform

This directory is the Next.js application and the Vercel project root. Read the
[repository README](../readme.md) for the product overview, environment
variables, and analyser deployment.

## Run Locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Use real local Supabase and analyser values in `.env.local`. The file is
gitignored and must never be committed.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```

`npm run check` is the full platform gate. Prefer the narrowest relevant test
while iterating, then run the full gate before delivery when the change warrants
it.

## Runtime Boundaries

- Keep `/catalogue`, `/library`, and `/library/[id]` public. Guests receive
  public chrome and authenticated visitors retain the app shell.
- Keep Explore content database-managed and draft-first. See
  [Explore presets](docs/explore-presets.md).
- Let music analysis begin quietly after upload. Only final Generate creates a
  show and starts cue generation.
- Clean up replaced or cleared, unclaimed music analyses and their private
  objects through the guarded cancellation path.
- Show fast-planner UI only in `fast` mode and model selection only in `llm`
  mode. Recheck the mode on submit.
- Filter admin navigation by permission and enforce the same permission in
  routes and actions.
- Keep editor previews and saves consistent with
  [editor integrity](docs/editor-integrity.md).

## Data Changes

Author schema changes only as chronological files in `supabase/migrations`.
Every exposed table needs RLS, explicit least-privilege grants, policies, and
focused tests. Regenerate `lib/database.types.ts` after applying a migration.
Follow [database safety](docs/database-safety.md) and
[the migration rule](../.cursor/rules/supabase-rls.mdc).

## Code And UI Conventions

Read the repository [agent guide](../AGENTS.md) and the
[pinned repo-local skill manifest](../.agents/skills/README.md) before editing
the app. Use only the skills relevant to the task, with project guidance and
the live implementation taking precedence.

- Use `app/components/ui` for app primitives. `components/ui` is the low-level
  Radix/shadcn layer; only files explicitly marked as generated are non-editable.
- Keep normal app/admin chrome neutral. Marker green is for primary actions,
  focus, progress, and active technical markers; `accent` is a neutral hover or
  selected surface.
- Use semantic tokens from `app/globals.css`, visible focus states, and Geist
  Mono with `tabular-nums` for dense numeric metadata.
- Keep stable route chrome visible while data loads and match skeleton geometry
  to the loaded surface.
- Comment non-obvious rationale and invariants, not filenames or the next line.
- Fail closed on database errors that affect access, credits, ownership, or cue
  safety. Put multi-write invariants in a transaction or guarded RPC.
- Keep `geometryTuning` schema/defaults, renderer consumption, editor controls,
  canonicalisation, preview timing, and tests in sync.

## Additional Documentation

- [Analyser runner](docs/analyser-runner.md)
- [Backend lifecycle](docs/backend-lifecycle.md)
- [Fireworks engine v2](docs/fireworks-engine-v2.md)
- [Shader cover plan](docs/css-covers-plan.md)
