"""Scale-to-zero music queue drain registered through the shared Modal layout."""

import importlib.util
from pathlib import Path

import modal
from showcrafter_workers.client import Job, JobClient, Settings
from showcrafter_workers.runtime import Usage

SERVICE = Path(__file__).resolve().parent
WORKERS = SERVICE.parent / "workers"
spec = importlib.util.spec_from_file_location(
    "showcrafter_modal_layout", WORKERS / "modal_app.py"
)
layout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(layout)


def handle_music(job: Job, usage: Usage) -> dict:
    """Run a shared-track handler with backend credentials available only in the drain."""
    from music_jobs import MusicHandler

    return MusicHandler(JobClient(Settings.from_environment()))(job, usage)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install_from_requirements(str(SERVICE / "requirements.txt"))
    .add_local_file(str(SERVICE / "music_jobs.py"), "/root/music_jobs.py")
    .add_local_file(str(SERVICE / "showcrafter.py"), "/root/showcrafter.py")
    .add_local_file(str(SERVICE / "audio_download.py"), "/root/audio_download.py")
)
app = layout.create_worker_app(
    "showcrafter-music", {"music_analyse": handle_music}, image=image
)
