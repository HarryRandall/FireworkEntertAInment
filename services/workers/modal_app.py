"""Modal registration hook for feature-owned handlers using the shared queue runtime."""

from collections.abc import Mapping
from pathlib import Path
from uuid import uuid4

import modal
from showcrafter_workers.client import JobClient, Settings
from showcrafter_workers.runtime import DEFAULT_MAX_JOBS, Handler, drain

# Invocation timeout in seconds, an operational cap rather than a feature duration claim.
DRAIN_TIMEOUT_SECONDS = 1800
# Small CPU queue drains: operational concurrency cap, protected further by SQL claims.
MAX_DRAIN_CONTAINERS = 2
# Short idle retention in seconds; no minimum or buffer containers are kept warm.
SCALEDOWN_SECONDS = 2
DEPENDENCIES = Path(__file__).with_name("requirements.txt")


def create_worker_app(
    name: str, handlers: Mapping[str, Handler], *, image: modal.Image | None = None
) -> modal.App:
    """Register a finite drain and proxy-authenticated wake endpoint for known handlers.

    Feature modules call this with their actual handlers and dependency image. The
    request cannot supply job kinds, payloads or database credentials. Importing this
    module neither connects to Supabase nor deploys a Modal app.
    """
    if not name.strip() or not handlers or any(not kind.strip() for kind in handlers):
        raise ValueError("App name and non-empty handler registry required")
    registry = dict(handlers)
    worker_image = (
        image if image is not None else modal.Image.debian_slim(python_version="3.11")
    )
    worker_image = worker_image.pip_install_from_requirements(str(DEPENDENCIES))
    worker_image = worker_image.add_local_python_source("showcrafter_workers")
    app = modal.App(name)

    @app.function(
        image=worker_image,
        secrets=[modal.Secret.from_name("showcrafter-workers")],
        timeout=DRAIN_TIMEOUT_SECONDS,
        min_containers=0,
        buffer_containers=0,
        max_containers=MAX_DRAIN_CONTAINERS,
        scaledown_window=SCALEDOWN_SECONDS,
        retries=0,
        serialized=True,
        name="drain_jobs",
    )
    def drain_jobs() -> int:
        """Claim and process a finite batch; SQL owns lease fencing and retries."""
        client = JobClient(Settings.from_environment())
        return drain(client, registry, f"modal-{uuid4()}", max_jobs=DEFAULT_MAX_JOBS)

    @app.function(
        image=worker_image,
        min_containers=0,
        buffer_containers=0,
        scaledown_window=SCALEDOWN_SECONDS,
        serialized=True,
        name="wake",
    )
    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def wake() -> dict[str, str]:
        """Acknowledge an authenticated wake after asynchronously spawning a drain."""
        call = drain_jobs.spawn()
        return {"call_id": call.object_id}

    return app
