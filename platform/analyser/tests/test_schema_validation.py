import sys
import unittest
from pathlib import Path

try:
    import numpy as np
except ModuleNotFoundError as exc:
    raise unittest.SkipTest("Install platform/analyser/requirements.txt to run analyser tests") from exc


ANALYSER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSER_DIR))

try:
    from showcrafter import (  # noqa: E402
        SCHEMA_VERSION,
        build_llm_payload,
        estimate_downbeats,
        filter_buildups,
        label_sections_from_clusters,
        select_climax_indices,
        validate_analysis_result,
    )
except ModuleNotFoundError as exc:
    raise unittest.SkipTest("Install platform/analyser/requirements.txt to run analyser tests") from exc


STYLE_VECTOR = {
    "boldness": 0.6,
    "elegance": 0.5,
    "playfulness": 0.4,
    "warmth": 0.5,
    "brightness": 0.5,
    "grandeur": 0.7,
    "tension": 0.4,
    "precision": 0.6,
}

DESCRIPTORS = {
    "energy": 0.5,
    "drive": 0.6,
    "brightness": 0.5,
    "warmth": 0.5,
    "tension": 0.4,
    "grandeur": 0.7,
    "playfulness": 0.4,
    "precision": 0.6,
    "dynamic_range": 0.5,
    "bass_impact": 0.5,
    "section_contrast": 0.2,
}


def make_analysis_payload():
    return {
        "schema_version": SCHEMA_VERSION,
        "file": "fixture.mp3",
        "analysis_meta": {
            "mode": "fast",
            "runner_version": "test-librosa",
            "timings_ms": {
                "download_ms": 0.0,
                "decode_ms": 1.0,
                "beat_ms": 2.0,
                "energy_ms": 3.0,
                "onset_ms": 4.0,
                "section_ms": 5.0,
                "profile_ms": 6.0,
                "validation_ms": 7.0,
                "total_ms": 28.0,
            },
        },
        "duration_seconds": 12.0,
        "tempo_bpm": 120.0,
        "total_beats": 4,
        "beat_times": [0.0, 1.0, 2.0, 3.0],
        "onset_times": [0.5, 1.5],
        "energy_timeline": [
            {"time": 0.0, "energy": 0.1},
            {"time": 6.0, "energy": 0.7},
        ],
        "sections": [
            {
                "start": 0.0,
                "end": 12.0,
                "duration": 12.0,
                "avg_energy": 0.5,
                "peak_energy": 0.9,
                "intensity": "medium",
                "cluster_id": 0,
                "label": "chorus",
            }
        ],
        "key_moments": [
            {"time": 6.0, "energy": 0.8, "prominence": 0.4, "type": "climax"}
        ],
        "buildups": [
            {"start": 4.0, "peak": 6.0, "duration": 2.0, "energy_rise": 0.4}
        ],
        "music_profile": {
            "genre_hint": "cinematic",
            "key_signature": {"root": "C", "mode": "major", "confidence": 0.7},
            "descriptors": DESCRIPTORS,
            "style_vector": STYLE_VECTOR,
            "dominant_traits": ["grandeur", "boldness"],
            "raw_metrics": {
                "tempo_bpm": 120.0,
                "onset_density_per_sec": 0.4,
                "key_moments_per_min": 5.0,
                "buildups_per_min": 5.0,
                "beat_stability": 0.8,
                "section_contrast": 0.2,
                "bass_ratio": 1.0,
            },
        },
        "show_personality": {
            "preset": "balanced",
            "blend_weights": {"user": 0.55, "music": 0.45},
            "dimensions": STYLE_VECTOR,
            "dominant_traits": ["grandeur", "boldness"],
            "palette_direction": {
                "primary": "gold",
                "secondary": "silver",
                "accent": "emerald",
            },
            "density_level": "medium",
            "genre_hint": "cinematic",
        },
        "firework_cues": [
            {
                "time": 6.0,
                "effect": "barrage",
                "reason": "climax",
                "energy": 0.8,
                "section": "chorus",
                "palette": "gold/silver",
                "shape": "chrysanthemum",
                "height": "high",
                "spread": "wide",
                "density": "dense",
                "style_tags": ["grandeur", "boldness"],
                "genre_hint": "cinematic",
            }
        ],
        "downbeat_times": [0.0, 2.0],
        "beats_per_bar": 2,
        "derived": {
            "finale_window": None,
            "quietest_section_index": 0,
            "highest_energy_section_index": 0,
            "repeated_chorus_count": 1,
            "section_rank_by_energy": [0],
            "anchor_windows": [
                {
                    "type": "climax",
                    "anchor_time": 6.0,
                    "start": 3.0,
                    "end": 10.0,
                    "energy": 0.8,
                }
            ],
        },
    }


class SchemaValidationTests(unittest.TestCase):
    def test_valid_analysis_payload_passes_schema_v14(self):
        validated = validate_analysis_result(make_analysis_payload())

        self.assertEqual(validated["schema_version"], "1.4.0")
        self.assertEqual(validated["analysis_meta"]["mode"], "fast")
        self.assertGreaterEqual(validated["analysis_meta"]["timings_ms"]["total_ms"], 0.0)
        self.assertEqual(validated["firework_cues"][0]["effect"], "barrage")
        # Schema 1.4.0 bar grid + derived block.
        self.assertEqual(validated["beats_per_bar"], 2)
        self.assertEqual(validated["downbeat_times"], [0.0, 2.0])
        self.assertEqual(validated["derived"]["repeated_chorus_count"], 1)

    def test_out_of_range_energy_fails_loudly(self):
        payload = make_analysis_payload()
        payload["key_moments"][0]["energy"] = 1.1

        with self.assertRaisesRegex(ValueError, "analysis result failed schema 1.4.0"):
            validate_analysis_result(payload)

    def test_llm_payload_summarises_baseline_cues(self):
        validated = validate_analysis_result(make_analysis_payload())
        payload = build_llm_payload(validated)

        self.assertNotIn("firework_cues_baseline", payload)
        self.assertEqual(payload["firework_cue_summary"]["total_count"], 1)
        self.assertEqual(payload["firework_cue_samples"][0]["effect"], "barrage")
        self.assertEqual(payload["cue_reference"]["json_path"], "firework_cues")

    def test_climax_selection_prefers_spaced_chorus_and_high_sections(self):
        sections = [
            {
                "start": 0.0,
                "end": 20.0,
                "label": "intro",
                "intensity": "low",
            },
            {
                "start": 20.0,
                "end": 60.0,
                "label": "chorus",
                "intensity": "medium",
            },
            {
                "start": 60.0,
                "end": 100.0,
                "label": "bridge",
                "intensity": "high",
            },
        ]

        selected = select_climax_indices(
            np.array([5.0, 30.0, 50.0, 70.0]),
            np.array([0.75, 0.8, 0.78, 0.77]),
            np.array([0.2, 0.9, 0.85, 0.8]),
            sections,
            duration=120.0,
        )

        self.assertEqual(len(selected), 2)
        self.assertNotIn(0, selected)

    def test_buildup_filter_caps_and_spaces_anchor_windows(self):
        buildups = [
            {"start": 6.0, "peak": 10.0, "duration": 4.0, "energy_rise": 0.5},
            {"start": 14.0, "peak": 18.0, "duration": 4.0, "energy_rise": 0.6},
            {"start": 36.0, "peak": 40.0, "duration": 4.0, "energy_rise": 0.45},
            {"start": 66.0, "peak": 70.0, "duration": 4.0, "energy_rise": 0.4},
        ]

        filtered = filter_buildups(buildups, duration=100.0)

        self.assertEqual([bu["peak"] for bu in filtered], [18.0, 40.0])

    def test_estimate_downbeats_locks_to_strongest_bar(self):
        sr, hop_length = 22050, 512
        fps = sr / hop_length
        # 8 beats at 120 BPM (0.5s apart). 4/4 with strong bar-1 energy.
        beat_times = [round(i * 0.5, 3) for i in range(8)]
        onset_env = np.zeros(int(8 * fps) + 8, dtype=float)
        for bar_start in (0, 4):
            frame = int(round(bar_start * 0.5 * fps))
            onset_env[frame] = 1.0

        downbeats, bpb = estimate_downbeats(beat_times, onset_env, sr, hop_length)

        self.assertEqual(bpb, 4)
        self.assertEqual(downbeats, [0.0, 2.0])

    def test_drop_label_for_high_peak_non_chorus_section(self):
        sr, hop_length = 22050, 512
        rms = np.zeros(int(40 * sr / hop_length) + 8, dtype=float)
        sections = [
            {"start": 0.0, "end": 10.0, "duration": 10.0, "avg_energy": 0.2, "peak_energy": 0.2, "intensity": "low", "cluster_id": 0, "label": "intro"},
            {"start": 10.0, "end": 20.0, "duration": 10.0, "avg_energy": 0.85, "peak_energy": 0.95, "intensity": "high", "cluster_id": 1, "label": "unknown"},
            {"start": 20.0, "end": 30.0, "duration": 10.0, "avg_energy": 0.6, "peak_energy": 0.7, "intensity": "medium", "cluster_id": 2, "label": "unknown"},
            {"start": 30.0, "end": 40.0, "duration": 10.0, "avg_energy": 0.6, "peak_energy": 0.7, "intensity": "medium", "cluster_id": 2, "label": "unknown"},
        ]

        label_sections_from_clusters(sections, rms, sr, hop_length)

        self.assertEqual(sections[1]["label"], "drop")
        self.assertEqual(sections[2]["label"], "chorus")
        self.assertEqual(sections[3]["label"], "chorus")

    def test_build_label_for_rising_section_before_chorus(self):
        sr, hop_length = 22050, 512
        fps = sr / hop_length
        total = int(30 * fps) + 8
        rms = np.zeros(total, dtype=float)
        s1_start = int(10 * fps)
        s1_end = int(20 * fps)
        rms[s1_start:s1_end] = np.linspace(0.1, 0.9, s1_end - s1_start)
        sections = [
            {"start": 0.0, "end": 10.0, "duration": 10.0, "avg_energy": 0.2, "peak_energy": 0.3, "intensity": "low", "cluster_id": 0, "label": "intro"},
            {"start": 10.0, "end": 20.0, "duration": 10.0, "avg_energy": 0.5, "peak_energy": 0.6, "intensity": "medium", "cluster_id": 1, "label": "unknown"},
            {"start": 20.0, "end": 30.0, "duration": 10.0, "avg_energy": 0.8, "peak_energy": 0.9, "intensity": "high", "cluster_id": 2, "label": "unknown"},
        ]

        label_sections_from_clusters(sections, rms, sr, hop_length)

        self.assertEqual(sections[1]["label"], "build")
        self.assertEqual(sections[2]["label"], "chorus")


if __name__ == "__main__":
    unittest.main()
