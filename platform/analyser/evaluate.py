"""
Run the analyser against versioned real-audio regression fixtures.

The baseline captures musical structure rather than exact JSON. Small decoder
differences are tolerated, while material drift in timing or structure fails
the evaluation.
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

from showcrafter import SCHEMA_VERSION, analyse_song, validate_analysis_result


ANALYSER_DIR = Path(__file__).resolve().parent
REPO_ROOT = ANALYSER_DIR.parents[1]
DEFAULT_BASELINE = ANALYSER_DIR / "evals" / "baseline_v1.json"
DEFAULT_REPORT = ANALYSER_DIR / "evaluation-report.json"
DEPENDENCIES = (
    "numpy",
    "scipy",
    "scikit-learn",
    "librosa",
    "pydantic",
    "soundfile",
)
REQUIRED_PROVENANCE_FIELDS = (
    "track_id",
    "title",
    "artist",
    "attribution",
    "licence_code",
    "licence_version",
    "licence_url",
    "source_url",
    "audio_path",
    "size_bytes",
    "sha256",
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ordered(values: list[float], *, strict: bool = False) -> bool:
    pairs = zip(values, values[1:])
    if strict:
        return all(left < right for left, right in pairs)
    return all(left <= right for left, right in pairs)


def sample_grid(values: list[float]) -> list[float]:
    if not values:
        return []
    last_index = len(values) - 1
    indexes = {
        0,
        last_index // 4,
        last_index // 2,
        (3 * last_index) // 4,
        last_index,
    }
    return [values[index] for index in sorted(indexes)]


def summarise_result(result: dict[str, Any]) -> dict[str, Any]:
    sections = result["sections"]
    beat_times = [float(value) for value in result["beat_times"]]
    downbeat_times = [float(value) for value in result["downbeat_times"]]
    climax_times = [
        float(moment["time"])
        for moment in result["key_moments"]
        if moment["type"] == "climax"
    ]
    buildup_peaks = [float(buildup["peak"]) for buildup in result["buildups"]]
    duration = float(result["duration_seconds"])
    section_timeline_valid = all(
        float(section["start"]) <= float(section["end"])
        and (index == 0 or float(sections[index - 1]["end"]) <= float(section["start"]))
        for index, section in enumerate(sections)
    )
    buildup_timeline_valid = all(
        0.0 <= float(buildup["start"]) <= float(buildup["peak"]) <= duration
        for buildup in result["buildups"]
    ) and ordered(buildup_peaks)
    finale = result["derived"]["finale_window"]
    finale_timeline_valid = finale is None or (
        0.0 <= float(finale["start"]) <= float(finale["end"]) <= duration
    )

    return {
        "schema_version": result["schema_version"],
        "duration_seconds": result["duration_seconds"],
        "tempo_bpm": result["tempo_bpm"],
        "total_beats": result["total_beats"],
        "beat_count": len(beat_times),
        "beat_samples": sample_grid(beat_times),
        "beat_times_strictly_increasing": ordered(beat_times, strict=True),
        "downbeat_count": len(downbeat_times),
        "downbeat_samples": sample_grid(downbeat_times),
        "downbeat_times_strictly_increasing": ordered(
            downbeat_times,
            strict=True,
        ),
        "beats_per_bar": result["beats_per_bar"],
        "section_count": len(sections),
        "section_labels": [section["label"] for section in sections],
        "section_starts": [section["start"] for section in sections],
        "section_timeline_valid": section_timeline_valid,
        "climax_times": climax_times,
        "climax_times_ordered": ordered(climax_times),
        "buildup_peaks": buildup_peaks,
        "buildup_timeline_valid": buildup_timeline_valid,
        "finale_window": finale,
        "finale_timeline_valid": finale_timeline_valid,
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
        make_check(
            "beat_times_strictly_increasing",
            actual["beat_times_strictly_increasing"],
            actual["beat_times_strictly_increasing"],
            True,
        ),
        make_check(
            "downbeat_times_strictly_increasing",
            actual["downbeat_times_strictly_increasing"],
            actual["downbeat_times_strictly_increasing"],
            True,
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
        anchors_check(
            "beat_samples",
            actual["beat_samples"],
            expected["beat_samples"],
            tolerances["beat_anchor_seconds"],
        ),
        anchors_check(
            "downbeat_samples",
            actual["downbeat_samples"],
            expected["downbeat_samples"],
            tolerances["downbeat_anchor_seconds"],
        ),
        make_check(
            "beats_per_bar",
            actual["beats_per_bar"] == expected["beats_per_bar"],
            actual["beats_per_bar"],
            expected["beats_per_bar"],
        ),
        numeric_check(
            "section_count",
            actual["section_count"],
            len(expected["section_labels"]),
            tolerances["section_count"],
        ),
        make_check(
            "section_timeline_valid",
            actual["section_timeline_valid"],
            actual["section_timeline_valid"],
            True,
        ),
        make_check(
            "climax_times_ordered",
            actual["climax_times_ordered"],
            actual["climax_times_ordered"],
            True,
        ),
        make_check(
            "buildup_timeline_valid",
            actual["buildup_timeline_valid"],
            actual["buildup_timeline_valid"],
            True,
        ),
        make_check(
            "finale_timeline_valid",
            actual["finale_timeline_valid"],
            actual["finale_timeline_valid"],
            True,
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


def provenance_checks(fixture: dict[str, Any]) -> list[dict[str, Any]]:
    checks = []
    for field in REQUIRED_PROVENANCE_FIELDS:
        checks.append(
            make_check(
                f"provenance_{field}",
                field in fixture and fixture[field] not in ("", None),
                fixture.get(field),
                "recorded",
            )
        )
    checks.extend(
        [
            make_check(
                "source_url_https",
                str(fixture.get("source_url", "")).startswith("https://"),
                fixture.get("source_url"),
                "HTTPS source URL",
            ),
            make_check(
                "licence_allowed",
                fixture.get("licence_code") in {"CC0", "CC BY"},
                fixture.get("licence_code"),
                "CC0 or CC BY",
            ),
        ]
    )
    return checks


def evaluate_fixture(
    fixture: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any]:
    audio_path = (REPO_ROOT / provenance["audio_path"]).resolve()
    started = time.perf_counter()
    fixture_report: dict[str, Any] = {
        "name": fixture["name"],
        "track_id": fixture["track_id"],
        "category": fixture["category"],
        "audio_path": provenance["audio_path"],
        "provenance": {
            key: provenance.get(key)
            for key in (
                "title",
                "artist",
                "attribution",
                "licence_code",
                "licence_version",
                "licence_url",
                "source_url",
                "size_bytes",
                "sha256",
            )
        },
        "checks": provenance_checks(provenance),
    }

    if not audio_path.is_file():
        fixture_report["checks"].append(
            make_check("audio_file_exists", False, False, True)
        )
        fixture_report["status"] = "fail"
        fixture_report["elapsed_seconds"] = 0.0
        return fixture_report

    actual_hash = file_sha256(audio_path)
    fixture_report["checks"].extend(
        [
            make_check("audio_file_exists", True, True, True),
            make_check(
                "audio_size_bytes",
                audio_path.stat().st_size == provenance["size_bytes"],
                audio_path.stat().st_size,
                provenance["size_bytes"],
            ),
            make_check(
                "audio_sha256",
                actual_hash == provenance["sha256"],
                actual_hash,
                provenance["sha256"],
            ),
        ]
    )

    try:
        result = analyse_song(str(audio_path))
        fixture_report["checks"].append(
            make_check("analysis_completed", True, "successful", "successful")
        )
        validated = validate_analysis_result(result)
        fixture_report["checks"].append(
            make_check(
                "schema_validation",
                True,
                validated["schema_version"],
                SCHEMA_VERSION,
            )
        )
        summary = summarise_result(validated)
        fixture_report["summary"] = summary
        fixture_report["checks"].extend(compare_summary(summary, fixture))
    except Exception as error:  # The report must survive one broken fixture.
        fixture_report["checks"].append(
            make_check(
                "analysis_completed",
                False,
                f"{type(error).__name__}: {error}",
                "successful analysis and schema validation",
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


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    args = parse_args()
    baseline_path = args.baseline.resolve()
    report_path = args.report.resolve()
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "baseline": str(baseline_path),
        "environment": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "dependencies": dependency_versions(),
        },
        "status": "fail",
        "checks": [],
        "fixtures": [],
        "errors": [],
    }

    try:
        baseline = load_json(baseline_path)
        report["evaluation_version"] = baseline["evaluation_version"]
        report["checks"].append(
            make_check(
                "analyser_schema_version",
                baseline["analyser_schema_version"] == SCHEMA_VERSION,
                SCHEMA_VERSION,
                baseline["analyser_schema_version"],
            )
        )
        manifest_path = (
            baseline_path.parent / baseline["fixture_manifest"]
        ).resolve()
        report["fixture_manifest"] = str(manifest_path)
        manifest = load_json(manifest_path)
        provenance_by_track = {
            fixture["track_id"]: fixture for fixture in manifest["fixtures"]
        }

        for fixture in baseline["fixtures"]:
            provenance = provenance_by_track.get(fixture["track_id"])
            if provenance is None:
                report["fixtures"].append(
                    {
                        "name": fixture["name"],
                        "track_id": fixture["track_id"],
                        "status": "fail",
                        "checks": [
                            make_check(
                                "fixture_manifest_entry",
                                False,
                                None,
                                fixture["track_id"],
                            )
                        ],
                    }
                )
                continue
            report["fixtures"].append(evaluate_fixture(fixture, provenance))
    except Exception as error:
        report["errors"].append(f"{type(error).__name__}: {error}")

    report["status"] = (
        "pass"
        if not report["errors"]
        and report["fixtures"]
        and all(check["status"] == "pass" for check in report["checks"])
        and all(fixture["status"] == "pass" for fixture in report["fixtures"])
        else "fail"
    )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    for fixture in report["fixtures"]:
        failed_checks = [
            check["name"]
            for check in fixture["checks"]
            if check["status"] == "fail"
        ]
        suffix = f": {', '.join(failed_checks)}" if failed_checks else ""
        print(f"{fixture['status'].upper():4} {fixture['name']}{suffix}")
    for error in report["errors"]:
        print(f"FAIL evaluation setup: {error}")
    print(f"Evaluation report: {report_path}")

    if report["status"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
