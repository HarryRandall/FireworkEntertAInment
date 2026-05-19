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
- **Audio Analysis**: Python (librosa) — see `platform/analyser/`
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

App schema lives in [`platform/supabase/migrations/`](platform/supabase/migrations/) and is applied chronologically by Supabase. The current shape after the May 2026 restructure:

- **User & RBAC**: `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permission_overrides`.
- **Catalogue**: `products` (was `catalogue_products` — supplier-facing firework SKU: `part_number`, `name`, `manufacturer`, `subtype`, `duration_seconds`, `description`), `product_shots` (was `product_effect_sequences` — one row per shot fired from a product, ordered by `shot_index`, joined to `effect_specs` via `effect_spec_id`), `effect_specs` (visual definition for the 3D renderer).
- **Shows**: `shows`, `show_cues` (links a show to a `product_id` at a given `time_seconds` + `launch_position_index`), `show_templates`, `shopping_list_items`.
- **Suppliers & imports**: `supplier_profiles`, `supplier_locations`, `supplier_inventory_items`, `import_jobs`, `import_outputs`, `media_assets`.

Every table has RLS enabled with at least one policy — see [`.cursor/rules/supabase-rls.mdc`](.cursor/rules/supabase-rls.mdc) for the required pattern.

A `show_cues` row points at one product. Single-shot products have exactly one `product_shots` row at `time_offset_seconds = 0`; multi-shot products have N rows that are expanded into individual replay cues in [`platform/lib/shows.server.ts`](platform/lib/shows.server.ts). The cue-builder server action ([`platform/app/actions/preview-cues.ts`](platform/app/actions/preview-cues.ts)) rejects overlapping cues on the same `launch_position_index` based on each product's total airtime.

Generated TS types live at [`platform/lib/database.types.ts`](platform/lib/database.types.ts). Regenerate via the Supabase MCP `generate_typescript_types` tool whenever the schema changes.

Server-side data access goes through [`platform/lib/shows.server.ts`](platform/lib/shows.server.ts) (`server-only`); domain types and formatters are in [`platform/lib/show-domain.ts`](platform/lib/show-domain.ts). Admin / RBAC / catalogue server helpers live in [`platform/lib/admin.server.ts`](platform/lib/admin.server.ts) with shared types in [`platform/lib/admin.types.ts`](platform/lib/admin.types.ts). The `import_jobs` flow lives in [`platform/lib/import-jobs.ts`](platform/lib/import-jobs.ts).

## Repository Structure

```
platform/         — Next.js web app (deploy root for Vercel)
  app/            — App Router pages, layouts, styles
  analyser/       — Python song analysis runner
  lib/            — shared server/client utilities
  utils/          — Supabase client helpers
  public/         — static assets
docs/             — project documentation and planning
data/             — sample data and example audio tracks
prototypes/       — standalone prototypes (site mockup)
scripts/          — utility scripts (e.g. Notion discovery)
```

> **Vercel**: set "Root Directory" to `platform` in project settings.
