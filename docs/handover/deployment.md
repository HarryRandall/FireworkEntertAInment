# Deploying to the client's accounts

Use this after [accounts](accounts-and-access.md) and
[configuration](configuration.md). The steps create or update hosted resources.
Have the client confirm the target projects, billing and operational data plan
before the cutover. Keep the previous environment available until acceptance.

## Choose the data handover

| Approach                  | Use when                                               | Procedure                                                               |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Fresh installation        | The approved reusable catalogue is sufficient          | Empty PostgreSQL 17 Supabase project, baseline migrations and bootstrap |
| Existing service transfer | Existing operational users/shows/data must be retained | Provider transfer and separately verified backup/restore/cutover plan   |

Do not apply the fresh baseline to an existing populated project as an upgrade.
Do not run local fixtures or production reset commands on a hosted database.
Recreating provider accounts does not transfer existing Auth users or Storage media.

## 1. Identify the release and targets

Record the Git tag/commit, receiving repository, Vercel project/team, Supabase
project reference, Modal workspace and intended domain in [Walkthrough](walkthrough.md).
Use an isolated preview/staging database for rehearsal. Confirm the repository's
CI and release configuration on the receiving fork rather than assuming it was copied.

## 2. Install a fresh hosted Supabase project

Create a fresh project using PostgreSQL 17. Save its database password privately.
From an authenticated repository checkout, replace `YOUR_PROJECT_REF` below:

```bash
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase db push --linked
```

Create a private, ignored `.env.handover` in the root containing only the destination
credentials needed for bootstrap:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=DESTINATION_SERVICE_ROLE_KEY
```

Then install and verify reusable content before creating any accounts:

```bash
node --env-file=.env.handover scripts/database/bootstrap.mjs --project-ref YOUR_PROJECT_REF
pnpm db:verify --project-ref YOUR_PROJECT_REF
```

The explicit project reference must match the CLI link and credential URL.
Verification compares fresh content and the media receipt; it will reject a
database with users/shows or deliberate subsequent catalogue changes. Do not
remove client data to make this check pass. Delete the temporary credentials file
when no longer needed, and keep it outside Git throughout.

Configure hosted Auth, email templates, SMTP, redirects and Storage as described
in [Configuration](configuration.md). The client administrator is created after
the web host is reachable and signup/email work.

## 3. Configure Vercel

1. Create/connect the project under the client's team and receiving GitHub repo.
2. Set **Root Directory** to `apps/web` and enable inclusion of files outside that
   root so the workspace lockfile and packages are available.
3. Select Node 24. Use `pnpm install --frozen-lockfile` and `pnpm build` as declared
   in `apps/web/vercel.json`.
4. Set `ENABLE_EXPERIMENTAL_COREPACK=1` in Production and Preview to use the pinned
   package manager. Set the destination Supabase variables and recovery secret.
5. Set `APP_ORIGIN` to the intended trusted origin, and configure the matching
   Supabase Site URL and redirects. Keep Preview credentials isolated from Production.
6. Set Upstash REST values for production QR/recovery. Add enabled providers' keys.
7. Assign the agreed domain and DNS records using Vercel's project-specific values.
   Confirm HTTPS and email DNS independently.

Local configuration does not change hosted project settings. Preview hosting must
also allow the callbacks and media access needed for its intended integration test.

## 4. Configure the production workflow

In the receiving GitHub repository's **production** environment, set:

| Kind      | Names                                                           |
| --------- | --------------------------------------------------------------- |
| Secrets   | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN` |
| Variables | `SUPABASE_PROJECT_REF`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`    |

Use credentials belonging to the intended receiving services. Configure agreed
branch protections and any environment approval rules. In a fork, enable Actions
if required and verify a run can access these environment settings.

After all dependent CI jobs pass, a push/merge to `main` triggers production release.
An operator can also dispatch **CI** on `main` with `deploy_production=true` to retry
an intended release. The default input is false. Pull requests and other branches
do not run this production deployment job.

The job rejects a superseded commit, fetches Vercel settings, checks that Vercel
and Supabase target the same installed project, applies migrations, builds that
commit and deploys the prebuilt output. The checked-in Vercel configuration disables
competing automatic Git deployments from `main`. Confirm that configuration remains
in the receiving project. Do not create an unreviewed code change just to trigger
the first deployment; dispatch the agreed checked `main` release.

A web release does not automatically deploy Modal, configure SMTP, create provider
accounts or move domains. If migrations fail, web deployment stops. If the build
fails after migrations succeed, keep the existing app running and fix forward
with compatible schema. See [Operations](operations.md).

## 5. Deploy the music analyser

Activate the Modal deployment environment from [Accounts](accounts-and-access.md).
Create Modal Secret `showcrafter` as described in Configuration. From the root:

```bash
cd services/music-analyser
SHOWCRAFTER_APP_ORIGIN=https://your-production-domain.example modal deploy modal_app.py
cd ../..
```

Use the actual origin, not the example. The image installs Python dependencies
and downloads/verifies the pinned Beat This! checkpoint. Wait for a successful
build and deployment. Record both printed endpoints:

- `SongAnalyser.analyse` becomes the web `ANALYSER_URL`.
- The lightweight API URL plus `/runs` becomes `ANALYSER_DISPATCH_URL`.

Ensure the callback-capable web release is deployed before enabling queued
dispatch, then redeploy the web with the matching shared secret and endpoints.
Upload representative music and confirm analysis, callback persistence, cue
completion and one credit settlement. Confirm there is no old recurring recovery
schedule in the receiving Modal app. Redeploying the web alone cannot remove an
old service schedule.

## 6. Deploy the video reconstruction worker

Create both import secrets from [Configuration](configuration.md), then run from
the repository root with the Modal environment active:

```bash
modal deploy services/firework-import-worker/modal_app.py
```

Modal builds a Node 24/Python image with FFmpeg, the renderer and fitting bridge.
Set `FIREWORK_IMPORT_URL` to the printed API URL ending `/runs`, set the matching
shared secret on the web host and redeploy the web. Submit a permitted test clip
and verify dispatch, job completion, candidate review and catalogue publication
only after deliberate approval in the admin workflow.

## 7. Establish administrator access and accept the installation

Sign up and verify the intended receiving administrator, then grant the role
using the exact UUID and `pnpm db:admin` procedure in [Accounts](accounts-and-access.md).
Test standard-user and public access separately.

Complete the [acceptance matrix](walkthrough.md) on the receiving URL. Confirm
provider billing/alerts, backups and independent deployment access before changing
DNS to replace a previous site or retiring the previous projects. Record when
old team access and credentials can be removed. GitHub release tags should identify
the accepted delivery; update repository links if the client fork becomes the
maintained source.
