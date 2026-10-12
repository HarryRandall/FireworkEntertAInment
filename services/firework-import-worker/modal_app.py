"""Modal job queue entry points for firework reconstruction.

Deploy this module separately from the local polling worker. Both paths use the
same atomic queued-to-processing claim, so only one executor can own a run.
"""

import hmac
import os
import sys
import uuid
from pathlib import Path

import modal


APP_NAME = "showcrafter-firework-import"
WORKER_SECRET_NAME = "showcrafter-firework-import-worker"
DISPATCH_SECRET_NAME = "showcrafter-firework-import-dispatch"
WORKER_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY = WORKER_DIRECTORY.parents[1]
CONTAINER_ROOT = "/opt/showcrafter"
REMOTE_WORKER_DIRECTORY = f"{CONTAINER_ROOT}/services/firework-import-worker"

# The renderer scorer runs in Node next to the Python worker, so the image starts
# from the repository's Node major and adds Python.
image = (
    modal.Image.from_registry("node:24-bookworm-slim", add_python="3.11")
    .apt_install("ffmpeg", "libgomp1")
    .pip_install_from_requirements(str(WORKER_DIRECTORY / "requirements.txt"))
    .add_local_dir(
        WORKER_DIRECTORY,
        remote_path=REMOTE_WORKER_DIRECTORY,
        copy=True,
        ignore=[".venv/**", "**/__pycache__/**", "tests/**"],
    )
)
for package in ("renderer", "video-fit"):
    image = image.add_local_dir(
        str(REPOSITORY / "packages" / package),
        f"{CONTAINER_ROOT}/packages/{package}",
        copy=True,
        ignore=["node_modules/**", "tests/**"],
    )
for filename in ("package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"):
    image = image.add_local_file(
        str(REPOSITORY / filename), f"{CONTAINER_ROOT}/{filename}", copy=True
    )
image = image.run_commands(
    f"cd {CONTAINER_ROOT} && corepack enable && "
    "pnpm install --frozen-lockfile --filter @showcrafter/video-fit...",
    f'cd {CONTAINER_ROOT} && echo \'{{"catalogue":true}}\' | node --import '
    "./packages/video-fit/scripts/register.mjs packages/video-fit/src/bridge.ts > /dev/null",
).pip_install("fastapi[standard]")
web_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi[standard]"
)

app = modal.App(APP_NAME)
worker_secret = modal.Secret.from_name(WORKER_SECRET_NAME)
dispatch_secret = modal.Secret.from_name(DISPATCH_SECRET_NAME)


def _worker_modules():
    if REMOTE_WORKER_DIRECTORY not in sys.path:
        sys.path.insert(0, REMOTE_WORKER_DIRECTORY)
    from supabase import create_client
    from worker import (
        env_required,
        process_next_reconstruction_run,
        process_reconstruction_run_by_id,
    )

    return (
        create_client,
        env_required,
        process_next_reconstruction_run,
        process_reconstruction_run_by_id,
    )


def _worker_client():
    (
        create_client,
        env_required,
        process_next_reconstruction_run,
        process_reconstruction_run_by_id,
    ) = _worker_modules()
    supabase = create_client(
        env_required("SUPABASE_URL"),
        env_required("SUPABASE_SERVICE_ROLE_KEY"),
    )
    return supabase, process_next_reconstruction_run, process_reconstruction_run_by_id


@app.function(
    image=image,
    secrets=[worker_secret, dispatch_secret],
    timeout=60 * 60,
    max_containers=8,
    cpu=4.0,
    memory=4_096,
)
def reconstruct_run(run_id: str):
    parsed_run_id = str(uuid.UUID(run_id))
    supabase, _, process_reconstruction_run_by_id = _worker_client()
    return process_reconstruction_run_by_id(
        supabase,
        parsed_run_id,
        modal_call_id=modal.current_input_id(),
    )


@app.function(
    image=image,
    secrets=[worker_secret, dispatch_secret],
    timeout=60 * 60,
    max_containers=8,
    cpu=4.0,
    memory=4_096,
)
def reconstruct_next_run():
    supabase, process_next_reconstruction_run, _ = _worker_client()
    return process_next_reconstruction_run(
        supabase,
        modal_call_id=modal.current_input_id(),
    )


@app.function(timeout=120)
def sweep_queued_runs():
    """Submit one lease-aware queue claim for explicit operational recovery."""

    call = reconstruct_next_run.spawn()
    return {"callId": call.object_id, "status": "submitted"}


@app.function(image=web_image, secrets=[dispatch_secret])
@modal.asgi_app()
def api():
    from fastapi import FastAPI, Header, HTTPException
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel

    web_app = FastAPI(
        title="ShowCrafter firework import", docs_url=None, redoc_url=None
    )

    class ReconstructionRequest(BaseModel):
        runId: uuid.UUID

    def authorise(authorization: str | None) -> None:
        expected = os.getenv("FIREWORK_IMPORT_SHARED_SECRET")
        supplied = (
            authorization.removeprefix("Bearer ").strip() if authorization else ""
        )
        if not expected or not supplied or not hmac.compare_digest(supplied, expected):
            raise HTTPException(status_code=401, detail="Unauthorised")

    @web_app.post("/runs", status_code=202)
    async def submit_job(
        payload: ReconstructionRequest, authorization: str | None = Header(default=None)
    ):
        authorise(authorization)
        call = await reconstruct_run.spawn.aio(str(payload.runId))
        return {
            "runId": str(payload.runId),
            "callId": call.object_id,
            "status": "accepted",
        }

    @web_app.get("/calls/{call_id}")
    async def poll_job(call_id: str, authorization: str | None = Header(default=None)):
        authorise(authorization)
        function_call = modal.FunctionCall.from_id(call_id)
        try:
            return await function_call.get.aio(timeout=0)
        except modal.exception.OutputExpiredError:
            return JSONResponse({"status": "expired"}, status_code=404)
        except TimeoutError:
            return JSONResponse({"status": "processing"}, status_code=202)

    return web_app
