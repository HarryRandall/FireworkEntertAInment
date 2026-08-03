# Firework Import Worker

Container worker for `/admin/imports` firework-video jobs.

## Environment

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=ShowCrafter
FIREWORK_IMPORT_RENDER_URL=https://showcrafter.example/internal/import-render
FIREWORK_IMPORT_SHARED_SECRET=at-least-32-random-characters
POLL_SECONDS=8
IMPORT_VIDEO_SAMPLE_FPS=20
IMPORT_MAX_SAMPLED_FRAMES=1800
IMPORT_MAX_MODEL_IMAGES=24
IMPORT_RECONSTRUCTION_CANDIDATES=3
IMPORT_RECONSTRUCTION_PASSES=2
OPENROUTER_MAX_ATTEMPTS=4
OPENROUTER_RETRY_BASE_SECONDS=1
OPENROUTER_RETRY_MAX_SECONDS=12
IMPORT_RUN_LEASE_SECONDS=900
IMPORT_RUN_DEADLINE_SECONDS=3000
IMPORT_MODEL_MAX_CALLS=15
IMPORT_OPENROUTER_ATTEMPT_BUDGET=24
IMPORT_RPC_MAX_ATTEMPTS=3
IMPORT_RPC_RETRY_BASE_SECONDS=0.5
IMPORT_FFPROBE_TIMEOUT_SECONDS=30
IMPORT_NORMALISE_TIMEOUT_SECONDS=240
IMPORT_AUDIO_TIMEOUT_SECONDS=60
IMPORT_ENGINE_RENDER_TIMEOUT_SECONDS=300
IMPORT_ENGINE_SCORE_FRAMES=36
IMPORT_ENGINE_REVIEW_FRAMES=40
IMPORT_REVIEW_ENCODE_TIMEOUT_SECONDS=90
```

Candidate and pass counts are bounded in code. The default performs three
independent synthesis calls, a critic pass, two targeted refinements, and a
final critic selection. OpenRouter calls use strict JSON Schema output and
bounded retry/backoff for transient errors.

`FIREWORK_IMPORT_RENDER_URL` must be the deployed ShowCrafter
`/internal/import-render` HTTPS route. For local development only, loopback HTTP
can be enabled with `FIREWORK_IMPORT_ALLOW_INSECURE_LOCAL_RENDER=true`. That flag
never permits a non-loopback HTTP origin. The shared secret must match Vercel
and contain at least 32 characters.

## Run

```bash
docker build -t showcrafter-firework-import-worker workers/firework-import-worker
docker run --env-file .env.worker showcrafter-firework-import-worker
```

For local development without Docker:

```bash
cd workers/firework-import-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENROUTER_API_KEY=... python worker.py
```

From `platform/`, the same worker can be started with the helper script. It
creates `.venv`, installs Python dependencies there, and then starts the worker:

```bash
npm run worker:firework-import
```

The worker polls queued `firework_video` imports, validates videos are 60 seconds
or less, tracks launch and burst trajectories at timestamped frames, extracts
colour, fade, gravity and optional audio observations, and asks OpenRouter for
multiple structured reconstructions. Silent videos are valid input.

Every model candidate is converted to the canonical renderer design and run
through the protected browser harness using ShowCrafter's real
`FireworksEngine`. The critic receives those timing, trajectory, palette, fade
and perceptual metrics before refinement. Renderer-native tuning fields let a
refinement directly alter gravity, speed, lifetimes, drag, turbulence, star and
trail density, trail persistence, head size, and launch/head/trail colours.
Aerial lift timing is converted to engine velocity
with the renderer's fixed 60 Hz shell physics: the cue offset is the only
pre-roll control, and canonical lift is derived from observed burst onset minus
that quantised cue time. Conflicting model lift tuning cannot move the apex.
Shell life only keeps the carrier alive beyond apex; star and trail lifetimes
control the fade. Fully publishable candidates receive their own bounded final
review MP4 and immutable final engine evidence. Weaker alternatives remain
available for review and refinement, but cannot be published.

Metric sampling expands beyond `IMPORT_ENGINE_SCORE_FRAMES` when necessary to
retain every measured launch, burst and fade boundary, up to the harness's 180
frame limit. A source whose complete event evidence cannot fit is retained for
manual review but is blocked from publication. PNG and MP4 review evidence
remains independently bounded to 48 frames. Roman candle and fountain peaks
are aggregated only when the model identifies one continuous activation;
every separately modelled activation remains a distinct engine cue, including
same-geometry emitters at the same position.

The selected result stores both the legacy `spec` during the rollout and a
strict renderer-native reconstruction under `generated_spec.payload.reconstruction`.
Every output includes a run and stage marker. The queued-to-processing claim is
also fenced with a unique run token so an older worker cannot complete a newer
attempt.

Durable reconstruction runs snapshot the pipeline and engine schema versions,
the effective system prompt and hash, synthesis and critic models, sampling and
retry settings, strict schema hashes, the renderer and metrics contract versions,
and the Modal input identifier when Modal executes the run. These snapshots make
a result reproducible without allowing a later prompt, renderer deployment or
sampling environment change to rewrite its provenance.

Model and engine checkpoints are inherited only by bounded automatic lease
recovery attempts whose parent source, prompt, model, schema and sampling
context still match exactly. Manual Retry and refinement runs always start new
candidate evidence.

## Modal execution

`modal_app.py` exposes an authenticated asynchronous queue endpoint while
`worker.py` remains the local polling fallback. Create a Modal secret named
`showcrafter-firework-import-worker` containing:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
FIREWORK_IMPORT_RENDER_URL
OPENROUTER_SITE_URL          # optional
OPENROUTER_APP_NAME          # optional
```

Create a separate `showcrafter-firework-import-dispatch` secret containing only
`FIREWORK_IMPORT_SHARED_SECRET`. The lightweight API receives only that dispatch
secret, while reconstruction containers receive both secrets so they can sign
protected engine-validation requests without exposing Supabase or OpenRouter
credentials to the web endpoint.

The Modal and Docker images install Playwright Chromium and run a headless
launch smoke test while building. The local `run-worker.sh` helper installs the
matching Chromium revision and verifies it before the worker polls or claims a
run. Required render environment is validated before a durable run acquires a
database lease.

Install the current Modal 1.x CLI, authenticate it, then test an ephemeral app:

```bash
python -m pip install 'modal>=1,<2'
modal serve workers/firework-import-worker/modal_app.py
```

Set `FIREWORK_IMPORT_URL` in the platform to the displayed `api` URL with the
`/runs` path appended, for example
`https://workspace--showcrafter-firework-import-api.modal.run/runs`. The server
posts the durable reconstruction run ID, not the mutable import job ID.

Submit a queued reconstruction run directly with the same contract:

```bash
curl -X POST "$FIREWORK_IMPORT_URL" \
  -H "Authorization: Bearer $FIREWORK_IMPORT_SHARED_SECRET" \
  -H 'Content-Type: application/json' \
  --data '{"runId":"00000000-0000-0000-0000-000000000000"}'
```

The response contains a `callId`. Poll the `api` base URL at
`GET /calls/{callId}` with the same authorisation header. A queued run can be
claimed by direct Modal dispatch, an explicitly invoked Modal queue sweep, or
the local poller, but the SQL lease permits only one executor. Modal does not
poll automatically: the reconstruction container starts when the platform
dispatches a run and scales down when the work finishes.

If an operator needs to recover a queued run after direct dispatch was
interrupted, invoke `sweep_queued_runs` explicitly from the Modal dashboard or
run:

```bash
modal run workers/firework-import-worker/modal_app.py::sweep_queued_runs
```

Deploy only after the secret and ephemeral endpoint have been verified:

```bash
modal deploy workers/firework-import-worker/modal_app.py
```

## Tests

```bash
cd workers/firework-import-worker
python -m unittest discover -s tests -p 'test_*.py'
```
