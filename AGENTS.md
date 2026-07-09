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
style defaults, prompts, imports, users, roles, and AI credit billing.

## Tech Stack

- **Framework**: Next.js App Router with TypeScript and React 19.
- **Styling**: Tailwind CSS v4, Radix/shadcn primitives, custom app primitives.
- **Backend and storage**: Supabase Auth, Postgres, Storage, RLS, and RPCs.
- **Hosting**: Vercel, with `platform` as the project root.
- **Audio analysis**: Python and librosa hosted on Modal, see
  `platform/analyser/` (`showcrafter.py`, `modal_app.py`).
- **Cue generation**: deterministic fast planner by default. OpenRouter through
  the `openai` SDK is optional for the LLM cue-assignment path and defaults to
  `anthropic/claude-sonnet-4.5` unless `OPENROUTER_CUE_MODEL` is set.
- **Renderer**: Three.js, React Three Fiber, custom firework engine.
- **Shader covers**: `@paper-design/shaders-react`, `@firecms/neat`.
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
  `song_analyses`, and `show_generation_runs`.
- **AI credits**: `ai_credit_accounts`, `ai_credit_costs`,
  `ai_credit_transactions`, and reservation/settlement/refund/grant RPCs.
- **Suppliers and imports**: `supplier_profiles`, `supplier_inventory_items`,
  `import_jobs`, `import_outputs`, and `media_assets`.

Every public table must have RLS enabled with at least one policy. Follow
`.cursor/rules/supabase-rls.mdc` for migration work. Anonymous `SELECT` is
intentional only for public browse tables such as `show_presets`,
`catalogue_items`, `fireworks`, `multishots`, and `multishot_fireworks`; document
why in the migration.

Security-definer RPCs are allowed only when they have explicit caller checks,
revoked public execute grants, narrow role grants, and tests for the access
path. Never use user-editable metadata for authorisation.

## Show Creation Flow

- `/shows/new` is a client wizard. Form submit advances steps until final
  generation.
- Audio upload writes directly to the private Supabase `audio` bucket under the
  user's prefix, then posts metadata to `/api/music-analysis`.
- `/api/music-analysis` validates object ownership, MIME type, and 50 MB size,
  reserves AI credits, creates a `song_analyses` row, and starts Modal analysis
  in `after()`.
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
- Shader cover generation and validation live in `platform/lib/shader-cover.ts`.

## UI Work

Use the local ShowCrafter design-system skill for any UI work:

- Codex agents: `.agents/skills/showcrafter-design-system/SKILL.md`
- Claude agents: `.claude/skills/showcrafter-design-system/SKILL.md`

Shared app UI primitives live in `platform/app/components/ui`. Generated
Radix/shadcn primitives live in `platform/components/ui`. Use `cn()` from
`@/lib/utils`.

Keep stable route chrome visible while data loads: page titles, descriptions,
labels, table headers, form section headings, and navigation should not vanish
behind skeletons. Use neutral `Skeleton` placeholders for data-driven values,
active/selected states, coloured badges, and controls whose value is still
loading. Match loaded dimensions closely so loading does not shift the layout.

Admin firework, effect, and style-default editors share
`FireworkEditorShell`, compact preview transport controls, history/JSON panels,
and scoped `FireworkRenderControls`. Style-default pages intentionally expose a
narrower rail than the main firework/effect editors.

## Repository Structure

```text
platform/                       Next.js web app, deploy root for Vercel
  app/                          App Router pages, layouts, actions, APIs
  app/components/               app shell, marketing, theme, admin, and custom UI
  components/ui/                generated Radix/shadcn primitives
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
  types/tests when needed?
- Did UI work follow the ShowCrafter design-system skill and preserve loading
  chrome?
- Did you run the narrowest useful verification, and say honestly if a full gate
  was not run?

> **Vercel**: set "Root Directory" to `platform` in project settings.
