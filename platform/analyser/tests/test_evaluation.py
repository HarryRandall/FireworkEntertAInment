import copy
import json
import sys
import unittest
from collections import Counter
from pathlib import Path


ANALYSER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSER_DIR))

try:
    from evaluate import compare_summary, file_sha256  # noqa: E402
except ModuleNotFoundError as exc:
    raise unittest.SkipTest(
        "Install platform/analyser/requirements.txt to run analyser tests"
    ) from exc


EXPECTED = {
    "schema_version": "1.5.0",
    "duration_seconds": 120.0,
    "tempo_bpm": 100.0,
    "total_beats": 200,
    "downbeat_count": 50,
    "beats_per_bar": 4,
    "bar_grid_confidence": 0.7,
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
    "bar_grid_confidence": 0.1,
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
        "section_count": 3,
        "analysis_timings_ms": {"total_ms": 10.0},
    }


class EvaluationTests(unittest.TestCase):
    def test_open_licence_baseline_matches_the_jamendo_manifest(self):
        baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
        manifest = json.loads(JAMENDO_MANIFEST_PATH.read_text(encoding="utf-8"))
        manifest_by_track_id = {
            fixture["track_id"]: fixture for fixture in manifest["fixtures"]
        }

        self.assertEqual(
            Counter(fixture["category"] for fixture in baseline["fixtures"]),
            {"pop": 2, "classical": 2},
        )
        for fixture in baseline["fixtures"]:
            with self.subTest(track_id=fixture["track_id"]):
                audio_path = (BASELINE_PATH.parent / fixture["path"]).resolve()
                imported = manifest_by_track_id[fixture["track_id"]]

                self.assertTrue(audio_path.is_file())
                self.assertEqual(file_sha256(audio_path), fixture["sha256"])
                self.assertEqual(imported["sha256"], fixture["sha256"])
                self.assertEqual(imported["evaluation_status"], "baseline")
                self.assertEqual(imported["licence_code"], "CC BY")
                self.assertEqual(imported["source_url"], fixture["source_url"])
                self.assertTrue(fixture["attribution"])

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
