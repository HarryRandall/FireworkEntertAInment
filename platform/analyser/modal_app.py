"""Durable Modal deployment of the ShowCrafter song analyser.

The HTTP endpoint only submits work or polls an existing Modal function call.
The analysis itself may run for up to 20 minutes without depending on the
lifetime of the Vercel request that submitted it.

Deploy from this directory:

    modal secret create showcrafter \
      ANALYSER_SHARED_SECRET=<random-32-bytes> \
      ANALYSER_ALLOWED_AUDIO_HOSTS=<project-host-or-custom-storage-host>
    modal deploy modal_app.py

The printed URL becomes the Next.js ``ANALYSER_URL`` environment variable.
``ANALYSER_ALLOWED_AUDIO_HOSTS`` is an exact, comma-separated allowlist. It is
required for both standard Supabase hosts and custom Storage domains.
"""

import os
import tempfile
import time
from pathlib import Path
from typing import Annotated

import modal
from fastapi import Header, HTTPException
from fastapi.responses import JSONResponse

from audio_download import AudioDownloadError, download_audio

image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install_from_requirements("requirements.txt")
    .pip_install("fastapi[standard]")
    .add_local_python_source("showcrafter", "audio_download")
)

app = modal.App("showcrafter-analyser")


@app.cls(
    image=image,
    secrets=[modal.Secret.from_name("showcrafter")],
    timeout=20 * 60,
    cpu=2.0,
    memory=4096,
    enable_memory_snapshot=True,
)
class SongAnalyserWorker:
    @modal.enter(snap=True)
    def warm(self):
        import librosa
        import numpy as np
        import scipy.linalg
        import sklearn.cluster
        from showcrafter import AudioInputError, analyse_song

        self.analyse_song = analyse_song
        self.audio_input_error = AudioInputError

        sr = 22050
        hop_length = 512
        y = np.zeros(sr * 2, dtype=np.float32)
        onset_env = librosa.onset.onset_strength(
            y=y,
            sr=sr,
            hop_length=hop_length,
            aggregate=np.median,
        )
        librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        librosa.feature.rms(y=y, hop_length=hop_length)
        librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)
        librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)
        librosa.stft(y, n_fft=2048, hop_length=hop_length)
        np.abs(librosa.cqt(y=y, sr=sr, bins_per_octave=36, n_bins=84))
        scipy.linalg.eigh(np.eye(3))
        sklearn.cluster.KMeans(n_clusters=2, n_init=1, random_state=0).fit_predict(
            np.array([[0.0], [1.0], [0.5]])
        )

    @modal.method()
    def ping(self):
        from showcrafter import SCHEMA_VERSION

        return {"runner_version": "modal-librosa-3", "schema_version": SCHEMA_VERSION}

    @modal.method()
    def analyse_job(self, audio_url: str, personality: str, analysis_id: str | None):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audio"
            download_start = time.perf_counter()
            try:
                download_audio(audio_url, path)
            except AudioDownloadError as exc:
                return {
                    "status": "failed",
                    "status_code": exc.status_code,
                    "detail": exc.as_http_detail(),
                }
            download_ms = round((time.perf_counter() - download_start) * 1000.0, 3)
            try:
                result = self.analyse_song(
                    str(path),
                    personality,
                    runner_version="modal-librosa-3",
                    initial_timings_ms={"download_ms": download_ms},
                )
            except self.audio_input_error as exc:
                return {
                    "status": "failed",
                    "status_code": exc.status_code,
                    "detail": exc.as_http_detail(),
                }
            if analysis_id:
                timings = result["analysis_meta"]["timings_ms"]
                print(
                    "[showcrafter-analyser] "
                    f"analysis_id={analysis_id} "
                    f"download_ms={timings['download_ms']} "
                    f"total_ms={timings['total_ms']}"
                )
            return {"status": "completed", "result": result}


song_analyser_worker = SongAnalyserWorker()


@app.cls(
    image=image,
    secrets=[modal.Secret.from_name("showcrafter")],
    timeout=60,
    cpu=0.25,
    memory=512,
)
class SongAnalyser:
    @modal.fastapi_endpoint(method="POST")
    def analyse(
        self,
        payload: dict,
        authorization: Annotated[str, Header()] = "",
    ):
        expected = os.environ.get("ANALYSER_SHARED_SECRET", "")
        if not expected or authorization != f"Bearer {expected}":
            raise HTTPException(status_code=401, detail="unauthorized")

        if payload.get("warmup") is True:
            return {"ok": True, **song_analyser_worker.ping.remote()}

        action = payload.get("action")
        if action == "submit":
            audio_url = payload.get("audio_url")
            if not isinstance(audio_url, str) or not audio_url:
                raise HTTPException(status_code=400, detail="invalid audio_url")
            analysis_id = payload.get("analysis_id")
            if analysis_id is not None and not isinstance(analysis_id, str):
                raise HTTPException(status_code=400, detail="invalid analysis_id")
            personality = payload.get("personality", "balanced")
            if not isinstance(personality, str):
                raise HTTPException(status_code=400, detail="invalid personality")

            call = song_analyser_worker.analyse_job.spawn(
                audio_url,
                personality,
                analysis_id,
            )
            return JSONResponse(
                status_code=202,
                content={"status": "submitted", "job_id": call.object_id},
            )

        if action == "poll":
            job_id = payload.get("job_id")
            if not isinstance(job_id, str) or not job_id or len(job_id) > 200:
                raise HTTPException(status_code=400, detail="invalid job_id")
            try:
                result = modal.FunctionCall.from_id(job_id).get(timeout=0)
            except TimeoutError:
                return JSONResponse(status_code=202, content={"status": "running"})
            except Exception as exc:
                print(f"[showcrafter-analyser] poll failed job_id={job_id}: {exc!r}")
                return JSONResponse(
                    status_code=502,
                    content={
                        "status": "failed",
                        "detail": {
                            "code": "modal_job_failed",
                            "message": "Modal analysis job failed",
                            "retryable": True,
                        },
                    },
                )

            if not isinstance(result, dict):
                return JSONResponse(
                    status_code=502,
                    content={
                        "status": "failed",
                        "detail": {
                            "code": "invalid_modal_job_result",
                            "message": "Modal job returned an invalid result envelope",
                            "retryable": False,
                        },
                    },
                )
            if result.get("status") == "failed":
                return JSONResponse(
                    status_code=result["status_code"],
                    content={"status": "failed", "detail": result["detail"]},
                )
            return result

        raise HTTPException(status_code=400, detail="invalid action")
