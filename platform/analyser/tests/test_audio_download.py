import http.client
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
    MAX_AUDIO_BYTES,
    classify_http_error,
    download_audio,
    validated_audio_host,
)


class FakeResponse:
    def __init__(self, chunks, *, content_length=None, on_read=None, read_error=None):
        self.chunks = list(chunks)
        self.headers = {}
        if content_length is not None:
            self.headers["Content-Length"] = str(content_length)
        self.on_read = on_read
        self.read_error = read_error

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def geturl(self):
        return "https://project.supabase.co/storage/v1/object/sign/audio/file.wav"

    def read(self, _size):
        if self.on_read is not None:
            self.on_read()
        if self.read_error is not None:
            error = self.read_error
            self.read_error = None
            raise error
        return self.chunks.pop(0) if self.chunks else b""


class FakeOpener:
    def __init__(self, response):
        self.response = response

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
    def setUp(self):
        self.hosts = patch.dict(
            "os.environ",
            {"ANALYSER_ALLOWED_AUDIO_HOSTS": "project.supabase.co,storage.example.com"},
            clear=False,
        )
        self.hosts.start()

    def tearDown(self):
        self.hosts.stop()

    def test_host_validation_blocks_plain_http_credentials_and_unlisted_hosts(self):
        invalid = (
            "http://project.supabase.co/audio.wav",
            "https://user:secret@project.supabase.co/audio.wav",
            "https://127.0.0.1/audio.wav",
            "https://example.com/audio.wav",
        )
        for url in invalid:
            with self.subTest(url=url), self.assertRaises(AudioDownloadError):
                validated_audio_host(url)

    def test_host_validation_requires_an_exact_allowlist_and_supports_custom_domains(self):
        self.assertEqual(
            validated_audio_host("https://storage.example.com/audio.wav"),
            "storage.example.com",
        )
        with patch.dict("os.environ", {"ANALYSER_ALLOWED_AUDIO_HOSTS": ""}, clear=False):
            with self.assertRaises(AudioDownloadError) as raised:
                validated_audio_host("https://project.supabase.co/audio.wav")
        self.assertEqual(raised.exception.error_code, "audio_host_allowlist_missing")

    def test_slow_stream_is_bounded_by_one_total_deadline(self):
        clock = Clock()
        response = FakeResponse(
            [b"a", b"b", b"c"],
            content_length=3,
            on_read=lambda: clock.advance(16),
        )
        with tempfile.TemporaryDirectory() as tmp:
            with patch(
                "audio_download.urllib.request.build_opener",
                return_value=FakeOpener(response),
            ):
                with self.assertRaises(AudioDownloadError) as raised:
                    download_audio(
                        "https://project.supabase.co/storage/v1/object/sign/audio/file.wav",
                        Path(tmp) / "audio",
                        monotonic=clock,
                    )
        self.assertEqual(raised.exception.error_code, "audio_download_timeout")
        self.assertTrue(raised.exception.retryable)

    def test_declared_oversized_audio_is_rejected_without_streaming(self):
        response = FakeResponse([], content_length=MAX_AUDIO_BYTES + 1)
        with tempfile.TemporaryDirectory() as tmp:
            with patch(
                "audio_download.urllib.request.build_opener",
                return_value=FakeOpener(response),
            ):
                with self.assertRaises(AudioDownloadError) as raised:
                    download_audio(
                        "https://project.supabase.co/storage/v1/object/sign/audio/file.wav",
                        Path(tmp) / "audio",
                    )
        self.assertEqual(raised.exception.status_code, 413)
        self.assertFalse(raised.exception.retryable)
        self.assertEqual(raised.exception.error_code, "audio_too_large")

    def test_truncated_responses_are_retryable(self):
        cases = (
            FakeResponse([b"abc"], content_length=6),
            FakeResponse([], read_error=http.client.IncompleteRead(partial=b"abc", expected=6)),
        )
        for response in cases:
            with self.subTest(response=response), tempfile.TemporaryDirectory() as tmp:
                with patch(
                    "audio_download.urllib.request.build_opener",
                    return_value=FakeOpener(response),
                ):
                    with self.assertRaises(AudioDownloadError) as raised:
                        download_audio(
                            "https://project.supabase.co/storage/v1/object/sign/audio/file.wav",
                            Path(tmp) / "audio",
                        )
            self.assertEqual(raised.exception.error_code, "audio_response_truncated")
            self.assertTrue(raised.exception.retryable)

    def test_http_error_retry_classification_is_explicit(self):
        cases = (
            (403, 502, True, "signed_url_rejected"),
            (404, 404, False, "audio_upstream_terminal"),
            (429, 429, True, "audio_upstream_transient"),
            (503, 503, True, "audio_upstream_transient"),
        )
        for upstream, expected_status, retryable, error_code in cases:
            with self.subTest(upstream=upstream):
                source = urllib.error.HTTPError("https://project.supabase.co/audio", upstream, "error", {}, None)
                classified = classify_http_error(source)
                self.assertEqual(classified.status_code, expected_status)
                self.assertEqual(classified.retryable, retryable)
                self.assertEqual(classified.error_code, error_code)


if __name__ == "__main__":
    unittest.main()
