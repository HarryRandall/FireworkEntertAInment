"""
Modal deployment of the ShowCrafter song analyser.

Wraps `analyse_song` from `showcrafter.py` in an authenticated HTTP endpoint
so the Next.js app on Vercel can offload the librosa/numpy/scipy workload
that does not fit (size or runtime) inside a Vercel serverless function.

Deploy from this directory:

    modal secret create showcrafter ANALYSER_SHARED_SECRET=<random-32-bytes>
    SHOWCRAFTER_APP_ORIGIN=https://your-showcrafter-domain.example modal deploy modal_app.py

The SongAnalyser.analyse URL remains `ANALYSER_URL`. Set
`ANALYSER_DISPATCH_URL` to the lightweight API URL plus `/runs`.
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

WORKER_DIRECTORY = Path(__file__).resolve().parent

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install_from_requirements(str(WORKER_DIRECTORY / "requirements.txt"))
    .pip_install("fastapi[standard]")
    .add_local_file(
        str(WORKER_DIRECTORY / "beat-this-model.json"),
        "/root/beat-this-model.json",
        copy=True,
    )
    .add_local_file(
        str(WORKER_DIRECTORY / "download_model.py"), "/root/download_model.py", copy=True
    )
    .add_local_file(
        str(WORKER_DIRECTORY / "asset_integrity.py"), "/root/asset_integrity.py", copy=True
    )
    .run_commands("python /root/download_model.py")
    .add_local_python_source(
        "showcrafter",
        "audio_download",
        "queued_analysis",
        "asset_integrity",
        "beat_metrics",
        "beat_tracking",
    )
)

app = modal.App("showcrafter-analyser")
callback_config = modal.Secret.from_dict({
    "SHOWCRAFTER_APP_ORIGIN": os.environ.get("SHOWCRAFTER_APP_ORIGIN", ""),
})
web_image = (modal.Image.debian_slim(python_version="3.11")
             .pip_install("fastapi[standard]", "requests")
             .add_local_python_source("queued_analysis"))


@app.cls(
    image=image,
    secrets=[modal.Secret.from_name("showcrafter"), callback_config],
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

        from beat_tracking import HOP_LENGTH, neural_model

        sr = 22050
        hop_length = HOP_LENGTH
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
        neural_model()

    @modal.fastapi_endpoint(method="POST")
    def analyse(
        self,
        payload: dict,
        authorization: Annotated[str, Header()] = "",
    ):
        from queued_analysis import authorise

        if not authorise(authorization):
            raise HTTPException(status_code=401, detail="unauthorized")

        return self._analyse(payload)

    @modal.method()
    def analyse_queued(self, payload: dict):
        from queued_analysis import deliver_callback, validate_job

        validate_job(payload)
        started = time.perf_counter()
        try:
            outcome = {"ok": True, "analysis": self._analyse(payload)}
        except HTTPException as exc:
            outcome = {"ok": False, "error": str(exc.detail)[:2000], "status": exc.status_code}
        except Exception:
            # Do not expose stack traces, signed audio URLs or request credentials.
            outcome = {"ok": False, "error": "Song analysis failed unexpectedly.", "status": 500}
        deliver_callback(payload, outcome, round((time.perf_counter() - started) * 1000))
        return {"analysis_id": payload["analysis_id"], "status": "delivered"}

    def _analyse(self, payload):
        from audio_download import AudioDownloadError, download_audio

        if payload.get("warmup") is True:
            from beat_tracking import algorithm_for
            from showcrafter import SCHEMA_VERSION

            return {
                "ok": True,
                "runner_version": algorithm_for("beat-this"),
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


@app.function(image=web_image, secrets=[modal.Secret.from_name("showcrafter"), callback_config], timeout=60)
@modal.asgi_app()
def api():
    from fastapi import FastAPI
    from queued_analysis import authorise, validate_job

    web_app = FastAPI(docs_url=None, redoc_url=None)

    @web_app.post("/runs", status_code=202)
    async def submit(payload: dict, authorization: Annotated[str, Header()] = ""):
        if not authorise(authorization):
            raise HTTPException(status_code=401, detail="unauthorised")
        try:
            validate_job(payload)
        except (ValueError, KeyError, TypeError):
            raise HTTPException(status_code=400, detail="invalid analysis job") from None
        call = await SongAnalyser().analyse_queued.spawn.aio(payload)
        return {"analysis_id": payload["analysis_id"], "call_id": call.object_id, "status": "accepted"}

    return web_app
