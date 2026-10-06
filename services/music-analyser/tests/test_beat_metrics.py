"""Independent-label beat metrics and tracker selection gate behaviour."""

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from beat_metrics import clock_tempo, f_measure, is_better, score_track  # noqa: E402


class BeatMetricTests(unittest.TestCase):
    """Ensure accuracy metrics reject aliases, extras and unlabelled clocks."""

    def test_switch_gate_requires_both_clocks_and_tempo_to_improve(self):
        baseline = {
            "beat_f_measure": 0.6,
            "downbeat_f_measure": 0.2,
            "tempo_correct": 0.7,
        }
        improved = {
            "beat_f_measure": 0.8,
            "downbeat_f_measure": 0.7,
            "tempo_correct": 0.8,
        }
        self.assertTrue(is_better({"librosa": baseline, "beat-this": improved}))
        self.assertFalse(
            is_better(
                {"librosa": baseline, "beat-this": {**improved, "tempo_correct": 0.6}}
            )
        )

    def test_event_matching_is_one_to_one_and_penalises_missing_or_extra_events(self):
        self.assertEqual(f_measure([0, 1, 2], [0, 1, 2]), 1)
        self.assertEqual(f_measure([0, 1, 2], []), 0)
        self.assertAlmostEqual(f_measure([1], [0.98, 1.02]), 2 / 3)

    def test_invalid_or_empty_reference_clock_fails(self):
        for clock in ([], [1, 1], [2, 1], [float("nan")], [-1]):
            with self.subTest(clock=clock), self.assertRaises(ValueError):
                f_measure(clock, [1])

    def test_half_tempo_and_wrong_bar_phase_fail(self):
        labels = {"beats": [0, 0.5, 1, 1.5, 2], "downbeats": [0, 2]}
        grid = SimpleNamespace(
            beats=np.array([0, 1, 2]),
            downbeats=np.array([1]),
            tempo=60,
            beats_per_bar=2,
        )
        scores = score_track(labels, grid)
        self.assertEqual(clock_tempo(labels["beats"]), 120)
        self.assertFalse(scores["tempo_correct"])
        self.assertEqual(scores["downbeat_f_measure"], 0)
        self.assertLess(scores["beat_f_measure"], 1)
