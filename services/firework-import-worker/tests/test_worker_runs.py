from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from interpret import (  # noqa: E402
    keyframe_images,
    proposal_from_response,
    response_schema,
    system_prompt,
)
from worker import (  # noqa: E402
    admin_guidance,
    append_reconstruction_output,
    build_reconstruction,
    complete_reconstruction_run,
    create_browser_normalized_video,
    create_required_browser_normalized_video,
    fail_reconstruction_run,
    fetch_prompt_config,
    ffprobe_media,
    fit_evidence,
    heartbeat_reconstruction_run,
    load_proposal_checkpoint,
    needs_browser_normalization,
    normalized_preview_storage_path,
    pan_degrees,
    parent_proposal,
    parse_frame_rate,
    persist_run_context,
    process_reconstruction_run_by_id,
    record_reconstruction_media_probe,
    validate_source_video,
)


class FakeRpcCall:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return SimpleNamespace(data=self.data)


class FakeSupabase:
    def __init__(self):
        self.calls = []

    def rpc(self, name, arguments):
        self.calls.append((name, arguments))
        return FakeRpcCall("candidate-id")


class CommitThenResponseLossSupabase:
    def __init__(self):
        self.calls = []
        self.committed = {}

    def rpc(self, name, arguments):
        self.calls.append((name, arguments))
        owner = self

        class Call:
            def execute(self):
                request = json.dumps(arguments, sort_keys=True, separators=(",", ":"))
                if name not in owner.committed:
                    owner.committed[name] = request
                    raise TimeoutError("response was lost after commit")
                if owner.committed[name] != request:
                    raise AssertionError("retry payload changed after response loss")
                return SimpleNamespace(data=f"{name}-result")

        return Call()


class FakeOpenRouterClient:
    def __init__(self, value):
        self.value = value
        self.messages = None

    def complete_json(self, messages, schema, schema_name, *, temperature):
        self.messages = messages
        self.schema = schema
        self.schema_name = schema_name
        self.temperature = temperature
        return SimpleNamespace(value=self.value, raw={"id": "response"}, attempts=1)


MEASUREMENT = {
    "duration_ms": 10000,
    "extractor": "video-measure-1.0.0",
    "shots": [
        {"t_ms": 500, "x": 0.3, "angle_deg": -4.4, "confidence": 0.9, "evidence": "audio_visual"},
        {"t_ms": 5500, "x": 0.7, "angle_deg": 47.0, "confidence": 0.8, "evidence": "visual"},
    ],
    "features": [
        {
            "shot_index": index,
            "apex_ratio": 0.8,
            "radius_ratio": 0.2,
            "life_ms": 3000,
            "truncated": False,
            "trail_present": False,
            "strobe": False,
            "crackle": None,
            "colours": [],
        }
        for index in range(2)
    ],
}
SUMMARY = {
    "a": {
        "template": "peony",
        "name": "Peony",
        "design": {"kind": "shell"},
        "durationSeconds": 6.25,
        "palette": ["#ff3048"],
    },
    "b": {
        "template": "fountain",
        "name": "Fountain",
        "design": {"kind": "fountain"},
        "durationSeconds": 4.0,
        "palette": [],
    },
}


def query_returning(rows):
    query = MagicMock()
    for method in ("select", "eq", "order", "limit"):
        getattr(query, method).return_value = query
    query.execute.return_value = SimpleNamespace(data=rows)
    return query


class WorkerRunTests(unittest.TestCase):
    def test_prompt_config_defaults_only_when_no_active_row_exists(self):
        query = MagicMock()
        query.select.return_value = query
        query.eq.return_value = query
        query.limit.return_value = query
        query.execute.return_value = SimpleNamespace(data=[])
        supabase = MagicMock()
        supabase.table.return_value = query

        self.assertIsNone(fetch_prompt_config(supabase, "missing"))

        query.execute.side_effect = TimeoutError("prompt lookup unavailable")
        with self.assertRaisesRegex(TimeoutError, "lookup unavailable"):
            fetch_prompt_config(supabase, "firework_video_reconstruction")

    def test_source_video_resource_guards_and_bounded_preview_selection(self):
        ordinary = {
            "video_codec": "h264",
            "audio_codec": "aac",
            "width": 1_920,
            "height": 1_080,
            "frame_rate": "30/1",
            "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
            "pixel_format": "yuv420p",
        }
        validate_source_video(ordinary)
        self.assertFalse(needs_browser_normalization(ordinary))
        self.assertEqual(parse_frame_rate("30000/1001"), 30000 / 1001)

        high_workload = {
            **ordinary,
            "width": 3_840,
            "height": 2_160,
            "frame_rate": "60/1",
        }
        validate_source_video(high_workload)
        self.assertTrue(needs_browser_normalization(high_workload))

        portrait_8k = {**ordinary, "width": 4_320, "height": 7_680}
        validate_source_video(portrait_8k)
        with self.assertRaisesRegex(RuntimeError, "maximum decoded"):
            validate_source_video({**ordinary, "width": 8_192, "height": 4_320})
        with self.assertRaisesRegex(RuntimeError, "frame rate"):
            validate_source_video({**ordinary, "frame_rate": "121/1"})

        first_path = normalized_preview_storage_path(
            "admin/source.mov",
            "run-1-source-hash",
        )
        second_path = normalized_preview_storage_path(
            "admin/source.mov",
            "run-2-source-hash",
        )
        self.assertNotEqual(first_path, second_path)
        self.assertTrue(first_path.endswith("run-1-source-hash.mp4"))

    def test_required_browser_normalisation_failure_is_not_hidden(self):
        with patch(
            "worker.create_browser_normalized_video",
            side_effect=RuntimeError("ffmpeg failed"),
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                "required browser-safe comparison video",
            ):
                create_required_browser_normalized_video(
                    FakeSupabase(),
                    Path("source.mov"),
                    Path("temporary"),
                    {"width": 1920, "height": 1080},
                    "admin/source.mov",
                    artefact_key="run-1-source-hash",
                )


    def test_worker_environment_is_validated_before_claiming_a_run(self):
        supabase = MagicMock()
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "OPENROUTER_API_KEY"):
                process_reconstruction_run_by_id(
                    supabase,
                    "00000000-0000-0000-0000-000000000001",
                )
        with patch.dict(
            "os.environ",
            {"OPENROUTER_API_KEY": "key", "IMPORT_FIT_ITERATIONS": "2.5"},
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, "IMPORT_FIT_ITERATIONS"):
                process_reconstruction_run_by_id(
                    supabase,
                    "00000000-0000-0000-0000-000000000001",
                )
        supabase.rpc.assert_not_called()

    def test_retired_spec_prompt_is_not_used_as_guidance(self):
        supabase = MagicMock()
        supabase.table.return_value = query_returning(
            [{"system_prompt_text": "Fill in a structured FireworkEffectSpecV3."}]
        )
        self.assertIsNone(admin_guidance(supabase))
        supabase.table.return_value = query_returning(
            [{"system_prompt_text": "Prefer warm golds for brocade."}]
        )
        self.assertEqual(admin_guidance(supabase), "Prefer warm golds for brocade.")
        self.assertIn("<ADMIN_GUIDANCE>\nPrefer warm golds", system_prompt("Prefer warm golds"))
        self.assertNotIn("ADMIN_GUIDANCE", system_prompt(None))

    def test_model_response_keeps_measured_times_and_angles(self):
        response = {
            "effects": [
                {"letter": "a", "template": "peony", "overrides_json": "{}", "reason": ""},
                {
                    "letter": "b",
                    "template": "fountain",
                    "overrides_json": '{"seed": 4}',
                    "reason": "",
                },
            ],
            "tubes": [{"i": 1, "letter": "b"}, {"i": 0, "letter": "a"}],
            "notes": "",
        }
        proposal = proposal_from_response(response, MEASUREMENT)
        self.assertEqual(proposal["effects"]["b"]["overrides"], {"seed": 4})
        self.assertEqual(
            proposal["composition"]["tubes"],
            [
                {"i": 0, "letter": "a", "t_ms": 500, "angle_deg": -4.4},
                {"i": 1, "letter": "b", "t_ms": 5500, "angle_deg": 47.0},
            ],
        )
        for mutation in (
            lambda value: value["tubes"].pop(),
            lambda value: value["effects"].append(dict(value["effects"][0])),
            lambda value: value["effects"][0].update(overrides_json="[1]"),
            lambda value: value["effects"][0].update(overrides_json='{"x": NaN}'),
        ):
            value = json.loads(json.dumps(response))
            mutation(value)
            with self.assertRaises(ValueError):
                proposal_from_response(value, MEASUREMENT)
        schema = response_schema(["peony", "fountain"])
        self.assertEqual(
            schema["properties"]["effects"]["items"]["properties"]["template"]["enum"],
            ["fountain", "peony"],
        )

    def test_keyframes_prefer_every_peak_within_the_image_budget(self):
        keyframes = [
            {
                "shot_index": index,
                **{
                    label: {"t_ms": index * 1000, "jpegBase64": f"{label}{index}"}
                    for label in ("launch", "peak", "fade")
                },
            }
            for index in range(3)
        ]
        chosen = keyframe_images(keyframes, limit=4)
        self.assertEqual(
            [image["jpegBase64"] for image in chosen], ["peak0", "launch0", "peak1", "peak2"]
        )

    def test_reconstruction_starts_at_the_first_firing_and_bounds_pan(self):
        proposal = {
            "effects": {"a": {"template": "peony", "overrides": {}}, "b": {"template": "fountain", "overrides": {}}},
            "composition": {
                "tubes": [
                    {"i": 0, "letter": "a", "t_ms": 500, "angle_deg": -4.4},
                    {"i": 1, "letter": "b", "t_ms": 5500, "angle_deg": 47.0},
                ]
            },
        }
        reconstruction = build_reconstruction("Two tubes", MEASUREMENT, proposal, SUMMARY)
        self.assertEqual(reconstruction["version"], 2)
        self.assertEqual([shot["timeOffsetSeconds"] for shot in reconstruction["shots"]], [0, 5])
        self.assertEqual([shot["panDegrees"] for shot in reconstruction["shots"]], [-4, 0])
        self.assertEqual(reconstruction["durationSeconds"], 9)
        self.assertEqual(reconstruction["source"]["firstShotSeconds"], 0.5)
        self.assertEqual(reconstruction["proposal"], proposal)
        self.assertEqual([design["key"] for design in reconstruction["designs"]], ["a", "b"])
        self.assertEqual(pan_degrees(47.0), 30)
        self.assertEqual(pan_degrees(None), 0)
        self.assertEqual(parent_proposal({"parent_candidate": reconstruction}), proposal)
        self.assertIsNone(parent_proposal({"parent_candidate": {"version": 1}}))

    def test_fit_evidence_is_rounded_and_keeps_unscored_features(self):
        evidence = fit_evidence(
            {
                "overall": 0.812345,
                "scores": {
                    "shots": [
                        {"overall": 0.812345, "distances": {"apex": 0.1, "crackle": None}}
                    ]
                },
            },
            "0.9.1",
            iterations={"a": 3},
            initial=0.5,
        )
        self.assertEqual(evidence["overall"], 0.8123)
        self.assertEqual(evidence["shots"][0]["distances"], {"apex": 0.1, "crackle": None})
        self.assertEqual(evidence["rendererVersion"], "0.9.1")
        self.assertEqual(evidence["initialOverall"], 0.5)

    def test_paid_interpretation_is_reused_only_for_the_same_measurement(self):
        supabase = MagicMock()
        proposal = {"effects": {}, "composition": {"tubes": []}}
        supabase.table.return_value = query_returning(
            [
                {"payload": {"kind": "proposal", "measurementHash": "old", "proposal": {}}},
                {"payload": {"kind": "proposal", "measurementHash": "same", "proposal": proposal}},
            ]
        )
        run = {"run_id": "run"}
        self.assertEqual(load_proposal_checkpoint(supabase, run, "same"), proposal)
        self.assertIsNone(load_proposal_checkpoint(supabase, run, "other"))

    def test_lease_heartbeat_and_completion_use_guarded_rpcs(self):
        supabase = FakeSupabase()
        run = {
            "run_id": "00000000-0000-0000-0000-000000000001",
            "lease_token": "lease-token",
        }
        candidates = [
            {
                "ordinal": 0,
                "schemaVersion": "showcrafter.firework-reconstruction.v2",
                "reconstruction": {"version": 2},
                "score": 0.9,
                "metrics": {},
                "validation": {"valid": True},
                "contentHash": "a" * 64,
            }
        ]

        heartbeat_reconstruction_run(supabase, run, "candidate_synthesis", 70)
        complete_reconstruction_run(supabase, run, candidates, 0)

        self.assertEqual(supabase.calls[0][0], "heartbeat_firework_import_run")
        self.assertEqual(supabase.calls[0][1]["p_lease_token"], "lease-token")
        self.assertEqual(supabase.calls[1][0], "complete_firework_import_run")
        self.assertEqual(supabase.calls[1][1]["p_candidates"], candidates)
        self.assertEqual(supabase.calls[1][1]["p_selected_ordinal"], 0)

    def test_commit_then_response_loss_retries_identical_append_and_completion(self):
        supabase = CommitThenResponseLossSupabase()
        run = {
            "run_id": "00000000-0000-0000-0000-000000000001",
            "lease_token": "lease-token",
        }
        candidates = [
            {
                "ordinal": 0,
                "schemaVersion": "showcrafter.firework-reconstruction.v2",
                "reconstruction": {"version": 2},
                "score": 0.9,
                "metrics": {},
                "validation": {"valid": True},
                "contentHash": "a" * 64,
            }
        ]

        with patch("worker.time.sleep") as sleep:
            append_reconstruction_output(
                supabase,
                run,
                stage="model",
                sequence=0,
                output_type="candidate_draft",
                schema_version="test.v1",
                payload={"candidate": 1},
            )
            complete_reconstruction_run(supabase, run, candidates, 0)

        append_calls = [
            arguments
            for name, arguments in supabase.calls
            if name == "append_firework_import_run_output"
        ]
        completion_calls = [
            arguments
            for name, arguments in supabase.calls
            if name == "complete_firework_import_run"
        ]
        self.assertEqual(len(append_calls), 2)
        self.assertEqual(len(completion_calls), 2)
        self.assertEqual(append_calls[0], append_calls[1])
        self.assertEqual(completion_calls[0], completion_calls[1])
        self.assertEqual(append_calls[0]["p_lease_token"], "lease-token")
        self.assertEqual(completion_calls[0]["p_lease_token"], "lease-token")
        self.assertEqual(sleep.call_count, 2)

    def test_commit_then_response_loss_retries_context_heartbeat_and_failure(self):
        supabase = CommitThenResponseLossSupabase()
        run = {
            "run_id": "00000000-0000-0000-0000-000000000001",
            "lease_token": "lease-token",
        }

        with patch("worker.time.sleep") as sleep:
            persist_run_context(
                supabase,
                run,
                source_sha256="a" * 64,
                model="openai/gpt-5.4",
                guidance=None,
                catalogue={"templates": [{"key": "peony"}], "renderer": "0.9.1"},
            )
            heartbeat_reconstruction_run(supabase, run, "video_analysis", 30)
            fail_reconstruction_run(supabase, run, RuntimeError("bounded failure"))

        for rpc_name in (
            "record_firework_import_run_context",
            "heartbeat_firework_import_run",
            "fail_firework_import_run",
        ):
            calls = [
                arguments for name, arguments in supabase.calls if name == rpc_name
            ]
            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0], calls[1])
        self.assertEqual(sleep.call_count, 3)

    def test_media_probe_update_uses_the_lease_guarded_rpc(self):
        supabase = FakeSupabase()
        run = {
            "run_id": "00000000-0000-0000-0000-000000000001",
            "lease_token": "lease-token",
        }
        source_probe = {"width": 1920, "height": 1080, "video_codec": "h264"}
        preview = {
            "storagePath": "admin/source-browser-run-1.mp4",
            "mimeType": "video/mp4",
        }

        record_reconstruction_media_probe(
            supabase,
            run,
            3.2,
            source_probe,
            preview,
        )

        name, arguments = supabase.calls[-1]
        self.assertEqual(name, "record_firework_import_media_probe")
        self.assertEqual(arguments["p_lease_token"], "lease-token")
        self.assertEqual(arguments["p_duration_seconds"], 3.2)
        self.assertEqual(arguments["p_source_probe"], source_probe)
        self.assertEqual(arguments["p_normalized_preview"], preview)

    def test_ffmpeg_tools_fail_cleanly_when_their_deadline_expires(self):
        with patch(
            "worker.subprocess.run",
            side_effect=subprocess.TimeoutExpired("ffprobe", 1),
        ):
            with self.assertRaisesRegex(RuntimeError, "Media probing exceeded"):
                ffprobe_media(Path("source.mp4"))
            with self.assertRaisesRegex(RuntimeError, "Video normalisation exceeded"):
                create_browser_normalized_video(
                    Path("source.mp4"),
                    Path("temporary"),
                    {"width": 1920, "height": 1080},
                )


if __name__ == "__main__":
    unittest.main()
