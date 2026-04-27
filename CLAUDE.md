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
npm install        # install dependencies
npm run dev        # start dev server at localhost:3000
npm run build      # production build
npm run lint       # run linter
```

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
