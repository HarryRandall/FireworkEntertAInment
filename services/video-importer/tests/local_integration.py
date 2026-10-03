"""Real local queue, MP4 download, measurements, crop storage and idempotent retry acceptance."""

import hashlib
import json
import sys
import unittest
from pathlib import Path
from uuid import uuid4

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))
from showcrafter_workers.client import DatabaseError, JobClient, Settings  # noqa: E402
from showcrafter_workers.runtime import execute_job  # noqa: E402

from measure import EXTRACTOR  # noqa: E402
from storage import storage_request  # noqa: E402
from video_jobs import VideoHandler  # noqa: E402


class LocalVideoTests(unittest.TestCase):
    def setUp(self):
        self.client = JobClient(Settings.from_environment(local_only=True))
        self.media = str(uuid4())
        self.analysis = str(uuid4())
        self.jobs = []
        self.objects = []
        self.addCleanup(self.cleanup)
        path = "video-tests/" + self.media + "/source.mp4"
        self.objects.append(path)
        source = (SERVICE / "tests/fixtures/shell-cake.mp4").read_bytes()
        with storage_request(
            self.client, "POST", "object/imports/" + path, source, "video/mp4"
        ) as response:
            response.read()
        self.client.request(
            "POST",
            "/media",
            {
                "id": self.media,
                "bucket": "imports",
                "path": path,
                "kind": "video",
                "mime": "video/mp4",
                "bytes": len(source),
                "sha256": hashlib.sha256(source).hexdigest(),
            },
        )
        self.client.request(
            "POST",
            "/video_analyses",
            {
                "id": self.analysis,
                "media_id": self.media,
                "extractor": EXTRACTOR,
                "priors": {"shot_count": 2, "duration_ms": 10000},
            },
        )

    def cleanup(self):
        rows = self.client.request("GET", f"/video_analyses?id=eq.{self.analysis}")
        if rows and rows[0]["keyframes"]:
            for shot in rows[0]["keyframes"]:
                self.objects.extend(shot[label]["path"] for label in ("launch", "peak", "fade"))
        for job in self.jobs:
            self.client.request("DELETE", f"/jobs?id=eq.{job}")
        self.client.request("DELETE", f"/video_analyses?id=eq.{self.analysis}")
        self.client.request("DELETE", f"/media?id=eq.{self.media}")
        if self.objects:
            with storage_request(
                self.client,
                "DELETE",
                "object/imports",
                json.dumps({"prefixes": list(set(self.objects))}).encode(),
                "application/json",
            ) as response:
                response.read()

    def enqueue(self):
        identity = str(uuid4())
        self.jobs.append(identity)
        self.client.request(
            "POST",
            "/jobs",
            {
                "id": identity,
                "kind": "video_analyse",
                "payload": {"analysis_id": self.analysis, "media_id": self.media},
            },
        )
        job = self.client.claim(("video_analyse",), "local-video-test-" + identity)
        self.assertEqual(job.id, identity)
        return job

    def test_durable_measurements_crops_cost_and_retry(self):
        job = self.enqueue()
        execute_job(self.client, job, VideoHandler(self.client))
        row = self.client.request("GET", f"/jobs?id=eq.{job.id}")[0]
        self.assertEqual(row["status"], "done", row["error"])
        self.assertEqual(row["cost"]["provider_usd"], 0)
        self.assertGreater(row["cost"]["duration_seconds"], 0)
        analysis = self.client.request("GET", f"/video_analyses?id=eq.{self.analysis}")[0]
        self.assertEqual(analysis["status"], "interpreting")
        self.assertEqual([shot["t_ms"] for shot in analysis["shots"]], [500, 5500])
        self.assertEqual(len(analysis["features"]), 2)
        for shot in analysis["keyframes"]:
            for label in ("launch", "peak", "fade"):
                crop = shot[label]
                self.assertEqual(crop["bucket"], "imports")
                with storage_request(
                    self.client, "GET", "object/authenticated/imports/" + crop["path"]
                ) as response:
                    self.assertTrue(response.read().startswith(b"\x89PNG"))
        repeated = self.enqueue()
        execute_job(self.client, repeated, VideoHandler(self.client))
        result = self.client.request("GET", f"/jobs?id=eq.{repeated.id}")[0]
        self.assertTrue(result["result"]["reused"])
        self.assertEqual(
            self.client.request("GET", f"/video_analyses?id=eq.{self.analysis}")[0], analysis
        )
        with self.assertRaises(DatabaseError):
            VideoHandler(self.client).transition(job, "failed", error="late")

    def test_corrupt_media_records_analysis_and_queue_failure(self):
        self.client.request("PATCH", f"/media?id=eq.{self.media}", {"sha256": "a" * 64})
        job = self.enqueue()
        execute_job(self.client, job, VideoHandler(self.client))
        analysis = self.client.request("GET", f"/video_analyses?id=eq.{self.analysis}")[0]
        row = self.client.request("GET", f"/jobs?id=eq.{job.id}")[0]
        self.assertEqual(analysis["status"], "failed")
        self.assertEqual(analysis["error"], "ValueError")
        self.assertEqual(row["status"], "failed")
        self.assertGreater(row["cost"]["duration_seconds"], 0)
        self.assertIsNone(analysis["shots"])


if __name__ == "__main__":
    unittest.main()
