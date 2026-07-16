from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np


WORKER_DIR = Path(__file__).resolve().parents[1]
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from media_analysis import (  # noqa: E402
    MAX_MODEL_FRAME_DIMENSION,
    VideoAnalysisConfig,
    _encode_jpeg,
    _has_consistent_visible_rise,
    _launch_observation,
    _select_model_frame_indexes,
    _weighted_palette,
    analyse_audio_features,
    analyse_firework_video,
    extract_audio_optional,
)


class MediaAnalysisTests(unittest.TestCase):
    def make_synthetic_firework(self, directory: Path) -> Path:
        path = directory / "synthetic-firework.avi"
        writer = cv2.VideoWriter(
            str(path),
            cv2.VideoWriter_fourcc(*"MJPG"),
            30,
            (320, 180),
        )
        if not writer.isOpened():
            self.skipTest("OpenCV MJPG video encoder is unavailable")

        for frame_index in range(90):
            time_seconds = frame_index / 30
            frame = np.zeros((180, 320, 3), dtype=np.uint8)
            if 0.2 <= time_seconds < 1.0:
                progress = (time_seconds - 0.2) / 0.8
                centre = (160 + round(progress * 4), 168 - round(progress * 78))
                cv2.circle(frame, centre, 3, (220, 220, 255), -1)
                cv2.line(
                    frame,
                    (centre[0], centre[1] + 2),
                    (centre[0] - 2, centre[1] + 18),
                    (150, 150, 255),
                    2,
                )
            if 1.0 <= time_seconds <= 2.25:
                age = time_seconds - 1.0
                radius = round(7 + age * 50)
                fade = max(0.08, 1 - age / 1.3)
                for spoke in range(18):
                    angle = spoke * np.pi * 2 / 18
                    endpoint = (
                        round(164 + np.cos(angle) * radius),
                        round(90 + np.sin(angle) * radius + age * age * 7),
                    )
                    colour = (round(40 * fade), round(80 * fade), round(255 * fade))
                    cv2.line(frame, (164, 90), endpoint, colour, 2)
                    cv2.circle(
                        frame,
                        endpoint,
                        2,
                        (round(70 * fade), round(120 * fade), round(255 * fade)),
                        -1,
                    )
            writer.write(frame)
        writer.release()
        return path

    def test_tracks_burst_colour_fade_and_labelled_frames(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            video_path = self.make_synthetic_firework(directory)
            summary, images = analyse_firework_video(
                video_path,
                3.0,
                VideoAnalysisConfig(
                    sample_fps=20, max_sampled_frames=100, max_model_images=12
                ),
            )

        self.assertEqual(summary["schemaVersion"], "showcrafter.video-observations.v1")
        self.assertEqual(summary["sourceWidth"], 320)
        self.assertEqual(summary["sourceHeight"], 180)
        self.assertGreater(summary["sampledFrameCount"], 40)
        self.assertTrue(summary["tracks"])
        self.assertTrue(summary["bursts"])
        strongest = max(summary["bursts"], key=lambda burst: burst["peakIntensity"])
        self.assertAlmostEqual(strongest["burstSeconds"], 1.1, delta=0.25)
        self.assertAlmostEqual(strongest["launchSeconds"], 0.2, delta=0.2)
        self.assertGreater(strongest["liftSeconds"], 0.4)
        self.assertIsNotNone(strongest["launchTrajectory"])
        self.assertAlmostEqual(
            strongest["launchTrajectory"]["frameAspectRatio"],
            16 / 9,
            places=5,
        )
        self.assertIsNotNone(strongest["launchColour"])
        self.assertGreater(strongest["fadeSeconds"], 0.1)
        self.assertIsNotNone(strongest["shapeAtPeak"])
        self.assertIn("aspectRatio", strongest["shapeAtPeak"])
        self.assertIn("majorAxisAngleDegrees", strongest["shapeAtPeak"])
        self.assertTrue(strongest["colours"])
        self.assertTrue(images)
        self.assertTrue(
            any(
                abs(image["timeSeconds"] - strongest["launchSeconds"]) <= 0.051
                for image in images
            )
        )
        self.assertTrue(
            all(
                image["label"].startswith("Source video frame at t=")
                for image in images
            )
        )
        self.assertEqual(
            [frame["timeSeconds"] for frame in summary["frames"]],
            sorted(frame["timeSeconds"] for frame in summary["frames"]),
        )

    def test_silent_video_is_valid_input(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            video_path = self.make_synthetic_firework(directory)
            audio_path = extract_audio_optional(
                video_path, directory, {"audio_codec": None}
            )
            analysis = analyse_audio_features(audio_path, 3.0)

        self.assertIsNone(audio_path)
        self.assertFalse(analysis["hasAudio"])
        self.assertEqual(analysis["events"], [])
        self.assertEqual(analysis["durationSeconds"], 3.0)

    def test_model_evidence_frames_are_bounded_with_recorded_dimensions(self):
        frame = np.zeros((1_800, 2_400, 3), dtype=np.uint8)
        encoded = _encode_jpeg(frame)

        self.assertIsNotNone(encoded)
        self.assertEqual(encoded["width"], MAX_MODEL_FRAME_DIMENSION)
        self.assertEqual(encoded["height"], 960)
        self.assertLessEqual(
            max(encoded["width"], encoded["height"]), MAX_MODEL_FRAME_DIMENSION
        )
        self.assertTrue(encoded["jpegBase64"])

    def test_chromatic_trails_are_not_lost_to_a_clipped_white_core(self):
        frame = np.full((100, 100, 3), 255, dtype=np.uint8)
        frame[:, :30] = (0, 0, 255)
        mask = np.full((100, 100), 255, dtype=np.uint8)

        palette = _weighted_palette(frame, mask)

        self.assertTrue(palette)
        self.assertGreater(int(palette[0]["hex"][1:3], 16), 200)
        self.assertLess(int(palette[0]["hex"][3:5], 16), 80)

    def test_narrow_consistent_lift_is_distinguished_from_track_noise(self):
        consistent = [
            {"y": value}
            for value in (
                0.7214,
                0.7164,
                0.7090,
                0.7090,
                0.7065,
                0.7040,
                0.6998,
                0.6940,
                0.6876,
            )
        ]
        oscillating = [
            {"y": value} for value in (0.7214, 0.6900, 0.7160, 0.6850, 0.7100, 0.6876)
        ]

        self.assertTrue(_has_consistent_visible_rise(consistent))
        self.assertFalse(_has_consistent_visible_rise(oscillating))

        points = [
            {
                "timeSeconds": 0.75 + index * 0.05,
                "x": 0.47,
                "y": point["y"],
                "area": 0.0002,
                "brightness": 0.9,
                "colour": "#ffffff",
            }
            for index, point in enumerate(consistent)
        ]
        launch = _launch_observation(
            [{"id": "track-visible-lift", "points": points}],
            burst_seconds=1.15,
            burst_centroid={"x": 0.47, "y": 0.68},
        )
        self.assertIsNotNone(launch)
        self.assertEqual(launch["launchSeconds"], 0.75)

    def test_model_frames_include_bounded_launch_and_burst_evidence(self):
        frames = [
            {
                "timeSeconds": index / 10,
                "flashIntensity": 0.8 if index == 18 else 0.0,
                "brightCoverage": 0.1 if index == 18 else 0.0,
            }
            for index in range(21)
        ]
        selected = _select_model_frame_indexes(
            frames,
            peaks=[18],
            limit=6,
            bursts=[
                {
                    "launchSeconds": 0.7,
                    "burstSeconds": 1.2,
                    "peakSeconds": 1.8,
                    "endSeconds": 2.0,
                }
            ],
        )

        self.assertLessEqual(len(selected), 6)
        self.assertIn(7, selected)
        self.assertIn(12, selected)
        self.assertIn(18, selected)


if __name__ == "__main__":
    unittest.main()
