"""Real local queue/storage acceptance using only committed synthetic audio."""

import hashlib
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, build_opener
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from music_jobs import ALGORITHM, MusicHandler  # noqa: E402
from showcrafter_workers.client import DatabaseError, JobClient, Settings, NoRedirects  # noqa: E402
from showcrafter_workers.runtime import execute_job  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures/clicks.wav"


class LocalMusicTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = JobClient(Settings.from_environment(local_only=True))

    def setUp(self):
        self.track = str(uuid4())
        self.jobs = []
        self.client.request(
            "POST",
            "/music_tracks",
            {
                "id": self.track,
                "provider": "jamendo",
                "provider_track_id": "synthetic-" + self.track,
                "title": "Synthetic offline fixture",
                "duration_ms": 10000,
                "licence_code": "CC0",
            },
        )
        self.addCleanup(self.cleanup)

    def cleanup(self):
        for job_id in self.jobs:
            self.client.request("DELETE", f"/jobs?id=eq.{job_id}")
        self.client.request("DELETE", f"/music_tracks?id=eq.{self.track}")
        self.client.request("DELETE", f"/media?path=like.{self.track}/*")
        # Remove only this test's content-addressed storage object, through Storage API.
        request = Request(
            self.client.settings.url + "/storage/v1/object/audio",
            method="DELETE",
            data=json.dumps(
                {
                    "prefixes": [
                        f"{self.track}/{hashlib.sha256(FIXTURE.read_bytes()).hexdigest()}"
                    ]
                }
            ).encode(),
            headers={
                "apikey": self.client.settings.service_role_key,
                "Authorization": "Bearer " + self.client.settings.service_role_key,
                "Content-Type": "application/json",
            },
        )
        with build_opener(NoRedirects()).open(request) as response:
            response.read()

    def enqueue(self, payload=None):
        job_id = str(uuid4())
        self.jobs.append(job_id)
        self.client.request(
            "POST",
            "/jobs",
            {
                "id": job_id,
                "kind": "music_analyse",
                "payload": payload
                or {
                    "track_id": self.track,
                    "audio_url": "https://prod-1.storage.jamendo.com/synthetic.wav",
                },
            },
        )
        job = self.client.claim(("music_analyse",), "local-test-" + job_id)
        self.assertEqual(job.id, job_id)
        return job

    def test_queue_audio_analysis_and_shared_reuse(self):
        job = self.enqueue()

        def offline_download(url, path):
            path.write_bytes(FIXTURE.read_bytes())

        with patch("music_jobs.download_audio", side_effect=offline_download):
            execute_job(self.client, job, MusicHandler(self.client))
        row = self.client.request("GET", f"/jobs?id=eq.{job.id}")[0]
        self.assertEqual(row["status"], "done", row["error"])
        self.assertGreater(row["cost"]["duration_seconds"], 0)
        self.assertEqual(row["cost"]["provider_usd"], 0)
        analyses = self.client.request(
            "GET", f"/music_analyses?track_id=eq.{self.track}"
        )
        self.assertEqual(len(analyses), 1)
        self.assertEqual(analyses[0]["algorithm"], ALGORITHM)
        self.assertTrue(analyses[0]["is_current"])
        self.assertEqual(
            analyses[0]["audio_sha256"],
            hashlib.sha256(FIXTURE.read_bytes()).hexdigest(),
        )
        track = self.client.request("GET", f"/music_tracks?id=eq.{self.track}")[0]
        self.assertEqual(track["duration_ms"], 10000)
        self.assertGreater(track["bpm"], 0)
        self.assertTrue(track["waveform"])
        self.assertIsNotNone(track["audio_media_id"])
        object_path = f"{self.track}/{analyses[0]['audio_sha256']}"
        request = Request(
            self.client.settings.url
            + "/storage/v1/object/authenticated/audio/"
            + object_path,
            headers={
                "apikey": self.client.settings.service_role_key,
                "Authorization": "Bearer " + self.client.settings.service_role_key,
            },
        )
        with build_opener(NoRedirects()).open(request) as response:
            self.assertEqual(response.read(), FIXTURE.read_bytes())

        repeat = self.enqueue()
        with patch(
            "music_jobs.download_audio", side_effect=AssertionError("repeat download")
        ):
            execute_job(self.client, repeat, MusicHandler(self.client))
        repeated = self.client.request("GET", f"/jobs?id=eq.{repeat.id}")[0]
        self.assertEqual(repeated["status"], "done")
        self.assertEqual(repeated["result"]["analysis_id"], analyses[0]["id"])
        self.assertTrue(repeated["result"]["reused"])
        stale_body = {
            "p_job": repeat.id,
            "p_worker": repeat.worker,
            "p_attempt": repeat.attempt,
            "p_algorithm": ALGORITHM,
            "p_analysis": analyses[0]["analysis"],
            "p_audio_sha256": analyses[0]["audio_sha256"],
            "p_bytes": 1,
            "p_mime": "audio/wav",
            "p_waveform": [],
        }
        with self.assertRaises(DatabaseError):
            self.client.request("POST", "/rpc/install_music_result", stale_body)
        self.assertEqual(
            self.client.request("GET", f"/music_tracks?id=eq.{self.track}")[0][
                "waveform"
            ],
            track["waveform"],
        )

    def test_public_and_signed_in_shopper_cannot_install_results(self):
        anonymous_key = os.environ["SHOWCRAFTER_LOCAL_ANON_KEY"]
        body = {
            "p_job": str(uuid4()),
            "p_worker": "untrusted",
            "p_attempt": 1,
            "p_algorithm": ALGORITHM,
            "p_analysis": {},
            "p_audio_sha256": "a" * 64,
            "p_bytes": 1,
            "p_mime": "audio/wav",
            "p_waveform": [],
        }

        def request(path, payload, bearer):
            return Request(
                self.client.settings.url + path,
                method="POST",
                data=json.dumps(payload).encode(),
                headers={
                    "apikey": anonymous_key,
                    "Authorization": "Bearer " + bearer,
                    "Content-Type": "application/json",
                },
            )

        def denied(bearer):
            with self.assertRaises(HTTPError) as raised:
                build_opener(NoRedirects()).open(
                    request("/rest/v1/rpc/install_music_result", body, bearer)
                )
            error = raised.exception
            response = json.loads(error.read())
            error.close()
            # PostgREST uses 401 for denied public callers and 403 for signed-in callers.
            self.assertIn(error.code, (401, 403, 404))
            self.assertIn(response.get("code"), ("42501", "PGRST202"))

        denied(anonymous_key)
        with build_opener(NoRedirects()).open(
            request(
                "/auth/v1/token?grant_type=password",
                {
                    "email": "shopper@showcrafter.test",
                    "password": "LocalShowcrafter123!",
                },
                anonymous_key,
            )
        ) as response:
            session = json.loads(response.read())
        try:
            denied(session["access_token"])
        finally:
            with build_opener(NoRedirects()).open(
                request("/auth/v1/logout?scope=local", {}, session["access_token"])
            ) as response:
                response.read()

    def test_invalid_payload_records_failure_and_duration(self):
        job = self.enqueue({"track_id": self.track, "user_id": self.track})
        execute_job(self.client, job, MusicHandler(self.client))
        row = self.client.request("GET", f"/jobs?id=eq.{job.id}")[0]
        self.assertEqual(row["status"], "failed")
        self.assertIn("ValidationError", row["error"])
        self.assertGreaterEqual(row["cost"]["duration_seconds"], 0)
        self.assertEqual(
            self.client.request("GET", f"/music_analyses?track_id=eq.{self.track}"), []
        )


if __name__ == "__main__":
    unittest.main()
