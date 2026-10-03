"""Offline handler acceptance: payload boundaries, shared reuse and failure visibility."""

import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from music_jobs import ALGORITHM, MusicHandler, MusicPayload, waveform_peaks  # noqa: E402
from showcrafter_workers.client import Job, DatabaseError  # noqa: E402
from showcrafter_workers.runtime import Usage  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


class MusicJobTests(unittest.TestCase):
    def setUp(self):
        self.track = str(uuid4())
        self.job = Job(
            str(uuid4()),
            "music_analyse",
            {
                "track_id": self.track,
                "audio_url": "https://prod-1.storage.jamendo.com/audio.mp3",
            },
            "test-worker",
            1,
            datetime.now(timezone.utc),
        )
        self.client = Mock()
        self.client.request.side_effect = [
            [{"provider": "jamendo", "audio_media_id": None, "waveform": None}],
            [],
            str(uuid4()),
        ]

    def test_new_track_installs_features_and_audio(self):
        analysis = json.loads((FIXTURES / "analysis.json").read_text())

        def download(url, path):
            path.write_bytes((FIXTURES / "clicks.wav").read_bytes())

        with (
            patch("music_jobs.download_audio", side_effect=download),
            patch("music_jobs.analyse_song", return_value=analysis) as analyse,
            patch("music_jobs.store_audio") as store,
        ):
            result = MusicHandler(self.client)(self.job, Usage())
        self.assertFalse(result["reused"])
        analyse.assert_called_once()
        store.assert_called_once()
        body = self.client.request.call_args.args[2]
        self.assertEqual(body["p_mime"], "audio/wav")
        self.assertEqual(body["p_algorithm"], ALGORITHM)
        self.assertEqual(body["p_job"], self.job.id)
        self.assertEqual(len(body["p_audio_sha256"]), 64)
        self.assertLessEqual(len(body["p_waveform"]), 256)
        self.assertEqual(body["p_analysis"]["file"], self.track)

    def test_repeat_job_does_not_download_or_analyse(self):
        self.client.request.side_effect = [
            [
                {
                    "provider": "jamendo",
                    "audio_media_id": str(uuid4()),
                    "waveform": [0.5],
                }
            ],
            [
                {
                    "id": "shared-analysis",
                    "analysis": json.loads((FIXTURES / "analysis.json").read_text()),
                }
            ],
        ]
        with (
            patch("music_jobs.download_audio") as download,
            patch("music_jobs.analyse_song") as analyse,
        ):
            result = MusicHandler(self.client)(self.job, Usage())
        self.assertEqual(result["analysis_id"], "shared-analysis")
        download.assert_not_called()
        analyse.assert_not_called()

    def test_lookup_failure_is_not_treated_as_missing_analysis(self):
        self.client.request.side_effect = DatabaseError("read failed")
        with (
            self.assertRaises(DatabaseError),
            patch("music_jobs.download_audio") as download,
        ):
            MusicHandler(self.client)(self.job, Usage())
        download.assert_not_called()

    def test_payload_rejects_user_identity_and_invalid_track(self):
        for payload in (
            {**self.job.payload, "user_id": self.track},
            {**self.job.payload, "track_id": "bad"},
        ):
            with self.assertRaises(ValueError):
                MusicPayload.model_validate(payload)

    def test_waveform_has_normalised_bounded_peaks(self):
        peaks = waveform_peaks(FIXTURES / "clicks.wav")
        self.assertTrue(peaks)
        self.assertLessEqual(len(peaks), 256)
        self.assertTrue(all(0 <= peak <= 1 for peak in peaks))


if __name__ == "__main__":
    unittest.main()
