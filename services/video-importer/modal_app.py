"""Scale-to-zero video measurement registration through the shared finite-drain layout."""

import importlib.util
from pathlib import Path

import modal
from showcrafter_workers.client import Job, JobClient, Settings
from showcrafter_workers.runtime import Usage

SERVICE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "showcrafter_video_layout", SERVICE.parent / "workers/modal_app.py"
)
layout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(layout)


def handle_video(job: Job, usage: Usage) -> dict:
    """Bind one measurement handler inside the credential-bearing queue drain."""
    from video_jobs import VideoHandler

    return VideoHandler(JobClient(Settings.from_environment()))(job, usage)


image = modal.Image.debian_slim(python_version="3.11").apt_install("ffmpeg")
image = image.pip_install_from_requirements(str(SERVICE / "requirements.txt"))
for filename in ("decode", "onsets", "features", "measure", "storage", "video_jobs"):
    image = image.add_local_file(str(SERVICE / (filename + ".py")), "/root/" + filename + ".py")
app = layout.create_worker_app("showcrafter-video", {"video_analyse": handle_video}, image=image)
