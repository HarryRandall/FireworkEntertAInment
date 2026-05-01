# Firework Import Worker

Container worker for `/admin/imports` firework-video jobs.

## Environment

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=ShowCrafter
POLL_SECONDS=8
```

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
or less, extracts frame/audio features, asks OpenRouter for a structured
reconstruction, and writes `generated_spec` output rows for admin review.
