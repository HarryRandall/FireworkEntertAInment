# Firework EntertAInment

## Agent Style

- Use British English.
- Avoid em dashes; prefer commas, colons, semicolons, or hyphens.
- Use straight apostrophes (`'`).
- Preserve the current show-creation flow: music analysis starts quietly after
  upload, and the final Generate step is the explicit user action that creates
  the show and starts cue generation.
- Do not surface hidden background processing unless an error blocks the user.

## Project Overview

- **Course**: COMP3500
- **Stakeholder**: ICON Pyrotechnics International Co Ltd (International
  Fireworks Pty Ltd)
- **Domain**: Consumer firework show design, helping non-experts create
  pyromusical shows with purchased fireworks

## Tech Stack

- **Framework**: Next.js App Router with TypeScript
- **Styling**: Tailwind CSS v4
- **Backend and storage**: Supabase
- **Hosting**: Vercel, with `platform` as the project root
- **Audio analysis**: Python and librosa hosted on Modal, see
  [`platform/analyser/`](platform/analyser/) (`showcrafter.py`, `modal_app.py`)
- **Choreography**: OpenRouter through the `openai` SDK, defaulting to
  `anthropic/claude-sonnet-4.5` unless `OPENROUTER_CUE_MODEL` is set
- **Firework import worker**: Python worker in
  [`workers/firework-import-worker/`](workers/firework-import-worker/)

## Development

```bash
cd platform
cp .env.example .env.local   # then fill in real Supabase, analyser, and OpenRouter values
npm install                  # install dependencies
npm run dev                  # start dev server at localhost:3000
npm run lint                 # run ESLint
npm run typecheck            # run TypeScript
npm test                     # run node:test suites
npm run build                # production build
npm run check                # full local gate
```

Start the firework import worker from `platform` with:

```bash
npm run worker:firework-import
```

## Required Environment Variables

Use `platform/.env.local` for local development. It is gitignored, never commit
secrets. In Vercel, configure these under Project Settings > Environment
Variables.

| Name                                                  | Required                           | Used by                          | Purpose                                                                                |
| ----------------------------------------------------- | ---------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                            | yes                                | browser and server               | Supabase project URL                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                       | yes, unless publishable key is set | browser and server               | Anon or publishable key, RLS-safe                                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`        | optional                           | browser and server               | Newer Supabase publishable key name, preferred when available                          |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY`                  | optional                           | server                           | Server-only fallbacks for non-`NEXT_PUBLIC_*` deployments                              |
| `SUPABASE_SERVICE_ROLE_KEY`                           | feature-gated                      | trusted server and import worker | Required for admin import media signing and worker writes, never expose to the browser |
| `ANALYSER_URL`                                        | yes                                | server                           | Hosted Modal song analyser URL printed by `modal deploy`                               |
| `ANALYSER_SHARED_SECRET`                              | yes                                | server and Modal                 | Bearer token shared with the Modal `showcrafter` secret                                |
| `OPENROUTER_API_KEY`                                  | yes for generation                 | server and import worker         | Enables show cue generation and firework-video reconstruction                          |
| `OPENROUTER_CUE_MODEL`                                | optional                           | server                           | Cue model override, defaults to `anthropic/claude-sonnet-4.5`                          |
| `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME`         | optional                           | server and import worker         | OpenRouter ranking headers                                                             |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optional                           | server                           | Shared cache for dynamic show reads, otherwise the app uses per-process memory cache   |

## Database

App schema lives in [`platform/supabase/migrations/`](platform/supabase/migrations/)
and is applied chronologically by Supabase. The current shape after the May
2026 restructure:

- **User and RBAC**: `profiles`, `roles`, `permissions`, `role_permissions`,
  `user_roles`, `user_permission_overrides`.
- **Catalogue**: `products` (formerly `catalogue_products`), `product_shots`
  (formerly `product_effect_sequences`), and `effect_specs`.
- **Shows**: `shows`, `show_cues`, `show_templates`, `shopping_list_items`,
  `music_analyses`, and `show_analyses`.
- **Suppliers and imports**: `supplier_profiles`, `supplier_locations`,
  `supplier_inventory_items`, `import_jobs`, `import_outputs`, and
  `media_assets`.

Every table has RLS enabled with at least one policy, see
[`.cursor/rules/supabase-rls.mdc`](.cursor/rules/supabase-rls.mdc).

A `show_cues` row points at one product. Single-shot products have exactly one
`product_shots` row at `time_offset_seconds = 0`; multi-shot products have
multiple rows that are expanded into individual replay cues in
[`platform/lib/shows.server.ts`](platform/lib/shows.server.ts). The cue-builder
server action ([`platform/app/actions/preview-cues.ts`](platform/app/actions/preview-cues.ts))
rejects overlapping cues on the same `launch_position_index` based on each
product's total airtime.

Generated TS types live at
[`platform/lib/database.types.ts`](platform/lib/database.types.ts). Regenerate
them via the Supabase MCP `generate_typescript_types` tool whenever the schema
changes.

## Show Creation Flow

- `/shows/new` is a client wizard. The form submit only advances steps.
- Audio upload writes directly to Supabase Storage, then starts music analysis
  through `/api/music-analysis`; the analysis record is stored in
  `music_analyses`.
- The final Generate button calls
  [`platform/app/(app)/shows/new/actions.ts`](<platform/app/(app)/shows/new/actions.ts>)
  `createShowAction`, which creates the show, starts cue generation in an
  `after()` callback, and redirects to `/shows/[id]/generating`.
- Keep upload-scoped analysis and explicit show generation separate. Uploading
  a song must not create the final show by itself.

## Server Helpers

Server-side show data access goes through
[`platform/lib/shows.server.ts`](platform/lib/shows.server.ts) (`server-only`).
Domain types and formatters live in
[`platform/lib/show-domain.ts`](platform/lib/show-domain.ts). Admin, RBAC, and
catalogue helpers live under [`platform/lib/admin/`](platform/lib/admin/) and
[`platform/lib/admin.server.ts`](platform/lib/admin.server.ts). The import jobs
flow lives in [`platform/lib/import-jobs.ts`](platform/lib/import-jobs.ts).

## UI Work

Use the local ShowCrafter design-system skill for UI work:

- Codex agents: [`.agents/skills/showcrafter-design-system/SKILL.md`](.agents/skills/showcrafter-design-system/SKILL.md)
- Claude agents: [`.claude/skills/showcrafter-design-system/SKILL.md`](.claude/skills/showcrafter-design-system/SKILL.md)

Shared app UI primitives live in `platform/app/components/ui`. Generated
Radix/shadcn primitives live in `platform/components/ui`. Use `cn()` from
`@/lib/utils`.

For loading states, keep stable route chrome such as page titles,
descriptions, labels, table headers, and form section headings visible. Use
neutral `Skeleton` placeholders for data-driven fields, active/selected
states, coloured badges, and controls whose value is still loading. Match the
loaded component's height, width, radius, and footer button sizes closely so
loading does not shift the layout.

## Repository Structure

```text
platform/                     - Next.js web app, deploy root for Vercel
  app/                        - App Router pages, layouts, actions, routes
  app/components/             - app shell, marketing, theme, and custom UI
  components/ui/              - generated Radix/shadcn primitives
  analyser/                   - Python song analysis runner
  lib/                        - shared server and client utilities
  utils/                      - Supabase client helpers
  public/                     - static assets
  supabase/migrations/        - chronological database migrations
  tests/                      - node:test suites
  docs/                       - platform technical notes
workers/firework-import-worker/ - queued firework-video import worker
data/                         - sample data and example media
memory/                       - project memory notes
prototypes/                   - standalone prototypes
scripts/                      - utility scripts
.agents/                      - repo-local agent skills
.codex/                       - Codex hooks
```

> **Vercel**: set "Root Directory" to `platform` in project settings.
