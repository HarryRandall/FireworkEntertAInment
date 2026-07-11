# Firework EntertAInment

## Agent Style

- Use British English.
- Avoid em dashes; prefer commas, colons, semicolons, or hyphens.
- Use straight apostrophes (`'`).
- Keep answers concise, direct, and grounded in the local repo.
- Inspect the live files, migrations, routes, and tests before making broad
  claims. This repo moves quickly and the worktree is often dirty.
- Never revert or tidy unrelated local changes unless explicitly asked.
- Preserve the show-creation flow: music analysis can start quietly after
  upload, but the final Generate step is the explicit user action that creates
  the show and starts cue generation.
- Do not surface hidden background processing unless an error blocks the user.
- Comments should explain rationale, invariants, security boundaries,
  asynchronous lifecycle constraints, coordinate systems, or non-obvious
  exported contracts. Do not narrate the next line or restate the filename.
- Update or remove stale comments in the same change. Code comments also use
  British English, straight apostrophes, and no em dashes.

## Project Overview

- **Course**: COMP3500.
- **Stakeholder**: ICON Pyrotechnics International Co Ltd, International
  Fireworks Pty Ltd.
- **Domain**: Consumer firework show design for non-experts using purchased
  retail fireworks.
- **Product name**: ShowCrafter.

ShowCrafter lets users browse fireworks and curated templates, upload music,
describe a show, generate a cue timeline, preview the result, and review a
shopping list. Admins manage catalogue data, firework/effect render settings,
style defaults, Explore presets, prompts, imports, users, roles, and AI credit
billing.

## Tech Stack

- **Framework**: Next.js App Router with TypeScript and React 19.
- **Styling**: Tailwind CSS v4, Radix/shadcn primitives, custom app primitives.
- **Backend and storage**: Supabase Auth, Postgres, Storage, RLS, and RPCs.
- **Hosting**: Vercel, with `platform` as the project root.
- **Audio analysis**: Python and librosa hosted on Modal, see
  `platform/analyser/` (`showcrafter.py`, `modal_app.py`).
- **Cue generation**: deterministic fast planner by default. OpenRouter through
  the `openai` SDK is optional for the LLM cue-assignment path and defaults to
  `openai/gpt-4.1-mini` unless `OPENROUTER_CUE_MODEL` is set.
- **Renderer**: Three.js and the custom firework engine.
- **Covers**: CSS-first covers, stored posters, and legacy
  `@paper-design/shaders-react` / `@firecms/neat` compatibility.
- **Cache**: optional Upstash Redis REST, otherwise per-process memory cache.
- **Firework import worker**: Python worker in `workers/firework-import-worker/`.

## Development

```bash
cd platform
cp .env.example .env.local   # then fill in real Supabase, analyser, and optional OpenRouter values
npm install
npm run dev                  # localhost:3000
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```

Run analyser tests from `platform/analyser`:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p "*test*.py"
```

Start the firework import worker from `platform`:

```bash
npm run worker:firework-import
```

## Delivery Workflow

- Branch from the latest `main` using a typed lowercase name such as
  `feat/fir-123-description`, `fix/fir-123-description`, or
  `refactor/fir-123-description`.
- Linear is the issue source of truth, GitHub is implementation and review
  evidence, and Notion is the verified sprint summary.
- Link each pull request to its Linear issue. Use Conventional Commit wording
  for pull request and squash titles.
- Treat database, authorisation, billing, ownership, and cue-safety read errors
  as failures. Do not convert them into empty data or permissive defaults.
- Multi-write invariants belong in a transaction or guarded RPC. Do not present
  a partially completed workflow as success.
- Do not hand-edit files explicitly marked as generated. The lower-level
  `platform/components/ui` directory also contains adapted and custom source,
  so inspect each file's header before editing.
- Keep `AGENTS.md` and `CLAUDE.md` aligned, and keep the Codex and Claude copies
  of the ShowCrafter design-system skill aligned.

## Required Environment Variables

Use `platform/.env.local` for local development. It is gitignored, never commit
secrets. In Vercel, configure values under Project Settings > Environment
Variables.

| Name                                                  | Required                                                  | Used by                          | Purpose                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                            | yes                                                       | browser and server               | Supabase project URL                                                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                | yes, preferred                                            | browser and server               | Browser-safe Supabase publishable key                                                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`        | optional fallback                                         | browser and server               | Legacy publishable key alias                                                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                       | optional fallback                                         | browser and server               | Legacy anon key alias                                                                                |
| `SUPABASE_URL`                                        | optional fallback                                         | server                           | Server-only Supabase URL fallback                                                                    |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`      | optional fallback                                         | server                           | Server-only public key fallbacks                                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`                           | feature-gated                                             | trusted server and import worker | Admin signing, prompt lookup, imports, impersonation, and worker writes. Never expose to the browser |
| `APP_ORIGIN`                                          | yes when deployed                                         | trusted server                   | Canonical HTTPS app origin for server-generated authentication redirects                             |
| `ANALYSER_URL`                                        | yes for analysis                                          | server                           | Hosted Modal song analyser URL                                                                       |
| `ANALYSER_SHARED_SECRET`                              | yes for analysis                                          | server and Modal                 | Bearer token shared with the Modal `showcrafter` secret                                              |
| `CRON_SECRET`                                         | deployed warm-up                                          | server                           | Authorises `/api/admin/analyser/warm`                                                                |
| `CUE_GENERATION_MODE`                                 | optional                                                  | server                           | Defaults to `fast`; set `llm` to opt into OpenRouter cue assignment                                  |
| `OPENROUTER_API_KEY`                                  | optional for default generation, required for LLM/imports | server and import worker         | Enables LLM cue assignment and firework-video reconstruction                                         |
| `OPENROUTER_CUE_MODEL`                                | optional                                                  | server                           | Cue model override                                                                                   |
| `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME`         | optional                                                  | server and import worker         | OpenRouter ranking headers                                                                           |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optional                                                  | server                           | Shared cache for dynamic reads; invalid placeholders fall back to memory                             |
| `SHOWCRAFTER_SLOW_LOG_MS`                             | optional                                                  | server                           | Development timing log threshold                                                                     |

## Database

App schema lives in `platform/supabase/migrations/` and is applied
chronologically. Generated TypeScript types live at
`platform/lib/database.types.ts`; regenerate them whenever schema changes.

Current schema groups:

- **Users and RBAC**: `users`, `roles`, `permissions`, `role_permissions`,
  `user_roles`, `user_permission_overrides`, plus `current_user_access` and
  `current_user_has_permission` RPCs.
- **Catalogue and effects**: `catalogue_items`, `fireworks`,
  `firework_effects`, `firework_style_defaults`, style-default link tables,
  `multishots`, and `multishot_fireworks`.
- **Shows and generation**: `shows`, `show_timeline_items`, `show_presets`,
  `show_preset_likes`, `show_preset_like_counts`, `song_analyses`, and
  `show_generation_runs`.
- **AI credits**: `ai_credit_accounts`, `ai_credit_costs`,
  `ai_credit_transactions`, and reservation/settlement/refund/grant RPCs.
- **Suppliers and imports**: `supplier_profiles`, `supplier_inventory_items`,
  `import_jobs`, `import_outputs`, and `media_assets`.

Every public table must have RLS enabled with at least one policy. Follow
`.cursor/rules/supabase-rls.mdc` for migration work. Anonymous `SELECT` is
intentional only for public browse tables such as `show_presets`,
`show_preset_like_counts`, `catalogue_items`, `fireworks`, `multishots`, and
`multishot_fireworks`; document why in the migration.

Security-definer RPCs are allowed only when they have explicit caller checks,
revoked public execute grants, narrow role grants, and tests for the access
path. Never use user-editable metadata for authorisation.

Explore presets are database-managed content. Do not append runtime seed files
or fabricate popularity metrics in application code. New, imported, and
duplicated presets start as drafts. Preset cues must store canonical
`catalogueItemId` UUIDs, resolve to catalogue products, fit inside the show, and
avoid overlap on the same launch position before publication or cloning.
Imported presets use `source_show_id` for durable, idempotent provenance. Likes
come from authenticated `show_preset_likes` rows and the public aggregate, not a
derived decoration. See `platform/docs/explore-presets.md`.

## Show Creation Flow

- `/shows/new` is a client wizard. Form submit advances steps until final
  generation.
- Audio upload writes directly to the private Supabase `audio` bucket under the
  user's prefix, then posts metadata to `/api/music-analysis`.
- `/api/music-analysis` validates object ownership, MIME type, and 50 MB size,
  reserves AI credits, creates a `song_analyses` row, and starts Modal analysis
  in `after()`.
- Replacing or clearing an upload discards an unclaimed analysis through the
  guarded cleanup RPC, resolves its active credit reservation, and removes the
  private audio object. Cleanup must refuse an analysis already linked to a
  show.
- The final Generate button calls
  `platform/app/(app)/shows/new/actions.ts#createShowAction`.
- `createShowAction` creates the `shows` row, stores a random `cover_shader`,
  reserves generation credits, starts cue generation in an `after()` callback,
  and redirects to `/shows/[slug]/generating`.
- Cue generation waits if `song_analyses` is still running, then resumes after
  analysis completes.
- Accepted cues are written to `show_timeline_items` through the
  `replace_show_timeline_items` RPC.
- Keep upload-scoped analysis and explicit show generation separate. Uploading
  a song must not create the final show by itself.

## Cue Generation

- `platform/lib/cue-generation/runner.server.ts` is the main generation runner.
- `platform/lib/cue-generation/fast-planner.ts` is the default cue planner.
- `platform/lib/prompt-configs.server.ts` reads generation settings and falls
  back to `fast` unless `CUE_GENERATION_MODE=llm`.
- OpenRouter is used only by the optional LLM assignment path and the import
  worker.
- The wizard must describe the active mode truthfully: show the fast planner in
  `fast` mode and expose model selection only in `llm` mode. Revalidate the mode
  on submit because an admin can change it while the wizard is open.
- Beat-test show styles can force deterministic beat planning for QA.
- Generation must settle AI credits on success and refund reservations on
  expected failure.
- Do not bypass overlap validation. Cue replacement should preserve
  per-launch-position timing safety.

## Server Helpers

- Server-side show data access goes through `platform/lib/shows.server.ts`
  (`server-only`).
- Domain types and formatters live in `platform/lib/show-domain.ts`.
- Admin, RBAC, catalogue, effect, import, prompt, billing, and style-default
  helpers live under `platform/lib/admin/` and related server modules.
- Supabase clients live under `platform/utils/supabase/`.
- Optional cache helpers live in `platform/lib/server-cache.ts`.
- `platform/lib/cover.ts` dispatches CSS-first and legacy shader cover parsing,
  generation, and gradient fallbacks.
- `/catalogue`, `/library`, and `/library/[id]` are public browse routes. Guests
  use public chrome; signed-in users retain the workspace shell.

## UI Work

Use the local ShowCrafter design-system skill for any UI work:

- Codex agents: `.agents/skills/showcrafter-design-system/SKILL.md`
- Claude agents: `.claude/skills/showcrafter-design-system/SKILL.md`

Shared app UI primitives live in `platform/app/components/ui`. The lower-level
Radix/shadcn layer lives in `platform/components/ui`; only files explicitly
marked as generated are non-editable. Use `cn()` from `@/lib/utils`.

Normal app/admin chrome uses neutral surfaces. Marker green is the sparse
primary for main actions, focus rings, progress, and active technical markers;
the `accent` token remains a neutral hover or selected surface. Use Geist Mono
through `font-mono` with `tabular-nums` for timings, prices, quantities, product
codes, confidence scores, and IDs. Never remove focus indicators globally.

Keep stable route chrome visible while data loads: page titles, descriptions,
labels, table headers, form section headings, and navigation should not vanish
behind skeletons. Use neutral `Skeleton` placeholders for data-driven values,
active/selected states, coloured badges, and controls whose value is still
loading. Match loaded dimensions closely so loading does not shift the layout.

Admin firework, effect, and style-default editors share
`FireworkEditorShell`, compact preview transport controls, history/JSON panels,
and scoped `FireworkRenderControls`. Style-default pages intentionally expose a
narrower rail than the main firework/effect editors.

Editor correctness is part of the UI contract. Cache keys must include every
value that changes the simulation. Saves must preserve edits made while a
request is in flight, use the canonical returned row as the saved snapshot, and
optional version-history writes must not block the primary save. Optimistic
history rows need bounded database confirmation before Restore is enabled.
Keep physical ranges non-negative and aligned across schema, actions, controls,
and the renderer. Give the interactive slider thumb an accessible name. See
`platform/docs/editor-integrity.md`.

Persist shape-specific renderer settings under `geometryTuning`. A geometry
change must keep the schema and defaults, renderer consumption, editor controls,
effect-model canonicalisation, preview timing, and tests aligned. Ground
emitters such as mines, roman candles, and fountains do not have a shell-lift
phase.

Filter admin navigation by the permission required for each destination, while
still enforcing permission checks on the route and action. Password-reset and
destructive controls must invoke the real Supabase Auth operation and describe
its actual scope. Never show success for a no-op placeholder.

## Repository Structure

```text
platform/                       Next.js web app, deploy root for Vercel
  app/                          App Router pages, layouts, actions, APIs
  app/components/               app shell, marketing, theme, admin, and custom UI
  components/ui/                low-level Radix/shadcn and custom primitives
  analyser/                     Python song analysis runner
  lib/                          shared server, client, domain, renderer utilities
  utils/supabase/               Supabase client helpers
  public/                       static assets
  supabase/migrations/          chronological database migrations
  tests/                        node:test suites
  docs/                         platform technical notes
workers/firework-import-worker/ queued firework-video import worker
data/                           sample data and example media
memory/                         project memory notes
prototypes/                     standalone prototypes
scripts/                        utility scripts
.agents/                        repo-local Codex skills
.claude/                        Claude skills and settings
.cursor/                        Cursor rules and MCP config
.codex/                         Codex hooks
```

## Agent Review Checklist

- Did you inspect the current local files before editing?
- Did you avoid unrelated dirty changes?
- Did you keep music analysis and explicit show generation separate?
- Did any Supabase migration enable RLS, add policies, and update generated
  types/tests when needed, with explicit least-privilege grants?
- Did Explore work remain database-managed, draft-first, canonical, and safe to
  schedule per launch position?
- Did UI work follow the ShowCrafter design-system skill and preserve loading
  chrome?
- Do admin links and actions reflect the current user's real permissions and
  the operation that will actually run?
- Do comments explain non-obvious reasoning instead of narrating the code?
- Do database and cue-safety failures fail closed rather than becoming empty or
  permissive state?
- Did you run the narrowest useful verification, and say honestly if a full gate
  was not run?

> **Vercel**: set "Root Directory" to `platform` in project settings.
