"""Queue payload, Storage integrity and failure handling without external calls."""

import hashlib
import io
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))
from showcrafter_workers.client import Job  # noqa: E402
from showcrafter_workers.runtime import Usage  # noqa: E402

from storage import download, object_path  # noqa: E402
from video_jobs import VideoHandler, payload_ids  # noqa: E402


class JobTests(unittest.TestCase):
    def setUp(self):
        self.analysis_id = str(uuid4())
        self.media_id = str(uuid4())
        self.job = Job(
            str(uuid4()),
            "video_analyse",
            {"analysis_id": self.analysis_id, "media_id": self.media_id},
            "offline",
            1,
            datetime.now(timezone.utc) + timedelta(minutes=5),
        )

    def test_payload_requires_exact_uuid_pair(self):
        self.assertEqual(payload_ids(self.job.payload), (self.analysis_id, self.media_id))
        for payload in (
            {},
            {**self.job.payload, "url": "https://example.test"},
            {**self.job.payload, "media_id": "invalid"},
        ):
            with self.assertRaises(ValueError):
                payload_ids(payload)

    def test_installed_result_reused_without_storage(self):
        client = Mock()
        client.request.return_value = {"status": "interpreting"}
        with patch("video_jobs.download", side_effect=AssertionError("unexpected download")):
            self.assertTrue(VideoHandler(client)(self.job, Usage())["reused"])
        self.assertEqual(client.request.call_count, 1)
        self.assertEqual(client.request.call_args.args[1], "/rpc/save_video_measurement")

    def test_failure_is_visible_and_fenced(self):
        client = Mock()
        client.request.side_effect = [{"status": "measuring", "priors": {}}, [], {}]
        with self.assertRaisesRegex(ValueError, "media row"):
            VideoHandler(client)(self.job, Usage())
        failure = client.request.call_args.args[2]
        self.assertEqual(failure["p_state"], "failed")
        self.assertEqual(failure["p_error"], "ValueError")
        self.assertEqual(failure["p_attempt"], self.job.attempt)

    def test_unsafe_paths_and_non_video_rejected(self):
        for path in ("../x", "/root", "a//b", "a\\b", "a?token", "a\nsecret"):
            with self.assertRaises(ValueError):
                object_path(path)
        self.assertEqual(object_path("supplier/a clip.mp4"), "supplier/a%20clip.mp4")
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(ValueError):
                download(Mock(), {"kind": "audio", "mime": "audio/mp3"}, Path(temporary) / "video")

    def test_storage_size_and_hash_verified(self):
        data = b"synthetic"
        media = {
            "kind": "video",
            "mime": "video/mp4",
            "bucket": "imports",
            "path": "video/test.mp4",
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "video"
            with patch("storage.storage_request", return_value=io.BytesIO(data)):
                download(Mock(), media, target)
            self.assertEqual(target.read_bytes(), data)
            for corrupted in (data + b"overflow", data[:-1], b"wronghash"):
                with patch("storage.storage_request", return_value=io.BytesIO(corrupted)):
                    with self.assertRaises(ValueError):
                        download(Mock(), media, target)

    def test_modal_registration_is_offline(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location("video_modal", SERVICE / "modal_app.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.app.name, "showcrafter-video")


if __name__ == "__main__":
    unittest.main()
