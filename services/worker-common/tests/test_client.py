"""Queue envelopes and safe transport failures without a live database."""

import io
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock
from urllib.error import HTTPError, URLError

from showcrafter_workers.client import (
    DatabaseError,
    Job,
    JobClient,
    LeaseLost,
    NoRedirects,
    Settings,
)

JOB_ID = "80000000-0000-4000-8000-000000000001"


def claimed_row():
    """Return a realistic leased envelope with an intentionally opaque feature payload."""
    return {
        "id": JOB_ID,
        "kind": "fake",
        "payload": {"value": 1},
        "status": "running",
        "worker": "test-worker",
        "attempts": 1,
        "lease_until": datetime.now(timezone.utc).isoformat(),
    }


class ClientTests(unittest.TestCase):
    def setUp(self):
        self.client = JobClient(Settings("http://127.0.0.1:55421", "secret-value"))

    def test_explicit_empty_and_composite_null(self):
        self.client.request = Mock(side_effect=[None, {"id": None, "payload": None}])
        self.assertIsNone(self.client.claim(("fake",), "test-worker"))
        self.assertIsNone(self.client.claim(("fake",), "test-worker"))

    def test_malformed_claims_are_visible(self):
        for row in (
            {},
            [],
            {**claimed_row(), "attempts": True},
            {**claimed_row(), "worker": "other"},
            {**claimed_row(), "payload": []},
            {**claimed_row(), "lease_until": "2026-01-01T00:00:00"},
        ):
            with self.subTest(row=row):
                self.client.request = Mock(return_value=row)
                with self.assertRaises((ValueError, KeyError)):
                    self.client.claim(("fake",), "test-worker")

    def test_rpc_fences_and_cost(self):
        job = Job.from_response(claimed_row(), ("fake",), "test-worker")
        self.client.request = Mock(return_value=job.lease_until.isoformat())
        self.assertEqual(self.client.heartbeat(job), job.lease_until)
        self.client.complete(job, {"ok": True}, {"duration_seconds": 1})
        self.client.fail(job, "safe reason", {"provider_usd": 0})
        for call in self.client.request.call_args_list:
            self.assertEqual(call.args[2]["attempt"], 1)
            self.assertEqual(call.args[2]["worker"], "test-worker")
            self.assertEqual(call.args[2]["id"], JOB_ID)

    def test_safe_http_errors_and_lease_rejection(self):
        for path, expected in (("/rpc/claim_job", DatabaseError), ("/rpc/complete_job", LeaseLost)):
            error = HTTPError(
                "https://secret.invalid",
                400,
                "secret-value",
                {},
                io.BytesIO(json.dumps({"code": "23514", "message": "secret-value"}).encode()),
            )
            self.client._opener.open = Mock(side_effect=error)
            with self.assertRaises(expected) as caught:
                self.client.request("POST", path, {})
            self.assertNotIn("secret-value", str(caught.exception))
            self.client._opener.open.assert_called_once()

    def test_transport_is_not_retried(self):
        self.client._opener.open = Mock(side_effect=URLError("secret-value"))
        with self.assertRaises(DatabaseError) as caught:
            self.client.claim(("fake",), "test-worker")
        self.assertNotIn("secret-value", str(caught.exception))
        self.client._opener.open.assert_called_once()

    def test_empty_or_invalid_claim_http_response_is_not_an_empty_queue(self):
        for raw in (b"", b"not-json"):
            response = Mock()
            response.read.return_value = raw
            context = Mock()
            context.__enter__ = Mock(return_value=response)
            context.__exit__ = Mock(return_value=False)
            self.client._opener.open = Mock(return_value=context)
            with self.assertRaises(DatabaseError):
                self.client.claim(("fake",), "test-worker")

    def test_origin_and_key_guards(self):
        for url in (
            "http://host.invalid",
            "https://host.invalid/path",
            "https://user:secret@host.invalid",
            "https://host.invalid?query=1",
        ):
            with self.assertRaises(ValueError):
                Settings(url, "secret")
        self.assertNotIn("secret-value", repr(self.client.settings))
        self.assertIsNone(NoRedirects().redirect_request(None, None, None, None, None, None))
