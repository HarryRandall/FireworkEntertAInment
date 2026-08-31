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
- Admin tools for catalogue, effects, imports, users, roles and AI credits.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase, Three.js, Modal and
Vercel.

## Repository

```text
app/                              Next.js routes and server actions
components/                       Low-level shared UI primitives
lib/                              Domain, server and renderer code
public/                           Runtime assets
services/music-analyser/          Modal music-analysis service
services/firework-import-worker/  Modal firework-video import service
supabase/                         Migrations, templates and database tests
tests/                            Application tests
docs/                             Focused technical documentation
```

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
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The full web gate is available as `npm run check`. Python service tests are run
separately:

```bash
npm run test:analyser
npm run test:worker
```

Install each service's Python requirements before running its tests.

## Documentation

- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Backend lifecycle](docs/backend-lifecycle.md)
- [Music analyser](docs/analyser-runner.md)
- [Database safety](docs/database-safety.md)
- [Explore presets](docs/explore-presets.md)
- [Editor integrity](docs/editor-integrity.md)
- [Firework renderer](docs/fireworks-engine-v2.md)
- [Import validation](docs/firework-import-engine-validation.md)

## Deployment

Vercel deploys the Next.js application from the repository root. The music
analyser and firework import worker are deployed independently to Modal. See the
linked technical documentation for their deployment contracts.
