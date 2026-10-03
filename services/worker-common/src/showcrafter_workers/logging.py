"""Allowlisted structured queue events without payloads, results or credentials."""

import json
import sys
from datetime import datetime, timezone

from .client import Job


def log_event(event: str, job: Job, *, error_type: str | None = None) -> None:
    """Emit one JSON line containing queue identity, UTC time and an optional error class."""
    record = {
        "event": event,
        "at": datetime.now(timezone.utc).isoformat(),
        "job_id": job.id,
        "kind": job.kind,
        "worker": job.worker,
        "attempt": job.attempt,
    }
    if error_type is not None:
        record["error_type"] = error_type
    print(json.dumps(record), file=sys.stdout, flush=True)
