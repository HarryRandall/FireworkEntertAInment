# Firework import worker

Python service for reconstructing catalogue fireworks from uploaded videos. It
performs bounded media analysis, requests structured candidates from OpenRouter,
and validates them against ShowCrafter's real renderer before publication.

The service can run as an authenticated Modal endpoint or as a local polling
worker. Database leases ensure that only one executor can complete a run.

## Requirements

- Python 3.11
- FFmpeg and ffprobe
- Playwright Chromium
- Supabase and OpenRouter credentials

Copy the relevant values from the root `.env.example`. The required service
credentials are:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
FIREWORK_IMPORT_RENDER_URL
FIREWORK_IMPORT_SHARED_SECRET
```

Never expose the service-role or OpenRouter credentials through the Modal
dispatch endpoint. The dispatch secret and worker secret remain separate.

## Local worker

From the repository root:

```bash
npm run worker:firework-import
```

The helper creates `services/firework-import-worker/.venv`, installs the Python
dependencies and matching Chromium revision, runs a browser smoke test, and
starts the polling worker.

To run it manually:

```bash
cd services/firework-import-worker
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python worker.py
```

## Modal

Create `showcrafter-firework-import-worker` and
`showcrafter-firework-import-dispatch` secrets with the values described in
`.env.example`, then verify the endpoint before deploying:

```bash
modal serve services/firework-import-worker/modal_app.py
modal deploy services/firework-import-worker/modal_app.py
```

Set `FIREWORK_IMPORT_URL` in the web deployment to the displayed API URL with
`/runs` appended.

## Tests

```bash
python -m unittest discover -s services/firework-import-worker/tests -p '*test*.py'
```

See [firework import validation](../../docs/firework-import-engine-validation.md)
for the reconstruction, renderer evidence, lease and publication contracts.
