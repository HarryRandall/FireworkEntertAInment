"""Pinned assets reject corruption and incorrect HTTP ranges without whole-archive reads."""

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from asset_integrity import file_sha256  # noqa: E402
from download_evaluation import RemoteZip  # noqa: E402


class AssetTests(unittest.TestCase):
    def response(self, content, *, status=206, content_range=None):
        response = Mock()
        response.status = status
        response.headers = {"Content-Range": content_range or "bytes 0-2/656927981"}
        response.read.return_value = content
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        return response

    def test_hash_is_of_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "asset"
            path.write_bytes(b"known bytes")
            self.assertEqual(
                file_sha256(path), hashlib.sha256(b"known bytes").hexdigest()
            )

    def test_exact_range_advances_byte_position(self):
        stream = RemoteZip("audio_mono-mic.zip")
        with patch("urllib.request.urlopen", return_value=self.response(b"zip")):
            self.assertEqual(stream.read(3), b"zip")
        self.assertEqual(stream.tell(), 3)

    def test_full_archive_response_is_rejected(self):
        stream = RemoteZip("audio_mono-mic.zip")
        with (
            patch(
                "urllib.request.urlopen", return_value=self.response(b"zip", status=200)
            ),
            self.assertRaises(ValueError),
        ):
            stream.read(3)

    def test_truncated_range_retries_without_advancing(self):
        stream = RemoteZip("audio_mono-mic.zip")
        with patch(
            "urllib.request.urlopen",
            side_effect=[self.response(b"z"), self.response(b"zip")],
        ) as request:
            self.assertEqual(stream.read(3), b"zip")
            self.assertEqual(request.call_count, 2)
        self.assertEqual(stream.tell(), 3)

    def test_exhausted_ranges_fail_visibly(self):
        stream = RemoteZip("audio_mono-mic.zip")
        with (
            patch("urllib.request.urlopen", return_value=self.response(b"z")),
            self.assertRaises(ValueError),
        ):
            stream.read(3)
        self.assertEqual(stream.tell(), 0)

    def test_manifest_has_independent_complete_clocks(self):
        manifest = json.loads(
            (Path(__file__).resolve().parents[1] / "evals/guitarset.json").read_text()
        )
        self.assertEqual(len(manifest["tracks"]), 22)
        for track in manifest["tracks"]:
            self.assertTrue(track["beats"])
            self.assertTrue(track["downbeats"])
            self.assertTrue(set(track["downbeats"]).issubset(track["beats"]))
            self.assertEqual(len(track["audio_sha256"]), 64)
            self.assertEqual(len(track["annotation_sha256"]), 64)


if __name__ == "__main__":
    unittest.main()
