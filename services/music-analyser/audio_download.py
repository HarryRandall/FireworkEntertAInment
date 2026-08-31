"""Bounded, SSRF-resistant audio download helpers for the Modal analyser."""

import http.client
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable

MAX_AUDIO_BYTES = 50 * 1024 * 1024
DOWNLOAD_TOTAL_TIMEOUT_SECONDS = 30
DOWNLOAD_SOCKET_TIMEOUT_SECONDS = 10
DOWNLOAD_CHUNK_BYTES = 1024 * 1024


class AudioDownloadError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        error_code: str,
        retryable: bool,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.retryable = retryable

    def as_http_detail(self) -> dict:
        return {
            "code": self.error_code,
            "message": str(self),
            "retryable": self.retryable,
        }


def validated_audio_host(audio_url: str) -> str:
    parsed = urllib.parse.urlsplit(audio_url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise AudioDownloadError(
            "audio_url must be an authenticated HTTPS URL",
            status_code=422,
            error_code="invalid_audio_url",
            retryable=False,
        )

    host = parsed.hostname.lower().rstrip(".")
    configured_hosts = {
        value.strip().lower().rstrip(".")
        for value in os.environ.get("ANALYSER_ALLOWED_AUDIO_HOSTS", "").split(",")
        if value.strip()
    }
    if host not in configured_hosts and not host.endswith(".supabase.co"):
        raise AudioDownloadError(
            "audio_url host is not allowed",
            status_code=422,
            error_code="audio_host_not_allowed",
            retryable=False,
        )
    return host


class SameHostRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, expected_host: str):
        super().__init__()
        self.expected_host = expected_host

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if validated_audio_host(newurl) != self.expected_host:
            raise AudioDownloadError(
                "audio_url redirected to a different host",
                status_code=422,
                error_code="cross_host_redirect",
                retryable=False,
            )
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def classify_http_error(error: urllib.error.HTTPError) -> AudioDownloadError:
    status = error.code
    if status in {401, 403}:
        return AudioDownloadError(
            f"signed audio URL was rejected with HTTP {status}",
            status_code=502,
            error_code="signed_url_rejected",
            retryable=True,
        )
    if status in {408, 425, 429} or status >= 500:
        return AudioDownloadError(
            f"audio download returned HTTP {status}",
            status_code=status,
            error_code="audio_upstream_transient",
            retryable=True,
        )
    return AudioDownloadError(
        f"audio download returned HTTP {status}",
        status_code=status,
        error_code="audio_upstream_terminal",
        retryable=False,
    )


def _set_response_socket_timeout(response, timeout_seconds: float) -> None:
    raw = getattr(getattr(response, "fp", None), "raw", None)
    socket = getattr(raw, "_sock", None)
    if socket is not None:
        socket.settimeout(max(0.001, timeout_seconds))


def download_audio(
    audio_url: str,
    path: Path,
    *,
    monotonic: Callable[[], float] = time.monotonic,
) -> None:
    expected_host = validated_audio_host(audio_url)
    opener = urllib.request.build_opener(SameHostRedirectHandler(expected_host))
    request = urllib.request.Request(audio_url, headers={"User-Agent": "ShowCrafter-Analyser/1"})
    deadline = monotonic() + DOWNLOAD_TOTAL_TIMEOUT_SECONDS

    try:
        remaining = deadline - monotonic()
        if remaining <= 0:
            raise TimeoutError
        with opener.open(request, timeout=min(DOWNLOAD_SOCKET_TIMEOUT_SECONDS, remaining)) as response:
            if validated_audio_host(response.geturl()) != expected_host:
                raise AudioDownloadError(
                    "audio_url resolved to a different host",
                    status_code=422,
                    error_code="cross_host_redirect",
                    retryable=False,
                )

            content_length_header = response.headers.get("Content-Length")
            content_length = None
            if content_length_header:
                try:
                    content_length = int(content_length_header)
                except ValueError as exc:
                    raise AudioDownloadError(
                        "audio response has an invalid Content-Length",
                        status_code=502,
                        error_code="invalid_content_length",
                        retryable=True,
                    ) from exc
                if content_length < 0:
                    raise AudioDownloadError(
                        "audio response has an invalid Content-Length",
                        status_code=502,
                        error_code="invalid_content_length",
                        retryable=True,
                    )
                if content_length > MAX_AUDIO_BYTES:
                    raise AudioDownloadError(
                        "audio file exceeds the 50 MiB limit",
                        status_code=413,
                        error_code="audio_too_large",
                        retryable=False,
                    )

            downloaded = 0
            with path.open("wb") as destination:
                while True:
                    remaining = deadline - monotonic()
                    if remaining <= 0:
                        raise TimeoutError
                    _set_response_socket_timeout(
                        response,
                        min(DOWNLOAD_SOCKET_TIMEOUT_SECONDS, remaining),
                    )
                    chunk = response.read(DOWNLOAD_CHUNK_BYTES)
                    if not chunk:
                        break
                    downloaded += len(chunk)
                    if downloaded > MAX_AUDIO_BYTES:
                        raise AudioDownloadError(
                            "audio file exceeds the 50 MiB limit",
                            status_code=413,
                            error_code="audio_too_large",
                            retryable=False,
                        )
                    destination.write(chunk)

            if content_length is not None and downloaded != content_length:
                raise AudioDownloadError(
                    "audio response was truncated",
                    status_code=502,
                    error_code="audio_response_truncated",
                    retryable=True,
                )
    except AudioDownloadError:
        raise
    except TimeoutError as exc:
        raise AudioDownloadError(
            "audio download timed out",
            status_code=504,
            error_code="audio_download_timeout",
            retryable=True,
        ) from exc
    except urllib.error.HTTPError as exc:
        raise classify_http_error(exc) from exc
    except http.client.IncompleteRead as exc:
        raise AudioDownloadError(
            "audio response was truncated",
            status_code=502,
            error_code="audio_response_truncated",
            retryable=True,
        ) from exc
    except http.client.HTTPException as exc:
        raise AudioDownloadError(
            "audio download failed",
            status_code=502,
            error_code="audio_download_failed",
            retryable=True,
        ) from exc
    except (urllib.error.URLError, ConnectionError, OSError) as exc:
        raise AudioDownloadError(
            "audio download failed",
            status_code=502,
            error_code="audio_download_failed",
            retryable=True,
        ) from exc
