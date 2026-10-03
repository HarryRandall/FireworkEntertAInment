"""Tracker selection, checkpoint integrity and schema-preserving clock behaviour."""

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from beat_tracking import algorithm_for, neural_grid, neural_model  # noqa: E402
from showcrafter import analyse_song, validate_analysis_result  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures/clicks.wav"


class BeatTrackingTests(unittest.TestCase):
    def tearDown(self):
        neural_model.cache_clear()

    def test_unknown_tracker_fails_and_versions_are_distinct(self):
        self.assertNotEqual(algorithm_for("librosa"), algorithm_for("beat-this"))
        with self.assertRaises(ValueError):
            algorithm_for("other")

    def test_partial_bars_do_not_halve_the_metre(self):
        grid = neural_grid(np.arange(0, 5, 0.5), np.array([0.5, 2.5, 4.5]), 5)
        self.assertEqual(grid.tempo, 120)
        self.assertEqual(grid.beats_per_bar, 4)

    def test_unsupported_bar_spacing_drops_uncertain_downbeats(self):
        grid = neural_grid(np.arange(0, 5, 0.5), np.arange(0, 5, 0.5), 5)
        self.assertEqual(grid.beats_per_bar, 4)
        self.assertEqual(len(grid.downbeats), 0)
        self.assertEqual(grid.tempo, 120)

    def test_invalid_clock_is_visible(self):
        with self.assertRaises(ValueError):
            neural_grid(np.array([2, 1]), np.array([]), 5)

    def test_bad_checkpoint_is_not_loaded_or_downloaded(self):
        with (
            patch("beat_tracking.file_sha256", return_value="wrong"),
            self.assertRaises(ValueError),
        ):
            neural_model()

    def test_neural_clocks_survive_the_full_analysis_contract(self):
        beats = np.arange(0.25, 10, 0.5)
        downbeats = beats[::4]
        with patch(
            "beat_tracking.neural_model", return_value=lambda y, sr: (beats, downbeats)
        ):
            result = validate_analysis_result(
                analyse_song(str(FIXTURE), beat_tracker="beat-this")
            )
        self.assertEqual(result["beat_times"], beats.tolist())
        self.assertEqual(result["downbeat_times"], downbeats.tolist())
        self.assertEqual(result["beats_per_bar"], 4)
        self.assertEqual(result["tempo_bpm"], 120)
        self.assertEqual(result["schema_version"], "1.4.0")
        self.assertIn("beat-this", json.dumps(result["analysis_meta"]))


if __name__ == "__main__":
    unittest.main()
