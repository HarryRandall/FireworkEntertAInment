#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"

cd "$script_dir"

app_env="${repo_root}/apps/web/.env.local"
if [ ! -f "$app_env" ]; then
  app_env="${repo_root}/apps/web/.env"
fi

if [ -f "$app_env" ]; then
  set -a
  # Load the app's local environment so the worker picks up Supabase/OpenRouter settings.
  . "$app_env"
  set +a
fi

if [ ! -d "${repo_root}/packages/video-fit/node_modules" ]; then
  echo "Run pnpm install from the repository root first; the renderer scorer needs it." >&2
  exit 1
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate

python -m pip install -r requirements.txt
python worker.py
