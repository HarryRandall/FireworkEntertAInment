# Development

Use Node 24 and the pinned pnpm version from the repository root:

```bash
eval "$(fnm env)" && fnm use 24
corepack enable
pnpm install --frozen-lockfile
```

## Local services

Supabase is local-only until switch-over. Start a clean local environment with:

```bash
pnpm db:setup
pnpm db:test
pnpm dev
```

Keep secrets in ignored local environment files. Do not link a hosted project or
apply a schema change outside the eventual switch-over runbook.

The shared Python queue runtime is in `services/worker-common`; the Modal
registration layout is in `services/workers/modal_app.py`. Feature services supply
handlers rather than creating separate leases or callbacks. A web check does not
deploy a worker, change hosted Supabase or verify production.

## Checks

Run focused behaviour or SQL tests while changing code, then run:

```bash
pnpm check
```

From the database foundations stage onwards, also run `pnpm db:reset && pnpm db:test`
against local Supabase. For UI work, inspect the requested desktop and narrow layouts
in light and dark themes and attach the screenshots to the PR.

## Renderer review

`http://localhost:3000/dev/fireworks` needs no local Supabase. It shows all built-in
templates and three simulation fixtures as progressive posters produced by one shared,
detached WebGL context. Selecting a card plays it in the independent live context.
After `pnpm db:setup` and `pnpm db:env`, choose a template and use
"Load selected template from database" to render its published stored version.
Fixtures are not database templates. Configuration, missing-row and validation
failures appear beside the loader.
Readiness does not wait for the poster catalogue; PNG work yields to pending live draws. The comparison link opens
`http://localhost:8765/fireworks.html` in a separate tab so the owner can arrange the
two pages alongside each other. The prototype must already be served from the
read-only reference checkout.

The view uses three.js 0.184.0 and a single output target and pass. Add `?ldr` to the
review URL to exercise its 8-bit fallback. Poster cameras frame shell bursts tightly and retain the climb for other kinds. Each
poster samples its own developed moment. The live audience camera and transport stay
independent from thumbnail rendering.

Install the test browser once with `pnpm exec playwright install chromium`.
`pnpm test:browser` runs Chromium journeys, accessibility checks, exact seek replay
and representative template screenshots at desktop and 390 px widths in both
colour schemes. It is included in `pnpm check`. Screenshots stay in ignored
`output/playwright/`; they are review evidence, not approved visual baselines.
Software GL measurements do not establish performance on a real device. The owner
must review visual parity against the prototype before delivery is called verified.

## Spray parity and frame-time comparison

The live view defaults to GPU sprays. Source-clock slots, birth positions, birth opacity
and inherited source velocity remain on the CPU. The vertex shader computes spark
motion, forks, glitter, cooling and streaks. The DOM-free CPU kernel remains the
reference. Both kernels use the same named tuning values and hash stream selectors;
the direction lookup retains the prototype's Float32 quantisation. Integer hash inputs
are uploaded as two exact 16-bit limbs so large seeds cannot round or become NaNs.

`tests/browser/spray-parity.spec.ts` reads the live shader with WebGL2 transform
feedback and compares position, colour, size and alpha with the CPU at fixed times.
The test states Float32/GLSL precision tolerances and covers directed gerbs, glitter,
forks, inherited velocity, streak bounds, large seeds and direct-seek replay.
Each fixed instant samples at most 128 evenly spaced source sparks, retaining all
candidate fork/streak rows for each selected spark. Two source passes count and then
sample the deterministic birth stream. Explicit modifier cases retain every synthetic
birth and boundary age. All populated Float32 texture rows and candidate pairs are
encoded once per case; the shader is compiled once and each instant is replayed on
that context. One comparison pass reports the worst lane using the unchanged
precision tolerances. No float render target is required for this parity harness.

Time the same CPU builder, packing, payload encoding and comparison without Chromium:
`node --import ./scripts/register-typescript.mjs --test packages/fireworks/tests/spray-parity-harness.test.mjs`.
The logged simulation duration includes CPU expectation evaluation and birth packing;
their separate durations are subsets. Node timings exclude page transfer, shader
compilation and software GL, which the composer must verify in the browser gate.

Run `corepack pnpm test:browser` to typecheck and execute it, or
`corepack pnpm exec tsc -p tests/browser/tsconfig.json` to typecheck without launching
Chromium. Full `pnpm check` includes the browser execution and needs Chromium.

On your own machine, open `/dev/fireworks`, select **Run 40-shot finale**, and compare
**CPU sprays** with **GPU sprays**. Restart each path from time zero using the same
viewport, browser, build and foreground visibility. Record median and 95th-percentile
frame intervals during the dense finale and note your device, build mode and viewport.
Repeat each run to distinguish persistent lag from first-use shader compilation.
The rolling readout covers the last 120 visible playing frames, uses a nearest-rank
95th percentile and resets when the scene or path changes. Pause and off-screen gaps
are excluded. The separate smoothed CPU build/submission duration does not measure
GPU completion; frame intervals include browser scheduling and display cadence.
Candidate counts include invisible GPU rows and are not a CPU/GPU visual count comparison.
Browser automation throttles animation frames, so its timings do not prove an improvement
on the owner's machine. Attach desktop and 390 px screenshots in both themes alongside
the prototype, and obtain owner visual review before accepting renderer parity.

## Agent tooling

Project skills are maintained once under `.agents/skills`. Claude uses relative links
from `.claude/skills`; the composer creates and verifies those links because agent
configuration is protected from workspace edits.

The project `.mcp.json` pins the Playwright MCP used for local visual reviews. It runs
an isolated Chromium profile, accepts only the local app and prototype origins, and
writes temporary output outside the repository. These settings reduce accidental
cross-project access but are not a security boundary. Use synthetic local data and
keep production sessions out of the profile.

The adjacent `supabase-local` entry uses the CLI-provided HTTP MCP endpoint at
`http://127.0.0.1:55421/mcp?read_only=true&features=database`. The server version
follows the pinned Supabase CLI (`2.101.0`) and its local image. No hosted project,
access token or cloud MCP endpoint is configured. See the
[official MCP configuration](https://supabase.com/docs/guides/ai-tools/mcp).

The composer starts local Supabase, confirms `pnpm db:status` identifies this project's
API on port 55421, and verifies the MCP connection before inspection. Check the tool
list and a read-only identity query (`select current_database(), current_user,
current_setting('transaction_read_only')`). Confirm the server honours read-only
mode and does not expose migration writes before using it. MCP connectivity and
read-only enforcement have not yet been verified here. If the pinned local server
cannot enforce this setting, leave the connection unused and report it; use the local
CLI for inspection. Schema changes always go through SQL files and the migration
workflow. MCP inspection is elevated local evidence and does not establish RLS
correctness for an API persona.

Read documentation shipped with installed packages first. Use matching official docs
when installed docs are absent, and Context7 only for an unresolved version-specific
library question. Never send credentials, personal data or private source in a
documentation query.

| Tool           | Pinned source                              | Licence    | Purpose                                    |
| -------------- | ------------------------------------------ | ---------- | ------------------------------------------ |
| Playwright MCP | `@playwright/mcp@0.0.83`                   | Apache-2.0 | Local screenshots and browser interactions |
| Supabase MCP   | Supabase CLI `2.101.0` local HTTP endpoint | Apache-2.0 | Local read-only database inspection        |

## Readability lint

Each handwritten TypeScript workspace composes the shared policy in
`scripts/eslint/readability.mjs`. The policy includes type-checked TypeScript rules,
TSDoc syntax, complexity and size limits, numeric-literal checks, selected SonarJS
checks and local rules for export documentation and lint exceptions.

All handwritten TypeScript packages pass these rules without a lint baseline.
Registry primitives are exempt only from export purpose comments so they can stay
close to upstream. Allocation-sensitive numeric kernels retain narrow, explained
parameter-count exceptions; size, complexity and numeric checks still apply.

## Browser posters

Import `poster`, `posterAll`, `developedTime` and `disposePosters` from
`@showcrafter/fireworks/poster` (also re-exported from `/view`).
`await poster(canvas, design, options)` copies a PNG into a 2D canvas and returns its
Blob for uploading. Pass `null` as the canvas to request only the Blob. The stored v1
design must already be validated. Options include sequence `shots`, sequence time `t`
in seconds, `prop`, positive CSS-pixel `width`/`height`, `forceLdr` and a world-metre
`framing: { position, target }` override. Default time is the first shot's firing time
plus its developed moment. The design's stored seed is used unless a shot overrides it.

`await posterAll(root, options)` fills `canvas[data-poster]` elements whose attribute
names a built-in template, in DOM order. Unknown keys and encoding failures reject.
The public API serialises captures and waits for PNG encoding before reusing its one
detached renderer. Size changes affect only this surface. Call `await disposePosters()`
when finished to release the context after queued encoders; the next capture allocates
lazily. The review page owns and revokes its progressive blob URLs on teardown.

Snapshot generation, perceptual tolerances and approval instructions are in
[the poster snapshot guide](../packages/fireworks/tests/snapshots/README.md).
The browser tests are part of `pnpm check`; the full catalogue also has a nightly
workflow. Browser execution and approved baseline images are required before this gate
can pass. Typechecking alone does not verify pixels, readiness time or device performance.

## Seeded local accounts

`pnpm db:setup` resets and seeds the local database. Run `pnpm db:env` once to
create the web app's local environment file; it refuses to replace an existing file.
These synthetic accounts are provisioned only by the local reset workflow. Never
apply the persona seed to a hosted database or reuse its password elsewhere.

All email accounts use the password `LocalShowcrafter123!`:

| Email                          | Persona                  | Access                                                            |
| ------------------------------ | ------------------------ | ----------------------------------------------------------------- |
| `admin@showcrafter.test`       | Platform super admin     | All local tenants; MFA requirement disabled for the local fixture |
| `owner@showcrafter.test`       | Hartley owner            | Leeds and York                                                    |
| `manager@showcrafter.test`     | Hartley manager          | Leeds only                                                        |
| `supplier@showcrafter.test`    | Supplier owner           | Demo Fireworks Supplier                                           |
| `other-owner@showcrafter.test` | Other organisation owner | Other Demo Store                                                  |
| `shopper@showcrafter.test`     | Signed-in shopper        | Own profile; no retailer membership                               |

An anonymous shopper profile is also seeded without an email or password. The
actual shopper flow uses Supabase anonymous sign-in to establish a session.
Use Auth directly for now; the application sign-in screens are not included here.

Demo QR slugs are `hartley-leeds` (store), `hartley-york` (planner),
`hartley-family` (show) and `hartley-garden` (collection). The demo has four
published products, movement-derived stock at both Hartley stores, two live shows,
a manual collection and 340 opening credits. Example legal and safety rules are
unchecked test data, never confirmed legal or supplier advice.

Refresh generated assets with `pnpm db:seeds`, `pnpm db:validators` and
`pnpm db:types`. Each supports `--check`; types compare against the local schema.
The database CI job checks all three after a fresh reset. Design Zod remains
owned and generated by the renderer package's `generate:schema` command.

## Shared Python workers

Install the shared runtime and its pinned check/Modal dependencies in an ignored
virtualenv inside this worktree. CI uses Python 3.11.15; the runtime supports Python
3.11 and newer. From the repository root:

```bash
python3 -m venv services/worker-common/.venv
services/worker-common/.venv/bin/python -m pip install -r services/worker-common/requirements.txt -r services/workers/requirements.txt -e services/worker-common
pnpm test:workers
pnpm db:setup
pnpm test:workers:local
```

`test:workers` runs Ruff lint/format and Python behaviour tests, including offline
registration against the pinned Modal SDK. It is included in `pnpm check`.
`test:workers:local` obtains credentials internally from local Supabase status,
refuses any API other than `http://127.0.0.1:55421`, inserts uniquely identified
`worker_smoke_test` jobs, runs a separate Python CLI process, checks the stored
results and deletes only its own jobs. Run it without another diagnostic worker
claiming that kind. CI runs it in the existing database job after reset and pgTAP.
It checks completion, heartbeat extension, stale/expired attempts, backoff,
exhaustion, cost and duration. SQL tests also execute every installed cron command
against the seeded catalogue and verify expiry, UTC rollups and idempotent reruns.
They roll back all test mutations. This is direct invocation evidence, not proof of
cron firing on its wall-clock schedule.

For a manually queued local diagnostic job, set `SUPABASE_URL` to the exact local
API and `SUPABASE_SERVICE_ROLE_KEY` to its local service-role key in an ignored
environment file or private shell environment, then run:

```bash
services/worker-common/.venv/bin/python -m showcrafter_workers --max-jobs 1
```

This CLI accepts only the diagnostic kind and local target. The diagnostic payload
is `{ "message": "local diagnostic" }`; its result echoes that message. An empty
queue exits immediately. The diagnostic handler is never registered on Modal.
Feature services can run locally using `JobClient(Settings.from_environment(local_only=True))`
and `drain(client, handlers, worker_identity)` with their own registered handlers.

### Queue and handler contract

The database owns the five-minute lease, attempt counter, retry budget and backoff.
The client uses `claim_job`, `renew_job_lease`, `complete_job` and `fail_job`, carrying
`id`, `worker` and `attempt` on every lease mutation. Renewal checks ownership before
the handler begins and every 60 seconds while it runs. Requests have a 20-second
transport deadline; redirects and automatic mutation retries are disabled. A lease
or transport failure stays visible, stops terminal writes and aborts the drain.
There is no ambiguous-error fallback to an empty queue. A failed completion is not
followed by a failure mutation because completion may already have committed.

Handlers receive `(job, usage)` and return a JSON object. They must validate their
feature payload, make any result writes idempotent and respect attempt ownership.
A heartbeat thread cannot forcibly interrupt a synchronous handler: avoid external
side effects after lost ownership and fence feature writes where needed. Handler
exceptions are recorded by class only, because messages may contain credentials,
URLs or user data. Structured stdout logs contain UTC time and queue identity,
never payloads, result documents, service keys or exception messages.

Set `usage.provider_usd` to actual provider spend as calls occur, including spend
before failure. Set `usage.compute_usd` only when a measured infrastructure charge
is available. `jobs.cost` stores `provider_usd`, `compute_usd`, `duration_seconds`
and `scope: "attempt"` through the terminal RPC. Duration is monotonic elapsed
seconds from invocation start, including renewal and handler failure; it excludes
the terminal RPC itself. Provider spend defaults to zero when no calls occur;
unknown compute cost is null, never a guessed tariff. The existing SQL RPC replaces
cost on each finish, so this is the latest finished attempt, not cumulative billing.
Abrupt process death, lease loss or an uncertain terminal request cannot reliably
record a final cost. Reconciliation of actual Modal charges is not implemented.

### Modal layout and wake hook

`create_worker_app(name, handlers, image=...)` returns an SDK app with two functions:
`drain_jobs` and a POST `wake` endpoint. Feature services supply an allowlisted
handler map such as `music_analyse` or `video_analyse`, add their source modules and
pinned dependencies to the supplied image, and expose the returned app from their
own module. The shared package is added to the image automatically. The default is
a Python 3.11 Debian image. No feature handlers are registered by this layout alone.
The music analyser registers its `music_analyse` handler through this layout.
Local changes do not replace the live deployment.

The wake endpoint requires Modal proxy authentication and accepts no job kinds,
payloads or Supabase credentials. It asynchronously spawns a drain and returns its
`call_id`; acknowledgement does not imply job completion. Only the drain receives
the Modal secret named `showcrafter-workers`:

| Setting                     | Location                    | Purpose                                         |
| --------------------------- | --------------------------- | ----------------------------------------------- |
| `SUPABASE_URL`              | Worker Modal secret         | Trusted backend database API origin             |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker Modal secret         | Server-only queue RPC and feature result access |
| `Modal-Key`, `Modal-Secret` | Trusted enqueue dispatcher  | Modal proxy-auth token headers for POST `wake`  |
| Feature provider keys       | Feature-owned Modal secrets | Only keys the registered handlers require       |

Choose **enqueue-triggered authenticated HTTP wakes**, rather than a continuously
polling container. Both functions have zero minimum/buffer containers and a
2-second idle scale-down window. Drains process at most ten attempts with two
concurrent containers and a 1,800-second invocation timeout. These are bounded
operational defaults, not measured capacity or cost guarantees. SQL fencing still
protects overlapping wake calls. Modal function retries are disabled for drains;
job retry state remains solely in Postgres.

The application enqueue integration is a documented hook, not installed here:
a trusted server-side dispatcher must POST to the relevant endpoint after the
queue transaction commits, retain/retry unsuccessful wake delivery, issue enough
wakes for queues larger than a batch, and arrange another wake at `run_after` for
delayed/failed jobs or at lease expiry after a crash. It must not keep an idle
container alive. The endpoint is ready for that dispatcher; no app enqueue code,
`pg_net` trigger, outbox or periodic Modal reconcile schedule is added. Until that
hook exists, use explicit local drains. SQL cron rollups and cleanups remain on
`pg_cron` and do not depend on Modal.

No Modal app, secret or proxy token is created by import, tests or local acceptance.
Deployment, live proxy-auth behaviour, container scale-to-zero, provider/compute
billing and the complete app-to-worker loop require separate owner-run verification.
During the rebuild use local Supabase only; do not configure a hosted secret or
deploy this layout.

## Shared music analysis

The music worker claims `music_analyse` jobs using the shared runtime and writes
results to Supabase directly. There are no per-user leases, warmth controls,
callbacks, queued dispatch endpoint or Modal reconciliation schedule. Run it
locally without Modal:

```bash
python3 -m venv services/music-analyser/.venv
services/music-analyser/.venv/bin/python -m pip install -r services/music-analyser/requirements.txt -r services/workers/requirements.txt -r services/worker-common/requirements.txt -e services/worker-common
pnpm test:analyser
pnpm test:analyser:contract
pnpm test:analyser:local
```

The local integration command gets credentials internally from local Supabase
status. It inserts a uniquely identified Jamendo track and queue jobs, substitutes
the committed CC0 click fixture for the provider download, runs the default CPU neural tracker and
Storage API writes, verifies stored bytes/features and repeat-job reuse, and
cleans up only its own rows and object. It also checks failed jobs, rejected result writes after completion, and REST
denial for public callers and signed-in shoppers. No test contacts Jamendo or downloads real audio.
CI runs this command in the database job. Local Python supports 3.11 or newer;
CI and the Modal image use Python 3.11. Dependency pins shared with the Modal
layout agree so the combined install does not replace Pydantic with another pin.

The enqueue payload is exactly:

```json
{ "track_id": "<shared music_tracks UUID>", "audio_url": "<Jamendo HTTPS audio URL>" }
```

The backend must first create or reuse a `music_tracks` row by
`(provider, provider_track_id)`, with `provider = 'jamendo'` and a positive provider
metadata duration. Shopper identities and preferences do not belong in this job.
The worker uses the balanced analyser output for everyone. A unique active-job
index on the UUID in the payload permits only one queued, running or failed job
per track. On an enqueue uniqueness conflict, read and reuse that active job;
do not change its lease. Completed/dead jobs do not prevent an intentional new
request. A current `beat-this-1.1.0-fold0` result with installed audio and waveform peaks
is reused without a download or second analysis. A crashed attempt before result
installation can recompute; a retry after installation reuses the durable result.

Downloads require an explicit comma-separated `ANALYSER_ALLOWED_AUDIO_HOSTS`
allowlist, HTTPS on port 443, no URL credentials and same-host redirects. Configure
the exact trusted Jamendo hosts supplied by the backend integration; no wildcard
Supabase host allowance remains. Tests allow their synthetic hosts explicitly.
The existing 50 MiB and 30-second download bounds remain. Audio is stored privately
at `audio/<track UUID>/<audio SHA-256>`, with MIME derived from decoded container
format. Track waveform data is up to 256 normalised absolute-amplitude peaks.
Analysis clocks stay in seconds; database duration is rounded to milliseconds.

`install_music_result` locks and checks the music job's current worker, attempt
and unexpired lease, then atomically installs media metadata, the immutable
analysis/current pointer and duration, BPM and waveform. Storage upload is outside
that transaction. Failed or interrupted attempts can leave an unreferenced
content-addressed object; automatic orphan cleanup is not installed. Repeated
uploads use the same object path. The shared `complete_job`/`fail_job` path records
attempt duration and provider spend (zero for this offline algorithm), with null
compute cost until actual infrastructure billing is available. Database read,
result-write and storage failures stay visible and are not interpreted as cache
misses. Existing pinned show analyses are preserved.

### Music contract

The producer Pydantic model owns the analysis structure. To refresh the planner's
checked-in JSON Schema and generated Zod validator after an intentional change:

```bash
services/music-analyser/.venv/bin/python services/music-analyser/export_schema.py > packages/planner/schema/music-analysis.v1.json
pnpm exec prettier --write packages/planner/schema/music-analysis.v1.json
pnpm --filter @showcrafter/planner generate:music-schema
```

Python tests compare the checked-in JSON Schema with the producer. Planner checks
verify generated Zod output and test the same fixture/mutations. The dedicated
cross-language CI job sends both the shared fixture and actual synthetic-audio
producer output through the public `musicAnalysisSchema`, including timeline,
section, anchor and bar-grid invariants beyond JSON Schema's structural checks.
These checks are included in `pnpm check`; the local acceptance command requires
a separately running local database.

### Music Modal layout and app hook

`services/music-analyser/modal_app.py` exposes `showcrafter-music`, a finite drain
and a proxy-authenticated wake endpoint, using the shared scale-to-zero defaults.
The image installs pinned analyser/worker dependencies, FFmpeg and libsndfile,
and packages the analyser and handler sources. The `showcrafter-workers` secret
must contain the backend Supabase settings above and
`ANALYSER_ALLOWED_AUDIO_HOSTS`. No Jamendo API search key is required by the worker;
the backend supplies the already selected audio URL. Retire the old callback,
analyser-auth and warmth secrets only when the owner replaces the live deployment.
No Modal deploy, secret creation or hosted connection is part of local setup.

The app hook for PR 6.5 remains documented because that app is not built in this
lane: enqueue or reuse the track's job, wake after the queue transaction commits,
read `jobs` status and `music_analyses` by shared track, validate with the planner's
music schema, then re-solve with its beat/downbeat clock and pin the selected
analysis UUID when saving a show. Wake delivery and delayed retry/crash recovery
need the trusted dispatcher described above. The complete shopper loop, planner
re-solving, actual Jamendo delivery, live Modal proxy authentication, scale-to-zero
and actual Modal cost are not verified by these local tests. The neural tracker and its independent evaluation are described below.

### Local database permission-call limitation

The local PostgreSQL image terminated with signal 11 when a revoked
`install_music_result` RPC was called directly as `anon`, both inside pgTAP's
`throws_ok` and through plain `psql`. Changing the public wrapper from SQL to
PL/pgSQL did not resolve that image behaviour. The server recovered automatically.
The suite therefore checks the actual function grants in SQL and denial through
the REST API for public and signed-in shoppers, while retaining SQL
behaviour checks for valid workers, stale/expired attempts and atomic rollback.
Direct SQL permission-error behaviour remains unverified beyond this observed
crash. No grant was widened, no check threshold was lowered, and the local image
was not replaced. Hosted behaviour has not been tested.

### Neural beat tracker and evaluation

The default is Beat This! 1.1.0, checkpoint `fold0`, on CPU with two Torch threads
and minimal postprocessing, behind the unchanged music analysis schema 1.4.0.
Database algorithm identity is `beat-this-1.1.0-fold0`; historical librosa results
remain immutable. Missing/corrupt weights or a mismatched package fail visibly,
without quietly returning librosa under a neural algorithm name. Unsupported or
missing bar evidence retains the beat clock and omits uncertain downbeats.

Install the updated pinned requirements and verified weights before running the
worker locally:

```bash
services/music-analyser/.venv/bin/python -m pip install -r services/music-analyser/requirements.txt -r services/workers/requirements.txt -e services/worker-common
services/music-analyser/.venv/bin/python services/music-analyser/download_model.py
pnpm test:analyser
pnpm test:analyser:contract
pnpm test:analyser:local
SHOWCRAFTER_TEST_LOCAL_DATABASE=1 services/music-analyser/.venv/bin/python -m unittest discover -s services/music-analyser/tests -p test_requeue.py
```

Linux pins the CPU-only Torch/torchaudio wheels; macOS uses the matching release.
The model download verifies SHA-256 before installation and inference verifies it
again before loading. `BEAT_THIS_CHECKPOINT` may point to a different local path,
but its bytes must still match the pinned model. No provider key is needed.
The Modal image installs the same requirements and downloads verified weights at
image build time into `/root/.cache/fold0.ckpt`, rather than on each invocation.
The existing `showcrafter-workers` Supabase/audio-host secret and authenticated
wake hook remain unchanged. No Modal image has been built or deployed here.

See [the evaluation guide](../services/music-analyser/evals/README.md) and
[per-track CPU report](../services/music-analyser/evals/report-local-cpu.json).
The default switch passed the independent-label beat/downbeat and strict-tempo
gate. This evidence is local macOS CPU, not Modal CPU/GPU runtime, cold starts,
scale-to-zero or compute billing. GPU evaluation is not needed for these short
local recordings; long/full-band tracks and Modal capacity remain unverified.

### Local saved-show music requeue

The local-only administrative script takes a JSON array of selected track UUIDs
and fresh trusted Jamendo audio URLs. Provider URLs are not retained in music
analysis rows, so the owner supplies them from trusted track metadata. Example:

```json
[{ "track_id": "<music track UUID>", "audio_url": "https://<allowlisted Jamendo host>/<audio>" }]
```

With `ANALYSER_ALLOWED_AUDIO_HOSTS` set to those exact hosts:

```bash
services/music-analyser/.venv/bin/python services/music-analyser/requeue_saved_music.py /private/tmp/selected-tracks.json
services/music-analyser/.venv/bin/python services/music-analyser/requeue_saved_music.py /private/tmp/selected-tracks.json --apply
```

The first command rolls its transaction back. `--apply` commits against the fixed
local PostgreSQL address on port 55422 only; there is no hosted target option.
Only selected Jamendo tracks referenced by saved show versions are eligible.
Tracks already current under the selected neural algorithm and tracks with active
jobs are skipped. Inserted jobs and removal of their old current pointers happen
atomically. Existing saved versions keep their analysis UUID and feature bytes.
If an upgrade job fails, that track has no current analysis until a successful
retry installs one; its saved snapshots still have the old pinned features.

A selected-but-not-queued count can include missing, non-Jamendo, unused, upgraded
or active tracks; inspect those selected UUIDs before assuming all were upgraded.
The script queues work only, without draining jobs or posting a Modal wake. Use an
explicit local drain for acceptance. The tested transaction uses rollback fixtures,
checks repeat-run idempotence, active-job protection, unused/current exclusions and
pin preservation. No saved-show batch has been applied outside those fixtures.
The later app hook still needs to enqueue/wake, read the selected result, re-solve
and pin its UUID; it has not been built in this lane.

## Video measurement worker

`services/video-importer` measures supplier MP4s deterministically using the shared
job runtime. It calls no model. Install the pinned Python dependencies in an ignored
worktree virtualenv, plus the documented system dependency **FFmpeg and ffprobe
with libx264 support** (FFmpeg 6 or newer). Local evidence used FFmpeg 8.1.1.
FFmpeg is not pinned by Python; the Modal image installs Debian's `ffmpeg` package,
and CI installs Ubuntu's package. Cross-version codec reproducibility is not claimed.
CI and the Modal layout use Python 3.11; local acceptance also works on Python 3.14.

```bash
python3 -m venv services/video-importer/.venv
services/video-importer/.venv/bin/python -m pip install -r services/video-importer/requirements.txt -r services/workers/requirements.txt -e services/worker-common
pnpm test:video
pnpm test:video:local
services/video-importer/.venv/bin/python services/video-importer/evaluate.py /private/tmp/video-evaluation.json
```

`test:video` runs Ruff lint/format, synthetic truth checks, exact repeatability,
input/integrity failures, queue-handler behaviour and offline Modal registration.
It is included in the root check. `test:video:local` uses local Supabase status
credentials internally, uploads synthetic video to private Storage, claims jobs,
measures, retrieves all crops, checks retry reuse and failure/cost records, and
removes only its own UUID-scoped rows and objects. The database CI job runs both.
The SQL suite covers backend-only access, duplicate active jobs, wrong worker,
stale/expired attempt, media identity, atomic evidence installation and retries.

For a standalone MP4 without a database:

```bash
services/video-importer/.venv/bin/python services/video-importer/measure.py /private/tmp/source.mp4 /private/tmp/video-evidence --shot-count 12
```

For a local queue drain, pass backend credentials through the same environment
mechanism documented for the shared runtime, then run:

```bash
services/video-importer/.venv/bin/python services/video-importer/video_jobs.py --max-jobs 1
```

The CLI refuses every endpoint except `http://127.0.0.1:55421`. It exits as soon as
the queue is empty. SQL owns claim, heartbeat, completion, retry backoff and exhaustion.
Every completed/failed attempt records real duration, zero provider spend and
`compute_usd: null` rather than an invented Modal charge.

### Video enqueue and interpretation hooks

A trusted enqueue caller creates a `video_analyses` row with the source `media_id`,
`extractor: 'video-measure-1.0.0'`, `status: 'queued'` and supplier `priors`. Numeric
priors are `shot_count` (positive integer, up to 200) and `duration_ms` (positive
integer); effect-name metadata may also remain in priors but is not interpreted.
Then enqueue a `video_analyse` job with exactly:

```json
{
  "analysis_id": "<existing video_analyses UUID>",
  "media_id": "<the same source media UUID>"
}
```

Create the row and job together in the eventual trusted enqueue transaction.
There is no browser enqueue route in this lane. The source media must identify a
private `imports` or `catalogue-media` MP4 object with matching byte size and SHA-256.
The handler reads only the configured Storage origin; it does not download arbitrary
supplier URLs. Uploading from a supplier URL belongs to that enqueue/upload caller.

`save_video_measurement` checks and locks the exact job/worker/attempt lease and its
matching analysis/media identity. State moves from queued to measuring, then to
interpreting only after all crops have been stored and each shot has features and
keyframes. Retries may restart a failed/measuring analysis. Installed evidence is
reused by the same extractor, including when queue completion fails afterwards;
measurement never rewrites an interpreting, fitting or ready result. Different
extractors need an explicit new analysis row. Failures retain a safe exception class
on the analysis and use `fail_job` through the shared runtime. A hard process kill
may leave status measuring until the reclaimed job retries.

The measurement job finishes at interpreting and returns `next: 'interpretation'`.
There is no automatic interpretation enqueue, model call, fitting or design
candidate creation here. The interpretation consumer must explicitly select these
rows and use their source video, priors, shots, features and imports keyframes.

Storage and Postgres cannot share a transaction. Content-addressed crop keys under
`video/<analysis UUID>/` make reuploads idempotent. A failure between upload and
installation can leave an unreferenced crop; automated orphan cleanup is not added.

### Measurement units and limits

All times are integer milliseconds from video presentation start. Decode uses 20 Hz,
256 x 192 letterboxed RGB with square pixels and mono 8 kHz audio. It preserves
source aspect ratio and excludes letterbox bars from geometry. Videos with rotation,
non-square pixels or mismatched audio/video stream presentation starts are rejected.
Input is capped at 64 MiB, two minutes and 3840 x 2160 source pixels, with subprocess
and transfer deadlines. Frames are disk-backed rather than retained twice in RAM.
FFmpeg receives local files only with a file-protocol whitelist.

Shot x is the first visible centroid divided by content width. Angle is early
projected flight degrees right of vertical, or null when ascent cannot be measured.
Audio onsets strengthen brightness rises; brightness times are backtracked to first
visible launch frames to avoid treating the brightest climb as firing. A supplier
shot-count prior ranks observed candidates and fails if evidence is insufficient;
a duration prior rejects disagreement above 20% of decoded duration. Priors do not
invent missing shots. Confidence is a weighted evidence score, not a probability.

Per-shot features include dominant chromatic sRGB swatches, absolute-time colour
samples, apex ratio (height above bottom/content height), radius ratio (half luminous
width/content width), observed life in ms, trail presence/length, crackle and strobe
proxies, content raster bounds and the content box. Launch/peak/fade PNGs share one
padded crop envelope, with absolute video times and `bucket: 'imports'` paths.
Peak is the widest observed luminous frame, not an inferred physical burst time.

The camera must be static with the ground in the lower part of the image. Each
shot's observation window ends at the next firing; a still-visible final frame is
marked `truncated`. Overlapping effects are not independently tracked, simultaneous
tubes closer than 300 ms cannot be separated, and projected ratios are not physical
metres. Trail shape, high-frequency crackle energy and brightness flicker are
heuristics. Silence produces a null crackle indicator. Model classification belongs
to the interpretation consumer, which must not treat these flags as verified labels.

See the [synthetic evidence guide](../services/video-importer/tests/fixtures/README.md)
and [local accuracy report](../services/video-importer/tests/fixtures/evaluation-local.json).
The set verifies shot times, positions and colours against known renderer inputs;
it does not establish real supplier-video accuracy or crowd/overlap handling.

### Video Modal layout

`services/video-importer/modal_app.py` registers `showcrafter-video` through the same
finite-drain and proxy-authenticated wake layout as the music worker, with
`video_analyse` as its only handler. It needs only the existing `showcrafter-workers`
secret containing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; no model/provider
key is used. Trusted enqueue dispatchers use the existing `Modal-Key` and
`Modal-Secret` headers to POST the wake hook. No periodic poller or warm container is
added. App enqueue and wake dispatch are absent in this lane and remain explicit
integration hooks. No Modal image build, deployment, secret creation, hosted
Supabase access, live wake verification or actual compute billing was performed.
