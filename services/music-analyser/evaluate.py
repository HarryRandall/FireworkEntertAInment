"""Compare trackers with independent annotated clocks, never earlier analyser output."""

import argparse
import json
import platform
from importlib.metadata import version
import time
from pathlib import Path

import numpy as np

from asset_integrity import file_sha256
from beat_metrics import is_better, score_track

SERVICE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = SERVICE / "evals/guitarset.json"
# Corpus size budget from the evaluation brief, counted before any inference.
MIN_EVALUATION_TRACKS = 20
MAX_EVALUATION_TRACKS = 40
# Stored timing fields use milliseconds; this report uses seconds.
MILLISECONDS_PER_SECOND = 1000


def evaluate(manifest_path: Path) -> dict:
    """Measure each pinned audio file with both CPU trackers and record per-track costs.

    Runtime includes the full analysis with first-call imports/model loading.
    It excludes downloads. Compute cost stays null
    without measured billing, and provider spend is zero for these offline models.
    """
    from beat_tracking import BeatGrid, CPU_THREADS, MODEL_MANIFEST
    from showcrafter import analyse_song, validate_analysis_result

    manifest = json.loads(manifest_path.read_text())
    if manifest.get("label_source") != "guitarset-1.1.0-jams":
        raise ValueError("Independent public annotations required")
    if not MIN_EVALUATION_TRACKS <= len(manifest["tracks"]) <= MAX_EVALUATION_TRACKS:
        raise ValueError("Evaluation needs 20 to 40 independent labelled recordings")
    rows = []
    for fixture in manifest["tracks"]:
        path = SERVICE / fixture["audio_path"]
        if file_sha256(path) != fixture["audio_sha256"]:
            raise ValueError("Evaluation audio checksum mismatch")
        for tracker in ("librosa", "beat-this"):
            started = time.perf_counter()
            result = validate_analysis_result(
                analyse_song(str(path), beat_tracker=tracker)
            )
            elapsed = time.perf_counter() - started
            grid = BeatGrid(
                np.asarray(result["beat_times"]),
                np.asarray(result["downbeat_times"]),
                result["tempo_bpm"],
                result["beats_per_bar"],
            )
            row = {
                "track": fixture["id"],
                "tracker": tracker,
                **score_track(fixture, grid),
                "runtime_seconds": elapsed,
                "tracking_runtime_seconds": result["analysis_meta"]["timings_ms"][
                    "beat_ms"
                ]
                / MILLISECONDS_PER_SECOND,
                "compute_usd": None,
                "provider_usd": 0,
            }
            rows.append(row)
            print(json.dumps(row), flush=True)
    summary = {}
    for tracker in ("librosa", "beat-this"):
        selected = [row for row in rows if row["tracker"] == tracker]
        summary[tracker] = {
            key: float(np.mean([row[key] for row in selected]))
            for key in (
                "beat_f_measure",
                "downbeat_f_measure",
                "tempo_correct",
                "runtime_seconds",
                "tracking_runtime_seconds",
            )
        }
    return {
        "neural_improves": is_better(summary),
        "environment": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "neural_cpu_threads": CPU_THREADS,
            "dependencies": {
                name: version(name)
                for name in ("beat-this", "torch", "librosa", "numpy", "soxr")
            },
        },
        "model": json.loads(MODEL_MANIFEST.read_text()),
        "manifest_sha256": file_sha256(manifest_path),
        "scope": "local CPU full analysis; first track includes cold loading; not Modal billing",
        "summary": summary,
        "tracks": rows,
    }


def main() -> None:
    """Write a reproducible independent-label comparison; missing inputs fail visibly."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument(
        "--report", type=Path, default=SERVICE / "evaluation-report.json"
    )
    args = parser.parse_args()
    report = evaluate(args.manifest)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    from beat_tracking import DEFAULT_TRACKER

    if DEFAULT_TRACKER == "beat-this" and not report["neural_improves"]:
        raise SystemExit("Selected neural tracker does not pass the comparison gate")


if __name__ == "__main__":
    main()
