# Firework import worker

Python service for reconstructing catalogue fireworks from uploaded videos. For
each run it:

1. measures the video on a fixed 256x192, 20 Hz clock: firing times from launch
   light and audio, then per-shot apex, radius, life, trail, strobe and colour
   (`decode.py`, `onsets.py`, `features.py`, `measure.py`);
2. asks an OpenRouter model to choose a renderer template, with optional
   overrides, for every measured shot (`interpret.py`);
3. fits launch height, launch time, radius, drag, star life and trail length with
   seeded CMA-ES, scoring each candidate headlessly against the measurements with
   `@showcrafter/renderer`'s CPU simulation (`fit.py`, `packages/video-fit`);
4. stores the fitted and unfitted candidates as renderer v1 designs for review.

No browser is involved. The service can run as an authenticated Modal endpoint or
as a local polling worker. Database leases ensure that only one executor can
complete a run.

## Requirements

- Python 3.11
- Node 24 and the repository's pnpm dependencies (for the renderer scorer)
- FFmpeg and ffprobe
- Supabase and OpenRouter credentials

Copy the relevant values from `apps/web/.env.example`. The required service
credentials are:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
FIREWORK_IMPORT_SHARED_SECRET
```

`FIREWORK_IMPORT_SHARED_SECRET` authenticates dispatch requests to the Modal
endpoint. Never expose the service-role or OpenRouter credentials through it.

Optional tuning: `IMPORT_FIT_SECONDS` (fitting wall clock, default 300),
`IMPORT_FIT_ITERATIONS` (CMA-ES generations per effect, default 30),
`IMPORT_MAX_MODEL_IMAGES` (keyframe crops sent to the model, default 24) and
`IMPORT_MODEL_MAX_CALLS` (model attempts per run, default 2).

## Local worker

From the repository root:

```bash
pnpm worker:firework-import
```

The helper creates `services/firework-import-worker/.venv`, installs the Python
dependencies and starts the polling worker. Run `pnpm install` first so the
renderer scorer can start.

## Modal

Create `showcrafter-firework-import-worker` with `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY`. Create
`showcrafter-firework-import-dispatch` with `FIREWORK_IMPORT_SHARED_SECRET`.
Install the Modal CLI separately and authenticate it as described in the
[handover account guide](../../docs/handover/accounts-and-access.md#modal), then
verify the endpoint before deploying:

```bash
modal serve services/firework-import-worker/modal_app.py
modal deploy services/firework-import-worker/modal_app.py
```

The image copies `packages/renderer`, `packages/video-fit` and the workspace
manifests, and installs them with pnpm. Set `FIREWORK_IMPORT_URL` in the web
deployment to the displayed API URL with `/runs` appended.

## Tests

```bash
pnpm install
python -m unittest discover -s services/firework-import-worker/tests -p '*test*.py'
```

`tests/fixtures` holds three synthetic clips rendered from the renderer's CPU
simulation; see its README.
