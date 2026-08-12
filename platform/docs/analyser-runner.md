# Hosted Analyser Runner

Music analysis starts quietly after the browser uploads a file in the new-show
wizard. It remains separate from show creation: only the final Generate action
creates the show and starts cue generation.

## Runtime

1. The browser uploads audio directly to the user's prefix in the private
   Supabase `audio` bucket.
2. `POST /api/music-analysis` verifies ownership, MIME type, and the 50 MB
   limit, reserves credits, creates a `song_analyses` row, and uses `after()`
   only to attempt the short durable submission. If that callback is killed,
   reconciliation claims the untouched row and submits it later.
3. A 60-second database lease mints a one-hour signed Storage URL and submits a
   Modal function call. The opaque call ID is persisted before the lease is
   released. Later reconciliation invocations poll that ID without consuming
   another attempt.
4. `platform/analyser/modal_app.py` downloads the signed audio into temporary
   storage through the HTTPS host allow-list, same-host redirect, 50 MiB, and
   30-second total download boundaries. Decoding is capped at 15 minutes.
5. Modal may run the job for 20 minutes. Vercel submit and poll requests have a
   20-second control deadline and never await the full analysis. A job older
   than 25 minutes is retried or failed through the normal bounded lifecycle.
6. A completed poll reads at most 8 MiB and validates the complete schema before
   completing the leased attempt through a guarded RPC. Analysis output and
   credit settlement commit together. Waiting cue generation becomes claimable
   on reconciliation.

The client can continue through the wizard while analysis is queued or running.
Hidden background state is surfaced only when an error blocks generation.

## Deployment

The analyser image installs `platform/analyser/requirements.txt`. Durable jobs
run with 2 CPU cores, 4 GB memory, a 20-minute timeout, and Modal memory
snapshots. The submit/poll endpoint itself has a 60-second timeout.

```bash
cd platform/analyser
modal deploy modal_app.py
```

Configure these values in the Next.js deployment:

- `ANALYSER_URL`, the deployed Modal web endpoint.
- `ANALYSER_SHARED_SECRET`, the bearer token shared with the Modal
  `showcrafter` secret.
- `SUPABASE_SERVICE_ROLE_KEY`, required by trusted reconciliation.
- `CRON_SECRET`, required by the protected reconciliation, backend health, and
  analyser warm-up routes.

Supabase, Modal, and Vercel must use matching production values. Never expose
the shared secret to the browser.

Set `ANALYSER_ALLOWED_AUDIO_HOSTS` in the Modal secret to the exact hostname in
the signed Storage URL. This allowlist is required for standard Supabase hosts
and custom Storage domains. Comma-separate multiple exact hostnames. Wildcards
and broad public domains are not accepted.

`platform/vercel.json` registers two independent Vercel Cron jobs every minute:

- `GET /api/admin/analyser/reconcile` submits or polls at most one analysis
  control operation, then performs bounded retention, credit repair, and health
  work.
- `GET /api/admin/cue-generation/reconcile` claims at most one ready cue job.

This frequency requires a Vercel Pro or Enterprise project. The Vercel project
Root Directory must remain `platform`, and `CRON_SECRET` must be configured in
the production environment before the production deployment that registers the
jobs. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically. After
deployment, verify that both jobs appear in the Vercel Cron dashboard and have
successful invocation logs. Repository tests guard the configuration, but
cannot prove that a particular deployment has registered or enabled it. See
[Backend lifecycle](backend-lifecycle.md).

## Persistence and cleanup

`song_analyses.analysis_json` is the source for cue generation, while
`song_analyses.markdown` is readable diagnostic context. Replacing or clearing
an upload uses the guarded cleanup RPC, resolves the active reservation, and
removes the private audio object. Cleanup refuses an analysis already linked
to a show.

Each new Modal submission increments `attempt_count` and receives a 60-second
lease. Polling the persisted call ID retains the same attempt. Network failures
and HTTP 408, 425, 429, or retryable 5xx responses retry after 30 then 120
seconds, with at most three submissions. Configuration, authentication, and
invalid-output failures are terminal. A stale invocation cannot write after its
lease expires because every submit-record, poll-deferral, completion, retry,
and failure RPC requires the current token.

The independent reconciliation routes reclaim expired leases, fail exhausted
attempts, make shows with terminal analyses claimable for cue generation, and
repair terminal show credit reservations. Separating the schedules prevents
continuously running analysis polls from starving ready cue work. These
operations are bounded and idempotent.

The repository analyser currently emits schema `1.4.0`. Runtime validation is
strict and fail-closed. Stored `1.3.0` analyses gain safe bar-grid and derived
defaults. Historical `1.2.0` compatibility is verified against a genuine
payload retained in Git history. That schema has the same validated musical
fields, but lacks timing metadata as well as the `1.4.0` fields, so it also
gains zeroed legacy timing metadata. A legacy payload that cannot be safely
upgraded enters the explicit re-analysis error path instead of reaching cue
planning. Unsupported future schemas fail explicitly.

The 8 MiB response limit is paired with the 15-minute duration cap and bounded
arrays: 10,000 beats and downbeats, 50,000 onsets, 2,000 energy points, 256
sections, 512 key moments and buildups, and 12,000 heuristic firework cues.
Dense 15-minute contract coverage verifies that a realistic maximum profile
remains below the transport limit.

Exact product quantities are future-compatible planner input only. The current
production runner does not pass them because supplier inventory is not a
show-specific fixed assortment. Quantity enforcement is therefore not active.

## Verification

Run the analyser unit tests from `platform/analyser`:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p "*test*.py"
```

CI also emits a Python-validated result and parses it through the TypeScript
runtime schema. For a real deployed endpoint, configure repository secrets
`ANALYSER_URL`, `ANALYSER_SHARED_SECRET`, and a short-lived private
`ANALYSER_TEST_AUDIO_URL`, then manually run the `Analyser live smoke`
workflow. Browser and real-audio end-to-end checks remain external. The live
harness is separate so ordinary pull requests never depend on production
services or persistent signed URLs.

For local timing investigation, without pass or fail thresholds:

```bash
python benchmark.py --repeat 2
```

## Manual route

`POST /api/analyse` remains an authenticated legacy wrapper for development and
repair. It now submits or polls the show's upload-scoped `song_analyses` row and
returns HTTP 202 while work is pending. It does not start request-bound analysis
or expose a user-facing button.

## Failure boundaries

- Invalid requests and unsupported uploads fail before credits are spent.
- Missing analyser configuration fails closed without retry.
- Transient Modal transport and service errors retain the reservation while a
  bounded retry is pending.
- Terminal analysis state and credit resolution share one database
  transaction. If that transaction fails, the lease expires for
  reconciliation rather than presenting partial success.
- Cue generation may wait for an in-progress analysis, but it must not treat a
  failed or unreadable analysis as an empty successful result.
