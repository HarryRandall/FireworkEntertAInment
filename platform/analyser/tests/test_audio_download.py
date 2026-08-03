import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch


ANALYSER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSER_DIR))

from audio_download import (  # noqa: E402
    AudioDownloadError,
    classify_http_error,
    download_audio,
)


class FakeResponse:
    def __init__(self, chunks, *, content_length=None, on_read=None):
        self.chunks = list(chunks)
        self.headers = {}
        if content_length is not None:
            self.headers["Content-Length"] = str(content_length)
        self.on_read = on_read

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def geturl(self):
        return "https://project.supabase.co/storage/v1/object/sign/audio/file.wav"

    def read(self, _size):
        if self.on_read is not None:
            self.on_read()
        return self.chunks.pop(0) if self.chunks else b""


class FakeOpener:
    def __init__(self, response):
        self.response = response
        self.timeout = None

    def open(self, _request, *, timeout):
        self.timeout = timeout
        return self.response


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class AudioDownloadTests(unittest.TestCase):
    def test_slow_stream_is_bounded_by_one_total_deadline(self):
        clock = Clock()
        response = FakeResponse(
            [b"a", b"b", b"c"],
            content_length=3,
            on_read=lambda: clock.advance(16),
        )
        opener = FakeOpener(response)

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audio"
            with patch("audio_download.urllib.request.build_opener", return_value=opener):
                with self.assertRaises(AudioDownloadError) as raised:
                    download_audio(
                        "https://project.supabase.co/storage/v1/object/sign/audio/file.wav",
                        path,
                        monotonic=clock,
                    )

        self.assertEqual(raised.exception.status_code, 504)
        self.assertTrue(raised.exception.retryable)
        self.assertEqual(raised.exception.error_code, "audio_download_timeout")

    def test_truncated_response_is_retryable(self):
        response = FakeResponse([b"abc"], content_length=6)
        opener = FakeOpener(response)

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audio"
            with patch("audio_download.urllib.request.build_opener", return_value=opener):
                with self.assertRaises(AudioDownloadError) as raised:
                    download_audio(
                        "https://project.supabase.co/storage/v1/object/sign/audio/file.wav",
                        path,
                    )

        self.assertEqual(raised.exception.status_code, 502)
        self.assertTrue(raised.exception.retryable)
        self.assertEqual(raised.exception.error_code, "audio_response_truncated")

    def test_http_error_retry_classification_is_explicit(self):
        cases = (
            (403, 502, True, "signed_url_rejected"),
            (404, 404, False, "audio_upstream_terminal"),
            (410, 410, False, "audio_upstream_terminal"),
            (429, 429, True, "audio_upstream_transient"),
            (503, 503, True, "audio_upstream_transient"),
        )
        for upstream, expected_status, retryable, error_code in cases:
            with self.subTest(upstream=upstream):
                source = urllib.error.HTTPError(
                    "https://project.supabase.co/audio",
                    upstream,
                    "error",
                    {},
                    None,
                )
                classified = classify_http_error(source)
                self.assertEqual(classified.status_code, expected_status)
                self.assertEqual(classified.retryable, retryable)
                self.assertEqual(classified.error_code, error_code)


if __name__ == "__main__":
    unittest.main()
