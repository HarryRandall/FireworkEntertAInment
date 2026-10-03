"""Finite queue execution with fenced heartbeats and measured per-attempt usage."""

import json
import math
import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from .client import Job, JobClient
from .logging import log_event

# Seconds between renewals: operational headroom within the SQL five-minute lease.
HEARTBEAT_SECONDS = 60
# Finite drain budget in jobs per invocation; bounds accidental queue-wide execution.
DEFAULT_MAX_JOBS = 10


@dataclass
class Usage:
    """Handler-owned provider spend for one attempt; no guessed infrastructure tariffs."""

    provider_usd: float = 0
    compute_usd: float | None = None

    def record(self, duration_seconds: float) -> dict[str, Any]:
        """Return latest-attempt costs in USD and monotonic elapsed seconds, including failures."""
        for amount in (self.provider_usd, self.compute_usd, duration_seconds):
            if amount is not None and (not math.isfinite(amount) or amount < 0):
                raise ValueError("Usage must be finite and non-negative")
        return {
            "provider_usd": self.provider_usd,
            "compute_usd": self.compute_usd,
            "duration_seconds": duration_seconds,
            "scope": "attempt",
        }


class Heartbeat:
    """Renew in a background thread; stop and surface failure before terminal RPCs."""

    def __init__(self, client: JobClient, job: Job, interval_seconds: float):
        """Configure renewal cadence in seconds strictly below the database lease budget."""
        if not 0 < interval_seconds <= HEARTBEAT_SECONDS:
            raise ValueError("Heartbeat interval must be positive and at most 60 seconds")
        self.client = client
        self.job = job
        self.interval_seconds = interval_seconds
        self.stopped = threading.Event()
        self.error: Exception | None = None
        self.thread = threading.Thread(target=self._renew, daemon=True)

    def _renew(self):
        while not self.stopped.wait(self.interval_seconds):
            try:
                self.client.heartbeat(self.job)
            except Exception as error:
                self.error = error
                self.stopped.set()

    def __enter__(self):
        """Check ownership before the handler starts, then begin renewal."""
        self.client.heartbeat(self.job)
        self.thread.start()
        return self

    def __exit__(self, exc_type, exc, traceback):
        """Join any in-flight renewal and propagate uncertain or lost ownership."""
        self.stopped.set()
        self.thread.join()
        if self.error is not None:
            raise self.error
        return False


Handler = Callable[[Job, Usage], dict[str, Any]]


def execute_job(
    client: JobClient, job: Job, handler: Handler, *, heartbeat_seconds: float = HEARTBEAT_SECONDS
) -> None:
    """Run a handler with renewal; record elapsed seconds and costs on success or failure.

    Handlers validate payloads and make result writes idempotent. Heartbeat or terminal
    transport failures propagate without a second mutation, leaving recovery to SQL.
    """
    started = time.monotonic()
    usage = Usage()
    failure = None
    result = None
    log_event("job_started", job)
    try:
        with Heartbeat(client, job, heartbeat_seconds):
            try:
                result = handler(job, usage)
                if not isinstance(result, dict):
                    raise ValueError("Handler result must be an object")
                # Validate before completion so non-JSON results become handler failures.
                json.dumps(result, allow_nan=False)
                usage.record(time.monotonic() - started)
            except Exception as error:
                failure = type(error).__name__
    except Exception as error:
        log_event("job_ownership_uncertain", job, error_type=type(error).__name__)
        raise
    cost = usage.record(time.monotonic() - started)
    if failure is not None:
        # Exception messages can contain URLs, secrets or user data; store only the class.
        client.fail(job, f"Handler failed: {failure}", cost)
        log_event("job_failed", job, error_type=failure)
    else:
        client.complete(job, result, cost)
        log_event("job_completed", job)


def drain(
    client: JobClient,
    handlers: Mapping[str, Handler],
    worker: str,
    *,
    max_jobs: int = DEFAULT_MAX_JOBS,
) -> int:
    """Process up to max_jobs due attempts, returning the count; exit immediately when empty.

    No idle polling or retry sleeping occurs. Failed jobs become eligible only after
    the database-owned backoff, requiring another wake invocation.
    """
    if type(max_jobs) is not int or max_jobs < 1 or not handlers:
        raise ValueError("Positive job budget and registered handlers required")
    processed = 0
    while processed < max_jobs:
        job = client.claim(tuple(handlers), worker)
        if job is None:
            break
        execute_job(client, job, handlers[job.kind])
        processed += 1
    return processed
