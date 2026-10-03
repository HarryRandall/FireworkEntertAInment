"""Local-only fake queue drain for checking the shared worker protocol."""

import argparse
from uuid import uuid4

from .client import Job, JobClient, Settings
from .runtime import Usage, drain

# Dedicated diagnostic kind keeps smoke tests away from feature queues.
FAKE_JOB_KIND = "worker_smoke_test"


def fake_handler(job: Job, usage: Usage) -> dict:
    """Validate and echo a diagnostic message; record known zero provider/compute spend."""
    message = job.payload.get("message")
    if not isinstance(message, str):
        raise ValueError("Diagnostic message must be text")
    usage.compute_usd = 0
    return {"message": message}


def main() -> None:
    """Drain only diagnostic jobs against the fixed local Supabase API, without Modal."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-jobs", type=int, default=1)
    args = parser.parse_args()
    client = JobClient(Settings.from_environment(local_only=True))
    count = drain(client, {FAKE_JOB_KIND: fake_handler}, f"local-{uuid4()}", max_jobs=args.max_jobs)
    print(f"Processed {count} diagnostic job(s)")


if __name__ == "__main__":
    main()
