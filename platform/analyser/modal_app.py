"""
Modal deployment of the ShowCrafter song analyser.

Wraps `analyse_song` from `showcrafter.py` in an authenticated HTTP endpoint
so the Next.js app on Vercel can offload the librosa/numpy/scipy workload
that does not fit (size or runtime) inside a Vercel serverless function.

Deploy from this directory:

    modal secret create showcrafter ANALYSER_SHARED_SECRET=<random-32-bytes>
    modal deploy modal_app.py

The printed URL becomes the Next.js `ANALYSER_URL` env var.
"""

import os
import tempfile
import urllib.request
from pathlib import Path
from typing import Annotated

import modal
from fastapi import Header, HTTPException

image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install_from_requirements("requirements.txt")
    .pip_install("fastapi[standard]")
    .add_local_python_source("showcrafter")
)

app = modal.App(
    "showcrafter-analyser",
    image=image,
    secrets=[modal.Secret.from_name("showcrafter")],
)


@app.function(timeout=600, cpu=2.0, memory=4096)
@modal.fastapi_endpoint(method="POST")
def analyse(
    payload: dict,
    authorization: Annotated[str, Header()] = "",
):
    from showcrafter import analyse_song

    expected = os.environ.get("ANALYSER_SHARED_SECRET", "")
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="unauthorized")

    audio_url = payload.get("audio_url")
    if not audio_url:
        raise HTTPException(status_code=400, detail="missing audio_url")

    personality = payload.get("personality", "balanced")

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "audio"
        urllib.request.urlretrieve(audio_url, path)
        return analyse_song(str(path), personality)
