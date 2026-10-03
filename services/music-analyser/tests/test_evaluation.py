"""Independent-label metrics reject tempo aliases and penalise hallucinated events."""

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from beat_metrics import f_measure, clock_tempo, score_track, is_better  # noqa: E402


class EvaluationTests(unittest.TestCase):
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
        self.assertFalse(
            is_better(
                {"librosa": baseline, "beat-this": {**improved, "beat_f_measure": 0.5}}
            )
        )

    def test_exact_and_missing_events(self):
        self.assertEqual(f_measure([0, 1, 2], [0, 1, 2]), 1)
        self.assertEqual(f_measure([0, 1, 2], []), 0)
        self.assertAlmostEqual(f_measure([0, 1, 2], [0, 2]), 0.8)

    def test_extra_events_and_one_to_one_matching(self):
        self.assertAlmostEqual(f_measure([1], [0.98, 1.02]), 2 / 3)
        self.assertEqual(f_measure([1, 1.1], [1.05]), 2 / 3)
        self.assertEqual(f_measure([1], [1.08]), 0)

    def test_invalid_and_empty_labels_fail(self):
        for clock in ([], [1, 1], [2, 1], [float("nan")], [-1]):
            with self.assertRaises(ValueError):
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


if __name__ == "__main__":
    unittest.main()
