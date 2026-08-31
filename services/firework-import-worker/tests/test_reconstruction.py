from __future__ import annotations

import copy
import json
import random
import sys
import unittest
from pathlib import Path

import jsonschema
import requests


WORKER_DIR = Path(__file__).resolve().parents[1]
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from reconstruction import (  # noqa: E402
    RENDERER_TUNING_PROPERTIES,
    STRICT_IMPORT_SPEC_SCHEMA,
    OpenRouterClient,
    _quantise_engine_time_seconds,
    _renderer_pan_degrees,
    build_reconstruction_validation,
    build_renderer_reconstruction,
    estimate_engine_lift_time_seconds,
    labelled_image_content,
    run_reconstruction_passes,
    score_candidate,
)


GEOMETRY_CASES = [
    ("sphere", "peony", "none"),
    ("crown", "brocade", "glitter"),
    ("weeping", "willow", "long_hang"),
    ("radial_arms", "palm", "thick_tail"),
    ("ring", "ring", "none"),
    ("split_cross", "crossette", "spark"),
    ("falling_tail", "horsetail", "thick_tail"),
    ("single_tail", "comet", "thick_tail"),
    ("upward_fan", "mine", "spray"),
    ("fragment_cloud", "crackle", "crackle"),
    ("heart", "heart-shell", "none"),
    ("five_point_star", "outlined-star-shell", "none"),
    ("pistil", "pistil", "none"),
    ("pearls", "pearls", "pearls"),
    ("fish", "silverFish", "fish"),
    ("waterfall", "waterfall", "waterfall"),
    ("whirl", "whirl", "whirl"),
    ("bowtie", "bowtie", "spark"),
    ("roman_candle", "roman_candle", "thick_tail"),
    ("fountain", "fountain", "spray"),
]


def renderer_tuning(**overrides):
    return {**{key: None for key in RENDERER_TUNING_PROPERTIES}, **overrides}


def make_spec(
    burst_time: float = 1.2, colour: str = "#ff0000", confidence: float = 0.9
):
    geometry_evidence = {
        "countPercent": 88.0,
        "scaleX": 1.0,
        "scaleY": 1.0,
        "depthScale": 0.12,
        "rotationDegrees": 0.0,
        "spread": 0.65,
        "confidence": confidence,
    }
    return {
        "name": "Synthetic red peony",
        "description": "A measured reconstruction",
        "durationSeconds": 3.0,
        "confidence": confidence,
        "effectSpec": {
            "version": 3,
            "name": "Synthetic red peony",
            "description": "A measured reconstruction",
            "source": "video_inferred",
            "confidence": confidence,
            "seed": 7,
            "type": "shell",
            "durationSeconds": 3.0,
            "heightMeters": 58.0,
            "colorPalette": [colour],
            "shell": {
                "family": "peony",
                "geometry": "sphere",
                "effectSlug": "peony",
                "trailProfile": "none",
                "geometryEvidence": geometry_evidence,
                "rendererTuning": renderer_tuning(),
                "size": 3.0,
                "starDensity": 1.0,
                "colorPalette": [colour],
                "color": colour,
                "secondColor": None,
                "pistil": False,
                "pistilColor": None,
                "glitter": "light",
                "smokeAmount": 0.2,
            },
            "launch": {
                "enabled": True,
                "fuseTimeSeconds": 0.0,
                "liftTimeSeconds": 0.8,
                "heightMeters": 58.0,
                "panDegrees": 0.0,
                "tiltDegrees": 90.0,
                "tracerColor": colour,
                "tailColor": colour,
            },
            "shots": [
                {
                    "index": 0,
                    "timeOffsetSeconds": max(0.0, burst_time - 0.8),
                    "burstTimeSeconds": burst_time,
                    "scale": 1.0,
                    "seedOffset": 0,
                    "position": {"x": 0.0, "y": 0.0, "z": 0.0},
                    "launchPositionIndex": 0,
                    "panDegrees": 0.0,
                    "tiltDegrees": 0.0,
                    "geometry": "sphere",
                    "effectSlug": "peony",
                    "trailProfile": "none",
                    "geometryEvidence": geometry_evidence,
                    "rendererTuning": renderer_tuning(),
                    "colorPalette": [colour],
                    "color": colour,
                    "tailColor": colour,
                    "liftTimeSeconds": 0.8,
                    "heightMeters": 58.0,
                }
            ],
        },
        "observations": {
            "observedEvents": [
                {
                    "timeSeconds": burst_time,
                    "type": "break",
                    "color": colour,
                    "estimatedHeight": 58.0,
                    "description": "Red break",
                    "confidence": confidence,
                }
            ],
            "unknowns": [],
            "suggestedManualReviewFields": [],
            "confidence": confidence,
        },
    }


def video_observations():
    return {
        "durationSeconds": 3.0,
        "globalPalette": ["#ff0000"],
        "bursts": [
            {
                "id": "burst-001",
                "burstSeconds": 1.2,
                "peakSeconds": 1.2,
                "endSeconds": 2.2,
                "fadeSeconds": 1.0,
                "spreadAtPeak": 0.12,
                "confidence": 0.9,
                "launchSeconds": 0.25,
                "liftSeconds": 0.95,
                "launchColour": "#ff8080",
                "launchTrajectory": {
                    "confidence": 0.9,
                    "normalisedGravity": 0.1,
                    "points": [
                        {"timeSeconds": 0.25, "x": 0.48, "y": 0.95},
                        {"timeSeconds": 1.2, "x": 0.52, "y": 0.45},
                    ],
                },
                "trajectory": {"normalisedGravity": 0.8, "confidence": 0.8},
            }
        ],
    }


def make_geometry_reconstruction(geometry: str, effect_slug: str, trail_profile: str):
    spec = make_spec()
    spec["effectSpec"]["shell"].update(
        {
            "family": effect_slug,
            "geometry": geometry,
            "effectSlug": effect_slug,
            "trailProfile": trail_profile,
        }
    )
    spec["effectSpec"]["shots"][0].update(
        {
            "geometry": geometry,
            "effectSlug": effect_slug,
            "trailProfile": trail_profile,
        }
    )
    return build_renderer_reconstruction(
        spec,
        video_observations(),
        {"hasAudio": False},
        {"selectedCandidateIndex": 0, "scores": []},
    )


class FakeResponse:
    def __init__(self, status_code, body, headers=None):
        self.status_code = status_code
        self._body = body
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}", response=self)

    def json(self):
        return self._body


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def post(self, *args, **kwargs):
        self.requests.append((args, kwargs))
        return self.responses.pop(0)


class ReconstructionTests(unittest.TestCase):
    def test_engine_time_quantisation_matches_javascript_half_up_rounding(self):
        self.assertAlmostEqual(_quantise_engine_time_seconds(0.175), 11 / 60)
        self.assertAlmostEqual(_quantise_engine_time_seconds(0.475), 29 / 60)

    def test_strict_candidate_schema_and_retry(self):
        spec = make_spec()
        jsonschema.validate(spec, STRICT_IMPORT_SPEC_SCHEMA)
        session = FakeSession(
            [
                FakeResponse(429, {}, {"Retry-After": "0"}),
                FakeResponse(
                    200,
                    {"choices": [{"message": {"content": json.dumps(spec)}}]},
                ),
            ]
        )
        sleeps = []
        client = OpenRouterClient(
            "test-key",
            "test-model",
            session=session,
            sleep=sleeps.append,
            random_source=random.Random(1),
            max_attempts=2,
        )

        result = client.complete_json(
            [{"role": "user", "content": "test"}],
            STRICT_IMPORT_SPEC_SCHEMA,
            "test_schema",
        )

        self.assertEqual(result.attempts, 2)
        self.assertEqual(result.value["name"], spec["name"])
        self.assertEqual(len(session.requests), 2)
        self.assertEqual(sleeps, [0.0])
        response_format = session.requests[-1][1]["json"]["response_format"]
        self.assertEqual(response_format["type"], "json_schema")
        self.assertTrue(response_format["json_schema"]["strict"])

    def test_openrouter_attempt_budget_bounds_transient_retries(self):
        session = FakeSession(
            [
                FakeResponse(429, {}, {"Retry-After": "0"}),
                FakeResponse(200, {}),
            ]
        )
        client = OpenRouterClient(
            "test-key",
            "test-model",
            session=session,
            sleep=lambda _seconds: None,
            max_attempts=4,
            attempt_budget=1,
        )

        with self.assertRaisesRegex(RuntimeError, "attempt budget"):
            client.complete_json(
                [{"role": "user", "content": "test"}],
                STRICT_IMPORT_SPEC_SCHEMA,
                "test_schema",
            )

        self.assertEqual(len(session.requests), 1)

    def test_openrouter_payment_failure_is_not_retried_and_reports_one_attempt(self):
        session = FakeSession([FakeResponse(402, {})])
        sleeps = []
        client = OpenRouterClient(
            "test-key",
            "test-model",
            session=session,
            sleep=sleeps.append,
            max_attempts=4,
        )

        with self.assertRaisesRegex(RuntimeError, "failed after 1 attempt: status 402"):
            client.complete_json(
                [{"role": "user", "content": "test"}],
                STRICT_IMPORT_SPEC_SCHEMA,
                "test_schema",
            )

        self.assertEqual(len(session.requests), 1)
        self.assertEqual(sleeps, [])

    def test_evidence_score_prefers_measured_timing_and_colour(self):
        exact = score_candidate(make_spec(), video_observations())
        wrong = score_candidate(make_spec(2.8, "#0000ff", 0.95), video_observations())
        self.assertGreater(exact["score"], wrong["score"])
        self.assertEqual(exact["timing"], 1.0)
        self.assertEqual(exact["colour"], 1.0)

    def test_renderer_contract_and_validation_are_separate(self):
        spec = make_spec()
        observations = video_observations()
        observations["bursts"][0]["colours"] = [{"hex": "#00ff00", "weight": 1.0}]
        diagnostics = {
            "selectedCandidateIndex": 0,
            "scores": [{"candidateIndex": 0, "combinedScore": 0.9}],
        }
        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            diagnostics,
        )
        validation = build_reconstruction_validation(spec, observations, diagnostics)

        self.assertEqual(reconstruction["version"], 1)
        self.assertEqual(reconstruction["source"], "video_inferred")
        self.assertEqual(
            set(reconstruction),
            {
                "version",
                "source",
                "name",
                "description",
                "durationSeconds",
                "heightMeters",
                "caliber",
                "confidence",
                "designs",
                "shots",
                "observations",
            },
        )
        self.assertEqual(
            reconstruction["shots"][0]["designKey"], reconstruction["designs"][0]["key"]
        )
        self.assertEqual(reconstruction["shots"][0]["timeOffsetSeconds"], 0.25)
        self.assertEqual(reconstruction["shots"][0]["observedBurstTimeSeconds"], 1.2)
        self.assertIsInstance(reconstruction["shots"][0]["panDegrees"], int)
        self.assertIsInstance(reconstruction["shots"][0]["tiltDegrees"], int)
        self.assertEqual(reconstruction["designs"][0]["effectSlug"], "peony")
        self.assertEqual(reconstruction["designs"][0]["colorPalette"], ["#00ff00"])
        self.assertIn("stars", reconstruction["designs"][0]["design"])
        self.assertNotIn("validation", reconstruction)
        self.assertTrue(validation["valid"])

    def test_refinement_can_add_hidden_preroll_without_mutating_visible_launch_evidence(
        self,
    ):
        observations = copy.deepcopy(video_observations())
        observations["bursts"][0].update(
            {
                "launchSeconds": 0.75,
                "liftSeconds": 0.45,
                "burstSeconds": 1.2,
                "peakSeconds": 1.2,
            }
        )

        for timing_source, requested_time, expected_time in (
            ("model", 0.209, 0.2),
            ("conflicting_renderer_tuning", 0.75, 0.75),
        ):
            with self.subTest(timing_source=timing_source):
                spec = make_spec()
                shot = spec["effectSpec"]["shots"][0]
                spec["effectSpec"]["launch"]["liftTimeSeconds"] = 0.45
                shot.update(
                    {
                        "timeOffsetSeconds": requested_time,
                        "burstTimeSeconds": 1.2,
                        "liftTimeSeconds": 0.45,
                    }
                )
                if timing_source == "conflicting_renderer_tuning":
                    shot["rendererTuning"] = renderer_tuning(liftTimeSeconds=1.0)

                reconstruction = build_renderer_reconstruction(
                    spec,
                    observations,
                    {"hasAudio": False},
                    {"scores": []},
                )
                rendered_shot = reconstruction["shots"][0]
                design = reconstruction["designs"][0]["design"]
                rendered_lift = estimate_engine_lift_time_seconds(
                    design["liftVelocity"],
                    design["shellLife"],
                    pan_degrees=rendered_shot["panDegrees"],
                )

                self.assertEqual(rendered_shot["sourceTimeOffsetSeconds"], 0.75)
                self.assertEqual(rendered_shot["timeOffsetSeconds"], expected_time)
                self.assertLessEqual(rendered_shot["timeOffsetSeconds"], requested_time)
                self.assertAlmostEqual(
                    rendered_shot["timeOffsetSeconds"] + rendered_lift,
                    1.2,
                    delta=(1 / 60) + 0.0001,
                )
                if timing_source == "conflicting_renderer_tuning":
                    self.assertNotAlmostEqual(
                        rendered_lift,
                        1.0,
                        delta=(1 / 60) + 0.0001,
                    )

    def test_aerial_cue_is_capped_at_visible_launch_and_quantised(self):
        spec = make_spec()
        spec["effectSpec"]["shots"][0]["timeOffsetSeconds"] = 0.91
        observations = copy.deepcopy(video_observations())
        observations["bursts"][0]["launchSeconds"] = 0.259

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )
        shot = reconstruction["shots"][0]
        design = reconstruction["designs"][0]["design"]
        rendered_lift = estimate_engine_lift_time_seconds(
            design["liftVelocity"],
            design["shellLife"],
            pan_degrees=shot["panDegrees"],
        )

        self.assertEqual(shot["sourceTimeOffsetSeconds"], 0.259)
        self.assertEqual(shot["timeOffsetSeconds"], 0.25)
        self.assertLessEqual(shot["timeOffsetSeconds"], shot["sourceTimeOffsetSeconds"])
        self.assertAlmostEqual(
            shot["timeOffsetSeconds"] + rendered_lift,
            shot["observedBurstTimeSeconds"],
            delta=(1 / 60) + 0.0001,
        )

    def test_negative_aerial_cue_clamps_to_time_zero_before_lift_is_derived(self):
        spec = make_spec()
        spec["effectSpec"]["shots"][0]["timeOffsetSeconds"] = -4.0
        spec["effectSpec"]["shots"][0]["rendererTuning"] = renderer_tuning(
            liftTimeSeconds=0.4
        )

        reconstruction = build_renderer_reconstruction(
            spec,
            video_observations(),
            {"hasAudio": False},
            {"scores": []},
        )
        shot = reconstruction["shots"][0]
        design = reconstruction["designs"][0]["design"]
        rendered_lift = estimate_engine_lift_time_seconds(
            design["liftVelocity"],
            design["shellLife"],
            pan_degrees=shot["panDegrees"],
        )

        self.assertEqual(shot["timeOffsetSeconds"], 0.0)
        self.assertEqual(shot["sourceTimeOffsetSeconds"], 0.25)
        self.assertAlmostEqual(
            rendered_lift,
            shot["observedBurstTimeSeconds"],
            delta=(1 / 60) + 0.0001,
        )
        self.assertNotAlmostEqual(
            rendered_lift,
            0.4,
            delta=(1 / 60) + 0.0001,
        )

    def test_each_aerial_shot_derives_its_own_lift_from_its_own_cue(self):
        spec = make_spec()
        first_shot = spec["effectSpec"]["shots"][0]
        first_shot.update(
            {
                "timeOffsetSeconds": 0.1,
                "burstTimeSeconds": 1.0,
                "liftTimeSeconds": 0.2,
                "rendererTuning": renderer_tuning(liftTimeSeconds=3.5),
            }
        )
        second_shot = copy.deepcopy(first_shot)
        second_shot.update(
            {
                "index": 1,
                "timeOffsetSeconds": 1.0,
                "burstTimeSeconds": 2.5,
                "seedOffset": 101,
                "rendererTuning": renderer_tuning(liftTimeSeconds=0.4),
            }
        )
        spec["effectSpec"]["shots"] = [first_shot, second_shot]

        observations = copy.deepcopy(video_observations())
        first_burst = observations["bursts"][0]
        first_burst.update(
            {
                "launchSeconds": 0.4,
                "burstSeconds": 1.0,
                "peakSeconds": 1.25,
                "endSeconds": 1.8,
                "liftSeconds": 0.6,
                "fadeSeconds": 0.8,
            }
        )
        second_burst = copy.deepcopy(first_burst)
        second_burst.update(
            {
                "id": "burst-002",
                "launchSeconds": 1.5,
                "burstSeconds": 2.5,
                "peakSeconds": 2.7,
                "endSeconds": 2.95,
                "liftSeconds": 1.0,
                "fadeSeconds": 0.45,
            }
        )
        observations["bursts"] = [first_burst, second_burst]

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )
        designs = {
            design["key"]: design["design"] for design in reconstruction["designs"]
        }

        self.assertEqual(
            [shot["timeOffsetSeconds"] for shot in reconstruction["shots"]],
            [0.1, 1.0],
        )
        for shot in reconstruction["shots"]:
            design = designs[shot["designKey"]]
            rendered_lift = estimate_engine_lift_time_seconds(
                design["liftVelocity"],
                design["shellLife"],
                pan_degrees=shot["panDegrees"],
            )
            self.assertAlmostEqual(
                shot["timeOffsetSeconds"] + rendered_lift,
                shot["observedBurstTimeSeconds"],
                delta=(1 / 60) + 0.0001,
            )

    def test_ground_mine_does_not_gain_a_shell_lift_phase(self):
        spec = make_spec(burst_time=0.2)
        spec["effectSpec"]["type"] = "mine"
        spec["effectSpec"]["shell"]["family"] = "mine"
        spec["effectSpec"]["shell"]["geometry"] = "upward_fan"
        spec["effectSpec"]["shell"]["effectSlug"] = "mine"
        spec["effectSpec"]["shell"]["trailProfile"] = "spray"
        spec["effectSpec"]["launch"]["liftTimeSeconds"] = 0.0
        spec["effectSpec"]["shots"][0]["timeOffsetSeconds"] = 0.0
        spec["effectSpec"]["shots"][0]["burstTimeSeconds"] = 0.2
        spec["effectSpec"]["shots"][0]["liftTimeSeconds"] = 0.0
        spec["effectSpec"]["shots"][0]["rendererTuning"] = renderer_tuning(
            liftTimeSeconds=3.9
        )
        spec["effectSpec"]["shots"][0]["geometry"] = "upward_fan"
        spec["effectSpec"]["shots"][0]["effectSlug"] = "mine"
        spec["effectSpec"]["shots"][0]["trailProfile"] = "spray"
        observations = copy.deepcopy(video_observations())
        observations["bursts"][0]["burstSeconds"] = 0.2
        observations["bursts"][0]["peakSeconds"] = 0.2
        observations["bursts"][0]["launchSeconds"] = 0.2
        observations["bursts"][0]["liftSeconds"] = 0.0

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"selectedCandidateIndex": 0, "scores": []},
        )
        imported_design = reconstruction["designs"][0]

        self.assertEqual(imported_design["effectSlug"], "mine")
        self.assertEqual(imported_design["design"]["geometry"], "upward_fan")
        self.assertEqual(imported_design["design"]["liftVelocity"], 0)
        self.assertEqual(reconstruction["shots"][0]["timeOffsetSeconds"], 0.2)
        self.assertFalse(imported_design["design"]["launch"]["shell"]["visible"])
        self.assertFalse(
            imported_design["design"]["launch"]["liftParticles"]["enabled"]
        )

    def test_roman_candle_peaks_map_to_one_timed_engine_sequence(self):
        spec = make_spec()
        spec["effectSpec"]["type"] = "roman_candle"
        spec["effectSpec"]["shell"].update(
            {
                "family": "roman_candle",
                "geometry": "roman_candle",
                "effectSlug": "roman_candle",
                "trailProfile": "thick_tail",
            }
        )
        spec["effectSpec"]["launch"]["liftTimeSeconds"] = 0.0
        source_shot = spec["effectSpec"]["shots"][0]
        spec["effectSpec"]["shots"] = [
            {
                **source_shot,
                "timeOffsetSeconds": 0.0,
                "burstTimeSeconds": 0.25,
                "liftTimeSeconds": 0.0,
                "geometry": "roman_candle",
                "effectSlug": "roman_candle",
                "trailProfile": "thick_tail",
            }
        ]
        observations = video_observations()
        observations["durationSeconds"] = 4.0
        observations["bursts"] = [
            {
                **copy.deepcopy(observations["bursts"][0]),
                "id": f"burst-{index}",
                "launchSeconds": timestamp,
                "burstSeconds": timestamp,
                "peakSeconds": timestamp,
                "endSeconds": timestamp + 0.35,
                "fadeSeconds": 0.35,
                "liftSeconds": 0.0,
            }
            for index, timestamp in enumerate((0.25, 1.25, 2.25, 3.25))
        ]

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )
        shape = reconstruction["designs"][0]["design"]["geometryTuning"]["romanCandle"]
        outer_life = reconstruction["designs"][0]["design"]["stars"]["outer"]["burst"][
            "life"
        ]

        self.assertEqual(len(reconstruction["shots"]), 1)
        self.assertEqual(reconstruction["shots"][0]["timeOffsetSeconds"], 0.0)
        self.assertEqual(reconstruction["shots"][0]["observedBurstTimeSeconds"], 0.25)
        self.assertEqual(shape["minShots"], 4)
        self.assertEqual(shape["shotsPercent"], 1)
        self.assertEqual(shape["durationPercent"], 100)
        self.assertAlmostEqual(shape["durationMinSeconds"], 4.0)
        self.assertAlmostEqual(shape["durationMaxSeconds"], 4.0)
        self.assertLess(outer_life[1], 0.5)
        self.assertTrue(
            any(
                "Roman candle cadence" in unknown
                for unknown in reconstruction["observations"]["unknowns"]
            )
        )

        reachable_spec = copy.deepcopy(spec)
        reachable_observations = copy.deepcopy(observations)
        reachable_times = (1.0, 2.0, 3.0, 4.0)
        reachable_spec["effectSpec"]["shots"][0]["timeOffsetSeconds"] = 0.5
        reachable_spec["effectSpec"]["shots"][0]["burstTimeSeconds"] = 1.0
        for burst, timestamp in zip(
            reachable_observations["bursts"], reachable_times, strict=True
        ):
            burst["launchSeconds"] = timestamp
            burst["burstSeconds"] = timestamp
            burst["peakSeconds"] = timestamp
            burst["endSeconds"] = timestamp + 0.35
            burst["fadeSeconds"] = 0.35
        reachable_observations["durationSeconds"] = 4.5
        reachable = build_renderer_reconstruction(
            reachable_spec,
            reachable_observations,
            {"hasAudio": False},
            {"scores": []},
        )
        reachable_shape = reachable["designs"][0]["design"]["geometryTuning"][
            "romanCandle"
        ]
        cue_start = reachable["shots"][0]["timeOffsetSeconds"]
        emission_duration = reachable_shape["durationMinSeconds"]
        rendered_emissions = [
            cue_start + (index + 0.5) * emission_duration / 4 for index in range(4)
        ]
        self.assertEqual(cue_start, 0.5)
        self.assertEqual(rendered_emissions, list(reachable_times))
        self.assertFalse(
            any(
                "Roman candle cadence" in unknown
                for unknown in reachable["observations"]["unknowns"]
            )
        )

    def test_irregular_roman_candle_cadence_requires_manual_review(self):
        spec = make_spec()
        spec["effectSpec"]["shell"].update(
            {
                "family": "roman_candle",
                "geometry": "roman_candle",
                "effectSlug": "roman_candle",
                "trailProfile": "thick_tail",
            }
        )
        source_shot = spec["effectSpec"]["shots"][0]
        times = (0.75, 1.75, 3.0, 3.75)
        spec["effectSpec"]["shots"] = [
            {
                **source_shot,
                "timeOffsetSeconds": 0.25,
                "burstTimeSeconds": times[0],
                "liftTimeSeconds": 0.0,
                "geometry": "roman_candle",
                "effectSlug": "roman_candle",
                "trailProfile": "thick_tail",
            }
        ]
        observations = video_observations()
        observations["durationSeconds"] = 4.5
        observations["bursts"] = [
            {
                **copy.deepcopy(observations["bursts"][0]),
                "launchSeconds": timestamp,
                "burstSeconds": timestamp,
                "peakSeconds": timestamp,
                "endSeconds": timestamp + 0.35,
                "fadeSeconds": 0.35,
                "liftSeconds": 0.0,
            }
            for timestamp in times
        ]

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )

        self.assertTrue(
            any(
                "Roman candle cadence" in unknown
                for unknown in reconstruction["observations"]["unknowns"]
            )
        )

    def test_separate_roman_candle_positions_remain_separate_activations(self):
        spec = make_spec()
        spec["effectSpec"]["shell"].update(
            {
                "family": "roman_candle",
                "geometry": "roman_candle",
                "effectSlug": "roman_candle",
                "trailProfile": "thick_tail",
            }
        )
        source_shot = spec["effectSpec"]["shots"][0]
        times_and_positions = ((1.0, -2.0), (1.1, 2.0))
        spec["effectSpec"]["shots"] = [
            {
                **source_shot,
                "index": index,
                "timeOffsetSeconds": timestamp,
                "burstTimeSeconds": timestamp,
                "liftTimeSeconds": 0.0,
                "position": {"x": position_x, "y": 0.0, "z": 0.0},
                "launchPositionIndex": index % 2,
                "geometry": "roman_candle",
                "effectSlug": "roman_candle",
                "trailProfile": "thick_tail",
            }
            for index, (timestamp, position_x) in enumerate(times_and_positions)
        ]
        observations = video_observations()
        observations["durationSeconds"] = 3.0
        observations["bursts"] = [
            {
                **copy.deepcopy(observations["bursts"][0]),
                "launchSeconds": timestamp,
                "burstSeconds": timestamp,
                "peakSeconds": timestamp,
                "endSeconds": timestamp + 0.3,
                "fadeSeconds": 0.3,
                "liftSeconds": 0.0,
            }
            for timestamp, _position_x in times_and_positions
        ]

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )

        self.assertEqual(len(reconstruction["shots"]), 2)
        self.assertEqual(
            {shot["position"]["x"] for shot in reconstruction["shots"]},
            {-2.0, 2.0},
        )

    def test_distant_same_position_ground_emitters_remain_separate(self):
        for geometry, effect_slug, trail_profile in (
            ("roman_candle", "roman_candle", "thick_tail"),
            ("fountain", "fountain", "spray"),
        ):
            with self.subTest(geometry=geometry):
                spec = make_spec()
                spec["effectSpec"]["shell"].update(
                    {
                        "family": geometry,
                        "geometry": geometry,
                        "effectSlug": effect_slug,
                        "trailProfile": trail_profile,
                    }
                )
                source_shot = spec["effectSpec"]["shots"][0]
                times = (1.0, 2.0, 6.0, 7.0)
                spec["effectSpec"]["shots"] = [
                    {
                        **source_shot,
                        "index": index,
                        "timeOffsetSeconds": timestamp,
                        "burstTimeSeconds": timestamp,
                        "liftTimeSeconds": 0.0,
                        "geometry": geometry,
                        "effectSlug": effect_slug,
                        "trailProfile": trail_profile,
                    }
                    for index, timestamp in enumerate(times)
                ]
                observations = video_observations()
                observations["durationSeconds"] = 8.0
                observations["bursts"] = [
                    {
                        **copy.deepcopy(observations["bursts"][0]),
                        "launchSeconds": timestamp,
                        "burstSeconds": timestamp,
                        "peakSeconds": timestamp,
                        "endSeconds": timestamp + 0.3,
                        "fadeSeconds": 0.3,
                        "liftSeconds": 0.0,
                    }
                    for timestamp in times
                ]

                reconstruction = build_renderer_reconstruction(
                    spec,
                    observations,
                    {"hasAudio": False},
                    {"scores": []},
                )

                self.assertEqual(len(reconstruction["shots"]), 4)
                self.assertEqual(
                    [shot["position"]["x"] for shot in reconstruction["shots"]],
                    [0.0, 0.0, 0.0, 0.0],
                )

    def test_ambiguous_ground_activation_assignment_requires_manual_review(self):
        spec = make_spec()
        spec["effectSpec"]["shell"].update(
            {
                "family": "fountain",
                "geometry": "fountain",
                "effectSlug": "fountain",
                "trailProfile": "spray",
            }
        )
        source_shot = spec["effectSpec"]["shots"][0]
        spec["effectSpec"]["shots"] = [
            {
                **source_shot,
                "index": index,
                "timeOffsetSeconds": timestamp,
                "burstTimeSeconds": timestamp,
                "liftTimeSeconds": 0.0,
                "geometry": "fountain",
                "effectSlug": "fountain",
                "trailProfile": "spray",
            }
            for index, timestamp in enumerate((0.5, 3.5))
        ]
        observations = video_observations()
        observations["durationSeconds"] = 5.0
        observations["bursts"] = [
            {
                **copy.deepcopy(observations["bursts"][0]),
                "launchSeconds": timestamp,
                "burstSeconds": timestamp,
                "peakSeconds": timestamp,
                "endSeconds": timestamp + 0.25,
                "fadeSeconds": 0.25,
                "liftSeconds": 0.0,
            }
            for timestamp in (0.5, 1.5, 3.5)
        ]

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )

        self.assertEqual(len(reconstruction["shots"]), 2)
        self.assertTrue(
            any(
                "assigned one-to-one" in unknown
                for unknown in reconstruction["observations"]["unknowns"]
            )
        )

    def test_fountain_window_is_separate_from_particle_fade(self):
        spec = make_spec()
        spec["effectSpec"]["shell"].update(
            {
                "family": "fountain",
                "geometry": "fountain",
                "effectSlug": "fountain",
                "trailProfile": "spray",
            }
        )
        source_shot = spec["effectSpec"]["shots"][0]
        times = (0.5, 1.5, 2.5)
        spec["effectSpec"]["shots"] = [
            {
                **source_shot,
                "timeOffsetSeconds": times[0],
                "burstTimeSeconds": times[0],
                "liftTimeSeconds": 0.0,
                "geometry": "fountain",
                "effectSlug": "fountain",
                "trailProfile": "spray",
            }
        ]
        observations = video_observations()
        observations["durationSeconds"] = 3.0
        observations["bursts"] = [
            {
                **copy.deepcopy(observations["bursts"][0]),
                "launchSeconds": timestamp,
                "burstSeconds": timestamp,
                "peakSeconds": timestamp,
                "endSeconds": timestamp + 0.25,
                "fadeSeconds": 0.25,
                "liftSeconds": 0.0,
            }
            for timestamp in times
        ]

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )
        design = reconstruction["designs"][0]["design"]
        shape = design["geometryTuning"]["fountain"]

        self.assertEqual(len(reconstruction["shots"]), 1)
        self.assertEqual(reconstruction["shots"][0]["timeOffsetSeconds"], 0.5)
        self.assertAlmostEqual(shape["durationMinSeconds"], 2.25)
        self.assertAlmostEqual(shape["durationMaxSeconds"], 2.25)
        self.assertLess(design["stars"]["outer"]["burst"]["life"][1], 0.4)

    def test_mixed_aerial_and_roman_shots_are_not_collapsed(self):
        spec = make_spec()
        roman_shot = {
            **copy.deepcopy(spec["effectSpec"]["shots"][0]),
            "index": 1,
            "timeOffsetSeconds": 1.5,
            "burstTimeSeconds": 1.5,
            "liftTimeSeconds": 0.0,
            "geometry": "roman_candle",
            "effectSlug": "roman_candle",
            "trailProfile": "thick_tail",
        }
        spec["effectSpec"]["shots"].append(roman_shot)
        observations = video_observations()
        observations["bursts"].append(
            {
                **copy.deepcopy(observations["bursts"][0]),
                "id": "burst-002",
                "launchSeconds": 1.5,
                "burstSeconds": 1.5,
                "peakSeconds": 1.5,
                "endSeconds": 1.85,
                "liftSeconds": 0.0,
            }
        )

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )

        self.assertEqual(len(reconstruction["shots"]), 2)
        self.assertEqual(
            {design["design"]["geometry"] for design in reconstruction["designs"]},
            {"sphere", "roman_candle"},
        )

    def test_every_engine_geometry_survives_the_renderer_contract(self):
        for geometry, effect_slug, trail_profile in GEOMETRY_CASES:
            with self.subTest(geometry=geometry):
                reconstruction = make_geometry_reconstruction(
                    geometry,
                    effect_slug,
                    trail_profile,
                )
                imported_design = reconstruction["designs"][0]
                self.assertEqual(imported_design["effectSlug"], effect_slug)
                self.assertEqual(imported_design["design"]["geometry"], geometry)
                self.assertEqual(
                    imported_design["design"]["trailProfile"], trail_profile
                )

    def test_labelled_images_precede_each_image(self):
        content = labelled_image_content(
            [
                {
                    "timeSeconds": 1.25,
                    "label": "Source video frame at t=1.250s",
                    "jpegBase64": "YWJj",
                }
            ]
        )
        self.assertEqual([item["type"] for item in content], ["text", "image_url"])
        self.assertIn("1.250s", content[0]["text"])

    def test_multi_pass_selection_is_deterministic(self):
        candidates = [make_spec(2.5, "#0000ff"), make_spec()]
        received_parents = []

        def generate(_instruction, parent):
            received_parents.append(parent)
            candidate = candidates.pop(0)
            return candidate, {"id": candidate["name"]}

        def critic(values, _observations):
            rows = [
                {
                    "candidateIndex": index,
                    "timing": score_candidate(value, video_observations())["timing"],
                    "colour": score_candidate(value, video_observations())["colour"],
                    "geometry": 0.8,
                    "physics": 0.8,
                    "fade": 0.8,
                    "issues": [],
                    "improvementInstruction": "Keep measured values",
                }
                for index, value in enumerate(values)
            ]
            return {
                "candidateScores": rows,
                "selectedCandidateIndex": 1,
                "rationale": "Evidence",
            }, {"id": "critic"}

        winner, generated, raw, diagnostics = run_reconstruction_passes(
            generate,
            critic,
            video_observations(),
            candidate_count=2,
            pass_count=1,
        )
        self.assertEqual(winner["effectSpec"]["colorPalette"], ["#ff0000"])
        self.assertEqual(len(generated), 2)
        self.assertEqual(diagnostics["selectedCandidateIndex"], 1)
        self.assertEqual(len(raw), 3)
        self.assertEqual(received_parents, [None, None])

    def test_refinement_receives_the_ranked_candidate(self):
        first = make_spec(2.5, "#0000ff")
        second = make_spec()
        refined = make_spec(1.2, "#ff0000", 0.95)
        queue = [first, second, refined, refined]
        received_parents = []
        received_instructions = []

        def generate(instruction, parent):
            received_instructions.append(instruction)
            received_parents.append(parent)
            return queue.pop(0), {"id": "candidate"}

        def critic(values, _observations):
            rows = [
                {
                    "candidateIndex": index,
                    "timing": score_candidate(value, video_observations())["timing"],
                    "colour": score_candidate(value, video_observations())["colour"],
                    "geometry": 0.8,
                    "physics": 0.8,
                    "fade": 0.8,
                    "issues": [],
                    "improvementInstruction": "Keep measured values",
                }
                for index, value in enumerate(values)
            ]
            return {
                "candidateScores": rows,
                "selectedCandidateIndex": 1,
                "rationale": "Evidence",
            }, {"id": "critic"}

        run_reconstruction_passes(
            generate,
            critic,
            video_observations(),
            candidate_count=2,
            pass_count=2,
        )

        self.assertEqual(received_parents[:2], [None, None])
        self.assertIs(received_parents[2], second)
        self.assertIs(received_parents[3], first)
        self.assertTrue(
            all(
                "correct timeOffsetSeconds from launch-onset evidence" in instruction
                and "canonical lift is observed burst onset minus that offset"
                in instruction
                and "Never use the global visual peak delta as carrier lift"
                in instruction
                and "tune post-burst speed, density, head size, star life and trails"
                in instruction
                and "fade-relative-to-peak delta" in instruction
                for instruction in received_instructions[2:]
            )
        )

    def test_checkpoint_resume_skips_a_completed_candidate_call(self):
        first = make_spec(2.5, "#0000ff")
        second = make_spec()
        generated = []
        checkpoints = []

        def generate(_instruction, parent):
            generated.append(parent)
            return second, {"id": "candidate-2"}

        def critic(values, _observations):
            rows = [
                {
                    "candidateIndex": index,
                    "timing": 0.8,
                    "colour": 0.8,
                    "geometry": 0.8,
                    "physics": 0.8,
                    "fade": 0.8,
                    "issues": [],
                    "improvementInstruction": "Keep measured values",
                }
                for index, _value in enumerate(values)
            ]
            return {
                "candidateScores": rows,
                "selectedCandidateIndex": 1,
                "rationale": "Evidence",
            }, {"id": "critic"}

        _winner, candidates, outputs, _diagnostics = run_reconstruction_passes(
            generate,
            critic,
            video_observations(),
            candidate_count=2,
            pass_count=1,
            checkpoint=checkpoints.append,
            resume_outputs=[
                {
                    "kind": "candidate",
                    "pass": 1,
                    "candidateIndex": 0,
                    "candidate": first,
                    "response": {"id": "candidate-1"},
                }
            ],
        )

        self.assertEqual(generated, [None])
        self.assertEqual(candidates, [first, second])
        self.assertEqual(checkpoints, outputs)
        self.assertIn("candidate", outputs[0])
        self.assertIn("critic", outputs[-1])

    def test_refinement_can_directly_tune_engine_physics_lifetimes_density_and_colours(
        self,
    ):
        spec = make_spec()
        tuning = renderer_tuning(
            burstSpeedMin=7.1,
            burstSpeedMax=9.2,
            gravityMin=-0.82,
            gravityMax=-0.44,
            starLifeMinSeconds=1.7,
            starLifeMaxSeconds=3.9,
            airResistancePercent=147,
            terminalVelocity=11.5,
            starCount=83,
            trailParticlesPerStar=211,
            trailLifetimeBaseSeconds=2.3,
            trailLifetimeVariationPercent=41,
            trailAfterglowSeconds=0.72,
            trailGravity=-0.31,
            trailDrag=3.4,
            trailTurbulence=0.66,
            trailInheritedVelocity=0.23,
            trailBrightness=1.8,
            trailFadeSoftness=2.2,
            headSize=510,
            liftTimeSeconds=1.8,
            panDegrees=12,
            shellLifeSeconds=2.1,
            headColour="#123456",
            trailColour="#654321",
            launchHeadColour="#abcdef",
            launchTrailColour="#fedcba",
        )
        spec["effectSpec"]["shots"][0]["rendererTuning"] = tuning
        reconstruction = build_renderer_reconstruction(
            spec,
            video_observations(),
            {"hasAudio": False},
            {"scores": []},
        )
        design = reconstruction["designs"][0]["design"]
        outer = design["stars"]["outer"]
        trail = outer["burstTrail"]

        self.assertEqual(outer["burst"]["speed"], [7.1, 9.2])
        self.assertEqual(outer["burst"]["gravity"], [-0.82, -0.44])
        self.assertEqual(outer["burst"]["life"], [1.7, 3.9])
        self.assertEqual(outer["burst"]["airResistancePercent"], 147)
        self.assertEqual(outer["burst"]["terminalVelocity"], 11.5)
        self.assertEqual(outer["count"], 83)
        self.assertEqual(outer["head"]["size"], 510)
        self.assertEqual(trail["particlesPerStar"], 211)
        self.assertEqual(trail["lifetime"]["baseSeconds"], 2.3)
        self.assertEqual(trail["lifetime"]["variationPercent"], 41)
        self.assertEqual(trail["lifetime"]["afterglowSeconds"], 0.72)
        self.assertEqual(trail["motion"]["gravity"], -0.31)
        self.assertEqual(trail["motion"]["drag"], 3.4)
        self.assertEqual(trail["motion"]["turbulence"], 0.66)
        self.assertEqual(trail["motion"]["inheritedVelocity"], 0.23)
        self.assertEqual(trail["intensity"]["brightness"], 1.8)
        self.assertEqual(trail["intensity"]["fadeSoftness"], 2.2)
        rendered_lift_time = estimate_engine_lift_time_seconds(
            design["liftVelocity"],
            design["shellLife"],
            pan_degrees=reconstruction["shots"][0]["panDegrees"],
        )
        expected_lift_time = (
            reconstruction["shots"][0]["observedBurstTimeSeconds"]
            - reconstruction["shots"][0]["timeOffsetSeconds"]
        )
        self.assertAlmostEqual(
            rendered_lift_time,
            expected_lift_time,
            delta=(1 / 60) + 0.0001,
        )
        self.assertNotAlmostEqual(
            rendered_lift_time,
            1.8,
            delta=(1 / 60) + 0.0001,
        )
        self.assertEqual(reconstruction["shots"][0]["panDegrees"], 12)
        self.assertGreaterEqual(design["shellLife"], expected_lift_time + 0.5)
        self.assertEqual(design["shellLife"], 2.1)
        self.assertEqual(outer["color"], {"r": 0.07059, "g": 0.20392, "b": 0.33725})
        self.assertEqual(
            design["secondaryColor"], {"r": 0.39608, "g": 0.26275, "b": 0.12941}
        )
        self.assertEqual(
            design["launch"]["shell"]["colour"],
            {"r": 0.67059, "g": 0.80392, "b": 0.93725},
        )
        self.assertEqual(
            design["launch"]["liftParticles"]["colour"],
            {"r": 0.99608, "g": 0.86275, "b": 0.72941},
        )

    def test_rendered_lift_apex_matches_observed_burst_time(self):
        reconstruction = build_renderer_reconstruction(
            make_spec(),
            video_observations(),
            {"hasAudio": False},
            {"scores": []},
        )
        shot = reconstruction["shots"][0]
        design = reconstruction["designs"][0]["design"]
        expected_lift_time = (
            shot["observedBurstTimeSeconds"] - shot["timeOffsetSeconds"]
        )

        rendered_lift_time = estimate_engine_lift_time_seconds(
            design["liftVelocity"],
            design["shellLife"],
            pan_degrees=shot["panDegrees"],
        )

        self.assertAlmostEqual(
            rendered_lift_time,
            expected_lift_time,
            delta=(1 / 60) + 0.0001,
        )
        self.assertGreaterEqual(design["shellLife"], expected_lift_time + 0.5)

    def test_explicit_zero_shot_pan_is_not_replaced_by_launch_default(self):
        spec = make_spec()
        spec["effectSpec"]["launch"]["panDegrees"] = 17.0
        observations = video_observations()
        observations["bursts"][0]["launchTrajectory"] = {
            "confidence": 0.0,
            "normalisedGravity": 0.0,
            "points": [],
        }

        reconstruction = build_renderer_reconstruction(
            spec,
            observations,
            {"hasAudio": False},
            {"scores": []},
        )

        self.assertEqual(reconstruction["shots"][0]["panDegrees"], 0)

    def test_pan_inversion_uses_source_aspect_ratio(self):
        base_trajectory = {
            "confidence": 0.9,
            "points": [
                {"x": 0.4, "y": 0.9},
                {"x": 0.5, "y": 0.5},
            ],
        }
        portrait_pan = _renderer_pan_degrees(
            {"panDegrees": 0},
            {"enabled": True, "panDegrees": 0},
            {
                "launchTrajectory": {
                    **base_trajectory,
                    "frameAspectRatio": 9 / 16,
                }
            },
            {},
            0.95,
            is_ground_emitter=False,
        )
        landscape_pan = _renderer_pan_degrees(
            {"panDegrees": 0},
            {"enabled": True, "panDegrees": 0},
            {
                "launchTrajectory": {
                    **base_trajectory,
                    "frameAspectRatio": 16 / 9,
                }
            },
            {},
            0.95,
            is_ground_emitter=False,
        )

        self.assertGreater(landscape_pan, portrait_pan)

    def test_renderer_tail_extends_product_without_rewriting_source_evidence(self):
        observations = video_observations()
        observations["durationSeconds"] = 4.0
        observations["bursts"][0]["endSeconds"] = 4.0
        reconstruction = build_renderer_reconstruction(
            make_spec(),
            observations,
            {"hasAudio": False},
            {"scores": []},
        )
        shot = reconstruction["shots"][0]
        design = reconstruction["designs"][0]

        self.assertEqual(shot["observedBurstTimeSeconds"], 1.2)
        self.assertEqual(shot["observedFadeEndSeconds"], 4.0)
        self.assertEqual(design["durationSeconds"], 9.75)
        self.assertEqual(reconstruction["durationSeconds"], 10.0)
        self.assertGreaterEqual(
            reconstruction["durationSeconds"],
            shot["timeOffsetSeconds"] + design["durationSeconds"],
        )


if __name__ == "__main__":
    unittest.main()
