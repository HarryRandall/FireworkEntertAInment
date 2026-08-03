from __future__ import annotations

import sys
import base64
import hashlib
import json
import math
import subprocess
import tempfile
import unittest
import time
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from unittest.mock import MagicMock, patch


WORKER_DIR = Path(__file__).resolve().parents[1]
TEST_DIR = Path(__file__).resolve().parent
for path in (WORKER_DIR, TEST_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from engine_validation import (  # noqa: E402
    EngineRenderValidator,
    MAX_METRIC_FRAMES,
    METRICS_SCHEMA_VERSION,
    RENDERER_VERSION,
    RESULT_SCHEMA_VERSION,
    apply_trusted_renderer_durations,
    build_render_timestamp_plan,
    build_render_timestamps,
    build_review_timestamps,
    compact_engine_result,
    encode_rendered_review_video,
    event_evidence_capacity_issue,
    provisional_renderer_durations,
    signed_render_url,
    trusted_render_url,
    upload_rendered_review_video,
)
from test_reconstruction import (  # noqa: E402
    make_geometry_reconstruction,
    make_spec,
    video_observations,
)
from worker import (  # noqa: E402
    apply_engine_selection,
    candidate_rows_for_completion,
    canonical_json_hash,
    engine_metrics_meet_publication_thresholds,
    include_reconstruction_mapping_issues,
    run_engine_validated_candidate_search,
)


def engine_metrics(score: float = 0.91) -> dict:
    component = {"score": score, "comparedFrameCount": 12}
    return {
        "schemaVersion": METRICS_SCHEMA_VERSION,
        "engine": {
            "renderer": "FireworksEngine",
            "rendererVersion": RENDERER_VERSION,
            "camera": "FireworkReplayCanvas.default",
            "frameWidth": 960,
            "frameHeight": 540,
            "frameCount": 16,
            "fixedStepSeconds": 1 / 60,
        },
        "timing": {"score": score},
        "trajectory": dict(component),
        "palette": {"score": score},
        "fade": dict(component),
        "perceptual": {
            **component,
            "activeFrameCount": 10,
            "foregroundWeightTotal": 7.4,
        },
        "overallScore": score,
        "priorityIssues": [],
        "frames": [],
    }


def engine_result(reconstruction: dict, score: float = 0.91) -> dict:
    durations = [
        {"designKey": design["key"], "durationSeconds": 5.857}
        for design in reconstruction["designs"]
    ]
    required = max(
        shot["timeOffsetSeconds"] + 5.857 for shot in reconstruction["shots"]
    )
    return {
        "schemaVersion": RESULT_SCHEMA_VERSION,
        "harnessVersion": "showcrafter.import-render-harness.v1",
        "rendererVersion": RENDERER_VERSION,
        "source": {"durationSeconds": 3, "width": 1920, "height": 1080},
        "rendererDurations": durations,
        "requiredProductDurationSeconds": required,
        "metrics": engine_metrics(score),
        "renderedFrames": [],
    }


def review_artifact(path: str, *, payload: bytes = b"review-video") -> dict:
    return {
        "storagePath": path,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "byteSize": len(payload),
        "storageETag": hashlib.md5(payload, usedforsecurity=False).hexdigest(),
    }


class FakeReviewStorage:
    def __init__(self):
        self.objects: dict[str, bytes] = {}
        self.metadata: dict[str, dict] = {}
        self.upload_options: list[dict] = []

    def upload(self, path, payload, options):
        self.upload_options.append(dict(options))
        if path in self.objects:
            raise RuntimeError("Asset Already Exists")
        self.objects[path] = bytes(payload)
        self.metadata[path] = {
            "mimetype": "video/mp4",
            "size": len(payload),
            "eTag": hashlib.md5(payload, usedforsecurity=False).hexdigest(),
        }

    def list(self, folder, options):
        prefix = f"{folder}/" if folder else ""
        return [
            {
                "name": path.removeprefix(prefix),
                "metadata": metadata,
            }
            for path, metadata in self.metadata.items()
            if path.startswith(prefix)
        ]

    def download(self, path):
        return self.objects[path]


class FakeReviewSupabase:
    def __init__(self, storage):
        self.storage = SimpleNamespace(from_=lambda _bucket: storage)


class EngineValidationTests(unittest.TestCase):
    def test_review_video_preserves_sparse_sample_timing(self):
        import cv2
        import numpy as np

        frames = []
        for index, timestamp in enumerate((0.0, 1.0, 2.0)):
            pixels = np.zeros((16, 16, 3), dtype=np.uint8)
            pixels[4:12, 4 + index : 8 + index] = (60, 180, 255)
            encoded, png = cv2.imencode(".png", pixels)
            self.assertTrue(encoded)
            frames.append(
                {
                    "timeSeconds": timestamp,
                    "pngBase64": base64.b64encode(png.tobytes()).decode("ascii"),
                }
            )

        with tempfile.TemporaryDirectory() as directory:
            video_path = encode_rendered_review_video(frames, directory)
            probe = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "stream=codec_name,pix_fmt,nb_frames:format=duration",
                    "-of",
                    "json",
                    str(video_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            metadata = json.loads(probe.stdout)

        self.assertEqual(metadata["streams"][0]["codec_name"], "h264")
        self.assertEqual(metadata["streams"][0]["pix_fmt"], "yuv420p")
        self.assertEqual(int(metadata["streams"][0]["nb_frames"]), 3)
        self.assertGreaterEqual(float(metadata["format"]["duration"]), 2.0)
        self.assertLess(float(metadata["format"]["duration"]), 2.02)

    def test_render_retry_reattaches_source_after_harness_reload(self):
        reconstruction = provisional_renderer_durations(
            make_geometry_reconstruction("sphere", "peony", "none")
        )
        page = MagicMock()
        page.evaluate.side_effect = [
            RuntimeError(
                "Attach the browser-normalised source video before rendering."
            ),
            engine_result(reconstruction),
        ]
        validator = EngineRenderValidator(
            render_url="https://showcrafter.example/internal/import-render",
            shared_secret="s" * 32,
            run_id="00000000-0000-0000-0000-000000000001",
            source_video_path=Path("source.mp4"),
        )
        validator._page = page

        result = validator.render_candidate(
            reconstruction,
            [0.0, 0.5],
            include_rendered_frames=False,
        )

        self.assertEqual(result["rendererVersion"], RENDERER_VERSION)
        self.assertEqual(page.evaluate.call_count, 2)
        self.assertEqual(
            page.locator.return_value.set_input_files.call_count,
            2,
        )

    def test_metric_sampling_keeps_all_fifty_shot_event_boundaries(self):
        bursts = []
        shots = []
        for index in range(50):
            launch = round(0.1 + index * 1.16, 4)
            burst = round(launch + 0.3, 4)
            fade = round(burst + 0.55, 4)
            bursts.append(
                {
                    "launchSeconds": launch,
                    "burstSeconds": burst,
                    "endSeconds": fade,
                }
            )
            shots.append(
                {
                    "timeOffsetSeconds": launch,
                    "sourceTimeOffsetSeconds": launch,
                    "observedBurstTimeSeconds": burst,
                    "observedFadeEndSeconds": fade,
                }
            )
        reconstruction = {"durationSeconds": 60.0, "shots": shots}
        observations = {"durationSeconds": 60.0, "bursts": bursts}

        plan = build_render_timestamp_plan(
            reconstruction,
            observations,
            limit=36,
        )

        expected = {
            value
            for burst in bursts
            for value in (
                burst["launchSeconds"],
                burst["burstSeconds"],
                burst["endSeconds"],
            )
        }
        self.assertTrue(plan["eventComplete"])
        self.assertEqual(plan["eventBoundaryCount"], 150)
        self.assertLessEqual(len(plan["timestamps"]), MAX_METRIC_FRAMES)
        self.assertTrue(expected.issubset(set(plan["timestamps"])))
        review = build_review_timestamps(
            reconstruction,
            observations,
            source_limit=40,
        )
        self.assertLessEqual(len(review), 48)

    def test_event_capacity_overflow_becomes_a_publication_blocker(self):
        bursts = []
        shots = []
        for index in range(60):
            launch = round(0.05 + index * 0.96, 4)
            burst = round(launch + 0.2, 4)
            fade = round(burst + 0.45, 4)
            bursts.append(
                {
                    "launchSeconds": launch,
                    "burstSeconds": burst,
                    "endSeconds": fade,
                }
            )
            shots.append(
                {
                    "timeOffsetSeconds": launch,
                    "sourceTimeOffsetSeconds": launch,
                    "observedBurstTimeSeconds": burst,
                    "observedFadeEndSeconds": fade,
                }
            )
        reconstruction = {
            **provisional_renderer_durations(
                make_geometry_reconstruction("sphere", "peony", "none")
            ),
            "durationSeconds": 60.0,
            "shots": shots,
        }
        observations = {"durationSeconds": 60.0, "bursts": bursts}
        plan = build_render_timestamp_plan(reconstruction, observations, limit=36)
        issue = event_evidence_capacity_issue(plan)

        self.assertFalse(plan["eventComplete"])
        self.assertIsNotNone(issue)
        self.assertLessEqual(len(plan["timestamps"]), MAX_METRIC_FRAMES)
        reconstruction["observations"]["unknowns"] = [issue]
        evaluation = include_reconstruction_mapping_issues(
            compact_engine_result(engine_result(reconstruction), reconstruction),
            reconstruction,
        )
        self.assertFalse(
            engine_metrics_meet_publication_thresholds(
                evaluation,
                require_review_video=False,
            )
        )

    def test_review_upload_is_append_only_and_exact_replays_are_verified(self):
        storage = FakeReviewStorage()
        supabase = FakeReviewSupabase(storage)
        run_id = "00000000-0000-0000-0000-000000000001"
        candidate_hash = "a" * 64
        with tempfile.TemporaryDirectory() as directory:
            review_path = Path(directory) / "review.mp4"
            review_path.write_bytes(b"immutable-review-mp4")
            first = upload_rendered_review_video(
                supabase,
                "import-videos",
                "owner/source.mp4",
                run_id,
                candidate_hash,
                review_path,
            )
            replay = upload_rendered_review_video(
                supabase,
                "import-videos",
                "owner/source.mp4",
                run_id,
                candidate_hash,
                review_path,
            )

        self.assertEqual(first, replay)
        self.assertEqual(
            first["sha256"], hashlib.sha256(b"immutable-review-mp4").hexdigest()
        )
        self.assertEqual(first["byteSize"], len(b"immutable-review-mp4"))
        self.assertEqual(len(storage.objects), 1)
        self.assertTrue(
            all("upsert" not in options for options in storage.upload_options)
        )

    def test_review_upload_rejects_an_existing_object_with_different_bytes(self):
        storage = FakeReviewStorage()
        supabase = FakeReviewSupabase(storage)
        run_id = "00000000-0000-0000-0000-000000000001"
        candidate_hash = "b" * 64
        storage_path = (
            "owner/engine-review-00000000-0000-0000-0000-000000000001-"
            "bbbbbbbbbbbbbbbb.mp4"
        )
        storage.objects[storage_path] = b"later-overwrite"
        storage.metadata[storage_path] = {
            "mimetype": "video/mp4",
            "size": len(b"later-overwrite"),
            "eTag": hashlib.md5(b"later-overwrite", usedforsecurity=False).hexdigest(),
        }
        with tempfile.TemporaryDirectory() as directory:
            review_path = Path(directory) / "review.mp4"
            review_path.write_bytes(b"expected-review")
            with self.assertRaisesRegex(RuntimeError, "not an exact replay"):
                upload_rendered_review_video(
                    supabase,
                    "import-videos",
                    "owner/source.mp4",
                    run_id,
                    candidate_hash,
                    review_path,
                )

    def test_renderer_mapping_unknown_is_a_publication_blocker(self):
        reconstruction = provisional_renderer_durations(
            make_geometry_reconstruction("sphere", "peony", "none")
        )
        reconstruction["observations"]["unknowns"] = [
            "Engine limit: measured ascent exceeds the supported carrier."
        ]
        evaluation = include_reconstruction_mapping_issues(
            compact_engine_result(engine_result(reconstruction), reconstruction),
            reconstruction,
        )

        self.assertFalse(
            engine_metrics_meet_publication_thresholds(
                evaluation,
                require_review_video=False,
            )
        )
        self.assertEqual(
            evaluation["metrics"]["priorityIssues"][0]["field"],
            "rendererMapping",
        )

    def test_renderer_timing_mapping_unknown_is_a_publication_blocker(self):
        reconstruction = provisional_renderer_durations(
            make_geometry_reconstruction("sphere", "peony", "none")
        )
        reconstruction["observations"]["unknowns"] = [
            "Engine limit: shot 1 schedules its rendered apex after the observed burst."
        ]
        evaluation = include_reconstruction_mapping_issues(
            compact_engine_result(engine_result(reconstruction), reconstruction),
            reconstruction,
        )

        self.assertFalse(
            engine_metrics_meet_publication_thresholds(
                evaluation,
                require_review_video=False,
            )
        )
        self.assertIn(
            "rendered apex",
            evaluation["metrics"]["priorityIssues"][0]["instruction"],
        )

    def test_capability_signature_matches_the_cross_runtime_contract(self):
        url = signed_render_url(
            "https://showcrafter.example/internal/import-render",
            "0123456789abcdef0123456789abcdef",
            "00000000-0000-0000-0000-000000000001",
            now_seconds=1_700_000_000,
            nonce="fixed-nonce",
            ttl_seconds=240,
        )
        query = parse_qs(urlsplit(url).query)

        self.assertEqual(query["expires"], ["1700000240"])
        self.assertEqual(query["nonce"], ["fixed-nonce"])
        self.assertEqual(
            query["signature"],
            ["DJVWSXLxLSGdjSJJH-svDGIdm4J8lJUumVsEkaGlkMs"],
        )

    def test_render_origin_requires_https_except_explicit_loopback_development(self):
        self.assertEqual(
            trusted_render_url("https://showcrafter.example/internal/import-render"),
            "https://showcrafter.example/internal/import-render",
        )
        for invalid in (
            "http://showcrafter.example/internal/import-render",
            "https://user@showcrafter.example/internal/import-render",
            "https://showcrafter.example/internal/import-render?token=secret",
            "https://showcrafter.example/admin/imports",
        ):
            with self.assertRaises(RuntimeError):
                trusted_render_url(invalid, allow_insecure_local=False)

        self.assertEqual(
            trusted_render_url(
                "http://127.0.0.1:3000/internal/import-render",
                allow_insecure_local=True,
            ),
            "http://127.0.0.1:3000/internal/import-render",
        )
        with self.assertRaises(RuntimeError):
            trusted_render_url(
                "http://192.168.1.2:3000/internal/import-render",
                allow_insecure_local=True,
            )

    def test_review_sampling_reserves_renderer_tail_slots(self):
        reconstruction = make_geometry_reconstruction("sphere", "peony", "none")
        reconstruction["durationSeconds"] = 6.0
        observations = video_observations()
        scoring = build_render_timestamps(reconstruction, observations, limit=40)
        review = build_review_timestamps(
            reconstruction,
            observations,
            source_limit=40,
        )
        desired_tail_frames = math.ceil(
            (
                reconstruction["durationSeconds"]
                - (observations["durationSeconds"] - 0.001)
            )
            / 0.25
        )

        self.assertLessEqual(len(review) + desired_tail_frames, 48)
        self.assertLessEqual(len(review), len(scoring))
        self.assertTrue(
            all(value <= observations["durationSeconds"] for value in review)
        )

        reconstruction["durationSeconds"] = 20
        with self.assertRaisesRegex(RuntimeError, "tail is too long"):
            build_review_timestamps(reconstruction, observations, source_limit=40)

    def test_trusted_renderer_durations_seal_post_source_tail_lifetime(self):
        raw = make_geometry_reconstruction("sphere", "peony", "none")
        provisional = provisional_renderer_durations(raw)
        result = engine_result(provisional)
        sealed = apply_trusted_renderer_durations(
            provisional,
            result,
            source_duration_seconds=3.0,
        )

        self.assertEqual(sealed["designs"][0]["durationSeconds"], 5.857)
        self.assertGreater(sealed["durationSeconds"], 3.0)
        self.assertGreaterEqual(
            sealed["durationSeconds"],
            result["requiredProductDurationSeconds"],
        )

    def test_metrics_contract_requires_active_foreground_and_renderer_version(self):
        reconstruction = provisional_renderer_durations(
            make_geometry_reconstruction("sphere", "peony", "none")
        )
        result = engine_result(reconstruction)
        compact = compact_engine_result(result, reconstruction)
        self.assertEqual(compact["rendererVersion"], RENDERER_VERSION)
        self.assertTrue(
            engine_metrics_meet_publication_thresholds(
                compact,
                require_review_video=False,
            )
        )

        stale = {**compact, "rendererVersion": "stale-renderer-version"}
        self.assertFalse(
            engine_metrics_meet_publication_thresholds(
                stale,
                require_review_video=False,
            )
        )

        result["metrics"]["perceptual"]["activeFrameCount"] = 1
        with self.assertRaisesRegex(RuntimeError, "active firework frames"):
            compact_engine_result(result, reconstruction)

    def test_metrics_contract_reports_renderer_contract_drift(self):
        reconstruction = provisional_renderer_durations(
            make_geometry_reconstruction("sphere", "peony", "none")
        )
        result = engine_result(reconstruction)
        result["rendererVersion"] = (
            "showcrafter.fireworks-engine.import-renderer.v1+sha256." + "0" * 64
        )

        with self.assertRaisesRegex(RuntimeError, "renderer contract does not match"):
            compact_engine_result(result, reconstruction)

    def test_candidate_row_keeps_exact_engine_evidence_and_review_path(self):
        candidate = make_spec()
        reconstruction = provisional_renderer_durations(
            make_geometry_reconstruction("sphere", "peony", "none")
        )
        result = engine_result(reconstruction)
        sealed = apply_trusted_renderer_durations(
            reconstruction,
            result,
            source_duration_seconds=3,
        )
        compact = compact_engine_result(result, sealed)
        review_path = (
            "00000000-0000-0000-0000-000000000099/"
            "engine-review-00000000-0000-0000-0000-000000000001-aaaaaaaaaaaaaaaa.mp4"
        )
        evaluation = {
            **compact,
            "candidateHash": canonical_json_hash(candidate),
            "renderedVideoPath": review_path,
            "reviewArtifact": review_artifact(review_path),
        }
        diagnostics = {
            "selectedCandidateIndex": 0,
            "pipelineVersion": "test",
            "scores": [
                {
                    "candidateIndex": 0,
                    "combinedScore": 0.9,
                    "evidence": {},
                    "publicationReady": True,
                }
            ],
        }
        rows, selected = candidate_rows_for_completion(
            [candidate],
            diagnostics,
            video_observations(),
            {"hasAudio": False},
            {0: evaluation},
        )

        self.assertEqual(selected, 0)
        self.assertEqual(rows[0]["renderedVideoPath"], review_path)
        self.assertEqual(
            rows[0]["metrics"]["engineRender"]["metrics"], result["metrics"]
        )
        self.assertEqual(
            rows[0]["metrics"]["engineRender"]["rendererDurations"],
            result["rendererDurations"],
        )

    def test_publishable_candidate_ranks_ahead_of_higher_blocked_score(self):
        blocked = make_spec(colour="#ff0000")
        publishable = make_spec(colour="#00ff00")
        reconstruction = provisional_renderer_durations(
            make_geometry_reconstruction("sphere", "peony", "none")
        )
        blocked_result = engine_result(reconstruction, score=0.97)
        blocked_result["metrics"]["priorityIssues"] = [
            {
                "field": "fade",
                "score": 0.97,
                "instruction": "Remove the overlong tail.",
            }
        ]
        publishable_result = engine_result(reconstruction, score=0.82)
        evaluations = {
            0: {
                **compact_engine_result(blocked_result, reconstruction),
                "candidateHash": canonical_json_hash(blocked),
                "renderedVideoPath": None,
            },
            1: {
                **compact_engine_result(publishable_result, reconstruction),
                "candidateHash": canonical_json_hash(publishable),
                "renderedVideoPath": (
                    "00000000-0000-0000-0000-000000000099/"
                    "engine-review-00000000-0000-0000-0000-000000000001-bbbbbbbbbbbbbbbb.mp4"
                ),
            },
        }
        evaluations[1]["reviewArtifact"] = review_artifact(
            evaluations[1]["renderedVideoPath"]
        )
        diagnostics = {
            "selectedCandidateIndex": 0,
            "scores": [
                {"candidateIndex": 0, "combinedScore": 0.98, "evidence": {}},
                {"candidateIndex": 1, "combinedScore": 0.79, "evidence": {}},
            ],
        }

        ranked = apply_engine_selection(
            [blocked, publishable],
            diagnostics,
            evaluations,
            require_review_video=True,
        )

        self.assertEqual(ranked["selectedCandidateIndex"], 1)
        self.assertEqual(ranked["publicationReadyCandidateCount"], 1)
        self.assertFalse(ranked["scores"][0]["publicationReady"])
        self.assertTrue(ranked["scores"][1]["publicationReady"])

    def test_every_threshold_passing_candidate_gets_a_unique_final_review(self):
        candidates = [
            make_spec(colour="#ff0000"),
            make_spec(colour="#00ff00"),
            make_spec(colour="#0000ff"),
        ]
        reconstruction = provisional_renderer_durations(
            make_geometry_reconstruction("sphere", "peony", "none")
        )
        evaluations = {}
        for index, candidate in enumerate(candidates):
            result = engine_result(reconstruction, score=0.9 if index < 2 else 0.7)
            evaluations[index] = {
                **compact_engine_result(result, reconstruction),
                "candidateHash": canonical_json_hash(candidate),
                "checkpointRunId": "00000000-0000-0000-0000-000000000001",
            }
        diagnostics = {
            "selectedCandidateIndex": 0,
            "scores": [
                {
                    "candidateIndex": index,
                    "combinedScore": 0.9 - index * 0.05,
                    "evidence": {},
                }
                for index in range(3)
            ],
        }
        final_results = [
            engine_result(reconstruction, score=0.9),
            engine_result(reconstruction, score=0.88),
        ]
        validator = MagicMock()
        validator.render_candidate.side_effect = final_results
        context = MagicMock()
        context.__enter__.return_value = validator
        context.__exit__.return_value = False
        supabase = MagicMock()
        supabase.rpc.return_value.execute.return_value = SimpleNamespace(
            data="output-id"
        )
        review_artifacts = [
            review_artifact(
                "00000000-0000-0000-0000-000000000099/"
                "engine-review-00000000-0000-0000-0000-000000000001-aaaaaaaaaaaaaaaa.mp4"
            ),
            review_artifact(
                "00000000-0000-0000-0000-000000000099/"
                "engine-review-00000000-0000-0000-0000-000000000001-bbbbbbbbbbbbbbbb.mp4"
            ),
        ]
        review_paths = [artifact["storagePath"] for artifact in review_artifacts]

        with (
            patch.dict(
                "os.environ",
                {
                    "FIREWORK_IMPORT_RENDER_URL": (
                        "https://showcrafter.example/internal/import-render"
                    ),
                    "FIREWORK_IMPORT_SHARED_SECRET": (
                        "0123456789abcdef0123456789abcdef"
                    ),
                },
            ),
            patch("worker.EngineRenderValidator", return_value=context),
            patch(
                "worker.run_reconstruction_passes",
                return_value=(candidates[0], candidates, [], diagnostics),
            ),
            patch(
                "worker.encode_rendered_review_video",
                return_value=Path("review.mp4"),
            ),
            patch(
                "worker.upload_rendered_review_video",
                side_effect=review_artifacts,
            ),
        ):
            _selected, _candidates, final_diagnostics, final_evaluations = (
                run_engine_validated_candidate_search(
                    supabase,
                    {
                        "run_id": "00000000-0000-0000-0000-000000000001",
                        "lease_token": "lease-token",
                    },
                    client=MagicMock(),
                    generate_candidate=MagicMock(),
                    before_model_call=MagicMock(),
                    frame_summary=video_observations(),
                    audio={"hasAudio": False},
                    duration=3,
                    source_video_path=Path("source.mp4"),
                    temporary_directory=Path("temporary"),
                    source_storage_path=(
                        "00000000-0000-0000-0000-000000000099/source.mp4"
                    ),
                    candidate_count=3,
                    pass_count=1,
                    resume_outputs=[],
                    engine_evaluations=evaluations,
                    deadline_monotonic=time.monotonic() + 1_000,
                )
            )

        self.assertEqual(validator.render_candidate.call_count, 2)
        self.assertEqual(final_evaluations[0]["renderedVideoPath"], review_paths[0])
        self.assertEqual(final_evaluations[1]["renderedVideoPath"], review_paths[1])
        self.assertEqual(final_evaluations[0]["reviewArtifact"], review_artifacts[0])
        self.assertIsNone(final_evaluations[2]["renderedVideoPath"])
        self.assertEqual(final_diagnostics["publicationReadyCandidateCount"], 2)
        final_outputs = [
            arguments
            for call in supabase.rpc.call_args_list
            if call.args[0] == "append_firework_import_run_output"
            and (arguments := call.args[1])["p_stage"] == "render_final"
        ]
        self.assertEqual([output["p_sequence"] for output in final_outputs], [0, 1])
        self.assertEqual(
            [output["p_storage_path"] for output in final_outputs],
            review_paths,
        )
        candidate_rows, selected_ordinal = candidate_rows_for_completion(
            candidates,
            final_diagnostics,
            video_observations(),
            {"hasAudio": False},
            final_evaluations,
        )
        output_evidence = final_outputs[0]["p_payload"]["engineRender"]
        candidate_evidence = candidate_rows[selected_ordinal]["metrics"]["engineRender"]

        self.assertEqual(output_evidence, candidate_evidence)
        self.assertEqual(
            canonical_json_hash(output_evidence),
            canonical_json_hash(candidate_evidence),
        )
        self.assertNotIn("reconstruction", output_evidence)
        self.assertNotIn("renderedVideoPath", output_evidence)
        self.assertEqual(
            candidate_rows[selected_ordinal]["renderedVideoPath"],
            final_outputs[0]["p_storage_path"],
        )


if __name__ == "__main__":
    unittest.main()
