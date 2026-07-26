"""
Run the analyser against versioned real-audio regression fixtures.

The baseline intentionally captures musical structure rather than exact JSON.
Small decoder differences are tolerated, while material changes to tempo,
beats, sections, climaxes, buildups, or the finale fail the evaluation.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import sys
import time
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from showcrafter import analyse_song


ANALYSER_DIR = Path(__file__).resolve().parent
DEFAULT_BASELINE = ANALYSER_DIR / "evals" / "baseline_v1.json"
DEFAULT_REPORT = ANALYSER_DIR / "evaluation-report.json"
DEPENDENCIES = ("numpy", "scipy", "scikit-learn", "librosa", "pydantic", "soundfile")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def summarise_result(result: dict[str, Any]) -> dict[str, Any]:
    sections = result["sections"]
    return {
        "schema_version": result["schema_version"],
        "duration_seconds": result["duration_seconds"],
        "tempo_bpm": result["tempo_bpm"],
        "total_beats": result["total_beats"],
        "beat_count": len(result["beat_times"]),
        "downbeat_count": len(result["downbeat_times"]),
        "beats_per_bar": result["beats_per_bar"],
        "bar_grid_confidence": result.get("bar_grid_confidence", 0.0),
        "section_count": len(sections),
        "section_labels": [section["label"] for section in sections],
        "section_starts": [section["start"] for section in sections],
        "climax_times": [
            moment["time"]
            for moment in result["key_moments"]
            if moment["type"] == "climax"
        ],
        "buildup_peaks": [buildup["peak"] for buildup in result["buildups"]],
        "finale_window": result["derived"]["finale_window"],
        "analysis_timings_ms": result["analysis_meta"]["timings_ms"],
    }


def make_check(
    name: str,
    passed: bool,
    actual: Any,
    expected: Any,
    *,
    tolerance: Any = None,
) -> dict[str, Any]:
    check = {
        "name": name,
        "status": "pass" if passed else "fail",
        "actual": actual,
        "expected": expected,
    }
    if tolerance is not None:
        check["tolerance"] = tolerance
    return check


def numeric_check(
    name: str,
    actual: float,
    expected: float,
    tolerance: float,
) -> dict[str, Any]:
    return make_check(
        name,
        abs(float(actual) - float(expected)) <= tolerance,
        actual,
        expected,
        tolerance=tolerance,
    )


def anchors_check(
    name: str,
    actual: list[float],
    expected: list[float],
    tolerance: float,
) -> dict[str, Any]:
    remaining = [float(value) for value in actual]
    deltas: list[float | None] = []

    for expected_value in expected:
        if not remaining:
            deltas.append(None)
            continue
        closest_index = min(
            range(len(remaining)),
            key=lambda index: abs(remaining[index] - expected_value),
        )
        closest = remaining.pop(closest_index)
        deltas.append(round(abs(closest - expected_value), 3))

    matched_anchors = sum(
        delta is not None and delta <= tolerance for delta in deltas
    )
    # Count drift is checked separately. Here, every anchor present in the
    # smaller set must still correspond to the same musical neighbourhood.
    passed = matched_anchors >= min(len(actual), len(expected))
    check = make_check(
        name,
        passed,
        actual,
        expected,
        tolerance={"maximum_anchor_shift_seconds": tolerance},
    )
    check["anchor_deltas_seconds"] = deltas
    return check


def compare_summary(
    actual: dict[str, Any],
    fixture: dict[str, Any],
) -> list[dict[str, Any]]:
    expected = fixture["expected"]
    tolerances = fixture["tolerances"]
    checks = [
        make_check(
            "schema_version",
            actual["schema_version"] == expected["schema_version"],
            actual["schema_version"],
            expected["schema_version"],
        ),
        make_check(
            "reported_total_beats",
            actual["total_beats"] == actual["beat_count"],
            actual["total_beats"],
            actual["beat_count"],
        ),
        numeric_check(
            "duration_seconds",
            actual["duration_seconds"],
            expected["duration_seconds"],
            tolerances["duration_seconds"],
        ),
        numeric_check(
            "tempo_bpm",
            actual["tempo_bpm"],
            expected["tempo_bpm"],
            tolerances["tempo_bpm"],
        ),
        numeric_check(
            "total_beats",
            actual["total_beats"],
            expected["total_beats"],
            tolerances["total_beats"],
        ),
        numeric_check(
            "downbeat_count",
            actual["downbeat_count"],
            expected["downbeat_count"],
            tolerances["downbeat_count"],
        ),
        make_check(
            "beats_per_bar",
            actual["beats_per_bar"] == expected["beats_per_bar"],
            actual["beats_per_bar"],
            expected["beats_per_bar"],
        ),
        numeric_check(
            "bar_grid_confidence",
            actual["bar_grid_confidence"],
            expected["bar_grid_confidence"],
            tolerances["bar_grid_confidence"],
        ),
        numeric_check(
            "section_count",
            actual["section_count"],
            len(expected["section_labels"]),
            tolerances["section_count"],
        ),
    ]

    label_similarity = SequenceMatcher(
        None,
        expected["section_labels"],
        actual["section_labels"],
    ).ratio()
    checks.append(
        make_check(
            "section_label_sequence",
            label_similarity >= tolerances["section_label_similarity"],
            actual["section_labels"],
            expected["section_labels"],
            tolerance={
                "minimum_sequence_similarity": tolerances[
                    "section_label_similarity"
                ],
                "actual_sequence_similarity": round(label_similarity, 3),
            },
        )
    )
    checks.extend(
        [
            anchors_check(
                "section_starts",
                actual["section_starts"],
                expected["section_starts"],
                tolerances["section_anchor_seconds"],
            ),
            numeric_check(
                "climax_count",
                len(actual["climax_times"]),
                len(expected["climax_times"]),
                tolerances["climax_count"],
            ),
            anchors_check(
                "climax_times",
                actual["climax_times"],
                expected["climax_times"],
                tolerances["climax_anchor_seconds"],
            ),
            numeric_check(
                "buildup_count",
                len(actual["buildup_peaks"]),
                len(expected["buildup_peaks"]),
                tolerances["buildup_count"],
            ),
            anchors_check(
                "buildup_peaks",
                actual["buildup_peaks"],
                expected["buildup_peaks"],
                tolerances["buildup_anchor_seconds"],
            ),
        ]
    )

    actual_finale = actual["finale_window"]
    expected_finale = expected["finale_window"]
    checks.append(
        make_check(
            "finale_presence",
            (actual_finale is None) == (expected_finale is None),
            actual_finale is not None,
            expected_finale is not None,
        )
    )
    if actual_finale is not None and expected_finale is not None:
        checks.extend(
            [
                numeric_check(
                    "finale_start",
                    actual_finale["start"],
                    expected_finale["start"],
                    tolerances["finale_start_seconds"],
                ),
                numeric_check(
                    "finale_end",
                    actual_finale["end"],
                    expected_finale["end"],
                    tolerances["duration_seconds"],
                ),
            ]
        )

    return checks


def dependency_versions() -> dict[str, str]:
    versions = {}
    for dependency in DEPENDENCIES:
        try:
            versions[dependency] = importlib.metadata.version(dependency)
        except importlib.metadata.PackageNotFoundError:
            versions[dependency] = "missing"
    return versions


def evaluate_fixture(
    fixture: dict[str, Any],
    baseline_dir: Path,
) -> dict[str, Any]:
    audio_path = (baseline_dir / fixture["path"]).resolve()
    started = time.perf_counter()
    fixture_report: dict[str, Any] = {
        "name": fixture["name"],
        "audio_path": str(audio_path),
        "checks": [],
    }

    if not audio_path.is_file():
        fixture_report["checks"].append(
            make_check("audio_file_exists", False, False, True)
        )
        fixture_report["status"] = "fail"
        fixture_report["elapsed_seconds"] = 0.0
        return fixture_report

    actual_hash = file_sha256(audio_path)
    fixture_report["checks"].append(
        make_check(
            "audio_sha256",
            actual_hash == fixture["sha256"],
            actual_hash,
            fixture["sha256"],
        )
    )

    try:
        result = analyse_song(str(audio_path))
        summary = summarise_result(result)
        fixture_report["summary"] = summary
        fixture_report["checks"].extend(compare_summary(summary, fixture))
    except Exception as error:  # The report must survive one broken fixture.
        fixture_report["checks"].append(
            make_check(
                "analysis_completed",
                False,
                f"{type(error).__name__}: {error}",
                "successful analysis",
            )
        )

    fixture_report["elapsed_seconds"] = round(time.perf_counter() - started, 3)
    fixture_report["status"] = (
        "pass"
        if all(check["status"] == "pass" for check in fixture_report["checks"])
        else "fail"
    )
    return fixture_report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate ShowCrafter analysis against real-audio baselines"
    )
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    baseline_path = args.baseline.resolve()
    report_path = args.report.resolve()
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))

    fixture_reports = [
        evaluate_fixture(fixture, baseline_path.parent)
        for fixture in baseline["fixtures"]
    ]
    passed = all(fixture["status"] == "pass" for fixture in fixture_reports)
    report = {
        "evaluation_version": baseline["evaluation_version"],
        "baseline": str(baseline_path),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "environment": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "dependencies": dependency_versions(),
        },
        "status": "pass" if passed else "fail",
        "fixtures": fixture_reports,
    }

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    for fixture in fixture_reports:
        failed_checks = [
            check["name"]
            for check in fixture["checks"]
            if check["status"] == "fail"
        ]
        suffix = f": {', '.join(failed_checks)}" if failed_checks else ""
        print(f"{fixture['status'].upper():4} {fixture['name']}{suffix}")
    print(f"Evaluation report: {report_path}")

    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
