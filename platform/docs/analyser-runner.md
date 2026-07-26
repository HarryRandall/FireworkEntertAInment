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
5. The server validates the response and completes the leased attempt through
   a guarded RPC. Analysis output and credit settlement commit together, then
   any cue generation waiting on this analysis resumes.

The client can continue through the wizard while analysis is queued or running.
Hidden background state is surfaced only when an error blocks generation.

## Deployment

The analyser image installs `platform/analyser/requirements.txt` and runs with
2 CPU cores, 4 GB memory, a 600-second timeout, and Modal memory snapshots.

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
authentication, schema, and invalid-output failures are terminal. A stale
worker cannot write after its lease expires because every completion, retry,
and failure RPC requires the current token.

The reconciliation route reclaims expired leases, fails exhausted attempts,
makes shows with terminal analyses claimable for cue generation, and repairs
terminal show credit reservations. These operations are bounded and
idempotent.

The analysis result currently uses schema `1.5.0`. Any schema change must
update the analyser models, TypeScript consumer, tests, and real-audio baseline
together.

Schema 1.5 adds `bar_grid_confidence` in the range 0-1. Meter estimation
combines beat accents, consistency across bars, section-boundary alignment, and
a conservative genre prior. Cue planners consume the analysed downbeats only
when confidence is at least 0.3; lower-confidence results retain the full beat
grid and fall back to conservative 4/4 bar spacing.

## Verification

Run unit tests and the four versioned real-audio regressions from
`platform/analyser`:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p "*test*.py"
python evaluate.py
```

`evaluate.py` verifies the fixture hashes and compares duration, tempo, beat
and downbeat grids, bar-grid confidence, section structure, climaxes, buildups,
and finale windows against `evals/baseline_v1.json`. It writes
`evaluation-report.json` and exits non-zero when a material regression is
detected. GitHub Actions uploads that report even when the evaluation fails.

For local timing investigation, without pass or fail thresholds:

```bash
python benchmark.py --repeat 2
```

### Open-licence fixture candidates

The Jamendo fixture importer searches tracks and records their source and
licence. Jamendo requires a client ID for every API call. For local use, add it
to the gitignored `platform/analyser/.env.local`:

```dotenv
JAMENDO_CLIENT_ID=your_read_client_id
```

Then search or import from `platform/analyser`:

```bash
python jamendo_fixture_importer.py search "cinematic instrumental" --limit 5
python jamendo_fixture_importer.py import TRACK_ID
```

Jamendo documents a public read-only testing ID, but that application currently
returns a suspended-application error. The importer therefore refuses to
pretend that a registration-free API path works and requires
`JAMENDO_CLIENT_ID`, `analyser/.env.local`, or `--client-id`. Only the public
client ID is needed. Do not store a Jamendo account password or API client
secret in the repository.

Imports require an explicit Jamendo download permission and default to CC0 or
CC BY tracks. For non-commercial research, NC, ND, SA, or unknown licences can
be imported only after manual review:

```bash
python jamendo_fixture_importer.py import TRACK_ID --allow-restricted-licence
```

The importer limits files to 50 MB, verifies MP3 content, hashes the result, and
records source, attribution, licence, and tags in
`evals/jamendo_fixtures.json`. New imports remain `candidate` fixtures. CI must
not call Jamendo directly, and a candidate's musical summary must be reviewed
before it is promoted into `evals/baseline_v1.json`.

The current baseline contains two pop tracks and two classical tracks, all
licensed CC BY 3.0. Attribution and source URLs live in both the baseline and
the Jamendo manifest so that the checked-in MP3 files remain auditable without
network access.

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
