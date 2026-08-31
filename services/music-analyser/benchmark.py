"""
Benchmark the ShowCrafter analyser on local audio files.

Run from the repository root with one or more local audio files:

    python services/music-analyser/benchmark.py path/to/audio.mp3

The first pass in a fresh process approximates local cold-start cost. Later
passes show warm-process performance after librosa and numba paths are loaded.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from showcrafter import analyse_song


def benchmark_file(path: Path, repeat: int) -> list[dict]:
    rows = []
    for run_index in range(repeat):
        started = time.perf_counter()
        result = analyse_song(str(path))
        elapsed_seconds = time.perf_counter() - started
        rows.append(
            {
                "file": str(path),
                "run": run_index + 1,
                "phase": "cold" if run_index == 0 else "warm",
                "elapsed_seconds": round(elapsed_seconds, 3),
                "duration_seconds": result["duration_seconds"],
                "beats": len(result["beat_times"]),
                "sections": len(result["sections"]),
                "key_moments": len(result["key_moments"]),
                "buildups": len(result["buildups"]),
                "timings_ms": result["analysis_meta"]["timings_ms"],
            }
        )
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark ShowCrafter audio analysis")
    parser.add_argument(
        "paths",
        nargs="+",
        type=Path,
        help="Local audio files to analyse",
    )
    parser.add_argument("--repeat", type=int, default=2, help="Runs per file")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.repeat < 1:
        raise SystemExit("--repeat must be at least 1")

    rows = []
    for path in args.paths:
        resolved = path.resolve()
        if not resolved.exists():
            raise SystemExit(f"Audio file not found: {resolved}")
        rows.extend(benchmark_file(resolved, args.repeat))

    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
