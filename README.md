# ShowCrafter

ShowCrafter helps people design consumer firework shows around music, preview the
result, and turn the final timeline into a practical shopping list.

Built for COMP3500 with ICON Pyrotechnics International and International
Fireworks.

## What it includes

- A public firework catalogue and curated show templates.
- A guided show builder with optional music analysis.
- Deterministic cue generation with an optional LLM assignment path.
- A Three.js firework renderer and timeline editor.
- My Store assortment management and public QR entry for fixed-bundle shows.
  Store analytics and credit top-ups currently include labelled preview data.
- Admin tools for catalogue, effects, imports, users, roles and AI credits.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase, Three.js, Modal and
Vercel.

## Repository

```text
app/                              Next.js routes and server actions
components/                       UI primitives, product patterns and shared features
styles/theme.css                  Light/dark theme and semantic colour tokens
lib/                              Domain, server and renderer code
public/                           Runtime assets
services/music-analyser/          Modal music-analysis service
services/firework-import-worker/  Modal firework-video import service
supabase/                         Migrations, templates and database tests
tests/                            Application tests grouped by domain
```

Component placement and UI rules live in [Architecture](docs/architecture.md).
The [UI audit](docs/audits/2026-09-08-ui-structure.md) inventories all pages,
including My Store, the kiosk, redirects and placeholders.

## Local development

Requirements:

- Node.js 24 and npm 11
- Python 3.11 for the two Python services
- A Supabase project or local Supabase environment

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Populate `.env.local` using the descriptions in `.env.example`. Never commit
credentials or service-role keys.

## Verification

```bash
npm run check       # Formatting, lint, TypeScript, application tests and build
npm run audit:ui    # Page inventory and component import review
```

Use `npm run typecheck` for a focused TypeScript check.

Service tests run separately with `npm run test:analyser` and
`npm run test:worker`. See [Contributing](CONTRIBUTING.md) for their setup.

## Project policies

- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Deployment

Vercel deploys the Next.js application from the repository root. The music
analyser and firework import worker are deployed independently to Modal.
