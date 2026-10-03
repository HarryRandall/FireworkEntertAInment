"""Real local API acceptance for a fake worker; refuses hosted targets."""

import json
import subprocess
import sys
import unittest
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

from showcrafter_workers.__main__ import FAKE_JOB_KIND
from showcrafter_workers.client import JobClient, LeaseLost, Settings

ROOT = Path(__file__).resolve().parents[3]


class LocalWorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Require explicitly provided local service credentials before any test writes."""
        cls.client = JobClient(Settings.from_environment(local_only=True))

    def setUp(self):
        self.id = str(uuid4())
        self.client.request(
            "POST",
            "/jobs",
            {"id": self.id, "kind": FAKE_JOB_KIND, "payload": {"message": "local diagnostic"}},
        )
        self.addCleanup(self.client.request, "DELETE", f"/jobs?id=eq.{self.id}")

    def row(self):
        """Read only this test's uniquely owned queue row."""
        return self.client.request("GET", f"/jobs?id=eq.{self.id}")[0]

    def run_cli(self):
        """Invoke the installed local worker as a separate process, without Modal."""
        result = subprocess.run(
            [sys.executable, "-m", "showcrafter_workers"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout

    def test_cli_end_to_end(self):
        output = self.run_cli()
        self.assertEqual(self.row()["status"], "done")
        self.assertEqual(self.row()["result"], {"message": "local diagnostic"})
        self.assertEqual(self.row()["cost"]["compute_usd"], 0)
        self.assertGreaterEqual(self.row()["cost"]["duration_seconds"], 0)
        events = [json.loads(line) for line in output.splitlines() if line.startswith("{")]
        self.assertEqual([event["event"] for event in events], ["job_started", "job_completed"])
        self.assertEqual(events[0]["job_id"], self.id)

    def test_heartbeat_and_stale_attempt(self):
        job = self.client.claim((FAKE_JOB_KIND,), "reused-worker")
        self.assertEqual(job.id, self.id)
        expiry = self.client.heartbeat(job)
        self.assertGreaterEqual(expiry, job.lease_until)
        self.assertIsNone(self.client.claim((FAKE_JOB_KIND,), "other-worker"))
        with self.assertRaises(LeaseLost):
            self.client.complete(replace(job, worker="wrong"), {}, {})
        self.client.request(
            "PATCH", f"/jobs?id=eq.{self.id}", {"lease_until": "2000-01-01T00:00:00Z"}
        )
        with self.assertRaises(LeaseLost):
            self.client.heartbeat(job)
        reclaimed = self.client.claim((FAKE_JOB_KIND,), "reused-worker")
        self.assertEqual(reclaimed.attempt, job.attempt + 1)
        with self.assertRaises(LeaseLost):
            self.client.complete(job, {}, {})
        self.client.complete(reclaimed, {"recovered": True}, {"provider_usd": 0})
        self.assertEqual(self.row()["status"], "done")

    def test_failure_backoff_and_exhaustion(self):
        self.client.request(
            "PATCH", f"/jobs?id=eq.{self.id}", {"payload": {"message": None}, "max_attempts": 2}
        )
        self.run_cli()
        row = self.row()
        self.assertEqual(row["status"], "failed")
        self.assertEqual(row["error"], "Handler failed: ValueError")
        self.assertGreaterEqual(row["cost"]["duration_seconds"], 0)
        self.assertIsNone(self.client.claim((FAKE_JOB_KIND,), "early-worker"))
        self.client.request(
            "PATCH", f"/jobs?id=eq.{self.id}", {"run_after": "2000-01-01T00:00:00Z"}
        )
        self.run_cli()
        self.assertEqual(self.row()["status"], "dead")
        self.assertEqual(self.row()["attempts"], 2)
        self.assertIsNone(self.client.claim((FAKE_JOB_KIND,), "exhausted-worker"))


if __name__ == "__main__":
    unittest.main()
