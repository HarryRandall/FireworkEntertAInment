"""Scale-to-zero measurement and fitting registration with a Node CPU simulation image."""

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


def handle_fit(job: Job, usage: Usage) -> dict:
    """Resume fitting with a disabled provider that cannot incur paid usage."""
    from fit_jobs import FitHandler

    return FitHandler(JobClient(Settings.from_environment()))(job, usage)


# Match the local Node engine and Python runtime; registration neither builds nor deploys.
image = modal.Image.from_registry("node:24.18.0-bookworm-slim", add_python="3.11")
image = image.apt_install("ffmpeg")
image = image.pip_install_from_requirements(str(SERVICE / "requirements.txt"))
ROOT = SERVICE.parents[1]
CONTAINER_ROOT = "/opt/showcrafter"
for filename in (
    "decode",
    "onsets",
    "features",
    "measure",
    "storage",
    "video_jobs",
    "fit",
    "fit_jobs",
    "interpret",
    "model_config",
):
    image = image.add_local_file(
        str(SERVICE / (filename + ".py")),
        f"{CONTAINER_ROOT}/services/video-importer/{filename}.py",
        copy=True,
    )
for package in ("fireworks", "video-fit"):
    image = image.add_local_dir(
        str(ROOT / "packages" / package),
        f"{CONTAINER_ROOT}/packages/{package}",
        ignore=["node_modules", "out"],
        copy=True,
    )
for filename in (
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "scripts/register-typescript.mjs",
    "apps/web/package.json",
    "packages/planner/package.json",
):
    image = image.add_local_file(str(ROOT / filename), f"{CONTAINER_ROOT}/{filename}", copy=True)
image = image.run_commands(
    f"cd {CONTAINER_ROOT} && corepack enable && pnpm install --frozen-lockfile "
    "--filter @showcrafter/video-fit... --filter showcrafter"
)
image = image.env({"PYTHONPATH": f"{CONTAINER_ROOT}/services/video-importer"})
app = layout.create_worker_app(
    "showcrafter-video", {"video_analyse": handle_video, "video_fit": handle_fit}, image=image
)
