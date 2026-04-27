# Firework EntertAInment

AI tool for designing real consumer firework shows, in partnership with ICON Pyrotechnics International.

## Project Overview

- **Course**: COMP3500
- **Stakeholder**: ICON Pyrotechnics International Co Ltd (International Fireworks Pty Ltd)
- **Domain**: Consumer firework show design — helping non-experts create pyromusical shows with purchased fireworks

## Tech Stack

- **Framework**: Next.js (App Router) with TypeScript
- **Styling**: Tailwind CSS v4
- **Backend/Storage**: Supabase
- **Hosting**: Vercel (main = production, other branches = preview deployments)
- **Audio Analysis**: Python (librosa) — see `prototypes/audio-analyser/`
- **Choreography**: LLM-based agent (API)

## Development

```bash
cd platform
cp .env.example .env.local   # then fill in real Supabase values
npm install                  # install dependencies
npm run dev                  # start dev server at localhost:3000
npm run build                # production build
npm run lint                 # run linter
```

### Required environment variables (`platform/.env.local`)

| Name | Required | Used by | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | browser + server | Anon / publishable key (RLS-safe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | optional | browser + server | Newer name for the same anon key — either is accepted |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | optional | server | Server-only fallbacks for non-`NEXT_PUBLIC_*` deployments |

`platform/.env.local` is gitignored — never commit secrets. In Vercel, configure these under Project Settings → Environment Variables.

## Database

App schema lives in [`platform/supabase/migrations/`](platform/supabase/migrations/):

- `0001_init_app_schema.sql` — creates `profiles`, `shows`, `show_cues`, `shopping_list_items`; enables RLS scoped to `auth.uid()`; provisions a private `audio` storage bucket with per-user prefix policies; adds an `on_auth_user_created` trigger that materialises `profiles` from `auth.users`.
- `0002_harden_function_security.sql` — locks `search_path` and revokes public `EXECUTE` on the trigger function.

Generated TS types live at [`platform/lib/database.types.ts`](platform/lib/database.types.ts). Regenerate via the Supabase MCP `generate_typescript_types` tool whenever the schema changes.

Server-side data access goes through [`platform/lib/shows.server.ts`](platform/lib/shows.server.ts) (`server-only`); the matching domain types and formatters are in [`platform/lib/shows.ts`](platform/lib/shows.ts).

## Repository Structure

```
platform/         — Next.js web app (deploy root for Vercel)
  app/            — App Router pages, layouts, styles
  lib/            — shared server/client utilities
  utils/          — Supabase client helpers
  public/         — static assets
docs/             — project documentation and planning
data/             — sample data and example audio tracks
prototypes/       — standalone prototypes (audio analyser, site mockup)
scripts/          — utility scripts (e.g. Notion discovery)
```

> **Vercel**: set "Root Directory" to `platform` in project settings.
