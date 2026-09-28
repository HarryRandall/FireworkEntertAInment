"""Authenticated callbacks for independently queued song analyses."""

import hmac
import os
import time
import uuid
from urllib.parse import urlsplit

import requests


def authorise(authorization):
    expected = os.environ.get("ANALYSER_SHARED_SECRET", "")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    return bool(expected and supplied and hmac.compare_digest(supplied, expected))


def app_origin():
    origin = os.environ.get("SHOWCRAFTER_APP_ORIGIN", "").rstrip("/")
    parsed = urlsplit(origin)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or
            parsed.password or parsed.path or parsed.query or parsed.fragment or parsed.port):
        raise ValueError("SHOWCRAFTER_APP_ORIGIN must be an HTTPS origin.")
    return origin


def validate_job(payload):
    """Restrict callback targets before forwarding the shared credential."""
    if payload.get("callback_url") != app_origin() + "/api/internal/music-analysis/callback":
        raise ValueError("Invalid analyser callback target.")
    uuid.UUID(payload["analysis_id"])
    uuid.UUID(payload["lease_token"])
    if not isinstance(payload.get("audio_url"), str):
        raise ValueError("Invalid audio URL.")
    return payload


def deliver_callback(payload, outcome, runtime_ms):
    validate_job(payload)
    body = {"analysis_id": payload["analysis_id"], "lease_token": payload["lease_token"],
            "runtime_ms": runtime_ms, **outcome}
    for attempt, delay in enumerate((0, 1, 3, 10)):
        if delay:
            time.sleep(delay)
        try:
            response = requests.post(
                payload["callback_url"], json=body,
                headers={"Authorization": "Bearer " + os.environ["ANALYSER_SHARED_SECRET"]},
                timeout=30, allow_redirects=False,
            )
            if response.status_code == 200:
                return
            if response.status_code < 500 and response.status_code != 429:
                raise ValueError(f"Analyser callback rejected with HTTP {response.status_code}.")
        except requests.RequestException:
            if attempt == 3:
                raise
    raise RuntimeError("Analyser callback could not be saved; manual recovery may be required.")
