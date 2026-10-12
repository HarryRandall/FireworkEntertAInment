"""Independent synthetic firing/position/colour truth and deterministic feature behaviour."""

import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))
from decode import FPS, HEIGHT, WIDTH, Clip, decode  # noqa: E402
from features import crackle, describe_shot, palette, projected_angle  # noqa: E402
from measure import measure  # noqa: E402
from onsets import Priors, detect_shots, fuse  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
# Acceptance tolerances from fixtures/README.md: two 20 Hz frames, content width,
# normalised sRGB channel error after YUV420 compression, and projected degrees.
TIME_TOLERANCE_MS = 100
POSITION_TOLERANCE = 0.04
COLOUR_TOLERANCE = 0.22
ANGLE_TOLERANCE_DEG = 5
TRUTH = json.loads((FIXTURES / "truth.json").read_text())


class MeasurementTests(unittest.TestCase):
    def test_synthetic_ground_truth_and_crops(self):
        for clip in TRUTH["clips"]:
            with self.subTest(clip=clip["name"]):
                result, keyframes = measure(
                    FIXTURES / (clip["name"] + ".mp4"),
                    {
                        "shot_count": len(clip["shots"]),
                        "duration_ms": round(clip["duration_s"] * 1000),
                    },
                )
                self.assertEqual(len(result["shots"]), len(clip["shots"]))
                for expected, shot, feature, crops in zip(
                    clip["shots"],
                    result["shots"],
                    result["features"],
                    keyframes,
                    strict=True,
                ):
                    self.assertLessEqual(abs(shot["t_ms"] - expected["t_ms"]), TIME_TOLERANCE_MS)
                    self.assertLessEqual(abs(shot["x"] - expected["x"]), POSITION_TOLERANCE)
                    self.assertLessEqual(
                        abs(shot["angle_deg"] - expected["angle_deg"]), ANGLE_TOLERANCE_DEG
                    )
                    colour = (
                        np.array(
                            [int(expected["colour"][start : start + 2], 16) for start in (1, 3, 5)]
                        )
                        / 255
                    )
                    self.assertTrue(feature["colours"])
                    self.assertLessEqual(
                        np.max(np.abs(np.array(feature["colours"][0]["rgb"]) - colour)),
                        COLOUR_TOLERANCE,
                    )
                    self.assertGreater(feature["life_ms"], 0)
                    self.assertGreater(feature["apex_ratio"], 0)
                    self.assertGreater(feature["radius_ratio"], 0)
                    self.assertTrue(feature["colours_over_time"])
                    self.assertIsInstance(feature["strobe"], bool)
                    for label in ("launch", "peak", "fade"):
                        encoded = np.frombuffer(
                            base64.b64decode(crops[label]["jpegBase64"]), dtype=np.uint8
                        )
                        image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
                        self.assertGreaterEqual(min(image.shape[:2]), 192)
                    self.assertLessEqual(crops["launch"]["t_ms"], crops["peak"]["t_ms"])
                    self.assertLessEqual(crops["peak"]["t_ms"], crops["fade"]["t_ms"])

    def test_repeat_is_identical_including_keyframe_bytes(self):
        path = FIXTURES / "delayed-audio.mp4"
        self.assertEqual(measure(path, {"shot_count": 1}), measure(path, {"shot_count": 1}))

    def test_without_a_count_weak_re_entering_light_is_not_a_shot(self):
        for name, expected in (("shell-cake", [500, 5500]), ("delayed-audio", [500])):
            with self.subTest(clip=name):
                result, _ = measure(FIXTURES / (name + ".mp4"), {})
                self.assertEqual([shot["t_ms"] for shot in result["shots"]], expected)

    def test_priors_reject_insufficient_evidence_and_duration_mismatch(self):
        path = FIXTURES / "silent-comet.mp4"
        with self.assertRaisesRegex(ValueError, "Insufficient"):
            measure(path, {"shot_count": 200})
        with self.assertRaisesRegex(ValueError, "duration disagrees"):
            measure(path, {"duration_ms": 100000})
        for priors in ({"shot_count": True}, {"shot_count": 0}, {"duration_ms": -1}, []):
            with self.assertRaises(ValueError):
                Priors.parse(priors)

    def test_no_evidence_is_not_invented(self):
        frames = np.zeros((FPS, HEIGHT, WIDTH, 3), dtype=np.uint8)
        clip = Clip(frames, np.zeros(8000, dtype=np.float32), 1, (0, 0, WIDTH, HEIGHT))
        with self.assertRaisesRegex(ValueError, "Insufficient"):
            detect_shots(clip, Priors(1))
        with self.assertRaisesRegex(ValueError, "No firing"):
            detect_shots(clip, Priors())
        self.assertIsNone(crackle(clip, 0, FPS))

    def test_palette_and_projected_angle(self):
        self.assertEqual(palette(np.array([[255, 255, 255], [0, 0, 0]])), [])
        self.assertIsNone(projected_angle([{"centre": None}]))
        self.assertAlmostEqual(
            projected_angle([{"centre": [index, 20 - index]} for index in range(8)]), 45
        )

    def test_audio_crackle_proxy_distinguishes_frequency_and_silence(self):
        samples = np.arange(8000) / 8000
        frames = np.zeros((FPS, HEIGHT, WIDTH, 3), dtype=np.uint8)
        for frequency, expected in ((500, False), (3000, True)):
            clip = Clip(
                frames,
                np.sin(samples * frequency * 2 * np.pi).astype(np.float32),
                1,
                (0, 0, WIDTH, HEIGHT),
            )
            self.assertEqual(crackle(clip, 0, FPS), expected)

    def test_feature_colour_transition_flicker_and_window_truncation(self):
        frames = np.zeros((FPS, HEIGHT, WIDTH, 3), dtype=np.uint8)
        for index in range(FPS):
            colour = [255, 0, 0] if index < FPS / 2 else [0, 255, 0]
            if index % 2 == 0:
                frames[index, 40:140, 120:125] = colour
        clip = Clip(frames, np.zeros(8000, dtype=np.float32), 1, (0, 0, WIDTH, HEIGHT))
        shot = {"t_ms": 0, "x": None, "angle_deg": None}
        feature, _ = describe_shot(clip, shot, FPS - 1, 0)
        self.assertTrue(feature["strobe"])
        self.assertTrue(feature["trail_present"])
        self.assertTrue(feature["truncated"])
        self.assertGreater(feature["trail_length_ratio"], 0)
        swatches = [
            palette["rgb"]
            for sample in feature["colours_over_time"]
            for palette in sample["colours"]
        ]
        self.assertIn([1, 0, 0], swatches)
        self.assertIn([0, 1, 0], swatches)

    def test_fusion_retains_visual_clock_and_reports_actual_sensors(self):
        visual = np.zeros(20)
        audio = np.zeros(20)
        visual[10] = 0.1
        audio[13] = 0.1
        fused = fuse([10], [13], visual, audio)
        self.assertEqual(fused, [(10, 0.1, "audio_visual")])
        self.assertEqual(fuse([], [13], visual, audio)[0][2], "audio")
        self.assertEqual(fuse([10], [], visual, audio)[0][2], "visual")

    def test_invalid_container_is_visible(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bad = root / "source.mp4"
            bad.write_bytes(b"not a video")
            with self.assertRaises(ValueError):
                decode(bad, root)


if __name__ == "__main__":
    unittest.main()
