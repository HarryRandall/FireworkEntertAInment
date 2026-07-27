import copy
import json
import sys
import unittest
from collections import Counter
from pathlib import Path


ANALYSER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSER_DIR))

try:
    from evaluate import (  # noqa: E402
        REPO_ROOT,
        compare_summary,
        file_sha256,
    )
except ModuleNotFoundError as exc:
    raise unittest.SkipTest(
        "Install platform/analyser/requirements.txt to run analyser tests"
    ) from exc


EXPECTED = {
    "schema_version": "1.4.0",
    "duration_seconds": 120.0,
    "tempo_bpm": 100.0,
    "total_beats": 200,
    "beat_samples": [0.0, 30.0, 60.0, 90.0, 119.0],
    "downbeat_count": 50,
    "downbeat_samples": [0.0, 30.0, 60.0, 90.0, 116.0],
    "beats_per_bar": 4,
    "section_labels": ["intro", "build", "chorus"],
    "section_starts": [0.0, 30.0, 60.0],
    "climax_times": [62.0],
    "buildup_peaks": [60.0],
    "finale_window": {"start": 100.0, "end": 120.0},
}

TOLERANCES = {
    "duration_seconds": 0.2,
    "tempo_bpm": 2.0,
    "total_beats": 4,
    "downbeat_count": 2,
    "beat_anchor_seconds": 0.15,
    "downbeat_anchor_seconds": 0.15,
    "section_count": 1,
    "section_label_similarity": 0.75,
    "section_anchor_seconds": 3.0,
    "climax_count": 1,
    "climax_anchor_seconds": 3.0,
    "buildup_count": 1,
    "buildup_anchor_seconds": 3.0,
    "finale_start_seconds": 4.0,
}

BASELINE_PATH = ANALYSER_DIR / "evals" / "baseline_v1.json"
JAMENDO_MANIFEST_PATH = ANALYSER_DIR / "evals" / "jamendo_fixtures.json"


def make_summary():
    return {
        **copy.deepcopy(EXPECTED),
        "beat_count": 200,
        "beat_times_strictly_increasing": True,
        "downbeat_times_strictly_increasing": True,
        "section_count": 3,
        "section_timeline_valid": True,
        "climax_times_ordered": True,
        "buildup_timeline_valid": True,
        "finale_timeline_valid": True,
        "analysis_timings_ms": {"total_ms": 10.0},
    }


class EvaluationTests(unittest.TestCase):
    def test_open_licence_baseline_matches_the_jamendo_manifest(self):
        baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
        manifest = json.loads(JAMENDO_MANIFEST_PATH.read_text(encoding="utf-8"))
        manifest_by_track_id = {
            fixture["track_id"]: fixture for fixture in manifest["fixtures"]
        }

        self.assertEqual(baseline["analyser_schema_version"], "1.4.0")
        self.assertEqual(
            Counter(fixture["category"] for fixture in baseline["fixtures"]),
            {"pop": 2, "classical": 2},
        )
        self.assertEqual(
            set(manifest_by_track_id),
            {fixture["track_id"] for fixture in baseline["fixtures"]},
        )
        for fixture in baseline["fixtures"]:
            with self.subTest(track_id=fixture["track_id"]):
                imported = manifest_by_track_id[fixture["track_id"]]
                audio_path = REPO_ROOT / imported["audio_path"]

                self.assertTrue(audio_path.is_file())
                self.assertEqual(audio_path.stat().st_size, imported["size_bytes"])
                self.assertEqual(file_sha256(audio_path), imported["sha256"])
                self.assertEqual(imported["evaluation_status"], "baseline")
                self.assertEqual(imported["licence_code"], "CC BY")
                self.assertTrue(imported["licence_url"].startswith("https://"))
                self.assertTrue(imported["source_url"].startswith("https://"))
                self.assertTrue(imported["attribution"])

    def test_baseline_summary_passes(self):
        checks = compare_summary(
            make_summary(),
            {"expected": EXPECTED, "tolerances": TOLERANCES},
        )

        self.assertTrue(all(check["status"] == "pass" for check in checks))

    def test_material_anchor_shift_fails(self):
        summary = make_summary()
        summary["climax_times"] = [75.0]

        checks = compare_summary(
            summary,
            {"expected": EXPECTED, "tolerances": TOLERANCES},
        )

        climax_check = next(
            check for check in checks if check["name"] == "climax_times"
        )
        self.assertEqual(climax_check["status"], "fail")

    def test_invalid_timeline_order_fails(self):
        summary = make_summary()
        summary["downbeat_times_strictly_increasing"] = False

        checks = compare_summary(
            summary,
            {"expected": EXPECTED, "tolerances": TOLERANCES},
        )

        order_check = next(
            check
            for check in checks
            if check["name"] == "downbeat_times_strictly_increasing"
        )
        self.assertEqual(order_check["status"], "fail")

    def test_one_extra_section_label_is_tolerated(self):
        summary = make_summary()
        summary["section_labels"] = ["intro", "build", "verse", "chorus"]

        checks = compare_summary(
            summary,
            {"expected": EXPECTED, "tolerances": TOLERANCES},
        )

        label_check = next(
            check for check in checks if check["name"] == "section_label_sequence"
        )
        self.assertEqual(label_check["status"], "pass")


if __name__ == "__main__":
    unittest.main()
