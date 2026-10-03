"""Handler lifecycle, renewal failure, finite drains and measured usage."""

import io
import json
import threading
import unittest
from contextlib import redirect_stdout
from unittest.mock import Mock

from test_client import claimed_row

from showcrafter_workers.client import DatabaseError, Job, LeaseLost
from showcrafter_workers.runtime import Usage, drain, execute_job


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.job = Job.from_response(claimed_row(), ("fake",), "test-worker")
        self.client = Mock()
        self.output = io.StringIO()
        self.capture = redirect_stdout(self.output)
        self.capture.__enter__()
        self.addCleanup(self.capture.__exit__, None, None, None)

    def test_success_records_usage_and_safe_logs(self):
        def handler(job, usage):
            usage.provider_usd = 0.025
            return {"private_result": "secret-value"}

        execute_job(self.client, self.job, handler)
        self.client.fail.assert_not_called()
        cost = self.client.complete.call_args.args[2]
        self.assertEqual(cost["provider_usd"], 0.025)
        self.assertIsNone(cost["compute_usd"])
        self.assertGreaterEqual(cost["duration_seconds"], 0)
        self.assertEqual(cost["scope"], "attempt")
        self.assertNotIn("secret-value", self.output.getvalue())
        events = [json.loads(line)["event"] for line in self.output.getvalue().splitlines()]
        self.assertEqual(events, ["job_started", "job_completed"])

    def test_failure_keeps_spend_and_redacts_reason(self):
        def handler(job, usage):
            usage.provider_usd = 0.1
            raise ValueError("secret-value")

        execute_job(self.client, self.job, handler)
        self.client.complete.assert_not_called()
        self.assertEqual(self.client.fail.call_args.args[1], "Handler failed: ValueError")
        self.assertEqual(self.client.fail.call_args.args[2]["provider_usd"], 0.1)
        self.assertNotIn("secret-value", self.output.getvalue())

    def test_renews_while_handler_runs(self):
        renewed = threading.Event()
        self.client.heartbeat.side_effect = lambda job: renewed.set()

        def handler(job, usage):
            renewed.clear()
            self.assertTrue(renewed.wait(1), "background renewal did not run")
            return {}

        execute_job(self.client, self.job, handler, heartbeat_seconds=0.001)
        self.assertGreaterEqual(self.client.heartbeat.call_count, 2)
        self.client.complete.assert_called_once()

    def test_lost_heartbeat_never_finishes(self):
        failed = threading.Event()

        def heartbeat(job):
            if self.client.heartbeat.call_count > 1:
                failed.set()
                raise LeaseLost("expired")

        self.client.heartbeat.side_effect = heartbeat

        def handler(job, usage):
            self.assertTrue(failed.wait(1))
            return {}

        with self.assertRaises(LeaseLost):
            execute_job(self.client, self.job, handler, heartbeat_seconds=0.001)
        self.client.complete.assert_not_called()
        self.client.fail.assert_not_called()

    def test_initial_renewal_failure_prevents_handler(self):
        self.client.heartbeat.side_effect = LeaseLost("expired")
        handler = Mock()
        with self.assertRaises(LeaseLost):
            execute_job(self.client, self.job, handler)
        handler.assert_not_called()

    def test_uncertain_completion_is_visible_without_failure_mutation(self):
        self.client.complete.side_effect = DatabaseError("unknown outcome")
        with self.assertRaises(DatabaseError):
            execute_job(self.client, self.job, lambda job, usage: {})
        self.client.fail.assert_not_called()

    def test_invalid_result_becomes_failure(self):
        execute_job(self.client, self.job, lambda job, usage: {"invalid": float("nan")})
        self.client.fail.assert_called_once()
        self.client.complete.assert_not_called()

    def test_finite_budget_and_empty_queue(self):
        self.client.claim.side_effect = [self.job, self.job, None]
        self.assertEqual(
            drain(self.client, {"fake": lambda job, usage: {}}, "worker", max_jobs=2), 2
        )
        self.assertEqual(self.client.claim.call_count, 2)
        self.assertEqual(drain(self.client, {"fake": lambda job, usage: {}}, "worker"), 0)

    def test_invalid_cost_is_visible(self):
        for value in (-1, float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                Usage(provider_usd=value).record(1)
