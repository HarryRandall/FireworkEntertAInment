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
npm install        # install dependencies
npm run dev        # start dev server at localhost:3000
npm run build      # production build
npm run lint       # run linter
```

## Repository Structure

```
app/              — Next.js App Router (pages, layouts, styles)
public/           — static assets
docs/             — project documentation and planning
data/             — sample data and example audio tracks
prototypes/       — standalone prototypes (audio analyser, site mockup)
```
