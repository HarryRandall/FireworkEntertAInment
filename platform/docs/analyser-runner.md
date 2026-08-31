# Hosted Analyser Runner

Music analysis starts quietly after the browser uploads a file in the new-show
wizard. It remains separate from show creation: only the final Generate action
creates the show and starts cue generation.

## Runtime

1. The browser uploads audio directly to the user's prefix in the private
   Supabase `audio` bucket.
2. `POST /api/music-analysis` verifies ownership, MIME type, and the 50 MB
   limit, reserves credits, creates a `song_analyses` row, and schedules
   `runMusicAnalysisForUpload` with Next.js `after()`.
3. The server mints a short-lived signed Storage URL and calls the Modal
   endpoint configured by `ANALYSER_URL`, authenticated with
   `ANALYSER_SHARED_SECRET`.
4. `platform/analyser/modal_app.py` downloads the signed audio into temporary
   storage and runs `showcrafter.analyse_song` inside the Modal container.
5. The server parses the response and completes the leased attempt through a
   guarded RPC. Analysis output and credit settlement commit together, then
   any cue generation waiting on this analysis resumes.

The client can continue through the wizard while analysis is queued or running.
Hidden background state is surfaced only when an error blocks generation.

## Deployment

The analyser image installs the exact dependency versions in
`platform/analyser/requirements.txt`; CI uses the reviewed Python 3.11.15
runtime. Modal runs with 2 CPU cores, 4 GB memory, a 600-second timeout, and
memory snapshots. Dependency or Python runtime changes require a reviewed
real-audio baseline run before deployment.

```bash
cd platform/analyser
modal deploy modal_app.py
```

Configure these values in the Next.js deployment:

- `ANALYSER_URL`, the deployed Modal web endpoint.
- `ANALYSER_SHARED_SECRET`, the bearer token shared with the Modal
  `showcrafter` secret.
- `SUPABASE_SERVICE_ROLE_KEY`, required by trusted reconciliation.
- `CRON_SECRET`, required by the protected analyser warm-up and reconciliation
  routes.

Supabase, Modal, and Vercel must use matching production values. Never expose
the shared secret to the browser.

Configure a scheduler to call `GET /api/admin/analyser/reconcile` with
`Authorization: Bearer <CRON_SECRET>` every minute. The route is intentionally
not added to `vercel.json`, so projects can use Vercel Cron or another trusted
scheduler without changing the analyser warm-up policy. The same route now
reconciles cue generation, dead letters, credit crash windows, and private
audio retention. See [Backend lifecycle](backend-lifecycle.md).

## Persistence and cleanup

`song_analyses.analysis_json` is the source for cue generation, while
`song_analyses.markdown` is readable diagnostic context. Replacing or clearing
an upload uses the guarded cleanup RPC, resolves the active reservation, and
removes the private audio object. Cleanup refuses an analysis already linked
to a show.

Each worker claim increments `attempt_count` and receives a 15-minute lease
token. Network failures and HTTP 408, 425, 429, or 5xx responses retry after 30
then 120 seconds, with at most three claimed attempts. Configuration,
authentication, and invalid-output failures are terminal. A stale worker cannot
write after its lease expires because every completion, retry, and failure RPC
requires the current token.

The reconciliation route reclaims expired leases, fails exhausted attempts,
makes shows with terminal analyses claimable for cue generation, and repairs
terminal show credit reservations. These operations are bounded and
idempotent.

The repository analyser currently emits schema `1.4.0`. Older stored analyses
remain readable because the bar-grid fields are optional to consumers.

## Verification

Run the analyser unit tests from `platform/analyser`:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p "*test*.py"
```

Run the schema 1.4.0 real-audio regression separately:

```bash
python evaluate.py
```

The regression analyses four versioned Jamendo MP3s: two pop tracks and two
classical recordings. Their attribution, source URLs, CC BY 3.0 licence, file
sizes, and SHA-256 values are recorded in
`platform/analyser/evals/jamendo_fixtures.json`. The reviewed musical baseline
is `platform/analyser/evals/baseline_v1.json`.

The evaluator verifies each immutable audio file before analysis, validates the
schema 1.4.0 result, and checks duration, tempo, beat and downbeat grids,
sections, climaxes, buildups, and the finale window. Timing and count checks use
bounded cross-platform tolerances, while schema versions, timeline ordering,
file hashes, and licence provenance are exact.

Hosted Modal responses are also validated at the Next.js boundary before any
completion write. The validator requires schema 1.4.0, rejects missing or
unexpected fields and non-finite values, checks score ranges, and enforces
ordered in-range beats, downbeats, sections, anchors, buildups, cues, and the
finale window. Invalid output is terminal HTTP 422 analyser work, not a
retryable transport failure.

The main CI workflow runs the analyser unit suite. A separate workflow runs the
real-audio regression when analyser or fixture files change, on a weekly
schedule, and when manually dispatched. This keeps unrelated pull requests
fast while still checking dependency and platform drift. The local
`evaluation-report.json` is ignored by Git; CI uploads that complete JSON
report for 14 days even when the regression step fails. To preserve an
existing local report, select another path:

```bash
python evaluate.py --report ../../.tmp_analyser/evaluation-report.json
```

For local timing investigation, without pass or fail thresholds:

```bash
python benchmark.py --repeat 2
```

## Manual route

`POST /api/analyse` remains an authenticated legacy wrapper for development and
repair. The product flow uses upload-scoped `song_analyses` and does not expose
this route as a user-facing button.

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
