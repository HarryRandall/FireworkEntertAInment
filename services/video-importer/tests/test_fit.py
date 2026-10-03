"""Cost refusal, response validation, deterministic optimisation and paid retry prevention."""

import json
import subprocess
import sys
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import Mock, patch

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))
from jsonschema import ValidationError  # noqa: E402
from showcrafter_workers.runtime import Usage  # noqa: E402

from fit import REPOSITORY, NodeScorer, fit_proposal  # noqa: E402
from fit_jobs import FitHandler  # noqa: E402
from interpret import DisabledProvider, VideoResponse, validate_response  # noqa: E402
from measure import measure  # noqa: E402
from model_config import actual_cost, estimate_cost  # noqa: E402


class InterpretationTests(unittest.TestCase):
    def setUp(self):
        self.provider = Mock()
        self.handler = FitHandler(Mock(), self.provider)
        self.handler.step = Mock()
        self.scorer = Mock()
        self.scorer.request.side_effect = [{"templates": []}, {"candidates": [{"overall": 1}]}]
        self.evidence = {"duration_ms": 10000}
        self.proposal = {
            "effects": {"a": {"template": "peony", "overrides": {}}},
            "composition": {"tubes": [{"i": 0, "letter": "a", "t_ms": 500, "angle_deg": 0}]},
        }
        self.provider.generate.return_value = VideoResponse(
            json.dumps(self.proposal), 1000, 100, 32
        )

    def interpret(self, state=None, evidence=None):
        usage = Usage()
        result = self.handler.interpret(
            Mock(),
            usage,
            self.scorer,
            evidence or self.evidence,
            Path("source.mp4"),
            state or {"call": None, "analysis": {"priors": {}}},
        )
        return result, usage

    def test_cost_units_and_refusal_before_generation(self):
        self.assertEqual(actual_cost(1000, 100, 32), Decimal("0.000147"))
        self.assertLess(estimate_cost(120000, "bounded prompt")["cost_usd"], 0.1)
        for duration, prompt in ((0, ""), (10000, "x" * 400000)):
            with self.assertRaises(ValueError):
                estimate_cost(duration, prompt)
        with self.assertRaises(ValueError):
            actual_cost(1, 1, 2)
        self.scorer.request.side_effect = [{"huge": "x" * 400000}]
        with self.assertRaises(ValueError):
            self.interpret()
        self.provider.generate.assert_not_called()
        self.handler.step.assert_not_called()

    def test_one_native_video_request_and_actual_usage_before_candidate_write(self):
        result, usage = self.interpret()
        self.assertEqual(result, self.proposal)
        self.assertEqual(usage.provider_usd, 0.000147)
        request = self.provider.generate.call_args.args[0]
        self.assertEqual(request.video, Path("source.mp4"))
        self.assertEqual((request.thinking_budget, request.retries), (0, 0))
        self.assertEqual(
            [call.args[1] for call in self.handler.step.call_args_list],
            ["reserve", "usage", "interpret"],
        )
        self.assertEqual(self.handler.step.call_args_list[1].args[2]["tokens_in"], 1000)

    def test_invalid_json_logs_usage_but_never_installs_candidate(self):
        self.provider.generate.return_value = VideoResponse("invalid", 1000, 100, 32)
        with self.assertRaises(ValueError):
            self.interpret()
        self.assertEqual(
            [call.args[1] for call in self.handler.step.call_args_list], ["reserve", "usage"]
        )
        for text in ("{}", '{"effects":NaN}', json.dumps({**self.proposal, "extra": 1})):
            with self.assertRaises((ValueError, ValidationError)):
                validate_response(text)

    def test_uncertain_or_disabled_generation_cannot_be_retried(self):
        with self.assertRaises(ValueError):
            self.interpret({"call": {"ok": False, "error": "reserved"}})
        self.provider.generate.assert_not_called()
        self.handler.provider = DisabledProvider()
        with self.assertRaises(RuntimeError):
            self.interpret()
        self.handler.step.assert_not_called()

    def test_provider_overrun_and_transport_failure_fail_closed(self):
        self.provider.generate.return_value = VideoResponse(
            json.dumps(self.proposal), 500000, 100, 32
        )
        with self.assertRaises(ValueError):
            self.interpret()
        self.assertEqual(self.handler.step.call_args.args[1], "usage")
        usage = Usage()
        self.scorer.request.side_effect = [{"templates": []}]
        self.provider.generate.side_effect = TimeoutError()
        with self.assertRaises(TimeoutError):
            self.handler.interpret(
                Mock(),
                usage,
                self.scorer,
                self.evidence,
                Path("source.mp4"),
                {"call": None, "analysis": {"priors": {}}},
            )
        self.assertGreater(usage.provider_usd, 0)


class FittingTests(unittest.TestCase):
    def test_seeded_fit_improves_and_repeats_on_real_cpu_measurements(self):
        import tempfile

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
        proposal = records["definitions"][1]["proposal"]
        with tempfile.TemporaryDirectory() as temporary:
            evidence = measure(
                SERVICE / "tests/fixtures/silent-comet.mp4", {"shot_count": 1}, Path(temporary)
            )
        with patch("fit.MAX_ITERATIONS", 2):
            with NodeScorer() as scorer:
                first = fit_proposal(scorer, evidence, proposal)
            with NodeScorer() as scorer:
                second = fit_proposal(scorer, evidence, proposal)
        self.assertEqual(first["fitted"], second["fitted"])
        self.assertGreaterEqual(first["fitted"]["overall"], first["initial"]["overall"])
        self.assertEqual(first["iterations"], {"a": 2})
        with NodeScorer(seconds=0) as scorer:
            with self.assertRaises(TimeoutError):
                scorer.request({"catalogue": True})


if __name__ == "__main__":
    unittest.main()
