from __future__ import annotations

import sys
import hashlib
import json
import subprocess
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


WORKER_DIR = Path(__file__).resolve().parents[1]
TEST_DIR = Path(__file__).resolve().parent
for path in (WORKER_DIR, TEST_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from test_reconstruction import (  # noqa: E402
    make_spec,
    video_observations,
)
from reconstruction import build_renderer_reconstruction  # noqa: E402
from worker import (  # noqa: E402
    CRITIC_SCHEMA,
    ENGINE_SCHEMA_VERSION,
    METRICS_SCHEMA_VERSION,
    PIPELINE_VERSION,
    RENDERER_VERSION,
    STRICT_IMPORT_SPEC_SCHEMA,
    append_reconstruction_output,
    call_openrouter_candidate,
    call_openrouter_critic,
    canonical_json_hash,
    candidate_rows_for_completion,
    compatible_checkpoint_run_ids,
    complete_reconstruction_run,
    create_browser_normalized_video,
    create_required_browser_normalized_video,
    effective_reconstruction_system_prompt,
    fail_reconstruction_run,
    fetch_prompt_config,
    ffprobe_media,
    heartbeat_reconstruction_run,
    load_reconstruction_checkpoints,
    model_video_context,
    needs_browser_normalization,
    normalized_preview_storage_path,
    parse_frame_rate,
    persist_reconstruction_snapshot,
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

    def test_engine_environment_is_validated_before_claiming_a_run(self):
        supabase = MagicMock()
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "FIREWORK_IMPORT_RENDER_URL"):
                process_reconstruction_run_by_id(
                    supabase,
                    "00000000-0000-0000-0000-000000000001",
                )
        supabase.rpc.assert_not_called()

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

    def test_model_video_context_is_deterministically_bounded(self):
        point = {"timeSeconds": 0.0, "x": 0.5, "y": 0.5}
        context = model_video_context(
            {
                "frames": [{"timeSeconds": index / 20} for index in range(500)],
                "timeline": [{"timeSeconds": index / 20} for index in range(500)],
                "tracks": [
                    {
                        "id": f"track-{index:03d}",
                        "startSeconds": index / 20,
                        "points": [
                            {**point, "timeSeconds": offset / 20}
                            for offset in range(60)
                        ],
                    }
                    for index in range(110)
                ],
                "bursts": [
                    {
                        "id": f"burst-{index:03d}",
                        "trajectory": {"points": [point] * 60},
                        "launchTrajectory": {"points": [point] * 60},
                    }
                    for index in range(170)
                ],
            }
        )

        self.assertEqual(len(context["frames"]), 400)
        self.assertEqual(len(context["timeline"]), 400)
        self.assertEqual(len(context["tracks"]), 96)
        self.assertTrue(all(len(track["points"]) <= 48 for track in context["tracks"]))
        self.assertEqual(len(context["bursts"]), 160)
        self.assertTrue(
            all(len(burst["trajectory"]["points"]) <= 48 for burst in context["bursts"])
        )

    def test_reproducibility_context_uses_the_lease_guarded_rpc(self):
        supabase = FakeSupabase()
        run = {
            "run_id": "00000000-0000-0000-0000-000000000001",
            "lease_token": "lease-token",
            "modal_call_id": "modal-input-123",
        }
        with patch.dict(
            "os.environ",
            {
                "IMPORT_VIDEO_SAMPLE_FPS": "24",
                "IMPORT_MAX_SAMPLED_FRAMES": "1440",
                "IMPORT_MAX_MODEL_IMAGES": "20",
                "IMPORT_ENGINE_SCORE_FRAMES": "72",
                "IMPORT_ENGINE_REVIEW_FRAMES": "32",
            },
        ):
            persist_reconstruction_snapshot(
                supabase,
                run,
                source_sha256="a" * 64,
                model="openai/gpt-5.4",
                reconstruction_prompt="Keep the observed timing exact.",
                candidate_count=3,
                pass_count=2,
            )

        rpc_name, payload = supabase.calls[-1]
        self.assertEqual(rpc_name, "record_firework_import_run_context")
        self.assertEqual(payload["p_pipeline_version"], PIPELINE_VERSION)
        self.assertEqual(payload["p_engine_schema_version"], ENGINE_SCHEMA_VERSION)
        self.assertEqual(payload["p_source_sha256"], "a" * 64)
        self.assertEqual(payload["p_video_model"], "openai/gpt-5.4")
        self.assertEqual(payload["p_modal_call_id"], "modal-input-123")
        self.assertEqual(payload["p_model_snapshot"]["modalInputId"], "modal-input-123")
        self.assertEqual(
            payload["p_model_snapshot"]["sampling"]["videoFramesPerSecond"], 24.0
        )
        self.assertEqual(
            payload["p_model_snapshot"]["sampling"]["engineScoreFrames"], 72
        )
        self.assertEqual(
            payload["p_model_snapshot"]["sampling"]["engineReviewFrames"], 32
        )
        self.assertEqual(
            payload["p_model_snapshot"]["engineValidation"],
            {
                "rendererVersion": RENDERER_VERSION,
                "metricsSchemaVersion": METRICS_SCHEMA_VERSION,
            },
        )
        self.assertEqual(len(payload["p_prompt_snapshot"]["sha256"]), 64)
        self.assertIn(
            "Keep the observed timing exact.",
            payload["p_prompt_snapshot"]["effectiveGuidance"],
        )

        persist_reconstruction_snapshot(
            supabase,
            {"run_id": run["run_id"], "lease_token": run["lease_token"]},
            source_sha256="b" * 64,
            model="openai/gpt-5.4",
            reconstruction_prompt=None,
            candidate_count=3,
            pass_count=2,
        )
        self.assertIsNone(supabase.calls[-1][1]["p_modal_call_id"])
        self.assertNotIn("modalInputId", supabase.calls[-1][1]["p_model_snapshot"])

    def test_live_prompt_guidance_cannot_replace_contract_prompt(self):
        client = FakeOpenRouterClient(make_spec())
        spec, _raw = call_openrouter_candidate(
            client,
            "source.mp4",
            3.0,
            video_observations(),
            [],
            {"hasAudio": False},
            None,
            "STALE ADMIN PROMPT: emit an incompatible object",
            "Produce an independent candidate",
        )

        system = client.messages[0]["content"]
        self.assertIn("strict schema requested by the API", system)
        self.assertIn("<ADMIN_GUIDANCE>", system)
        self.assertIn("subordinate", system)
        for calibrated_prior in (
            "rendererTuning.starCount 100",
            "headSize 360",
            "burstSpeedMin 2",
            "burstSpeedMax 4",
            "gravityMin -0.24",
            "gravityMax -0.02",
            "airResistancePercent 100",
            "trailParticlesPerStar 24",
        ):
            self.assertIn(calibrated_prior, system)
        self.assertIn("rendered minus source", system)
        self.assertIn("timeOffsetSeconds is the sole hidden pre-roll control", system)
        self.assertIn(
            "canonical lift time from observed burst onset minus that quantised cue time",
            system,
        )
        self.assertIn("Never turn a visual peak delta into lift timing", system)
        self.assertIs(client.schema, STRICT_IMPORT_SPEC_SCHEMA)
        self.assertEqual(client.schema_name, "firework_video_reconstruction_v10")
        self.assertEqual(
            spec["effectSpec"]["metadata"]["normalizedAs"], "FireworkEffectSpecV3"
        )

    def test_critic_passes_signed_engine_corrections_into_the_refinement_prompt(self):
        critic_value = {
            "candidateScores": [
                {
                    "candidateIndex": 0,
                    "timing": 0.4,
                    "colour": 0.8,
                    "geometry": 0.8,
                    "physics": 0.7,
                    "fade": 0.5,
                    "issues": ["Rendered timing is offset"],
                    "improvementInstruction": "Align the trusted engine render.",
                }
            ],
            "selectedCandidateIndex": 0,
            "rationale": "Only candidate",
        }
        client = FakeOpenRouterClient(critic_value)
        evaluation = {
            "componentScores": {
                "timing": 0.4,
                "trajectory": 0.8,
                "palette": 0.8,
                "fade": 0.5,
                "perceptual": 0.6,
            },
            "priorityIssues": [{"field": "timing", "score": 0.4}],
            "metrics": {
                "schemaVersion": METRICS_SCHEMA_VERSION,
                "overallScore": 0.6,
                "timing": {
                    "sourceOnsetSeconds": 0.25,
                    "renderedOnsetSeconds": 0.75,
                    "sourcePeakSeconds": 1.2,
                    "renderedPeakSeconds": 1.5,
                    "sourceFadeEndSeconds": 2.2,
                    "renderedFadeEndSeconds": 1.9,
                    "score": 0.4,
                },
                "trajectory": {"score": 0.8},
                "palette": {"score": 0.8},
                "fade": {"score": 0.5},
                "perceptual": {"score": 0.6},
            },
            "reconstruction": build_renderer_reconstruction(
                make_spec(),
                video_observations(),
                {"hasAudio": False},
                {"scores": []},
            ),
        }

        critic, _raw = call_openrouter_critic(
            client,
            [make_spec()],
            video_observations(),
            {0: evaluation},
        )

        system = client.messages[0]["content"]
        user = client.messages[1]["content"]
        instruction = critic["candidateScores"][0]["improvementInstruction"]
        self.assertIn("positive is late and negative is early", system)
        self.assertIn(
            "global visual peak is post-burst activity, never carrier apex", system
        )
        self.assertIn(
            "Never spread one global peak correction across multiple shots", system
        )
        self.assertIn('"onsetSignedDeltaSeconds":0.5', user)
        self.assertIn('"peakRelativeToOnsetSignedDeltaSeconds":-0.2', user)
        self.assertIn('"fadeRelativeToPeakSignedDeltaSeconds":-0.6', user)
        self.assertIn('"scope":"single aerial shot"', user)
        self.assertIn('"correctedTimeOffsetSeconds":0.0', user)
        self.assertIn('"requiredCanonicalLiftSeconds":1.2', user)
        self.assertIn('"postBurstPeakDevelopmentSignedDeltaSeconds":0.3', user)
        self.assertIn("onset +0.500s", instruction)
        self.assertIn("Set timeOffsetSeconds to 0.000s", instruction)
        self.assertIn("observed burst onset is 1.200s", instruction)
        self.assertIn("canonical lift must be 1.200s", instruction)
        self.assertIn("Do not derive lift from the global visual peak", instruction)
        self.assertIn("post-burst visual peak develops 0.300s late", instruction)
        self.assertIn("never carrier lift", instruction)
        self.assertNotIn("peak relative to onset", instruction)
        self.assertNotIn("visual peak delta as lift", instruction)
        self.assertIs(client.schema, CRITIC_SCHEMA)

    def test_identical_candidates_are_deduplicated_before_atomic_completion(self):
        spec = make_spec()
        diagnostics = {
            "pipelineVersion": PIPELINE_VERSION,
            "selectedCandidateIndex": 1,
            "scores": [
                {"candidateIndex": 0, "combinedScore": 0.8, "evidence": {}},
                {"candidateIndex": 1, "combinedScore": 0.9, "evidence": {}},
            ],
        }
        rows, selected_ordinal = candidate_rows_for_completion(
            [spec, spec],
            diagnostics,
            video_observations(),
            {"hasAudio": False},
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(selected_ordinal, 0)
        self.assertEqual(rows[0]["score"], 0.9)
        self.assertEqual(len(rows[0]["contentHash"]), 64)

    def test_lease_heartbeat_and_completion_use_guarded_rpcs(self):
        supabase = FakeSupabase()
        run = {
            "run_id": "00000000-0000-0000-0000-000000000001",
            "lease_token": "lease-token",
        }
        candidates = [
            {
                "ordinal": 0,
                "schemaVersion": "showcrafter.firework-reconstruction.v1",
                "reconstruction": {"version": 1},
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
                "schemaVersion": "showcrafter.firework-reconstruction.v1",
                "reconstruction": {"version": 1},
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
            persist_reconstruction_snapshot(
                supabase,
                run,
                source_sha256="a" * 64,
                model="openai/gpt-5.4",
                reconstruction_prompt=None,
                candidate_count=2,
                pass_count=1,
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

    def test_compatible_recovery_loads_exact_parent_and_current_checkpoints(self):
        prompt = "Keep the observed timing exact."
        prompt_hash = hashlib.sha256(
            effective_reconstruction_system_prompt(prompt).encode("utf-8")
        ).hexdigest()
        run_query = MagicMock()
        parent_context_query = MagicMock()
        parent_outputs_query = MagicMock()
        current_outputs_query = MagicMock()
        for query in (
            run_query,
            parent_context_query,
            parent_outputs_query,
            current_outputs_query,
        ):
            query.select.return_value = query
            query.eq.return_value = query
            query.order.return_value = query
            query.single.return_value = query
        run_query.execute.return_value = SimpleNamespace(
            data={
                "parent_run_id": "00000000-0000-0000-0000-000000000000",
                "idempotency_key": (
                    "lease-recovery:00000000-0000-0000-0000-000000000000"
                ),
                "lease_recovery_count": 1,
            }
        )
        parent_context_query.execute.return_value = SimpleNamespace(
            data={
                "source_sha256": "a" * 64,
                "pipeline_version": PIPELINE_VERSION,
                "video_model": "openai/gpt-5.4",
                "prompt_snapshot": {"sha256": prompt_hash},
                "model_snapshot": {
                    "synthesisModel": "openai/gpt-5.4",
                    "criticModel": "openai/gpt-5.4",
                    "candidateCount": 2,
                    "passCount": 1,
                    "structuredOutput": {
                        "candidateSchemaSha256": canonical_json_hash(
                            STRICT_IMPORT_SPEC_SCHEMA
                        ),
                        "criticSchemaSha256": canonical_json_hash(CRITIC_SCHEMA),
                    },
                    "sampling": {
                        "videoFramesPerSecond": 20.0,
                        "maxSampledFrames": 1800,
                        "maxModelImages": 24,
                        "engineScoreFrames": 36,
                        "engineReviewFrames": 40,
                    },
                    "engineValidation": {
                        "rendererVersion": RENDERER_VERSION,
                        "metricsSchemaVersion": METRICS_SCHEMA_VERSION,
                    },
                },
            }
        )
        parent_payload = {
            "kind": "candidate",
            "pass": 1,
            "candidateIndex": 0,
            "candidate": make_spec(),
            "response": {"id": "parent"},
        }
        current_payload = {
            "kind": "critic",
            "pass": 1,
            "critic": {"candidateScores": []},
            "response": {"id": "current"},
        }
        parent_outputs_query.execute.return_value = SimpleNamespace(
            data=[{"sequence": 0, "payload": parent_payload}]
        )
        current_outputs_query.execute.return_value = SimpleNamespace(
            data=[{"sequence": 1, "payload": current_payload}]
        )
        supabase = MagicMock()
        supabase.table.side_effect = [
            run_query,
            parent_context_query,
            parent_outputs_query,
            current_outputs_query,
        ]

        outputs = load_reconstruction_checkpoints(
            supabase,
            {
                "run_id": "00000000-0000-0000-0000-000000000001",
                "lease_token": "lease-token",
            },
            source_sha256="a" * 64,
            model="openai/gpt-5.4",
            reconstruction_prompt=prompt,
            candidate_count=2,
            pass_count=1,
        )

        self.assertEqual(outputs, [parent_payload, current_payload])

    def test_manual_retry_never_inherits_parent_checkpoints(self):
        run_query = MagicMock()
        current_outputs_query = MagicMock()
        for query in (run_query, current_outputs_query):
            query.select.return_value = query
            query.eq.return_value = query
            query.order.return_value = query
            query.single.return_value = query
        run_query.execute.return_value = SimpleNamespace(
            data={
                "parent_run_id": "00000000-0000-0000-0000-000000000000",
                "idempotency_key": "manual-retry-idempotency-key",
                "lease_recovery_count": 0,
            }
        )
        current_payload = {
            "kind": "candidate",
            "pass": 1,
            "candidateIndex": 0,
            "candidate": make_spec(),
            "response": {"id": "current"},
        }
        current_outputs_query.execute.return_value = SimpleNamespace(
            data=[{"sequence": 0, "payload": current_payload}]
        )
        supabase = MagicMock()
        supabase.table.side_effect = [run_query, current_outputs_query]

        outputs = load_reconstruction_checkpoints(
            supabase,
            {
                "run_id": "00000000-0000-0000-0000-000000000001",
                "lease_token": "lease-token",
            },
            source_sha256="a" * 64,
            model="openai/gpt-5.4",
            reconstruction_prompt=None,
            candidate_count=2,
            pass_count=1,
        )

        self.assertEqual(outputs, [current_payload])

    def test_automatic_recovery_rejects_stale_renderer_evidence(self):
        current_query = MagicMock()
        parent_query = MagicMock()
        for query in (current_query, parent_query):
            query.select.return_value = query
            query.eq.return_value = query
            query.single.return_value = query
        parent_run_id = "00000000-0000-0000-0000-000000000000"
        current_run_id = "00000000-0000-0000-0000-000000000001"
        current_query.execute.return_value = SimpleNamespace(
            data={
                "parent_run_id": parent_run_id,
                "idempotency_key": f"lease-recovery:{parent_run_id}",
                "lease_recovery_count": 1,
            }
        )
        prompt_hash = hashlib.sha256(
            effective_reconstruction_system_prompt(None).encode("utf-8")
        ).hexdigest()
        parent_query.execute.return_value = SimpleNamespace(
            data={
                "source_sha256": "a" * 64,
                "pipeline_version": PIPELINE_VERSION,
                "video_model": "openai/gpt-5.4",
                "prompt_snapshot": {"sha256": prompt_hash},
                "model_snapshot": {
                    "synthesisModel": "openai/gpt-5.4",
                    "criticModel": "openai/gpt-5.4",
                    "candidateCount": 2,
                    "passCount": 1,
                    "structuredOutput": {
                        "candidateSchemaSha256": canonical_json_hash(
                            STRICT_IMPORT_SPEC_SCHEMA
                        ),
                        "criticSchemaSha256": canonical_json_hash(CRITIC_SCHEMA),
                    },
                    "sampling": {
                        "videoFramesPerSecond": 20.0,
                        "maxSampledFrames": 1800,
                        "maxModelImages": 24,
                        "engineScoreFrames": 36,
                        "engineReviewFrames": 40,
                    },
                    "engineValidation": {
                        "rendererVersion": "stale-renderer-version",
                        "metricsSchemaVersion": METRICS_SCHEMA_VERSION,
                    },
                },
            }
        )
        supabase = MagicMock()
        supabase.table.side_effect = [current_query, parent_query]

        run_ids = compatible_checkpoint_run_ids(
            supabase,
            {"run_id": current_run_id, "lease_token": "lease-token"},
            source_sha256="a" * 64,
            model="openai/gpt-5.4",
            reconstruction_prompt=None,
            candidate_count=2,
            pass_count=1,
        )

        self.assertEqual(run_ids, [current_run_id])

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
