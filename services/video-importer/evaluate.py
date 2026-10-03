"""Compare deterministic MP4 measurements with independently authored simulation fixture truth."""

import argparse
import hashlib
import json
import platform
import tempfile
import time
from pathlib import Path

import numpy as np

from decode import FPS, run_decoder
from measure import EXTRACTOR, measure

# Acceptance budgets: two 20 Hz frames, 4% content width and lossy YUV420 RGB channel error.
TIME_TOLERANCE_MS = 100
POSITION_TOLERANCE = 0.04
COLOUR_TOLERANCE = 0.22
# Flight centroid tolerance in degrees, allowing muzzle sway and raster rounding.
ANGLE_TOLERANCE_DEG = 5
FIXTURES = Path(__file__).parent / "tests/fixtures"


def compare_shots(expected: list[dict], measured: dict) -> list[dict]:
    """Return per-shot absolute time/x/angle errors and maximum RGB-channel colour error."""
    results = []
    for truth, shot, feature in zip(expected, measured["shots"], measured["features"], strict=True):
        colour = (
            np.array([int(truth["colour"][index : index + 2], 16) for index in (1, 3, 5)]) / 255
        )
        errors = {
            "time_error_ms": abs(truth["t_ms"] - shot["t_ms"]),
            "position_error": abs(truth["x"] - shot["x"]),
            "angle_error_deg": abs(truth["angle_deg"] - shot["angle_deg"]),
            "colour_error_max_channel": float(
                np.max(np.abs(colour - feature["colours"][0]["rgb"]))
            ),
        }
        errors["passed"] = (
            errors["time_error_ms"] <= TIME_TOLERANCE_MS
            and errors["position_error"] <= POSITION_TOLERANCE
            and errors["angle_error_deg"] <= ANGLE_TOLERANCE_DEG
            and errors["colour_error_max_channel"] <= COLOUR_TOLERANCE
        )
        results.append(
            {
                "truth": truth,
                "measured_shot": shot,
                "measured_dominant_rgb": feature["colours"][0]["rgb"],
                **errors,
            }
        )
    return results


def evaluate() -> dict:
    """Measure committed clips with real local runtime and independent tolerances."""
    truth = json.loads((FIXTURES / "truth.json").read_text())
    clips = []
    for definition in truth["clips"]:
        path = FIXTURES / (definition["name"] + ".mp4")
        started = time.perf_counter()
        with tempfile.TemporaryDirectory() as temporary:
            measured = measure(path, {"shot_count": len(definition["shots"])}, Path(temporary))
        clips.append(
            {
                "name": definition["name"],
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "runtime_seconds": time.perf_counter() - started,
                "shots": compare_shots(definition["shots"], measured),
            }
        )
    return {
        "extractor": EXTRACTOR,
        "platform": platform.platform(),
        "python": platform.python_version(),
        "ffmpeg": run_decoder(["ffmpeg", "-version"]).decode().splitlines()[0],
        "analysis_fps": FPS,
        "tolerances": {
            "time_ms": TIME_TOLERANCE_MS,
            "position_fraction": POSITION_TOLERANCE,
            "rgb_channel": COLOUR_TOLERANCE,
            "angle_deg": ANGLE_TOLERANCE_DEG,
        },
        "clips": clips,
        "passed": all(shot["passed"] for clip in clips for shot in clip["shots"]),
        "provider_usd": 0,
        "modal_compute_usd": None,
        "scope": "Local synthetic static-camera evidence; real-video and Modal accuracy unverified",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluate measurements against authored synthetic truth"
    )
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    report = evaluate()
    arguments.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": report["passed"], "clips": len(report["clips"])}))
    raise SystemExit(0 if report["passed"] else 1)
