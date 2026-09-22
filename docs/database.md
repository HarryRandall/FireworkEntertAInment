# Database development and handover

ShowCrafter uses local Supabase for ordinary development and a hosted Supabase
project for production. Docker, Node 24 and the pinned pnpm version are required.
The CLI is pinned in the root package manifest. All commands run from the repository root.

## Local setup

Start Docker, then run:

```bash
pnpm install --frozen-lockfile
pnpm db:setup
pnpm db:env
pnpm dev
```

`db:setup` starts the isolated `showcrafter` stack, installs the catalogue once,
and creates synthetic local accounts and sample shows. `db:env` writes
`apps/web/.env.local` only if it does not exist. It disables inherited external
service settings, including values in an existing `.env`. Keep this file private.
If you already have `.env.local`, update its database values using `pnpm db:status`.

| Service           | Address                  |
| ----------------- | ------------------------ |
| Supabase API      | `http://127.0.0.1:55421` |
| PostgreSQL        | `127.0.0.1:55422`        |
| Studio            | `http://127.0.0.1:55423` |
| Local email inbox | `http://127.0.0.1:55424` |

Local accounts are `admin@showcrafter.test`, `supplier@showcrafter.test` and
`user@showcrafter.test`. Their local-only password is `LocalShowCrafter123!`.
Each receives development credits. The user account owns three editable example
shows. Fixtures run only against the exact local API port and cannot target a
hosted project. Re-running them does not duplicate accounts, credits or shows.

```bash
pnpm db:stop                       # Keep local data for next time
pnpm db:reset                      # Destroy and rebuild only the local application database
pnpm db:bootstrap --local          # Restore reusable content and media
pnpm db:verify --local             # Compare the fresh database with the snapshot, before fixtures
pnpm db:test                       # Transactional database regression tests, rolled back
pnpm db:types --check              # Check application types against the local schema
pnpm db:fixtures                   # Add local accounts, credits and sample shows
```

`db:reset` deliberately does not select a linked project and rejects extra flags.
Other local Supabase projects use different project IDs and ports.

## Schema and content have separate lifecycles

`supabase/migrations/` contains an ordered fresh-install baseline: foundation,
tables, domain functions, constraints, security, auth/Storage and an installation
receipt. The previous migration chain remains in Git before this rebaseline.
After this baseline ships, migrations are immutable. Add a new migration for each
schema change, reset locally, run the SQL tests and regenerate types with
`pnpm db:types`. Commit generated types with the migration.

`supabase/bootstrap/` contains reusable production content and media, with hashes
and row counts in `manifest.json`. It includes all 26 effects, 90 fireworks,
39 multishots and their 882 shots, calibrated defaults, catalogue rows, previews,
role/permission definitions, suppliers/inventory, assortments, AI prompts/settings
and credit prices. The handover selection retains Queen City Fireworks and Hammer
& Anvil, Backyard Bash Assortment and Comet Trail Assortment, and the published
Outback Gold, Colour Burst and Midnight Pulse presets and covers.

Six test suppliers and the `Ass`/`qr_test` assortments are excluded by explicit IDs
in `supabase/bootstrap-selection.json`. Old accounts, user shows, credit balances,
logs, jobs, editor history and source-show provenance are excluded. Nullable audit
account references are cleared. Nothing is deleted from the export source.

Bootstrap validates every file before writing, refuses any populated application
table, and installs rows transactionally. Media uploads are resumable and never
overwrite a different object. A private receipt prevents subsequent deployments
or bootstrap runs from overwriting catalogue edits. A seed is a fresh-install
snapshot, not a production synchronisation mechanism.

Continue editing catalogue content through the production admin UI. To update
future handovers, pause content edits briefly and export to a new ignored directory:

```bash
node --env-file=apps/web/.env.production-export scripts/database/export.mjs .tmp/catalogue-export
```

The private environment file needs `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` for the source. The exporter reads tables twice and
rejects changing/incomplete results; this is not a transactionally isolated backup.
Review counts, exclusions and media, replace `supabase/bootstrap/` with the complete
export, then repeat fresh-install verification before committing. Refresh the
snapshot count assertions when intentionally changing the approved catalogue.
Keep source credentials and uncurated exports outside Git.

## Fresh hosted installation

Create a fresh Supabase project on PostgreSQL 17. Use an empty project: the new
baseline is not an in-place upgrade of the retired migration history. Do not use
migration-history repair to pretend an existing project has this schema.

```bash
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase db push --linked
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for that exact destination in
a private environment file, then run:

```bash
node --env-file=.env.handover scripts/database/bootstrap.mjs --project-ref YOUR_PROJECT_REF
pnpm db:verify --project-ref YOUR_PROJECT_REF
```

Hosted commands require an explicit project reference matching the local link.
The source export can use a separate CLI working directory to avoid changing that
link. Never run `db:fixtures` against a hosted project.

Configure hosted Auth site URL, allowed redirects and email delivery for the
actual application domain. Local confirmation settings are not production Auth
configuration. Sign up and verify the intended administrator through Auth, then
use their exact account UUID:

```bash
pnpm db:admin --project-ref YOUR_PROJECT_REF --user-id VERIFIED_ACCOUNT_UUID
```

There is no hard-coded email privilege or shared production admin password. The
command requires an existing verified, active account and assigns the seeded
admin role. Subsequent signups always receive the standard user role.

Configure the web host with the new URL, publishable key and server-only service
key. Configure services with the same project's credentials and buckets. Verify
signup/login, public catalogue and presets, role access, saving a show and media
loading before switching the public application to the new project. Retain the
old project until the new installation is accepted.

## Optional integrations

Local catalogue browsing, editing, presets and fast show generation need no
external provider. Fixtures select `fast` generation locally; the handover seed
preserves production's `llm` setting. Use the configuration checklist below to enable optional services locally.

| Capability                    | Configuration                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| AI show generation/refinement | `OPENROUTER_API_KEY`; choose a supported model and enable LLM mode in admin settings                                                 |
| Music analysis                | `ANALYSER_URL`, `ANALYSER_SHARED_SECRET`; deploy the analyser separately                                                             |
| Jamendo search/import         | `JAMENDO_CLIENT_ID`; analysis is also needed for imported music                                                                      |
| Firework video import         | `FIREWORK_IMPORT_URL`, `FIREWORK_IMPORT_SHARED_SECRET`, `FIREWORK_IMPORT_RENDER_URL`; deploy the worker and reachable render harness |
| Durable public QR rate limits | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` for production                                                                  |

Hosted services cannot fetch a laptop's `localhost` Storage URL. For full external
integration testing, use an isolated hosted development project, or a deliberately
configured reachable HTTPS storage endpoint and the service's allowed-host
configuration. Do not point local development at production to bypass this.
Missing configuration must be resolved before exercising that capability; normal
local database work remains available. Deploying the web app does not deploy the
Python services.

## Verification coverage

Historical tests that matched `ALTER`, `DROP` or seed text in old migration files
have been replaced by installed-schema checks and snapshot checks. Application,
renderer and worker behaviour tests remain in their respective suites. Database
suites cover active/suspended ownership, anonymous/public QR capabilities, exact
assortment use and credits, import leases and immutable review artefacts, published
preset lane safety, signup, effective grants, RLS and Storage visibility. Fresh
snapshot verification checks all reusable table values and the renderer contract.

## Manual production releases

The `database` CI job builds an empty database, installs the snapshot, runs the SQL
contracts and checks generated types, then repeats the reset and fixture setup.
Pushes to `main` run validation only. Production migration and deployment are
eligible only when an operator manually dispatches the `CI` workflow on `main`
with `deploy_production` set to `true`, and all web, database and service jobs
pass. The production job then checks that Vercel and Supabase target the same
installed project, applies migrations, builds that exact commit and deploys it.
It rejects a superseded commit and never resets or reseeds production. The
dispatch input defaults to `false`.

Before the first merge, configure these GitHub `production` environment settings:

- Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`.
- Variables: `SUPABASE_PROJECT_REF`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

The Vercel project must use `apps/web` as its Root Directory, include workspace
files outside it, use Node 24, and have the destination Supabase credentials in
its Production environment. `apps/web/vercel.json` disables automatic Git
production deployments from `main`. Preview branch deployments remain available;
give previews an isolated hosted development database if they need provider
integrations.

This workflow does not automatically provision Auth providers, SMTP, Modal
services, external API keys, billing plans or domains. Those belong to the hosted
project handover. A failed migration stops the web deployment. If deployment
fails after migrations succeed, fix the build and rerun the tested release;
subsequent migrations should remain compatible with the currently running app.
