"""Service-role PostgREST access to the database-owned job lease protocol."""

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

# Operational HTTP deadline in seconds, well inside the database's five-minute lease.
REQUEST_TIMEOUT_SECONDS = 20
LOCAL_API_URL = "http://127.0.0.1:55421"


class DatabaseError(RuntimeError):
    """A database request failed; messages exclude credentials and response bodies."""


class LeaseLost(DatabaseError):
    """The database rejected a stale, expired or mismatched worker attempt."""


class NoRedirects(HTTPRedirectHandler):
    """Keep service-role credentials on the configured origin."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        """Reject redirects rather than forwarding privileged request headers."""
        return None


@dataclass(frozen=True)
class Settings:
    """Trusted backend configuration; the service key is excluded from repr."""

    url: str
    service_role_key: str = field(repr=False)

    def __post_init__(self):
        """Require a clean HTTPS origin or the explicit local development API."""
        origin = urlsplit(self.url)
        if origin.username or origin.password or origin.query or origin.fragment:
            raise ValueError("Supabase URL must be an origin without credentials")
        if origin.path or not origin.hostname:
            raise ValueError("Supabase URL must be an origin without a path")
        if self.url != LOCAL_API_URL and origin.scheme != "https":
            raise ValueError("Supabase requires HTTPS outside the local API")
        if not self.service_role_key.strip():
            raise ValueError("Supabase service-role key required")

    @classmethod
    def from_environment(cls, *, local_only: bool = False):
        """Read backend secrets, optionally refusing every target except local Supabase."""
        settings = cls(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
        if local_only and settings.url != LOCAL_API_URL:
            raise ValueError("Local workers require the API on port 55421")
        return settings


def parse_timestamp(value: Any) -> datetime:
    """Validate a database lease timestamp as a timezone-aware wall-clock instant."""
    if not isinstance(value, str):
        raise ValueError("Lease timestamp required")
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None:
        raise ValueError("Lease timestamp must include a timezone")
    return stamp


@dataclass(frozen=True)
class Job:
    """An immutable attempt fence and its untrusted feature payload."""

    id: str
    kind: str
    payload: dict[str, Any]
    worker: str
    attempt: int
    lease_until: datetime

    @classmethod
    def from_response(cls, row: Any, kinds: tuple[str, ...], worker: str):
        """Validate the claimed envelope; feature handlers validate payload contents."""
        if not isinstance(row, dict):
            raise ValueError("Expected a claimed job object")
        UUID(row["id"])
        attempt = row["attempts"]
        if type(attempt) is not int or attempt < 1:
            raise ValueError("Positive attempt number required")
        if row["status"] != "running" or row["worker"] != worker or row["kind"] not in kinds:
            raise ValueError("Claimed job does not match requested ownership")
        if not isinstance(row["payload"], dict):
            raise ValueError("Job payload must be an object")
        return cls(
            row["id"],
            row["kind"],
            row["payload"],
            worker,
            attempt,
            parse_timestamp(row["lease_until"]),
        )

    def fence(self) -> dict[str, Any]:
        """Return RPC identity fields that fence this exact attempt, even for reused workers."""
        return {"id": self.id, "worker": self.worker, "attempt": self.attempt}


class JobClient:
    """Use service-role HTTP access without automatic retries of mutating requests."""

    def __init__(self, settings: Settings):
        """Bind privileged access to one configured database origin."""
        self.settings = settings
        self._opener = build_opener(NoRedirects())

    def request(self, method: str, path: str, body: Any = None) -> Any:
        """Send a relative REST request; expose status/code but never database body text."""
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("Relative REST path required")
        data = None if body is None else json.dumps(body, allow_nan=False).encode()
        request = Request(
            self.settings.url + "/rest/v1" + path,
            data=data,
            method=method,
            headers={
                "apikey": self.settings.service_role_key,
                "Authorization": "Bearer " + self.settings.service_role_key,
                "Content-Type": "application/json",
            },
        )
        try:
            with self._opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                raw = response.read()
        except HTTPError as error:
            code = None
            try:
                code = json.loads(error.read()).get("code")
            except (ValueError, AttributeError):
                pass
            finally:
                error.close()
            if code == "23514" and path in (
                "/rpc/renew_job_lease",
                "/rpc/complete_job",
                "/rpc/fail_job",
            ):
                raise LeaseLost("Current worker lease required") from None
            raise DatabaseError(f"Database request failed (HTTP {error.code})") from None
        except (URLError, TimeoutError, OSError):
            raise DatabaseError("Database transport failed; outcome may be unknown") from None
        if not raw and path in ("/rpc/claim_job", "/rpc/renew_job_lease"):
            raise DatabaseError("Database returned an empty RPC response")
        try:
            return json.loads(raw) if raw else None
        except ValueError:
            raise DatabaseError("Database returned invalid JSON") from None

    def claim(self, kinds: tuple[str, ...], worker: str) -> Job | None:
        """Claim one due job; return None only for the RPC's explicit empty result."""
        if not kinds or any(not isinstance(kind, str) or not kind.strip() for kind in kinds):
            raise ValueError("Non-empty job kinds required")
        if not worker.strip():
            raise ValueError("Worker identity required")
        row = self.request("POST", "/rpc/claim_job", {"kinds": kinds, "worker": worker})
        # A null SQL composite can be encoded as an object whose fields are all null.
        if row is None or (isinstance(row, dict) and row and all(v is None for v in row.values())):
            return None
        return Job.from_response(row, kinds, worker)

    def heartbeat(self, job: Job) -> datetime:
        """Extend the matching lease using the database clock; return its new expiry."""
        return parse_timestamp(self.request("POST", "/rpc/renew_job_lease", job.fence()))

    def complete(self, job: Job, result: dict[str, Any], cost: dict[str, Any]) -> None:
        """Finish this unexpired attempt atomically with its result and usage record."""
        self.request("POST", "/rpc/complete_job", {**job.fence(), "result": result, "cost": cost})

    def fail(self, job: Job, reason: str, cost: dict[str, Any]) -> None:
        """Record a safe failure reason; the database owns backoff and exhaustion."""
        if not reason.strip():
            raise ValueError("Failure reason required")
        self.request(
            "POST", "/rpc/fail_job", {**job.fence(), "failure_reason": reason, "cost": cost}
        )
