"""Real local queue, MP4 download, measurements, crop storage and idempotent retry acceptance."""

import hashlib
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))
from showcrafter_workers.client import DatabaseError, JobClient, Settings  # noqa: E402
from showcrafter_workers.runtime import execute_job  # noqa: E402

from fit import REPOSITORY  # noqa: E402
from fit_jobs import FitHandler  # noqa: E402
from interpret import VideoResponse  # noqa: E402
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
        self.client.request(
            "DELETE", f"/jobs?kind=eq.video_fit&payload->>analysis_id=eq.{self.analysis}"
        )
        self.client.request(
            "DELETE", f"/llm_calls?purpose=eq.video.interpret&ref_id=eq.{self.media}"
        )
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

    def test_interpretation_fit_lineage_usage_and_idempotent_completion(self):
        measurement_job = self.enqueue()
        execute_job(self.client, measurement_job, VideoHandler(self.client))
        records = json.loads(
            subprocess.check_output(
                [
                    "node",
                    "--import",
                    str(REPOSITORY / "scripts/register-typescript.mjs"),
                    str(REPOSITORY / "packages/video-fit/tests/fixtures.mjs"),
                ],
                cwd=REPOSITORY,
            )
        )
        provider = Mock()
        provider.generate.return_value = VideoResponse(
            json.dumps(records["definitions"][0]["proposal"]), 1000, 100, 32
        )
        fit_job = self.client.claim(("video_fit",), "local-video-fit-test")
        self.assertEqual(fit_job.payload["analysis_id"], self.analysis)
        self.jobs.append(fit_job.id)
        with patch("fit.MAX_ITERATIONS", 2):
            execute_job(self.client, fit_job, FitHandler(self.client, provider))
        job = self.client.request("GET", f"/jobs?id=eq.{fit_job.id}")[0]
        self.assertEqual(job["status"], "done", job["error"])
        self.assertEqual(job["cost"]["provider_usd"], 0.000147)
        analysis = self.client.request("GET", f"/video_analyses?id=eq.{self.analysis}")[0]
        self.assertEqual(analysis["status"], "ready", analysis["error"])
        candidates = self.client.request(
            "GET", f"/design_candidates?analysis_id=eq.{self.analysis}"
        )
        self.assertEqual(len(candidates), 2)
        initial = next(row for row in candidates if row["source"] == "llm")
        fitted = next(row for row in candidates if row["source"] == "fit")
        self.assertEqual(fitted["parent_id"], initial["id"])
        self.assertGreaterEqual(fitted["overall"], initial["overall"])
        self.assertEqual(len(fitted["scores"]["shots"]), 2)
        self.assertEqual(fitted["renderer"], initial["renderer"])
        calls = self.client.request(
            "GET", f"/llm_calls?purpose=eq.video.interpret&ref_id=eq.{self.media}"
        )
        self.assertEqual(len(calls), 1)
        self.assertEqual(
            (calls[0]["tokens_in"], calls[0]["tokens_out"], calls[0]["ok"]), (1000, 100, True)
        )
        retry_id = str(uuid4())
        self.jobs.append(retry_id)
        self.client.request(
            "POST", "/jobs", {"id": retry_id, "kind": "video_fit", "payload": fit_job.payload}
        )
        repeated = self.client.claim(("video_fit",), "local-video-fit-test")
        execute_job(self.client, repeated, FitHandler(self.client, provider))
        self.assertEqual(provider.generate.call_count, 1)
        result = self.client.request("GET", f"/jobs?id=eq.{retry_id}")[0]
        self.assertTrue(result["result"]["reused"])
        with self.assertRaises(DatabaseError):
            FitHandler(self.client, provider).step(fit_job, "failure", {"error": "late"})

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
