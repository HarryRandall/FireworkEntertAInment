"""
Modal deployment of the ShowCrafter song analyser.

Wraps `analyse_song` from `showcrafter.py` in an authenticated HTTP endpoint
so the Next.js app on Vercel can offload the librosa/numpy/scipy workload
that does not fit (size or runtime) inside a Vercel serverless function.

Deploy from this directory:

    modal secret create showcrafter ANALYSER_SHARED_SECRET=<random-32-bytes>
    modal deploy modal_app.py

The printed URL becomes the Next.js `ANALYSER_URL` env var.
Set `ANALYSER_ALLOWED_AUDIO_HOSTS` in the Modal secret when Supabase Storage
uses a custom domain. Standard `*.supabase.co` storage hosts are allowed by
default.
"""

import os
import tempfile
import time
from pathlib import Path
from typing import Annotated

import modal
from fastapi import Header, HTTPException

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
    timeout=600,
    cpu=2.0,
    memory=4096,
    enable_memory_snapshot=True,
)
class SongAnalyser:
    @modal.enter(snap=True)
    def warm(self):
        import librosa
        import numpy as np
        import scipy.linalg
        import sklearn.cluster
        from showcrafter import analyse_song

        self.analyse_song = analyse_song

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
            from showcrafter import SCHEMA_VERSION

            return {
                "ok": True,
                "runner_version": "modal-librosa-2",
                "schema_version": SCHEMA_VERSION,
            }

        audio_url = payload.get("audio_url")
        if not audio_url:
            raise HTTPException(status_code=400, detail="missing audio_url")
        if not isinstance(audio_url, str):
            raise HTTPException(status_code=400, detail="invalid audio_url")

        analysis_id = payload.get("analysis_id")
        if analysis_id is not None and not isinstance(analysis_id, str):
            raise HTTPException(status_code=400, detail="invalid analysis_id")

        personality = payload.get("personality", "balanced")

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audio"
            download_start = time.perf_counter()
            try:
                download_audio(audio_url, path)
            except AudioDownloadError as exc:
                raise HTTPException(status_code=exc.status_code, detail=exc.as_http_detail()) from exc
            download_ms = round((time.perf_counter() - download_start) * 1000.0, 3)
            from showcrafter import AudioInputError

            try:
                result = self.analyse_song(
                    str(path),
                    personality,
                    runner_version="modal-librosa-2",
                    initial_timings_ms={"download_ms": download_ms},
                )
            except AudioInputError as exc:
                raise HTTPException(status_code=exc.status_code, detail=exc.as_http_detail()) from exc
            if analysis_id:
                timings = result["analysis_meta"]["timings_ms"]
                print(
                    "[showcrafter-analyser] "
                    f"analysis_id={analysis_id} "
                    f"download_ms={timings['download_ms']} "
                    f"total_ms={timings['total_ms']}"
                )
            return result
