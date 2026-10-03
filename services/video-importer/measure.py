"""Combine bounded decode, onset fusion and per-shot evidence for storage."""

import json
import tempfile
from pathlib import Path

from decode import FPS, MS_PER_SECOND, decode
from features import describe_shot
from onsets import Priors, detect_shots

EXTRACTOR = "video-measure-1.0.0"


def measure(path: Path, priors: dict, output: Path) -> dict:
    """Measure an MP4 deterministically, returning JSON facts and writing PNG keyframes.

    Times use integer milliseconds from video presentation start; x is [0,1] from
    the left content edge, angle is projected degrees right of vertical, apex is
    height above the bottom divided by content height, and radius is half-width
    divided by content width. No real-world camera calibration is inferred.
    """
    constraints = Priors.parse(priors)
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        clip = decode(path, Path(temporary))
        shots = detect_shots(clip, constraints)
        features = []
        keyframes = []
        for index, shot in enumerate(shots):
            end = (
                round(shots[index + 1]["t_ms"] / MS_PER_SECOND * FPS)
                if index + 1 < len(shots)
                else len(clip.frames)
            )
            feature, crops = describe_shot(clip, shot, end, output, index)
            features.append(feature)
            keyframes.append(crops)
        return {
            "extractor": EXTRACTOR,
            "shots": shots,
            "features": features,
            "keyframes": keyframes,
            "duration_ms": round(clip.duration_s * MS_PER_SECOND),
            "geometry": {"space": "normalised_content", "content_box_px": list(clip.content_box)},
        }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Measure a local MP4 without a model or database")
    parser.add_argument("video", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--shot-count", type=int)
    arguments = parser.parse_args()
    result = measure(arguments.video, {"shot_count": arguments.shot_count}, arguments.output)
    (arguments.output / "measurements.json").write_text(json.dumps(result, indent=2) + "\n")
