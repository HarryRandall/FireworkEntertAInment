# Firework EntertAInment

ShowCrafter is an AI-assisted firework show-planning platform for designing
real consumer pyromusical shows from a retailer catalogue.

The project is built in partnership with
[ICON Pyrotechnics International](http://www.iconpyro.com) as part of COMP3500.

## Product Snapshot

ShowCrafter helps non-experts turn a song, budget, site width, style brief, and
retailer firework catalogue into a timed show plan. The app supports:

- Public browsing for catalogue items and curated show presets.
- Database-managed Explore presets with draft publication, source-show
  provenance, authenticated likes, and public aggregate counts.
- Authenticated show creation, personal show management, previews, shopping
  lists, exports, and account settings.
- Quiet upload-scoped music analysis before final show generation.
- Deterministic fast cue planning by default, with an optional OpenRouter LLM
  assignment mode for higher-cost generation paths.
- AI credit reservations, settlement, refunds, and admin credit grants.
- Admin catalogue, effect, multishot, prompt, user, role, import, supplier, and
  billing surfaces.
- CSS-first animated cover art with stored browse posters and legacy shader
  compatibility.
- A separate firework-video import worker for AI-assisted catalogue ingestion.

## Tech Stack

| Layer               | Technology                                                                          |
| ------------------- | ----------------------------------------------------------------------------------- |
| Web app             | Next.js App Router, React 19, TypeScript                                            |
| Styling             | Tailwind CSS v4, Radix/shadcn primitives, custom app UI primitives                  |
| Rendering           | Three.js and the custom firework engine                                             |
| Covers              | CSS/SVG/Canvas covers, stored posters, legacy Paper/Neat shader compatibility       |
| Backend and storage | Supabase Auth, Postgres, Storage, RLS, RPCs                                         |
| Audio analysis      | Python, librosa, Modal-hosted HTTP analyser                                         |
| Cue generation      | Fast deterministic planner by default, optional OpenRouter through the `openai` SDK |
| Cache               | Optional Upstash Redis REST cache, otherwise per-process memory                     |
| Hosting             | Vercel, with `platform` as the project root                                         |
| Worker              | Python firework import worker under `workers/firework-import-worker`                |

## Repository Layout

```text
platform/                       Next.js app, deploy root for Vercel
  app/                          App Router routes, layouts, actions, APIs
    (app)/                      Authenticated customer workspace
    (admin)/                    Platform admin console
    (auth)/                     Login and signup pages
    (browse)/                   Guest and signed-in catalogue/Explore routes
    (dev)/dev/                  Local visual and shader playgrounds
    (marketing)/                Public marketing pages
    api/                        Health, analysis, admin, user, and show APIs
    components/                 App, admin, marketing, theme, and UI components
  components/ui/                Low-level Radix/shadcn and custom primitives
  analyser/                     Python Modal song analyser
  docs/                         Platform technical notes
  lib/                          Server, domain, renderer, generation, admin utilities
  public/                       Static assets
  scripts/                      Platform scripts
  supabase/migrations/          Chronological database migrations
  tests/                        Node test suites
  utils/supabase/               Supabase browser, server, middleware helpers
workers/firework-import-worker/  Queued firework-video import worker
data/                           Sample data and example media
memory/                         Project memory notes
prototypes/                     Standalone prototypes
scripts/                        Repo-level utility scripts
.agents/                        Codex skills
.claude/                        Claude skills and settings
.cursor/                        Cursor rules and MCP config
.codex/                         Codex hooks
```

## Local Setup

### Prerequisites

- Node.js 22 for parity with CI, or Node.js 20.9+ for local development.
- npm.
- Python 3.11 for analyser tests and Modal work.
- A Supabase project for end-to-end auth, storage, and database flows.
- A Modal account for hosted music analysis.
- An OpenRouter key only when using LLM cue generation or the import worker.

### Install And Run

```bash
cd platform
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The Vercel project root must be set to `platform`.

### Checks

```bash
cd platform
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```

`npm run check` runs Prettier check, ESLint, TypeScript, node tests, and a
production build.

Python analyser tests run from `platform/analyser`:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p "*test*.py"
```

CI runs the platform gate plus the analyser unit tests on every push and pull
request.

## Environment Variables

Use `platform/.env.local` for local development. It is gitignored. Never commit
real secrets.

| Name                                                  | Required                                                  | Purpose                                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                            | Yes                                                       | Supabase project URL for browser and server clients.                                                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                | Yes, preferred                                            | Browser-safe Supabase publishable key.                                                                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`        | Optional fallback                                         | Legacy publishable key alias.                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                       | Optional fallback                                         | Legacy anon key alias.                                                                                                                 |
| `SUPABASE_URL`                                        | Optional server fallback                                  | Server-only Supabase URL fallback.                                                                                                     |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`      | Optional server fallback                                  | Server-only public key fallbacks.                                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                           | Feature-gated                                             | Trusted server and worker operations, admin media signing, imports, prompt lookups, and impersonation. Never expose it to the browser. |
| `APP_ORIGIN`                                          | Yes when deployed                                         | Canonical HTTPS app origin for trusted server-generated authentication redirects.                                                      |
| `ANALYSER_URL`                                        | Yes for analysis                                          | Modal analyser URL printed by `modal deploy`.                                                                                          |
| `ANALYSER_SHARED_SECRET`                              | Yes for analysis                                          | Bearer token shared by Next.js and the Modal secret.                                                                                   |
| `CRON_SECRET`                                         | Required in deployed warm-up                              | Authorises `/api/admin/analyser/warm`; development allows calls without it.                                                            |
| `CUE_GENERATION_MODE`                                 | Optional                                                  | Defaults to `fast`. Set to `llm` to use OpenRouter cue assignment.                                                                     |
| `OPENROUTER_API_KEY`                                  | Optional for default generation, required for LLM/imports | Enables optional LLM cue assignment and firework-video reconstruction.                                                                 |
| `OPENROUTER_CUE_MODEL`                                | Optional                                                  | Cue model override, defaulting to `openai/gpt-4.1-mini`.                                                                               |
| `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME`         | Optional                                                  | OpenRouter ranking headers.                                                                                                            |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional                                                  | Shared cache for dynamic server reads. Missing or placeholder values fall back to memory cache.                                        |
| `SHOWCRAFTER_SLOW_LOG_MS`                             | Optional                                                  | Development slow-log threshold for server timing diagnostics.                                                                          |

## Music Analysis

Audio upload writes directly to the private Supabase `audio` bucket under the
current user's prefix. `/api/music-analysis` validates that the object exists,
that it is 50 MB or smaller, and that its MIME type is MP3, WAV, AAC, or M4A.

The API reserves AI credits, creates a `song_analyses` row, then starts
`runMusicAnalysisForUpload` in a Next.js `after()` callback. The hosted Modal
runner receives a short-lived signed URL and persists analyser JSON with schema
version `1.4.0` and runner version `modal-librosa-2`.

Deploy or redeploy the analyser with:

```bash
brew install pipx
pipx ensurepath
pipx install modal
pipx inject modal fastapi
modal token new

SECRET=$(openssl rand -hex 32)
modal secret create showcrafter ANALYSER_SHARED_SECRET="$SECRET"

cd platform/analyser
modal deploy modal_app.py
```

Set the printed URL as `ANALYSER_URL` and the same secret as
`ANALYSER_SHARED_SECRET` in local and Vercel environments.

## Show Generation Flow

The show-creation flow intentionally separates upload analysis from explicit
show generation:

1. `/shows/new` is a client wizard. Form submission advances steps until the
   final Generate action.
2. Audio upload starts music analysis quietly and stores the result in
   `song_analyses`. Uploading a song must not create a final show.
3. The Generate button calls
   `platform/app/(app)/shows/new/actions.ts#createShowAction`.
4. `createShowAction` creates the `shows` row, assigns a random `cover_shader`,
   reserves generation credits, marks generation as running, and redirects to
   `/shows/[slug]/generating`.
5. Cue generation runs in an `after()` callback. If music analysis is still
   running, the generation runner waits and resumes after analysis completes.
6. The fast deterministic planner is the default. The optional LLM path is
   enabled only when the generation setting or `CUE_GENERATION_MODE` selects
   `llm`.
7. The wizard shows the fast planner in `fast` mode and model selection only in
   `llm` mode. The server revalidates the mode when Generate is submitted.
8. Accepted cues are written to `show_timeline_items` through the
   `replace_show_timeline_items` RPC. AI credits are settled on success and
   refunded on expected failure.

## Database

Schema lives in `platform/supabase/migrations` and is applied chronologically.
Generated TypeScript types live in `platform/lib/database.types.ts`.

Current major groups:

- **Users and RBAC**: `users`, `roles`, `permissions`, `role_permissions`,
  `user_roles`, `user_permission_overrides`, plus `current_user_access` and
  `current_user_has_permission` RPCs.
- **Catalogue and effects**: `catalogue_items`, `fireworks`,
  `firework_effects`, `firework_style_defaults`, style-default link tables,
  `multishots`, and `multishot_fireworks`.
- **Shows and generation**: `shows`, `show_timeline_items`, `show_presets`,
  `show_preset_likes`, `show_preset_like_counts`, `song_analyses`, and
  `show_generation_runs`.
- **AI credits**: `ai_credit_accounts`, `ai_credit_costs`, and
  `ai_credit_transactions`.
- **Suppliers and imports**: `supplier_profiles`, `supplier_inventory_items`,
  `import_jobs`, `import_outputs`, and `media_assets`.

Every public table must have RLS enabled with policies. Public browse tables
such as `show_presets`, `show_preset_like_counts`, `catalogue_items`,
`fireworks`, `multishots`, and `multishot_fireworks` intentionally allow
anonymous `SELECT`; document any new anonymous policy in the migration.

RLS is paired with explicit Data API grants. Security-definer functions must
check the caller, use a fixed empty search path with qualified objects, revoke
public execution, and grant only the required roles. Migration changes should
also add needed foreign-key indexes, avoid redundant indexes, and preflight
existing rows before enforcing constraints.

When schema changes are made, regenerate `platform/lib/database.types.ts` with
the Supabase MCP `generate_typescript_types` tool or the approved project
workflow, then update tests that assert schema-dependent behaviour.

### Explore Presets

`show_presets` is the only runtime source for Explore. New, imported, and
duplicated presets start unpublished. Imported presets retain a unique nullable
`source_show_id`, so import identity does not depend on a mutable title or slug.

Preset cues use canonical `catalogueItemId` UUIDs. Publication and cloning
require every cue to resolve, remain inside the show duration, and avoid overlap
on the same launch position. Likes are persisted per authenticated user in
`show_preset_likes`; guests see only aggregate counts. See
[`platform/docs/explore-presets.md`](platform/docs/explore-presets.md).

## Storage

- `audio`: private user-uploaded tracks. Objects live under `<user id>/...`.
  Storage policies enforce per-user access and the bucket limits accepted MIME
  types to MP3, WAV, AAC, and M4A with a 50 MB file limit.
- `import-videos`: admin-only firework videos for import jobs. The import
  worker signs and processes these files with service-role access.

## Admin And Worker Flows

The admin area under `/admin` covers overview, catalogue, fireworks,
multishots, effects, style defaults, Explore presets, prompts, imports,
suppliers, users, roles, and billing. Navigation is filtered by each
destination's permission, while route and action checks remain authoritative.

User password-reset controls send a real Supabase Auth recovery email. User
deletion removes the Auth user and relies on database cascades for owned app
data; the confirmation copy must state that scope.

Firework and effect editors share `FireworkEditorShell`, `FireworkRenderControls`,
history panels, JSON panels, and compact preview transport controls. Style
defaults use the same shell but keep a narrower side rail.

Editor saves preserve newer local changes made while a request is in flight.
Replay caches include every simulation input and launch-position coordinate,
version-history recording is best-effort, physical ranges remain non-negative,
and slider thumbs carry their accessible names. See
[`platform/docs/editor-integrity.md`](platform/docs/editor-integrity.md).

Start the import worker from `platform`:

```bash
npm run worker:firework-import
```

The worker polls queued `firework_video` import jobs, validates videos are 60
seconds or less, extracts features, asks OpenRouter for a structured
reconstruction, and writes `generated_spec` output rows for admin review.

## UI And Design System

Use the repo-local ShowCrafter design-system skill before UI work:

- Codex: `.agents/skills/showcrafter-design-system/SKILL.md`
- Claude: `.claude/skills/showcrafter-design-system/SKILL.md`

Shared app UI primitives live in `platform/app/components/ui`. The lower-level
Radix/shadcn layer lives in `platform/components/ui`; only files explicitly
marked as generated are non-editable. Prefer app primitives for product UI and
use `cn()` from `@/lib/utils`.

Global tokens live in `platform/app/globals.css`. Shared legacy class fragments
live in `platform/app/components/ui/styles.ts`; prefer moving repeated patterns
onto primitives over adding more route-level class strings there.

Normal app and admin chrome uses neutral surfaces. Marker green is reserved for
primary actions, focus, progress, and active technical markers, while `accent`
is a neutral hover or selected surface. Use Geist Mono with `tabular-nums` for
timings, prices, quantities, product codes, confidence scores, and IDs. Never
remove a focus indicator without providing a visible replacement on the same
control.

Loading states should keep stable route chrome visible, including page titles,
descriptions, labels, table headers, and form section headings. Use neutral
`Skeleton` placeholders only for data-driven values and controls whose value is
still loading.

`/catalogue`, `/library`, and `/library/[id]` are public browse URLs. Guests see
marketing navigation and footer chrome; authenticated visitors keep the
workspace shell. Mobile shells keep their sidebar trigger reachable and render
one main landmark.

## Platform Documentation

- [`platform/README.md`](platform/README.md): platform setup and operational
  entry points.
- [`platform/docs/explore-presets.md`](platform/docs/explore-presets.md):
  Explore lifecycle, cue contract, provenance, and likes.
- [`platform/docs/editor-integrity.md`](platform/docs/editor-integrity.md):
  editor save, preview cache, ranges, history, and accessibility rules.
- [`platform/docs/database-safety.md`](platform/docs/database-safety.md):
  migration, RLS, grants, types, and linked-environment verification.

## Notes For Agents

- Read [`AGENTS.md`](AGENTS.md) before changing the repository. `CLAUDE.md`
  mirrors it and is guarded by tests to prevent drift.
- Use British English, straight apostrophes, and no em dashes.
- Preserve the explicit show-generation boundary. Music analysis can run after
  upload, but final show creation and cue generation belong to Generate.
- Do not reveal hidden background work unless an error blocks the user.
- Treat local source, migrations, tests, and route files as the source of truth.
- Keep unrelated dirty worktree changes intact.
- Comment rationale, invariants, security boundaries, lifecycle constraints,
  coordinate systems, and non-obvious contracts. Do not narrate obvious code.
- Fail closed when database errors affect authorisation, billing, ownership, or
  cue scheduling. Use a transaction or guarded RPC for multi-write invariants.
- Keep renderer `geometryTuning` changes aligned across schema defaults,
  renderer code, editor controls, canonicalisation, preview timing, and tests.

## Team Tools

- GitHub: version control, CI, pull requests.
- Linear: issue tracking.
- Notion: planning and documentation.
- Teams: stakeholder meetings.
- Discord: team communication.
