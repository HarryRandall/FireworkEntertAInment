"""Deterministic renderer fitting and a complete worker run on synthetic clips."""

import json
import subprocess
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))
from fit import REPOSITORY, NodeScorer, fit_proposal  # noqa: E402
from measure import measure  # noqa: E402
from worker import RECONSTRUCTION_SCHEMA_VERSION, process_reconstruction_run  # noqa: E402

FIXTURES = SERVICE / "tests" / "fixtures"


def fixture_proposals():
    return json.loads(
        subprocess.check_output(
            [
                "node",
                "--import",
                str(REPOSITORY / "scripts/renderer/register-typescript.mjs"),
                str(REPOSITORY / "packages/video-fit/tests/fixtures.mjs"),
            ],
            cwd=REPOSITORY,
        )
    )


class RecordingSupabase:
    """Lease RPCs, storage download and empty checkpoint queries for one run."""

    def __init__(self, video: bytes):
        self.calls = []
        self.video = video

    def rpc(self, name, arguments):
        self.calls.append((name, arguments))
        return SimpleNamespace(execute=lambda: SimpleNamespace(data="candidate-id"))

    @property
    def storage(self):
        bucket = SimpleNamespace(download=lambda _path: self.video)
        return SimpleNamespace(from_=lambda _bucket: bucket)

    def table(self, _name):
        query = MagicMock()
        for method in ("select", "eq", "order", "limit"):
            getattr(query, method).return_value = query
        query.execute.return_value = SimpleNamespace(data=[])
        return query


class FakeModel:
    def __init__(self, value):
        self.value = value
        self.calls = 0

    def complete_json(self, messages, schema, schema_name, *, temperature):
        self.calls += 1
        self.messages = messages
        return SimpleNamespace(value=self.value, raw={}, attempts=1)


class FittingTests(unittest.TestCase):
    def test_seeded_fit_improves_and_repeats_on_real_cpu_measurements(self):
        proposal = fixture_proposals()["definitions"][1]["proposal"]
        evidence, _ = measure(FIXTURES / "silent-comet.mp4", {"shot_count": 1})
        with NodeScorer() as scorer:
            first = fit_proposal(scorer, evidence, proposal, max_iterations=2)
        with NodeScorer() as scorer:
            second = fit_proposal(scorer, evidence, proposal, max_iterations=2)
        self.assertEqual(first["fitted"], second["fitted"])
        self.assertGreaterEqual(first["fitted"]["overall"], first["initial"]["overall"])
        self.assertEqual(first["iterations"], {"a": 2})
        self.assertFalse(first["timed_out"])
        with NodeScorer(seconds=0) as scorer:
            with self.assertRaises(TimeoutError):
                scorer.request({"catalogue": True})

    def test_bridge_reports_validation_errors(self):
        evidence, _ = measure(FIXTURES / "silent-comet.mp4", {"shot_count": 1})
        proposal = {
            "effects": {"a": {"template": "invented", "overrides": {}}},
            "composition": {"tubes": [{"i": 0, "letter": "a", "t_ms": 0, "angle_deg": 0}]},
        }
        proposal["composition"]["tubes"][0]["t_ms"] = evidence["shots"][0]["t_ms"]
        with NodeScorer() as scorer:
            with self.assertRaisesRegex(ValueError, "Unknown effect template"):
                scorer.request({"evidence": evidence, "proposal": proposal})

    def test_worker_run_completes_with_renderer_designs(self):
        response = {
            "effects": [
                {"letter": "a", "template": "peony", "overrides_json": "{}", "reason": "red"},
                {"letter": "b", "template": "peony", "overrides_json": "{}", "reason": "green"},
            ],
            "tubes": [{"i": 0, "letter": "a"}, {"i": 1, "letter": "b"}],
            "notes": "",
        }
        model = FakeModel(response)
        supabase = RecordingSupabase((FIXTURES / "shell-cake.mp4").read_bytes())
        run = {
            "run_id": "00000000-0000-0000-0000-000000000001",
            "lease_token": "lease",
            "storage_path": "admin/shell-cake.mp4",
            "source_name": "Shell cake",
            "selected_model": "test/model",
        }
        environment = {"IMPORT_FIT_ITERATIONS": "1", "IMPORT_FIT_SECONDS": "120"}
        with (
            patch.dict("os.environ", environment),
            patch("worker.create_openrouter_client", return_value=model),
        ):
            process_reconstruction_run(supabase, run)

        self.assertEqual(model.calls, 1)
        names = [name for name, _ in supabase.calls]
        self.assertEqual(names[-1], "complete_firework_import_run")
        completion = supabase.calls[-1][1]
        self.assertEqual(completion["p_selected_ordinal"], 0)
        fitted = completion["p_candidates"][0]
        self.assertEqual(fitted["schemaVersion"], RECONSTRUCTION_SCHEMA_VERSION)
        self.assertEqual(fitted["metrics"]["source"], "fitted")
        reconstruction = fitted["reconstruction"]
        self.assertEqual([shot["designKey"] for shot in reconstruction["shots"]], ["a", "b"])
        self.assertEqual(reconstruction["shots"][0]["timeOffsetSeconds"], 0)
        self.assertAlmostEqual(reconstruction["shots"][1]["timeOffsetSeconds"], 5, delta=0.1)
        self.assertTrue(all(d["design"]["kind"] == "shell" for d in reconstruction["designs"]))
        self.assertEqual(len(fitted["metrics"]["fit"]["shots"]), 2)
        self.assertGreater(fitted["score"], 0)
        stages = [
            arguments["p_stage"]
            for name, arguments in supabase.calls
            if name == "append_firework_import_run_output"
        ]
        self.assertEqual(stages, ["started", "probe", "video_analysis", "model", "render"])


if __name__ == "__main__":
    unittest.main()
