# Firework EntertAInment

An AI tool for designing real consumer firework shows.

Built in partnership with [ICON Pyrotechnics International](http://www.iconpyro.com) as part of COMP3500.

## About

ShowCrafter is a web-based tool that lets everyday consumers design AI-choreographed pyromusical fireworks shows using products available at their local retail fireworks store. Users pick a song, set a budget, describe the vibe they want, and ShowCrafter handles the rest — analysing the music, selecting appropriate fireworks from the retailer's catalogue, and generating a fully choreographed show plan.

The tool is provided to consumers by fireworks retailers, either in-store (as a sales and upselling tool) or online (as a self-service experience).

## Tech Stack

| Layer             | Technology                                  |
| ----------------- | ------------------------------------------- |
| Framework         | [Next.js](https://nextjs.org/) (App Router) |
| Language          | TypeScript                                  |
| Styling           | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Backend / Storage | [Supabase](https://supabase.com/)           |
| Hosting           | [Vercel](https://vercel.com/)               |
| Audio Analysis    | Python (librosa)                            |
| Choreography      | LLM-based agent (API)                       |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.9+
- npm

### Installation

```bash
cd platform
cp .env.example .env.local   # then fill in Supabase + analyser values
npm install
```

### Development

```bash
cd platform
npm run dev
```

### Audio analyser (Modal)

The librosa song analyser is too heavy for Vercel's serverless runtime (the
`librosa + numpy + scipy + scikit-learn` stack exceeds the 250 MB function
size limit and a full analysis can outrun the function timeout), so we host
it on [Modal](https://modal.com/) and the Next.js server calls it over HTTP.

One-time setup (per developer / per environment):

```bash
brew install pipx
pipx ensurepath && exec zsh
pipx install modal
pipx inject modal fastapi          # fastapi is needed locally for `modal deploy`

modal token new                    # browser-based login

SECRET=$(openssl rand -hex 32)
echo "$SECRET"                     # save this — also goes into .env.local / Vercel
modal secret create showcrafter ANALYSER_SHARED_SECRET="$SECRET"

cd platform/analyser
modal deploy modal_app.py          # prints the public URL
```

Set the printed URL as `ANALYSER_URL` and the same secret as
`ANALYSER_SHARED_SECRET` in both `platform/.env.local` and in
Vercel → Project Settings → Environment Variables (Production + Preview + Development).

To redeploy after editing `platform/analyser/showcrafter.py` or
`modal_app.py`, just re-run `modal deploy modal_app.py`. Logs live at
`modal app logs showcrafter-analyser`.

The local CLI (`python showcrafter.py song.mp3 ...`) still works for
offline debugging — Modal only fronts the HTTP path.

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build

```bash
cd platform
npm run build
```

### Checks

```bash
cd platform
npm run lint
npm run typecheck
npm test
npm run build
```

Run the full local gate with:

```bash
cd platform
npm run check
```

### CI

GitHub Actions runs the platform checks on every pushed commit and pull request:

- `npm run lint` from `platform/`
- `npm run typecheck` from `platform/`
- `npm test` from `platform/`
- `npm run build` from `platform/`
- Python analyser unit tests from `platform/analyser/`

## Deployment

The project is hosted on Vercel with the following branching strategy:

| Branch                  | Environment | URL                                 |
| ----------------------- | ----------- | ----------------------------------- |
| `main`                  | Production  | Primary Vercel domain               |
| `development` (and PRs) | Preview     | Auto-generated preview URL per push |

All deployment URLs are publicly accessible — team members do not need Vercel accounts to view them.

## Repository Structure

```
app/                       — Next.js App Router (pages, layouts, styles)
public/                    — static assets
docs/                      — project documentation and planning
  guides/                  — team workflow guides (issue & merging)
  planning/                — product vision, roadmap, user stories, risk assessment
  project/                 — research, competitor analysis, technical notes
  sprints/                 — sprint scrum notes and stakeholder meeting records
data/                      — sample data and example audio tracks
prototypes/                — standalone prototypes
  site-mockup/             — static HTML/Tailwind landing page mockup
platform/analyser/         — Python song analysis runner (librosa/MIR)
```

## Components

- **Web App** (`app/`): Next.js application — the main platform.
- **Audio Analyser** (`platform/analyser/`): Python-based song analysis pipeline that extracts musical structure, timestamps beats, and classifies sections (highs, lows, drops, builds) for the choreography engine.
- **Site Mockup** (`prototypes/site-mockup/`): Original static HTML mockups used during early design exploration.

## Contributing

This project follows the [Issue & Merging Guide](docs/guides/issue-and-merging-guide.md). Key rules:

- No work begins without a GitHub issue
- Branch naming: `<type>/#<issue>-<short-description>`
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
- PRs require at least one reviewer approval before merging
- Use **Squash and Merge**

## Team Tools

- **Notion** — documentation and notes
- **GitHub** — version control and issues
- **Linear** — issue tracking
- **Teams** — stakeholder meetings
- **Discord** — team communication
