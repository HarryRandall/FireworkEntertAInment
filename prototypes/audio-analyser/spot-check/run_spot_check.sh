#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INPUT_DIR="${INPUT_DIR:-$ROOT_DIR/spot-check/inputs}"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/spot-check/outputs}"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
ANALYSER="$ROOT_DIR/showcrafter.py"
NUMBA_CACHE_DIR="${NUMBA_CACHE_DIR:-$ROOT_DIR/spot-check/.cache/numba}"
LOKY_MAX_CPU_COUNT="${LOKY_MAX_CPU_COUNT:-8}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Missing Python virtualenv at $PYTHON_BIN"
  echo "Create it from prototypes/audio-analyser with:"
  echo "  python3 -m venv .venv"
  echo "  source .venv/bin/activate"
  echo "  pip install -r requirements.txt"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
mkdir -p "$NUMBA_CACHE_DIR"
export NUMBA_CACHE_DIR
export LOKY_MAX_CPU_COUNT

shopt -s nullglob nocaseglob
files=(
  "$INPUT_DIR"/*.mp3
  "$INPUT_DIR"/*.wav
  "$INPUT_DIR"/*.m4a
  "$INPUT_DIR"/*.flac
  "$INPUT_DIR"/*.aac
)

if (( ${#files[@]} == 0 )); then
  echo "No audio files found in $INPUT_DIR"
  echo "Add 3-4 mp3/wav/m4a/flac/aac files, then run this script again."
  exit 0
fi

for file in "${files[@]}"; do
  name="$(basename "$file")"
  stem="${name%.*}"
  safe_stem="$(printf "%s" "$stem" | tr -cs '[:alnum:]_.-' '_')"
  song_output="$OUTPUT_DIR/$safe_stem"

  mkdir -p "$song_output"
  echo "Analyzing $name"
  "$PYTHON_BIN" "$ANALYSER" "$file" \
    --personality balanced \
    --analysis-out "$song_output/analysis.json" \
    --markdown-out "$song_output/report.md" \
    --llm-out "$song_output/compact_payload.json" \
    2>&1 | tee "$song_output/run.log"
done

echo "Spot check outputs written to $OUTPUT_DIR"
