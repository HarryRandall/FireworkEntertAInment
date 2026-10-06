"""Tracker selection, checkpoint integrity and schema-preserving clock behaviour."""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from beat_tracking import algorithm_for, neural_grid, neural_model  # noqa: E402
from showcrafter import analyse_song, validate_analysis_result  # noqa: E402

# Test click duration in seconds, enough for spectral segmentation.
FIXTURE_DURATION_SECONDS = 10
# Test sample rate in Hz, matching the analyser's target audio resolution.
FIXTURE_SAMPLE_RATE_HZ = 22050


class BeatTrackingTests(unittest.TestCase):
    """Verify tracker selection and neural clock contract integration."""

    def tearDown(self):
        """Clear the process-local model cache between tests."""
        neural_model.cache_clear()

    def test_unknown_tracker_fails_and_versions_are_distinct(self):
        """Expose unsupported selections and retain distinct algorithm identities."""
        self.assertNotEqual(algorithm_for("librosa"), algorithm_for("beat-this"))
        with self.assertRaises(ValueError):
            algorithm_for("other")

    def test_partial_bars_do_not_halve_the_metre(self):
        """Infer metre from completed spans rather than edge fragments."""
        grid = neural_grid(np.arange(0, 5, 0.5), np.array([0.5, 2.5, 4.5]), 5)
        self.assertEqual(grid.tempo, 120)
        self.assertEqual(grid.beats_per_bar, 4)

    def test_unsupported_bar_spacing_drops_uncertain_downbeats(self):
        """Avoid exporting a bar grid when model spacing is unsupported."""
        grid = neural_grid(np.arange(0, 5, 0.5), np.arange(0, 5, 0.5), 5)
        self.assertEqual(grid.beats_per_bar, 4)
        self.assertEqual(len(grid.downbeats), 0)

    def test_bad_checkpoint_is_not_loaded_or_downloaded(self):
        """Surface corrupted checkpoint bytes rather than falling back silently."""
        with patch("beat_tracking.file_sha256", return_value="wrong"), self.assertRaises(ValueError):
            neural_model()

    def test_neural_clocks_survive_the_full_analysis_contract(self):
        """Keep schema 1.4.0 while using Beat This! clocks."""
        beats = np.arange(0.25, 10, 0.5)
        downbeats = beats[::4]
        samples = np.zeros(FIXTURE_DURATION_SECONDS * FIXTURE_SAMPLE_RATE_HZ)
        samples[:: FIXTURE_SAMPLE_RATE_HZ // 2] = 1
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "clicks.wav"
            sf.write(fixture, samples, FIXTURE_SAMPLE_RATE_HZ)
            with patch(
                "beat_tracking.neural_model", return_value=lambda y, sr: (beats, downbeats)
            ):
                result = validate_analysis_result(
                    analyse_song(str(fixture), beat_tracker="beat-this")
                )
        self.assertEqual(result["beat_times"], beats.tolist())
        self.assertEqual(result["downbeat_times"], downbeats.tolist())
        self.assertEqual(result["beats_per_bar"], 4)
        self.assertEqual(result["tempo_bpm"], 120)
        self.assertEqual(result["schema_version"], "1.4.0")
        self.assertIn("beat-this", json.dumps(result["analysis_meta"]))
