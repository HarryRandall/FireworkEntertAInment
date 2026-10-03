"""Shared-track music jobs: bounded audio download, reusable features and fenced writes."""

import argparse
import hashlib
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener
from uuid import UUID, uuid4

import numpy as np
import soundfile as sf
from pydantic import BaseModel, ConfigDict, HttpUrl
from showcrafter_workers.client import (
    DatabaseError,
    Job,
    JobClient,
    Settings,
    NoRedirects,
)
from showcrafter_workers.runtime import Usage, drain

from audio_download import download_audio
from showcrafter import (
    analyse_song,
    elapsed_ms,
    validate_analysis_result,
)

from beat_tracking import DEFAULT_TRACKER, algorithm_for

ALGORITHM = algorithm_for(DEFAULT_TRACKER)
# UI peak budget per track, chosen to bound JSON size independently of song length.
WAVEFORM_PEAK_COUNT = 256
# Audio upload deadline in seconds, allowing a bounded 50 MiB input on a slower link.
STORAGE_TIMEOUT_SECONDS = 60
# MIME names from libsndfile's decoded container format, not URL suffixes.
AUDIO_MIME_TYPES = {
    "WAV": "audio/wav",
    "MP3": "audio/mpeg",
    "OGG": "audio/ogg",
    "FLAC": "audio/flac",
}


class MusicPayload(BaseModel):
    """Backend enqueue contract; identity is a shared Jamendo track, never a user."""

    model_config = ConfigDict(extra="forbid")
    track_id: UUID
    audio_url: HttpUrl


def waveform_peaks(path: Path) -> list[float]:
    """Return up to 256 normalised absolute-amplitude peaks across decoded audio frames.

    Reads bounded blocks without retaining a second full waveform. Stereo channels
    contribute their greatest amplitude; each peak covers an equal time interval.
    """
    with sf.SoundFile(path) as audio:
        frames_per_peak = max(1, int(np.ceil(audio.frames / WAVEFORM_PEAK_COUNT)))
        peaks = []
        while True:
            block = audio.read(frames_per_peak, dtype="float32", always_2d=True)
            if not block.size:
                return peaks
            peaks.append(float(np.clip(np.max(np.abs(block)), 0, 1)))


def store_audio(client: JobClient, path: Path, object_path: str, mime: str) -> None:
    """Upload bounded validated audio to the private bucket without forwarding redirects.

    The content-addressed path makes retry uploads idempotent. Storage and Postgres
    cannot share a transaction; an interrupted upload can leave an unreferenced object.
    """
    request = Request(
        client.settings.url + "/storage/v1/object/audio/" + object_path,
        data=path.read_bytes(),
        method="POST",
        headers={
            "apikey": client.settings.service_role_key,
            "Authorization": "Bearer " + client.settings.service_role_key,
            "Content-Type": mime,
            "x-upsert": "true",
        },
    )
    try:
        with build_opener(NoRedirects()).open(
            request, timeout=STORAGE_TIMEOUT_SECONDS
        ) as response:
            response.read()
    except HTTPError as error:
        error.close()
        raise DatabaseError(f"Audio storage failed (HTTP {error.code})") from None
    except (URLError, OSError, TimeoutError):
        raise DatabaseError("Audio storage transport failed") from None


class MusicHandler:
    """Bind feature processing to the same service-role client as the queue runtime."""

    def __init__(self, client: JobClient):
        """Use one trusted database origin for track lookup, storage and result writes."""
        self.client = client

    def __call__(self, job: Job, usage: Usage) -> dict:
        """Analyse one shared track, reusing the current algorithm on repeated jobs.

        Audio URLs are untrusted and pass the bounded downloader's host checks.
        Result installation checks ownership in SQL; queue completion remains owned
        by the shared runtime. No provider call with a monetary charge is made.
        """
        payload = MusicPayload.model_validate(job.payload)
        track_id = str(payload.track_id)
        tracks = self.client.request("GET", f"/music_tracks?id=eq.{track_id}")
        if len(tracks) != 1 or tracks[0]["provider"] != "jamendo":
            raise ValueError("Jamendo track required")
        current = self.client.request(
            "GET",
            f"/music_analyses?track_id=eq.{track_id}&is_current=eq.true&algorithm=eq.{ALGORITHM}",
        )
        if (
            current
            and tracks[0]["audio_media_id"]
            and tracks[0]["waveform"] is not None
        ):
            validate_analysis_result(current[0]["analysis"])
            return {
                "track_id": track_id,
                "analysis_id": current[0]["id"],
                "reused": True,
            }
        return self.analyse_track(job, track_id, str(payload.audio_url))

    def analyse_track(self, job: Job, track_id: str, audio_url: str) -> dict:
        """Install validated features and content-addressed audio for this fenced attempt."""
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "audio"
            download_started = time.perf_counter()
            download_audio(audio_url, path)
            download_ms = elapsed_ms(download_started)
            audio_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            analysis = validate_analysis_result(
                analyse_song(
                    str(path),
                    runner_version=ALGORITHM,
                    initial_timings_ms={"download_ms": download_ms},
                )
            )
            # Temporary filesystem names are not part of the durable analysis identity.
            analysis["file"] = track_id
            peaks = waveform_peaks(path)
            self.client.heartbeat(job)
            mime = AUDIO_MIME_TYPES.get(
                sf.info(path).format, "application/octet-stream"
            )
            store_audio(self.client, path, f"{track_id}/{audio_hash}", mime)
            analysis_id = self.client.request(
                "POST",
                "/rpc/install_music_result",
                {
                    "p_job": job.id,
                    "p_worker": job.worker,
                    "p_attempt": job.attempt,
                    "p_algorithm": ALGORITHM,
                    "p_analysis": analysis,
                    "p_audio_sha256": audio_hash,
                    "p_bytes": path.stat().st_size,
                    "p_mime": mime,
                    "p_waveform": peaks,
                },
            )
        return {"track_id": track_id, "analysis_id": analysis_id, "reused": False}


def main() -> None:
    """Drain only music jobs against explicitly configured local Supabase, without Modal."""
    parser = argparse.ArgumentParser(description="Drain local music analysis jobs")
    parser.add_argument("--max-jobs", type=int, default=1)
    args = parser.parse_args()
    client = JobClient(Settings.from_environment(local_only=True))
    drain(
        client,
        {"music_analyse": MusicHandler(client)},
        f"local-music-{uuid4()}",
        max_jobs=args.max_jobs,
    )


if __name__ == "__main__":
    main()
