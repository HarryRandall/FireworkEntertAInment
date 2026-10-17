# Configuration and integration credentials

The web environment example is `apps/web/.env.example`. Next.js reads local env
files in `apps/web`, not a root web `.env`. Use `pnpm db:env` for the isolated local
setup, or copy the example to `apps/web/.env.local` for an isolated hosted
development setup and fill it from that project's settings.

Never commit filled environment files. Variables beginning `NEXT_PUBLIC_` are
browser-visible. All other credentials below stay on servers. Changes to a hosted
environment normally require a new deployment; restart local development after
changing local configuration.

## Web configuration register

| Variable                               | Source and purpose                                              | Required when                          |
| -------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Destination Supabase API URL                                    | Every web environment                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Destination public/publishable API key                          | Every web environment                  |
| `SUPABASE_SERVICE_ROLE_KEY`            | Same project's server-only service-role key                     | Privileged web operations              |
| `APP_ORIGIN`                           | Actual trusted website origin, with scheme                      | Hosted authentication and callbacks    |
| `PASSWORD_RECOVERY_SIGNING_SECRET`     | Independent random secret per environment                       | Password recovery                      |
| `ANALYSER_URL`                         | Modal `SongAnalyser.analyse` URL                                | Music analysis and warm-up             |
| `ANALYSER_DISPATCH_URL`                | Lightweight analyser API URL ending `/runs`                     | Queued analysis and result callbacks   |
| `ANALYSER_SHARED_SECRET`               | Same value on web and Modal analyser                            | Authenticated analysis                 |
| `JAMENDO_CLIENT_ID`                    | Jamendo developer application client ID                         | Music search/import                    |
| `CRON_SECRET`                          | Private operational bearer secret                               | Authorised lifecycle/health operations |
| `FIREWORK_IMPORT_URL`                  | Import Modal API URL, normally ending `/runs`                   | Hosted video import                    |
| `FIREWORK_IMPORT_SHARED_SECRET`        | Same value on web and import dispatch secret, 32-512 characters | Hosted video import                    |
| `OPENROUTER_API_KEY`                   | Client-owned OpenRouter key                                     | LLM generation/refinement              |
| `UPSTASH_REDIS_REST_URL`               | Upstash HTTPS REST endpoint                                     | Production distributed rate limiting   |
| `UPSTASH_REDIS_REST_TOKEN`             | Upstash REST token                                              | Production distributed rate limiting   |

Legacy public Supabase aliases are documented in the env example. Prefer the
publishable name and remove conflicting old values. Do not mix keys from two
projects. `SUPABASE_URL` is also needed by database bootstrap/export scripts and
the polling import worker; set it to the same project's API URL for those tools.

Create independent high-entropy recovery, analyser, import and operational secrets
with a password manager. For example, `openssl rand -base64 48` produces a value
that can be saved directly into the relevant private settings. Do not share the
command output in logs or use one secret for every integration.

## Supabase Auth, email and Storage

1. Set Auth's Site URL to the actual application origin.
2. Allow the exact origins/redirects used by the receiving deployment. The app's
   signup callback is `/auth/callback`; recovery uses `/auth/confirm` and the
   `/reset-password` journey. Keep previews tied to a development project.
3. Review the repository's `supabase/templates/` recovery email against the hosted
   Auth email template. A default provider template is not proof that the custom
   token-hash recovery journey is configured.
4. Configure SMTP and test confirmation and password recovery in a real mailbox.
5. Install migrations and bootstrap media using [Deployment](deployment.md).
   Test public catalogue images and authorised private music/video uploads.

Local Auth/mail settings from `supabase/config.toml` do not configure a hosted
project's Auth dashboard. A hosted database also needs its own admin account.

## Music analyser on Modal

Create Modal Secret `showcrafter` with:

| Key                            | Value                                       |
| ------------------------------ | ------------------------------------------- |
| `ANALYSER_SHARED_SECRET`       | Exact same secret as the web environment    |
| `ANALYSER_ALLOWED_AUDIO_HOSTS` | Optional custom Storage hostname allow-list |

Deploy with `SHOWCRAFTER_APP_ORIGIN` set to the trusted web origin. This is embedded
in the deployment's callback configuration. Set the web's `ANALYSER_URL` to the
synchronous endpoint and `ANALYSER_DISPATCH_URL` to the separate lightweight API's
`/runs` endpoint. Do not swap them. Deploy callback routes before enabling dispatch.

The analyser receives a signed audio URL and returns results to
`/api/internal/music-analysis/callback`. It does not need the database service-role
key. Standard Supabase Storage hostnames are allowed by the downloader; a custom
host needs deliberate allow-list configuration. Hosted Modal cannot reach local
Supabase on a developer's loopback address.

## Video reconstruction on Modal

Create these two named secrets in the intended Modal workspace:

| Modal Secret                           | Keys                                                              |
| -------------------------------------- | ----------------------------------------------------------------- |
| `showcrafter-firework-import-worker`   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY` |
| `showcrafter-firework-import-dispatch` | `FIREWORK_IMPORT_SHARED_SECRET`                                   |

The worker database must match the web environment. Set the web import URL to
the deployed API's `/runs` route. In production, a missing dispatch URL is an
error; there is no automatic laptop polling fallback.

For local polling, put `SUPABASE_URL`, the local service-role key and
`OPENROUTER_API_KEY` in the private app env file. Leave `FIREWORK_IMPORT_URL` empty
and run `pnpm worker:firework-import` separately. This path can access the local
Supabase instance from the same machine.

Optional controls include `IMPORT_FIT_SECONDS=300`, `IMPORT_FIT_ITERATIONS=30`
and `IMPORT_RUN_DEADLINE_SECONDS=3000` on the relevant consumers. The worker also
supports model image/call limits described in its README. Start with defaults.
A non-Modal dispatch hostname requires the web's explicit
`FIREWORK_IMPORT_ALLOWED_HOSTS` allow-list; it must not contain URL paths.

## Generation modes and durable rate limits

The fast planner uses local catalogue-aware logic and does not need OpenRouter.
The fresh hosted content preserves the production `llm` generation setting;
local fixtures deliberately select `fast`. Choose the intended mode in
Admin > Prompts and test it. `OPENROUTER_CUE_MODEL` is an optional model override.

Configure both Upstash REST variables in production when recovery or public
assortment QR flows are enabled. Development can use per-process memory; public
QR production endpoints fail closed without durable shared limits. Do not treat
that failure as a reason to remove rate limiting.

## Verify configuration without exposing it

Record the provider project IDs, secret item references and deployment IDs in
[the walkthrough record](walkthrough.md). Check values privately in dashboards.
Test one real journey for every enabled integration and record the result. A
successful save of an environment variable does not establish service delivery.
