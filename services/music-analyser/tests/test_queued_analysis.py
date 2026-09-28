import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from queued_analysis import authorise, deliver_callback, validate_job


class QueuedAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"SHOWCRAFTER_APP_ORIGIN": "https://showcrafter.example", "ANALYSER_SHARED_SECRET": "test-secret"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.payload = {"analysis_id": "c87acebd-4a96-4770-8825-1b2aebc84365", "lease_token": "efaa21bc-a153-4b69-a8a3-013fae4fa74a", "audio_url": "https://project.supabase.co/audio", "callback_url": "https://showcrafter.example/api/internal/music-analysis/callback"}

    def test_callback_target_must_match_deployment_origin(self):
        validate_job(self.payload)
        for target in ("https://attacker.example/callback", "http://showcrafter.example/api/internal/music-analysis/callback", "https://showcrafter.example@attacker.example/api/internal/music-analysis/callback"):
            with self.assertRaises(ValueError):
                validate_job({**self.payload, "callback_url": target})

    def test_invalid_job_ids_are_rejected_before_dispatch(self):
        with self.assertRaises(ValueError):
            validate_job({**self.payload, "lease_token": "invalid"})

    def test_authentication_is_required(self):
        self.assertFalse(authorise(None))
        self.assertFalse(authorise("Bearer wrong"))
        self.assertTrue(authorise("Bearer test-secret"))

    @patch("queued_analysis.time.sleep")
    @patch("queued_analysis.requests.post")
    def test_transient_callback_failure_redelivers_same_lease(self, post, sleep):
        post.side_effect = [Mock(status_code=503), Mock(status_code=200)]
        deliver_callback(self.payload, {"ok": True, "analysis": {"schema_version": "1.4.0"}}, 15000)
        self.assertEqual(post.call_count, 2)
        self.assertEqual(post.call_args.kwargs["json"]["lease_token"], self.payload["lease_token"])
        self.assertFalse(post.call_args.kwargs["allow_redirects"])

    @patch("queued_analysis.requests.post")
    def test_redirect_is_not_followed_with_shared_secret(self, post):
        post.return_value = Mock(status_code=307)
        with self.assertRaises(ValueError):
            deliver_callback(self.payload, {"ok": False, "error": "Failed", "status": 500}, 1)
        self.assertEqual(post.call_count, 1)

    @patch("queued_analysis.requests.post")
    def test_invalid_destination_never_receives_a_request(self, post):
        with self.assertRaises(ValueError):
            deliver_callback({**self.payload, "callback_url": "https://attacker.example"}, {"ok": True}, 1)
        post.assert_not_called()
