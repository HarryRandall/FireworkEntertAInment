import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    import librosa
    import numpy as np
    import soundfile as sf
except ModuleNotFoundError as exc:
    raise unittest.SkipTest("Install platform/analyser/requirements.txt to run analyser tests") from exc


ANALYSER_DIR = Path(__file__).resolve().parents[1]
SCHEMA_MUTATIONS = json.loads(
    (Path(__file__).parent / "fixtures" / "schema-mutations.json").read_text(encoding="utf-8")
)
sys.path.insert(0, str(ANALYSER_DIR))

try:
    from showcrafter import (  # noqa: E402
        SCHEMA_VERSION,
        AudioInputError,
        MAX_AUDIO_DURATION_SECONDS,
        MAX_DECODED_SAMPLES,
        analyse_song,
        build_llm_payload,
        build_firework_cue_summary,
        estimate_downbeats,
        enforce_audio_limits,
        filter_buildups,
        get_section_at_time,
        label_sections_from_clusters,
        laplacian_segment,
        preflight_audio_duration,
        refine_event_times,
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
        self.assertIn("finale_window", validated["derived"])
        self.assertIsNone(validated["derived"]["finale_window"])

    def test_out_of_range_energy_fails_loudly(self):
        payload = make_analysis_payload()
        payload["key_moments"][0]["energy"] = 1.1

        with self.assertRaisesRegex(ValueError, "analysis result failed schema 1.4.0"):
            validate_analysis_result(payload)

    def test_python_contract_rejects_the_same_cross_field_mutations_as_zod(self):
        for mutation in SCHEMA_MUTATIONS:
            with self.subTest(mutation=mutation["name"]):
                payload = make_analysis_payload()
                target = payload
                for segment in mutation["path"][:-1]:
                    target = target[segment]
                target[mutation["path"][-1]] = mutation["value"]
                with self.assertRaises(ValueError):
                    validate_analysis_result(payload)

    def test_python_contract_rejects_overlapping_sections(self):
        payload = make_analysis_payload()
        payload["sections"] = [
            {**payload["sections"][0], "end": 8.0, "duration": 8.0},
            {
                **payload["sections"][0],
                "start": 7.0,
                "end": 12.0,
                "duration": 5.0,
                "cluster_id": 1,
                "label": "outro",
            },
        ]
        payload["derived"]["section_rank_by_energy"] = [0, 1]

        with self.assertRaisesRegex(ValueError, "non-overlapping"):
            validate_analysis_result(payload)

    def test_python_producer_contract_rejects_legacy_or_incomplete_bar_grid(self):
        legacy = make_analysis_payload()
        legacy["schema_version"] = "1.3.0"
        with self.assertRaises(ValueError):
            validate_analysis_result(legacy)

        for field in ("downbeat_times", "beats_per_bar"):
            with self.subTest(field=field):
                payload = make_analysis_payload()
                del payload[field]
                with self.assertRaises(ValueError):
                    validate_analysis_result(payload)

    def test_beatless_audio_is_a_terminal_input_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "silence.wav"
            sf.write(path, np.zeros(22050 * 2, dtype=np.float32), 22050)

            with self.assertRaisesRegex(AudioInputError, "reliable rhythmic grid") as raised:
                analyse_song(str(path))

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.error_code, "insufficient_musical_content")

    def test_pure_tone_is_a_terminal_input_error(self):
        sr = 22050
        samples = np.arange(sr * 2, dtype=np.float32) / sr
        tone = (0.2 * np.sin(2 * np.pi * 440 * samples)).astype(np.float32)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "tone.wav"
            sf.write(path, tone, sr)

            with self.assertRaises(AudioInputError) as raised:
                analyse_song(str(path))

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.error_code, "insufficient_musical_content")

    def test_damaged_or_unsupported_audio_is_terminal(self):
        samples = {
            "empty.wav": b"",
            "garbage.mp3": b"not an audio file\x00\x01\x02",
            "truncated.wav": b"RIFF\x24\x00\x00\x00WAVEfmt ",
            "truncated.aac": b"\xff\xf1\x50\x80\x00\x1f\xfc" + b"\x00" * 20,
        }
        with tempfile.TemporaryDirectory() as tmp:
            for filename, content in samples.items():
                with self.subTest(filename=filename):
                    path = Path(tmp) / filename
                    path.write_bytes(content)
                    with self.assertRaises(AudioInputError) as raised:
                        analyse_song(str(path))
                    self.assertEqual(raised.exception.status_code, 415)
                    self.assertEqual(raised.exception.error_code, "unsupported_audio")

    def test_ffprobe_rejects_overlong_audio_before_decode(self):
        completed = subprocess.CompletedProcess(
            args=["ffprobe"],
            returncode=0,
            stdout=str(MAX_AUDIO_DURATION_SECONDS + 0.01),
            stderr="",
        )
        with patch("showcrafter.subprocess.run", return_value=completed):
            with self.assertRaises(AudioInputError) as raised:
                preflight_audio_duration("overlong.mp3")

        self.assertEqual(raised.exception.status_code, 413)
        self.assertEqual(raised.exception.error_code, "audio_too_long")

    def test_decoded_sample_limit_is_enforced_independently(self):
        with self.assertRaises(AudioInputError) as raised:
            enforce_audio_limits(
                duration_seconds=MAX_AUDIO_DURATION_SECONDS,
                decoded_samples=MAX_DECODED_SAMPLES + 1,
            )

        self.assertEqual(raised.exception.status_code, 413)
        self.assertEqual(raised.exception.error_code, "audio_too_long")

    def test_actual_python_json_passes_zod_and_builds_cue_slots(self):
        if os.environ.get("SHOWCRAFTER_RUN_CROSS_LANGUAGE_CONTRACT") != "1":
            self.skipTest("Run by the dedicated analyser-contract CI job")

        node_binary = os.environ.get("SHOWCRAFTER_NODE_BINARY") or shutil.which("node")
        if not node_binary:
            self.fail("The analyser contract requires Node.js 22 or newer")
        version = subprocess.run(
            [node_binary, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        self.assertEqual(version.returncode, 0, version.stderr)
        major_version = int(version.stdout.strip().lstrip("v").split(".", maxsplit=1)[0])
        self.assertGreaterEqual(major_version, 22)

        sr = 22050
        sample_times = np.arange(sr * 10, dtype=np.float32) / sr
        amplitude = 0.02 + 0.06 * (sample_times / 10.0)
        tonal_bed = amplitude * np.sin(2 * np.pi * 220 * sample_times)
        clicks = librosa.clicks(
            times=np.arange(0.5, 10.0, 0.5),
            sr=sr,
            length=sr * 10,
            click_duration=0.1,
        )
        audio = (tonal_bed + clicks).astype(np.float32)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "clicks.wav"
            sf.write(path, audio, sr)
            result = analyse_song(str(path))

        helper = ANALYSER_DIR.parent / "tests" / "analyser-pipeline-helper.mjs"
        completed = subprocess.run(
            [node_binary, "--experimental-strip-types", str(helper)],
            cwd=ANALYSER_DIR.parent,
            input=json.dumps(result),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        summary = json.loads(completed.stdout)
        self.assertEqual(summary["schemaVersion"], "1.4.0")
        self.assertTrue(summary["finaleWindowPresent"])
        self.assertIsNone(summary["finaleWindow"])
        self.assertTrue(summary["plannerReturnedSlots"])
        self.assertGreater(summary["slotCount"], 0)

    def test_decoder_uses_audio_content_instead_of_the_filename_extension(self):
        sr = 22050
        audio = librosa.clicks(
            times=np.arange(0.5, 10.0, 0.5),
            sr=sr,
            length=sr * 10,
            click_duration=0.1,
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "clicks.mp3"
            sf.write(path, audio, sr, format="WAV")

            result = analyse_song(str(path))

        self.assertEqual(len(result["sections"]), 1)
        self.assertEqual(result["sections"][0]["label"], "unknown")
        self.assertGreater(result["tempo_bpm"], 0)

    def test_short_audio_threshold_enters_spectral_path_at_twenty_seconds(self):
        sr, hop_length = 22050, 512
        y = np.zeros(sr * 20, dtype=np.float32)
        rms = np.zeros(int(sr * 20 / hop_length) + 1, dtype=float)
        beat_frames = np.arange(0, 400, 40, dtype=int)

        sections, cqt = laplacian_segment(
            y,
            sr,
            beat_frames,
            rms,
            hop_length,
            19.99,
        )
        self.assertEqual(sections[0]["label"], "unknown")
        self.assertIsNone(cqt)

        with patch("showcrafter.librosa.cqt", side_effect=RuntimeError("spectral path entered")):
            with self.assertRaisesRegex(RuntimeError, "spectral path entered"):
                laplacian_segment(y, sr, beat_frames, rms, hop_length, 20.0)

    def test_adjacent_sections_use_half_open_membership(self):
        sections = [
            {"index": 0, "label": "verse", "start": 0.0, "end": 5.0},
            {"index": 1, "label": "chorus", "start": 5.0, "end": 10.0},
        ]
        cues = [
            {"time": 4.999, "effect": "single"},
            {"time": 5.0, "effect": "accent"},
            {"time": 10.0, "effect": "barrage"},
        ]

        self.assertIs(get_section_at_time(5.0, sections), sections[1])
        self.assertIs(get_section_at_time(10.0, sections), sections[1])
        summary = build_firework_cue_summary(cues, sections)
        self.assertEqual(summary["counts_by_section"][0]["total_count"], 1)
        self.assertEqual(summary["counts_by_section"][1]["total_count"], 2)

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

    def test_estimate_downbeats_rejects_a_flat_unreliable_phase(self):
        beat_times = [round(i * 0.5, 3) for i in range(12)]
        onset_env = np.ones(300, dtype=float)

        downbeats, bpb = estimate_downbeats(beat_times, onset_env, 22050, 512)

        self.assertEqual(downbeats, [])
        self.assertEqual(bpb, 4)

    def test_event_refinement_moves_to_the_local_transient_peak(self):
        onset_env = np.zeros(20, dtype=float)
        onset_env[6:9] = [0.4, 1.0, 0.4]

        refined = refine_event_times([6], onset_env, sr=100, hop_length=10)

        self.assertAlmostEqual(refined[0], 0.7, places=3)

    def test_event_refinement_keeps_flat_and_ambiguous_windows_on_grid(self):
        flat = np.zeros(20, dtype=float)
        tied = np.zeros(20, dtype=float)
        tied[4] = 1.0
        tied[8] = 1.0

        flat_time = refine_event_times([6], flat, sr=100, hop_length=10)
        tied_time = refine_event_times([6], tied, sr=100, hop_length=10)

        self.assertAlmostEqual(flat_time[0], 0.6, places=3)
        self.assertAlmostEqual(tied_time[0], 0.6, places=3)

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
