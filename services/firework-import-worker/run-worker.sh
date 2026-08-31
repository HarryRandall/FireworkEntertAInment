#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"

cd "$script_dir"

if [ -f "${repo_root}/.env.local" ]; then
  set -a
  # Load the app's local environment so the worker picks up Supabase/OpenRouter settings.
  . "${repo_root}/.env.local"
  set +a
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate

python -m pip install -r requirements.txt
python -m playwright install chromium
python smoke_playwright.py
python worker.py
