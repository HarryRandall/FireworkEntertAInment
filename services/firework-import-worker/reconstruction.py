"""Model orchestration and renderer-native reconstruction contracts."""

from __future__ import annotations

import json
import math
import random
import statistics
import time
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from typing import Any, Callable

import jsonschema
import requests


RECONSTRUCTION_CONTRACT_VERSION = 1
PIPELINE_VERSION = "firework-reconstruction-v10"
RETRYABLE_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}


def _strict_object(properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": properties,
        "required": required,
    }


HEX_COLOUR_SCHEMA = {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"}


def _nullable(schema: dict[str, Any]) -> dict[str, Any]:
    return {"anyOf": [schema, {"type": "null"}]}


ENGINE_GEOMETRIES = [
    "sphere",
    "crown",
    "weeping",
    "radial_arms",
    "ring",
    "split_cross",
    "falling_tail",
    "single_tail",
    "upward_fan",
    "fragment_cloud",
    "heart",
    "five_point_star",
    "pistil",
    "pearls",
    "fish",
    "waterfall",
    "whirl",
    "bowtie",
    "roman_candle",
    "fountain",
]

ENGINE_TRAIL_PROFILES = [
    "none",
    "spark",
    "glitter",
    "long_hang",
    "thick_tail",
    "fragmenting",
    "spray",
    "blink",
    "crackle",
    "pearls",
    "fish",
    "waterfall",
    "whirl",
]

IMPORT_EFFECT_SLUGS = [
    "peony",
    "chrysanthemum",
    "brocade",
    "kamuro",
    "willow",
    "palm",
    "ring",
    "saturn",
    "crossette",
    "double_break",
    "bowtie",
    "horsetail",
    "comet",
    "mine",
    "pearls",
    "pistil",
    "nishiki",
    "strobe",
    "crackle",
    "silverFish",
    "waterfall",
    "whirl",
    "roman_candle",
    "fountain",
    "heart-shell",
    "outlined-star-shell",
]

IMPORT_EFFECT_FAMILIES = [
    *IMPORT_EFFECT_SLUGS,
    "ghost",
    "floral",
    "falling_leaves",
    "custom",
]

GEOMETRY_EVIDENCE_SCHEMA = _strict_object(
    {
        "countPercent": {"type": "number", "minimum": 1, "maximum": 200},
        "scaleX": {"type": "number", "minimum": 0.2, "maximum": 2.5},
        "scaleY": {"type": "number", "minimum": 0.2, "maximum": 2.5},
        "depthScale": {"type": "number", "minimum": 0, "maximum": 1.5},
        "rotationDegrees": {"type": "number", "minimum": -180, "maximum": 180},
        "spread": {"type": "number", "minimum": 0, "maximum": 2},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    [
        "countPercent",
        "scaleX",
        "scaleY",
        "depthScale",
        "rotationDegrees",
        "spread",
        "confidence",
    ],
)

RENDERER_TUNING_PROPERTIES = {
    "burstSpeedMin": _nullable({"type": "number", "minimum": 0, "maximum": 20}),
    "burstSpeedMax": _nullable({"type": "number", "minimum": 0, "maximum": 20}),
    "gravityMin": _nullable({"type": "number", "minimum": -2, "maximum": 1}),
    "gravityMax": _nullable({"type": "number", "minimum": -2, "maximum": 1}),
    "starLifeMinSeconds": _nullable({"type": "number", "minimum": 0.05, "maximum": 30}),
    "starLifeMaxSeconds": _nullable({"type": "number", "minimum": 0.05, "maximum": 30}),
    "airResistancePercent": _nullable({"type": "number", "minimum": 0, "maximum": 300}),
    "terminalVelocity": _nullable({"type": "number", "minimum": 0, "maximum": 18}),
    "starCount": _nullable({"type": "integer", "minimum": 1, "maximum": 100}),
    "trailParticlesPerStar": _nullable(
        {"type": "integer", "minimum": 0, "maximum": 2000}
    ),
    "trailLifetimeBaseSeconds": _nullable(
        {"type": "number", "minimum": 0.05, "maximum": 8}
    ),
    "trailLifetimeVariationPercent": _nullable(
        {"type": "number", "minimum": 0, "maximum": 100}
    ),
    "trailAfterglowSeconds": _nullable({"type": "number", "minimum": 0, "maximum": 6}),
    "trailGravity": _nullable({"type": "number", "minimum": -2, "maximum": 1}),
    "trailDrag": _nullable({"type": "number", "minimum": 0, "maximum": 6}),
    "trailTurbulence": _nullable({"type": "number", "minimum": 0, "maximum": 2}),
    "trailInheritedVelocity": _nullable({"type": "number", "minimum": 0, "maximum": 1}),
    "trailBrightness": _nullable({"type": "number", "minimum": 0, "maximum": 3}),
    "trailFadeSoftness": _nullable({"type": "number", "minimum": 0.2, "maximum": 4}),
    "headSize": _nullable({"type": "number", "minimum": 10, "maximum": 1000}),
    "liftTimeSeconds": _nullable(
        {
            "type": "number",
            "minimum": 0.35,
            "maximum": 3.9,
            "description": (
                "Advisory launch-to-burst estimate. Canonical aerial timing derives the "
                "actual lift from observed burst onset minus the shot time offset so this "
                "value cannot move the rendered apex away from source evidence."
            ),
        }
    ),
    "panDegrees": _nullable(
        {
            "type": "number",
            "minimum": -30,
            "maximum": 30,
            "description": (
                "Direct engine launch-pan correction. Leave null to invert the "
                "measured launch trajectory through the shell physics."
            ),
        }
    ),
    "shellLifeSeconds": _nullable(
        {
            "type": "number",
            "minimum": 2,
            "maximum": 60,
            "description": (
                "Carrier survival deadline only. For aerial shells the worker raises this "
                "above the target apex; use star and trail lifetimes to control the fade."
            ),
        }
    ),
    "headColour": _nullable(HEX_COLOUR_SCHEMA),
    "trailColour": _nullable(HEX_COLOUR_SCHEMA),
    "launchHeadColour": _nullable(HEX_COLOUR_SCHEMA),
    "launchTrailColour": _nullable(HEX_COLOUR_SCHEMA),
}
RENDERER_TUNING_SCHEMA = _strict_object(
    RENDERER_TUNING_PROPERTIES,
    list(RENDERER_TUNING_PROPERTIES),
)

STRICT_IMPORT_SPEC_SCHEMA = _strict_object(
    {
        "name": {"type": "string", "minLength": 1},
        "description": {"type": ["string", "null"]},
        "durationSeconds": {"type": "number", "minimum": 0.1, "maximum": 60},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "effectSpec": _strict_object(
            {
                "version": {"type": "integer", "const": 3},
                "name": {"type": "string", "minLength": 1},
                "description": {"type": ["string", "null"]},
                "source": {"type": "string", "const": "video_inferred"},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "seed": {"type": "integer"},
                "type": {
                    "type": "string",
                    "enum": [
                        "shell",
                        "cake",
                        "mine",
                        "comet",
                        "single_shot",
                        "combo",
                        "custom",
                    ],
                },
                "durationSeconds": {"type": "number", "minimum": 0.1, "maximum": 60},
                "heightMeters": {"type": "number", "minimum": 0, "maximum": 220},
                "colorPalette": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 12,
                    "items": HEX_COLOUR_SCHEMA,
                },
                "shell": _strict_object(
                    {
                        "family": {
                            "type": "string",
                            "enum": IMPORT_EFFECT_FAMILIES,
                        },
                        "geometry": {"type": "string", "enum": ENGINE_GEOMETRIES},
                        "effectSlug": {"type": "string", "enum": IMPORT_EFFECT_SLUGS},
                        "trailProfile": {
                            "type": "string",
                            "enum": ENGINE_TRAIL_PROFILES,
                        },
                        "geometryEvidence": GEOMETRY_EVIDENCE_SCHEMA,
                        "rendererTuning": RENDERER_TUNING_SCHEMA,
                        "size": {"type": "number", "minimum": 1, "maximum": 100},
                        "starDensity": {
                            "type": "number",
                            "minimum": 0.05,
                            "maximum": 4,
                        },
                        "colorPalette": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": 12,
                            "items": HEX_COLOUR_SCHEMA,
                        },
                        "color": HEX_COLOUR_SCHEMA,
                        "secondColor": {"anyOf": [HEX_COLOUR_SCHEMA, {"type": "null"}]},
                        "pistil": {"type": "boolean"},
                        "pistilColor": {"anyOf": [HEX_COLOUR_SCHEMA, {"type": "null"}]},
                        "glitter": {
                            "type": "string",
                            "enum": [
                                "none",
                                "light",
                                "medium",
                                "heavy",
                                "thick",
                                "streamer",
                                "willow",
                            ],
                        },
                        "smokeAmount": {"type": "number", "minimum": 0, "maximum": 2},
                    },
                    [
                        "family",
                        "geometry",
                        "effectSlug",
                        "trailProfile",
                        "geometryEvidence",
                        "rendererTuning",
                        "size",
                        "starDensity",
                        "colorPalette",
                        "color",
                        "secondColor",
                        "pistil",
                        "pistilColor",
                        "glitter",
                        "smokeAmount",
                    ],
                ),
                "launch": _strict_object(
                    {
                        "enabled": {"type": "boolean"},
                        "fuseTimeSeconds": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 60,
                        },
                        "liftTimeSeconds": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 20,
                        },
                        "heightMeters": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 220,
                        },
                        "panDegrees": {
                            "type": "number",
                            "minimum": -180,
                            "maximum": 180,
                        },
                        "tiltDegrees": {"type": "number", "minimum": 0, "maximum": 180},
                        "tracerColor": HEX_COLOUR_SCHEMA,
                        "tailColor": HEX_COLOUR_SCHEMA,
                    },
                    [
                        "enabled",
                        "fuseTimeSeconds",
                        "liftTimeSeconds",
                        "heightMeters",
                        "panDegrees",
                        "tiltDegrees",
                        "tracerColor",
                        "tailColor",
                    ],
                ),
                "shots": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 500,
                    "items": _strict_object(
                        {
                            "index": {"type": "integer", "minimum": 0},
                            "timeOffsetSeconds": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 60,
                            },
                            "burstTimeSeconds": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 60,
                            },
                            "scale": {"type": "number", "minimum": 0.1, "maximum": 4},
                            "seedOffset": {"type": "integer"},
                            "position": _strict_object(
                                {
                                    "x": {
                                        "type": "number",
                                        "minimum": -1000,
                                        "maximum": 1000,
                                    },
                                    "y": {
                                        "type": "number",
                                        "minimum": -1000,
                                        "maximum": 1000,
                                    },
                                    "z": {
                                        "type": "number",
                                        "minimum": -1000,
                                        "maximum": 1000,
                                    },
                                },
                                ["x", "y", "z"],
                            ),
                            "launchPositionIndex": {
                                "type": "integer",
                                "minimum": 0,
                                "maximum": 2,
                            },
                            "panDegrees": {
                                "type": "number",
                                "minimum": -30,
                                "maximum": 30,
                            },
                            "tiltDegrees": {
                                "type": "number",
                                "minimum": -50,
                                "maximum": 50,
                            },
                            "geometry": {"type": "string", "enum": ENGINE_GEOMETRIES},
                            "effectSlug": {
                                "type": "string",
                                "enum": IMPORT_EFFECT_SLUGS,
                            },
                            "trailProfile": {
                                "type": "string",
                                "enum": ENGINE_TRAIL_PROFILES,
                            },
                            "geometryEvidence": GEOMETRY_EVIDENCE_SCHEMA,
                            "rendererTuning": RENDERER_TUNING_SCHEMA,
                            "colorPalette": {
                                "type": "array",
                                "minItems": 1,
                                "maxItems": 12,
                                "items": HEX_COLOUR_SCHEMA,
                            },
                            "color": HEX_COLOUR_SCHEMA,
                            "tailColor": HEX_COLOUR_SCHEMA,
                            "liftTimeSeconds": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 20,
                            },
                            "heightMeters": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 220,
                            },
                        },
                        [
                            "index",
                            "timeOffsetSeconds",
                            "burstTimeSeconds",
                            "scale",
                            "seedOffset",
                            "position",
                            "launchPositionIndex",
                            "panDegrees",
                            "tiltDegrees",
                            "geometry",
                            "effectSlug",
                            "trailProfile",
                            "geometryEvidence",
                            "rendererTuning",
                            "colorPalette",
                            "color",
                            "tailColor",
                            "liftTimeSeconds",
                            "heightMeters",
                        ],
                    ),
                },
            },
            [
                "version",
                "name",
                "description",
                "source",
                "confidence",
                "seed",
                "type",
                "durationSeconds",
                "heightMeters",
                "colorPalette",
                "shell",
                "launch",
                "shots",
            ],
        ),
        "observations": _strict_object(
            {
                "observedEvents": {
                    "type": "array",
                    "maxItems": 200,
                    "items": _strict_object(
                        {
                            "timeSeconds": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 60,
                            },
                            "type": {
                                "type": "string",
                                "enum": [
                                    "launch",
                                    "mine",
                                    "break",
                                    "secondary_break",
                                    "crackle",
                                    "strobe",
                                    "glitter",
                                    "smoke",
                                    "fade",
                                    "report",
                                    "unknown",
                                ],
                            },
                            "color": {"anyOf": [HEX_COLOUR_SCHEMA, {"type": "null"}]},
                            "estimatedHeight": {
                                "type": ["number", "null"],
                                "minimum": 0,
                                "maximum": 220,
                            },
                            "description": {"type": "string"},
                            "confidence": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 1,
                            },
                        },
                        [
                            "timeSeconds",
                            "type",
                            "color",
                            "estimatedHeight",
                            "description",
                            "confidence",
                        ],
                    ),
                },
                "unknowns": {
                    "type": "array",
                    "maxItems": 50,
                    "items": {"type": "string"},
                },
                "suggestedManualReviewFields": {
                    "type": "array",
                    "maxItems": 50,
                    "items": {"type": "string"},
                },
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            },
            ["observedEvents", "unknowns", "suggestedManualReviewFields", "confidence"],
        ),
    },
    [
        "name",
        "description",
        "durationSeconds",
        "confidence",
        "effectSpec",
        "observations",
    ],
)


CRITIC_SCHEMA = _strict_object(
    {
        "candidateScores": {
            "type": "array",
            "minItems": 1,
            "maxItems": 16,
            "items": _strict_object(
                {
                    "candidateIndex": {"type": "integer", "minimum": 0},
                    "timing": {"type": "number", "minimum": 0, "maximum": 1},
                    "colour": {"type": "number", "minimum": 0, "maximum": 1},
                    "geometry": {"type": "number", "minimum": 0, "maximum": 1},
                    "physics": {"type": "number", "minimum": 0, "maximum": 1},
                    "fade": {"type": "number", "minimum": 0, "maximum": 1},
                    "issues": {
                        "type": "array",
                        "maxItems": 20,
                        "items": {"type": "string"},
                    },
                    "improvementInstruction": {"type": "string"},
                },
                [
                    "candidateIndex",
                    "timing",
                    "colour",
                    "geometry",
                    "physics",
                    "fade",
                    "issues",
                    "improvementInstruction",
                ],
            ),
        },
        "selectedCandidateIndex": {"type": "integer", "minimum": 0},
        "rationale": {"type": "string"},
    },
    ["candidateScores", "selectedCandidateIndex", "rationale"],
)


def parse_json_content(content: Any) -> dict[str, Any]:
    if isinstance(content, list):
        content = "".join(
            item.get("text", "")
            for item in content
            if isinstance(item, dict) and item.get("type") == "text"
        )
    if not isinstance(content, str):
        raise RuntimeError("OpenRouter returned non-text structured output")
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[1] if "\n" in stripped else stripped
        stripped = stripped.rsplit("```", 1)[0]
    parsed = json.loads(stripped)
    if not isinstance(parsed, dict):
        raise RuntimeError("OpenRouter structured output must be a JSON object")
    return parsed


def _retry_after_seconds(response: Any, cap_seconds: float) -> float | None:
    value = getattr(response, "headers", {}).get("Retry-After")
    if not value:
        return None
    try:
        return min(cap_seconds, max(0.0, float(value)))
    except ValueError:
        try:
            seconds = (
                parsedate_to_datetime(value)
                - parsedate_to_datetime(response.headers["Date"])
            ).total_seconds()
            return min(cap_seconds, max(0.0, seconds))
        except (KeyError, TypeError, ValueError):
            return None


@dataclass(frozen=True)
class OpenRouterResult:
    value: dict[str, Any]
    raw: dict[str, Any]
    attempts: int


class OpenRouterClient:
    """A bounded OpenRouter client using strict JSON Schema responses."""

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        site_url: str | None = None,
        app_name: str = "ShowCrafter Firework Import Worker",
        timeout_seconds: float = 150,
        max_attempts: int = 4,
        base_delay_seconds: float = 1,
        max_delay_seconds: float = 12,
        session: Any | None = None,
        sleep: Callable[[float], None] = time.sleep,
        random_source: random.Random | None = None,
        deadline_monotonic: float | None = None,
        attempt_budget: int | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.site_url = site_url
        self.app_name = app_name
        self.timeout_seconds = max(10, timeout_seconds)
        self.max_attempts = max(1, min(6, max_attempts))
        self.base_delay_seconds = max(0, base_delay_seconds)
        self.max_delay_seconds = max(self.base_delay_seconds, max_delay_seconds)
        self.session = session or requests.Session()
        self.sleep = sleep
        self.random_source = random_source or random.Random()
        self.deadline_monotonic = deadline_monotonic
        self.attempt_budget = (
            max(1, int(attempt_budget)) if attempt_budget is not None else None
        )
        self.attempts_used = 0

    def complete_json(
        self,
        messages: list[dict[str, Any]],
        schema: dict[str, Any],
        schema_name: str,
        *,
        temperature: float = 0.15,
    ) -> OpenRouterResult:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Title": self.app_name,
        }
        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        payload = {
            "model": self.model,
            "temperature": temperature,
            "messages": messages,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            },
        }
        last_error: Exception | None = None
        attempts_made = 0
        for attempt in range(1, self.max_attempts + 1):
            response = None
            try:
                if (
                    self.attempt_budget is not None
                    and self.attempts_used >= self.attempt_budget
                ):
                    raise RuntimeError(
                        "OpenRouter run-wide attempt budget was exhausted"
                    )
                request_timeout = self.timeout_seconds
                if self.deadline_monotonic is not None:
                    remaining = self.deadline_monotonic - time.monotonic()
                    if remaining <= 2:
                        raise RuntimeError("OpenRouter run-wide deadline was exhausted")
                    request_timeout = min(request_timeout, max(1.0, remaining - 1.0))
                self.attempts_used += 1
                attempts_made = attempt
                response = self.session.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=request_timeout,
                )
                if response.status_code in RETRYABLE_STATUS_CODES:
                    raise requests.HTTPError(
                        f"OpenRouter retryable status {response.status_code}",
                        response=response,
                    )
                response.raise_for_status()
                raw = response.json()
                content = raw["choices"][0]["message"]["content"]
                value = parse_json_content(content)
                jsonschema.validate(value, schema)
                return OpenRouterResult(value=value, raw=raw, attempts=attempt)
            except (
                requests.RequestException,
                KeyError,
                IndexError,
                TypeError,
                ValueError,
                json.JSONDecodeError,
                jsonschema.ValidationError,
            ) as exc:
                last_error = exc
                status_code = getattr(
                    getattr(exc, "response", None), "status_code", None
                )
                retryable = isinstance(
                    exc,
                    (
                        requests.Timeout,
                        requests.ConnectionError,
                        json.JSONDecodeError,
                        jsonschema.ValidationError,
                    ),
                )
                retryable = retryable or status_code in RETRYABLE_STATUS_CODES
                if not retryable or attempt >= self.max_attempts:
                    break
                retry_after = (
                    _retry_after_seconds(response, self.max_delay_seconds)
                    if response is not None
                    else None
                )
                if retry_after is None:
                    exponential = self.base_delay_seconds * (2 ** (attempt - 1))
                    retry_after = min(
                        self.max_delay_seconds, exponential
                    ) * self.random_source.uniform(0.8, 1.2)
                if self.deadline_monotonic is not None:
                    retry_after = min(
                        retry_after,
                        max(0.0, self.deadline_monotonic - time.monotonic() - 2.0),
                    )
                self.sleep(retry_after)
        raise RuntimeError(
            f"OpenRouter structured output failed after {attempts_made} "
            f"{'attempt' if attempts_made == 1 else 'attempts'}: {last_error}"
        ) from last_error


def labelled_image_content(images: list[dict[str, Any]]) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = []
    for image in images:
        encoded = image.get("jpegBase64")
        if not isinstance(encoded, str) or not encoded:
            continue
        timestamp = float(image.get("timeSeconds") or 0.0)
        label = image.get("label") or f"Source video frame at t={timestamp:.3f}s"
        content.append({"type": "text", "text": str(label)})
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
            }
        )
    return content


def _colour_set(values: list[Any]) -> set[str]:
    return {
        str(value).upper()
        for value in values
        if isinstance(value, str) and len(value) == 7
    }


def _hex_channels(value: str) -> tuple[int, int, int] | None:
    try:
        return int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16)
    except (TypeError, ValueError):
        return None


def _palette_similarity(
    candidate_colours: set[str], observed_colours: set[str]
) -> float:
    if not observed_colours:
        return 0.5
    if not candidate_colours:
        return 0.0
    similarities = []
    maximum_distance = math.sqrt(3 * 255 * 255)
    for observed in observed_colours:
        observed_channels = _hex_channels(observed)
        if observed_channels is None:
            continue
        best = 0.0
        for candidate in candidate_colours:
            candidate_channels = _hex_channels(candidate)
            if candidate_channels is None:
                continue
            distance = math.sqrt(
                sum(
                    (left - right) ** 2
                    for left, right in zip(
                        observed_channels, candidate_channels, strict=True
                    )
                )
            )
            best = max(best, 1.0 - distance / maximum_distance)
        similarities.append(best)
    return sum(similarities) / len(similarities) if similarities else 0.0


def _shot_burst_times(spec: dict[str, Any]) -> list[float]:
    effect = spec.get("effectSpec") if isinstance(spec.get("effectSpec"), dict) else {}
    launch = effect.get("launch") if isinstance(effect.get("launch"), dict) else {}
    default_lift = float(_first_present(launch.get("liftTimeSeconds"), 0.0))
    shots = effect.get("shots") if isinstance(effect.get("shots"), list) else []
    output: list[float] = []
    for shot in shots:
        if not isinstance(shot, dict):
            continue
        if shot.get("burstTimeSeconds") is not None:
            output.append(float(shot["burstTimeSeconds"]))
        else:
            output.append(
                float(shot.get("timeOffsetSeconds") or 0.0)
                + float(_first_present(shot.get("liftTimeSeconds"), default_lift))
            )
    return sorted(output)


def score_candidate(
    spec: dict[str, Any], video_observations: dict[str, Any]
) -> dict[str, float]:
    effect = spec.get("effectSpec") if isinstance(spec.get("effectSpec"), dict) else {}
    shell = effect.get("shell") if isinstance(effect.get("shell"), dict) else {}
    candidate_shots = (
        effect.get("shots") if isinstance(effect.get("shots"), list) else []
    )
    shot_geometries = {
        str(
            shot.get("geometry")
            or shell.get("geometry")
            or shell.get("family")
            or effect.get("type")
            or ""
        )
        for shot in candidate_shots
        if isinstance(shot, dict)
    }
    continuous_ground_emitter = len(shot_geometries) == 1 and next(
        iter(shot_geometries), ""
    ) in {"roman_candle", "fountain"}
    observed_bursts = (
        video_observations.get("bursts")
        if isinstance(video_observations.get("bursts"), list)
        else []
    )
    observed_times = [
        float(item.get("burstSeconds", item.get("peakSeconds")))
        for item in observed_bursts
        if isinstance(item, dict)
        and (
            item.get("burstSeconds") is not None or item.get("peakSeconds") is not None
        )
    ]
    candidate_times = _shot_burst_times(spec)
    if continuous_ground_emitter:
        observed_start = min(
            (
                float(
                    _first_present(
                        item.get("launchSeconds"),
                        item.get("burstSeconds"),
                        item.get("peakSeconds"),
                        0.0,
                    )
                )
                for item in observed_bursts
                if isinstance(item, dict)
            ),
            default=0.0,
        )
        candidate_start = min(
            (
                float(shot.get("timeOffsetSeconds") or 0.0)
                for shot in candidate_shots
                if isinstance(shot, dict)
            ),
            default=0.0,
        )
        timing = max(0.0, 1.0 - abs(observed_start - candidate_start) / 1.2)
        count = 1.0 if candidate_shots else 0.0
    elif observed_times and candidate_times:
        timing_error = sum(
            min(abs(observed - candidate) for candidate in candidate_times)
            for observed in observed_times
        ) / len(observed_times)
        timing = max(0.0, 1.0 - timing_error / 1.2)
        count = 1.0 - min(
            1.0,
            abs(len(observed_times) - len(candidate_times))
            / max(len(observed_times), len(candidate_times)),
        )
    elif not observed_times and candidate_times:
        timing, count = 0.55, 0.45
    else:
        timing, count = 0.0, 0.0

    candidate_colours = _colour_set(
        effect.get("colorPalette")
        if isinstance(effect.get("colorPalette"), list)
        else []
    )
    observed_colours = _colour_set(
        video_observations.get("globalPalette")
        if isinstance(video_observations.get("globalPalette"), list)
        else []
    )
    colour = _palette_similarity(candidate_colours, observed_colours)
    observed_duration = float(video_observations.get("durationSeconds") or 0.0)
    candidate_duration = float(
        spec.get("durationSeconds") or effect.get("durationSeconds") or 0.0
    )
    duration = max(
        0.0,
        1.0 - abs(observed_duration - candidate_duration) / max(1.0, observed_duration),
    )
    richness_fields = [
        shell.get("family"),
        shell.get("starDensity"),
        effect.get("launch"),
        effect.get("shots"),
    ]
    richness = sum(value not in (None, {}, []) for value in richness_fields) / len(
        richness_fields
    )
    evidence_confidence = float(spec.get("confidence") or 0.0)
    total = (
        timing * 0.32
        + count * 0.18
        + colour * 0.17
        + duration * 0.13
        + richness * 0.12
        + evidence_confidence * 0.08
    )
    return {
        "score": round(max(0.0, min(1.0, total)), 5),
        "timing": round(timing, 5),
        "shotCount": round(count, 5),
        "colour": round(colour, 5),
        "duration": round(duration, 5),
        "richness": round(richness, 5),
    }


GenerateCandidate = Callable[
    [str, dict[str, Any] | None], tuple[dict[str, Any], dict[str, Any]]
]
CritiqueCandidates = Callable[
    [list[dict[str, Any]], dict[str, Any]], tuple[dict[str, Any], dict[str, Any]]
]
CheckpointOutput = Callable[[dict[str, Any]], None]
EvaluateCandidate = Callable[[dict[str, Any], int], None]


def _checkpoint_key(output: dict[str, Any]) -> tuple[Any, ...] | None:
    kind = output.get("kind")
    pass_index = output.get("pass")
    if kind == "candidate" and isinstance(output.get("candidateIndex"), int):
        return kind, pass_index, output["candidateIndex"]
    if kind == "critic":
        return kind, pass_index
    return None


def run_reconstruction_passes(
    generate_candidate: GenerateCandidate,
    critique_candidates: CritiqueCandidates,
    video_observations: dict[str, Any],
    *,
    candidate_count: int = 3,
    pass_count: int = 2,
    checkpoint: CheckpointOutput | None = None,
    resume_outputs: list[dict[str, Any]] | None = None,
    evaluate_candidate: EvaluateCandidate | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    candidate_count = max(1, min(5, candidate_count))
    pass_count = max(1, min(4, pass_count))
    candidates: list[dict[str, Any]] = []
    raw_outputs: list[dict[str, Any]] = []
    critic_reports: list[dict[str, Any]] = []
    resumed = {
        key: output
        for output in (resume_outputs or [])
        if isinstance(output, dict) and (key := _checkpoint_key(output)) is not None
    }

    def record(output: dict[str, Any]) -> None:
        raw_outputs.append(output)
        if checkpoint:
            checkpoint(output)

    for index in range(candidate_count):
        instruction = (
            f"Produce independent reconstruction candidate {index + 1} of {candidate_count}. "
            "Measure timing, launch, geometry, colours, gravity and fade from the supplied evidence. "
            "Do not copy assumptions from another candidate."
        )
        candidate_index = len(candidates)
        resumed_output = resumed.get(("candidate", 1, candidate_index))
        if resumed_output and isinstance(resumed_output.get("candidate"), dict):
            candidate = resumed_output["candidate"]
            output = resumed_output
        else:
            candidate, raw = generate_candidate(instruction, None)
            output = {
                "kind": "candidate",
                "pass": 1,
                "candidateIndex": candidate_index,
                "candidate": candidate,
                "response": raw,
            }
        candidates.append(candidate)
        record(output)
        if evaluate_candidate:
            evaluate_candidate(candidate, candidate_index)

    for pass_index in range(2, pass_count + 1):
        resumed_output = resumed.get(("critic", pass_index - 1))
        if resumed_output and isinstance(resumed_output.get("critic"), dict):
            critic = resumed_output["critic"]
            output = resumed_output
        else:
            critic, raw = critique_candidates(candidates, video_observations)
            output = {
                "kind": "critic",
                "pass": pass_index - 1,
                "critic": critic,
                "response": raw,
            }
        critic_reports.append(critic)
        record(output)
        deterministic = [
            score_candidate(candidate, video_observations)["score"]
            for candidate in candidates
        ]
        critic_by_index = {
            int(item["candidateIndex"]): sum(
                float(item[key])
                for key in ("timing", "colour", "geometry", "physics", "fade")
            )
            / 5
            for item in critic.get("candidateScores", [])
            if isinstance(item, dict) and isinstance(item.get("candidateIndex"), int)
        }
        ranked = sorted(
            range(len(candidates)),
            key=lambda index: (
                -(deterministic[index] * 0.68 + critic_by_index.get(index, 0.0) * 0.32),
                index,
            ),
        )
        parents = ranked[: min(2, len(ranked))]
        score_rows = {
            int(row["candidateIndex"]): row
            for row in critic.get("candidateScores", [])
            if isinstance(row, dict)
        }
        for parent_index in parents:
            row = score_rows.get(parent_index, {})
            instruction = (
                f"Refine candidate {parent_index} for reconstruction pass {pass_index}. "
                f"Correct these evidence mismatches: {row.get('issues', [])}. "
                f"Apply this critic instruction: {row.get('improvementInstruction', '')}. "
                "Signed engine deltas are rendered minus source. For an isolated aerial shot, "
                "correct timeOffsetSeconds from launch-onset evidence; canonical lift is observed "
                "burst onset minus that offset. Never use the global visual peak delta as carrier "
                "lift: tune post-burst speed, density, head size, star life and trails instead. "
                "Subtract the fade-relative-to-peak delta from star and trail lifetimes within "
                "their schema bounds. Do not apply one global timing delta across multiple shots. "
                "Return a complete replacement reconstruction, not a patch."
            )
            candidate_index = len(candidates)
            resumed_output = resumed.get(("candidate", pass_index, candidate_index))
            if resumed_output and isinstance(resumed_output.get("candidate"), dict):
                candidate = resumed_output["candidate"]
                output = resumed_output
            else:
                candidate, generated_raw = generate_candidate(
                    instruction,
                    candidates[parent_index],
                )
                output = {
                    "kind": "candidate",
                    "pass": pass_index,
                    "candidateIndex": candidate_index,
                    "parentCandidateIndex": parent_index,
                    "candidate": candidate,
                    "response": generated_raw,
                }
            candidates.append(candidate)
            record(output)
            if evaluate_candidate:
                evaluate_candidate(candidate, candidate_index)

    resumed_output = resumed.get(("critic", pass_count))
    if resumed_output and isinstance(resumed_output.get("critic"), dict):
        final_critic = resumed_output["critic"]
        output = resumed_output
    else:
        final_critic, final_raw = critique_candidates(candidates, video_observations)
        output = {
            "kind": "critic",
            "pass": pass_count,
            "critic": final_critic,
            "response": final_raw,
        }
    critic_reports.append(final_critic)
    record(output)
    critic_by_index = {
        int(item["candidateIndex"]): sum(
            float(item[key])
            for key in ("timing", "colour", "geometry", "physics", "fade")
        )
        / 5
        for item in final_critic.get("candidateScores", [])
        if isinstance(item, dict) and isinstance(item.get("candidateIndex"), int)
    }
    scored = []
    for index, candidate in enumerate(candidates):
        evidence = score_candidate(candidate, video_observations)
        combined = evidence["score"] * 0.72 + critic_by_index.get(index, 0.0) * 0.28
        scored.append(
            {
                "candidateIndex": index,
                "combinedScore": round(combined, 5),
                "evidence": evidence,
            }
        )
    winner = min(scored, key=lambda row: (-row["combinedScore"], row["candidateIndex"]))
    diagnostics = {
        "pipelineVersion": PIPELINE_VERSION,
        "candidateCount": len(candidates),
        "passCount": pass_count,
        "selectedCandidateIndex": winner["candidateIndex"],
        "scores": scored,
        "criticReports": critic_reports,
    }
    return candidates[winner["candidateIndex"]], candidates, raw_outputs, diagnostics


def _clamp(value: Any, minimum: float, maximum: float, fallback: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = fallback
    return max(minimum, min(maximum, numeric))


def _first_present(*values: Any) -> Any:
    return next((value for value in values if value is not None), None)


def _quantise_engine_time_seconds(value: float) -> float:
    return (
        math.floor(float(value) / ENGINE_FIXED_STEP_SECONDS + 0.5 + 1e-12)
        * ENGINE_FIXED_STEP_SECONDS
    )


def _engine_step_count(value: float) -> int:
    return math.floor(float(value) / ENGINE_FIXED_STEP_SECONDS + 0.5 + 1e-12)


def _rgb(value: Any) -> dict[str, float] | str:
    if not isinstance(value, str) or len(value) != 7:
        return "random"
    try:
        return {
            "r": round(int(value[1:3], 16) / 255, 5),
            "g": round(int(value[3:5], 16) / 255, 5),
            "b": round(int(value[5:7], 16) / 255, 5),
        }
    except ValueError:
        return "random"


GEOMETRY_BY_FAMILY = {
    "peony": "sphere",
    "chrysanthemum": "sphere",
    "brocade": "crown",
    "kamuro": "crown",
    "floral": "crown",
    "willow": "weeping",
    "palm": "radial_arms",
    "ring": "ring",
    "saturn": "ring",
    "crossette": "split_cross",
    "double_break": "split_cross",
    "falling_leaves": "falling_tail",
    "horsetail": "falling_tail",
    "comet": "single_tail",
    "mine": "upward_fan",
    "crackle": "fragment_cloud",
    "heart-shell": "heart",
    "outlined-star-shell": "five_point_star",
    "pistil": "pistil",
    "pearls": "pearls",
    "silverFish": "fish",
    "waterfall": "waterfall",
    "whirl": "whirl",
    "bowtie": "bowtie",
    "roman_candle": "roman_candle",
    "fountain": "fountain",
}

TRAIL_BY_FAMILY = {
    "peony": "none",
    "chrysanthemum": "spark",
    "brocade": "glitter",
    "kamuro": "long_hang",
    "willow": "long_hang",
    "falling_leaves": "long_hang",
    "horsetail": "thick_tail",
    "palm": "thick_tail",
    "comet": "thick_tail",
    "crackle": "crackle",
    "strobe": "blink",
    "pearls": "pearls",
    "silverFish": "fish",
    "waterfall": "waterfall",
    "whirl": "whirl",
    "mine": "spray",
    "roman_candle": "thick_tail",
    "fountain": "spray",
}

TRAIL_BY_GEOMETRY = {
    "weeping": "long_hang",
    "radial_arms": "thick_tail",
    "falling_tail": "thick_tail",
    "single_tail": "thick_tail",
    "upward_fan": "spray",
    "fragment_cloud": "crackle",
    "pearls": "pearls",
    "fish": "fish",
    "waterfall": "waterfall",
    "whirl": "whirl",
    "roman_candle": "thick_tail",
    "fountain": "spray",
}

PRESET_BY_FAMILY = {
    "brocade": "denseBrocade",
    "kamuro": "willowHang",
    "willow": "willowHang",
    "falling_leaves": "willowHang",
    "horsetail": "cometTail",
    "palm": "cometTail",
    "comet": "cometTail",
    "crackle": "dragonEgg",
    "ghost": "ghostFade",
    "waterfall": "silverRain",
}

PRESET_BY_TRAIL = {
    "none": "none",
    "long_hang": "willowHang",
    "thick_tail": "cometTail",
    "crackle": "dragonEgg",
    "waterfall": "silverRain",
}

EFFECT_SLUG_BY_FAMILY = {
    "peony": "peony",
    "chrysanthemum": "chrysanthemum",
    "brocade": "brocade",
    "kamuro": "kamuro",
    "ghost": "strobe",
    "strobe": "strobe",
    "palm": "palm",
    "ring": "ring",
    "saturn": "saturn",
    "crossette": "crossette",
    "double_break": "double_break",
    "bowtie": "bowtie",
    "floral": "peony",
    "falling_leaves": "willow",
    "willow": "willow",
    "crackle": "crackle",
    "horsetail": "horsetail",
    "comet": "comet",
    "mine": "mine",
    "pearls": "pearls",
    "pistil": "pistil",
    "nishiki": "nishiki",
    "silverFish": "silverFish",
    "waterfall": "waterfall",
    "whirl": "whirl",
    "roman_candle": "roman_candle",
    "fountain": "fountain",
    "heart-shell": "heart-shell",
    "outlined-star-shell": "outlined-star-shell",
    "custom": "peony",
}


def _renderer_identity(
    shell: dict[str, Any], shot: dict[str, Any]
) -> tuple[str, str, str, dict[str, Any]]:
    family = str(shell.get("family") or "peony")
    geometry = str(
        shot.get("geometry")
        or shell.get("geometry")
        or GEOMETRY_BY_FAMILY.get(family, "")
    )
    effect_slug = str(
        shot.get("effectSlug")
        or shell.get("effectSlug")
        or EFFECT_SLUG_BY_FAMILY.get(family, "")
    )
    trail_profile = str(
        shot.get("trailProfile")
        or shell.get("trailProfile")
        or TRAIL_BY_FAMILY.get(family)
        or TRAIL_BY_GEOMETRY.get(geometry, "spark")
    )
    evidence = shot.get("geometryEvidence")
    if not isinstance(evidence, dict):
        evidence = shell.get("geometryEvidence")
    evidence = evidence if isinstance(evidence, dict) else {}
    if geometry not in ENGINE_GEOMETRIES:
        raise RuntimeError(f"Unsupported renderer geometry '{geometry or family}'")
    if effect_slug not in IMPORT_EFFECT_SLUGS:
        raise RuntimeError(
            f"Unsupported renderer effect slug '{effect_slug or family}'"
        )
    if trail_profile not in ENGINE_TRAIL_PROFILES:
        raise RuntimeError(f"Unsupported renderer trail profile '{trail_profile}'")
    return geometry, effect_slug, trail_profile, evidence


def _geometry_tuning(
    geometry: str,
    evidence: dict[str, Any],
    *,
    emission_duration_seconds: float | None = None,
    emission_peak_count: int | None = None,
) -> dict[str, Any] | None:
    count = _clamp(evidence.get("countPercent"), 1, 200, 88)
    scale_x = _clamp(evidence.get("scaleX"), 0.2, 2.5, 1)
    scale_y = _clamp(evidence.get("scaleY"), 0.2, 2.5, 1)
    depth = _clamp(evidence.get("depthScale"), 0, 1.5, 0.12)
    rotation = _clamp(evidence.get("rotationDegrees"), -180, 180, 0)
    spread = _clamp(evidence.get("spread"), 0, 2, 0.65)
    groups: dict[str, dict[str, Any]] = {
        "ring": {
            "ring": {
                "countPercent": min(100, count),
                "wobble": min(1, depth),
                "verticalSquash": min(1.5, scale_y),
                "tiltVariation": min(3, spread * 1.5),
            }
        },
        "crown": {"crown": {"lift": min(2, scale_y * 0.55), "spread": spread}},
        "weeping": {"weeping": {"lift": min(2, scale_y * 0.35), "spread": spread}},
        "radial_arms": {
            "radialArms": {
                "countPercent": min(100, count),
                "armLength": min(2, scale_x * 0.74),
                "angleJitter": min(1, depth),
            }
        },
        "falling_tail": {
            "fallingTail": {"countPercent": min(100, count), "spread": spread}
        },
        "pearls": {"pearls": {"countPercent": min(100, count), "spread": spread}},
        "fragment_cloud": {"fragmentCloud": {"countPercent": min(100, count)}},
        "heart": {
            "heart": {
                "countPercent": min(100, count),
                "scaleX": scale_x,
                "scaleY": scale_y,
                "depthScale": min(1, depth),
                "rotationDegrees": rotation,
            }
        },
        "five_point_star": {
            "fivePointStar": {
                "countPercent": min(100, count),
                "points": 5,
                "scaleX": scale_x,
                "scaleY": scale_y,
                "depthScale": min(1, depth),
                "rotationDegrees": rotation,
            }
        },
        "bowtie": {
            "bowtie": {
                "countPercent": min(100, count),
                "fanAngleDegrees": 10 + spread / 2 * 170,
                "verticalScale": min(1.5, scale_y),
                "depthScale": depth,
                "lengthBase": min(2, scale_x),
            }
        },
        "fish": {"fish": {"countPercent": count, "verticalScale": min(1.5, scale_y)}},
        "waterfall": {
            "waterfall": {
                "countPercent": count,
                "curtainWidth": min(6, scale_x * 2.2),
                "sideDrift": min(2, spread * 0.45),
                "depthDrift": min(2, depth),
            }
        },
        "whirl": {
            "whirl": {"countPercent": count, "spinStrength": min(10, spread * 3.6)}
        },
        "single_tail": {
            "singleTail": {
                "driftPercent": min(100, spread * 24),
                "riseFactor": min(2, scale_y * 0.55),
            }
        },
        "upward_fan": {
            "upwardFan": {
                "countPercent": count,
                "spreadAngleDegrees": 10 + spread / 2 * 290,
                "depthScale": depth,
            }
        },
        "roman_candle": {
            "romanCandle": {
                "spread": spread,
                "depthScale": depth,
                **(
                    {
                        "shotsPercent": 1,
                        "minShots": max(1, min(60, int(emission_peak_count or 1))),
                        "durationPercent": 100,
                        "durationMinSeconds": _clamp(
                            emission_duration_seconds,
                            0.5,
                            30,
                            3,
                        ),
                        "durationMaxSeconds": _clamp(
                            emission_duration_seconds,
                            1,
                            30,
                            3,
                        ),
                    }
                    if emission_duration_seconds is not None
                    else {}
                ),
            }
        },
        "fountain": {
            "fountain": {
                "coneAngleDegrees": 2 + spread / 2 * 178,
                "lateralScale": min(1.5, scale_x * 0.55),
                **(
                    {
                        "durationPercent": 100,
                        "durationMinSeconds": _clamp(
                            emission_duration_seconds,
                            0.5,
                            30,
                            2.5,
                        ),
                        "durationMaxSeconds": _clamp(
                            emission_duration_seconds,
                            1,
                            30,
                            2.5,
                        ),
                    }
                    if emission_duration_seconds is not None
                    else {}
                ),
            }
        },
    }
    return groups.get(geometry)


def _merge_observed_geometry_evidence(
    model_evidence: dict[str, Any],
    observation: dict[str, Any],
) -> dict[str, Any]:
    shape = observation.get("shapeAtPeak")
    if not isinstance(shape, dict):
        return model_evidence
    confidence = _clamp(shape.get("confidence"), 0, 1, 0)
    if confidence < 0.2:
        return model_evidence
    aspect_ratio = _clamp(shape.get("aspectRatio"), 0.16, 6.25, 1)
    aspect_scale = math.sqrt(aspect_ratio)
    measured = {
        "scaleX": _clamp(aspect_scale, 0.2, 2.5, 1),
        "scaleY": _clamp(1.0 / aspect_scale, 0.2, 2.5, 1),
        "rotationDegrees": _clamp(
            shape.get("majorAxisAngleDegrees"),
            -180,
            180,
            0,
        ),
        "spread": _clamp(
            float(observation.get("spreadAtPeak") or 0.0) * 6.0,
            0,
            2,
            model_evidence.get("spread", 0.65),
        ),
        "confidence": max(
            confidence,
            _clamp(model_evidence.get("confidence"), 0, 1, 0),
        ),
    }
    return {**model_evidence, **measured}


def _canonical_palette(values: Any) -> list[str]:
    output: list[str] = []
    for value in values if isinstance(values, list) else []:
        if not isinstance(value, str) or len(value) != 7:
            continue
        lowered = value.lower()
        try:
            int(lowered[1:], 16)
        except ValueError:
            continue
        if lowered not in output:
            output.append(lowered)
    return output[:12]


def _nearest_burst(
    video_observations: dict[str, Any], burst_time: float
) -> dict[str, Any]:
    bursts = [
        burst
        for burst in video_observations.get("bursts", [])
        if isinstance(burst, dict)
    ]
    if not bursts:
        return {}
    return min(
        bursts,
        key=lambda burst: abs(
            float(burst.get("burstSeconds", burst.get("peakSeconds")) or 0.0)
            - burst_time
        ),
    )


def _aggregate_continuous_ground_observation(
    bursts: list[dict[str, Any]],
    source_duration_seconds: float,
    geometry: str,
) -> dict[str, Any]:
    if not bursts:
        return {}
    emission_times = sorted(
        float(
            _first_present(
                burst.get("burstSeconds"),
                burst.get("peakSeconds"),
                burst.get("launchSeconds"),
                0.0,
            )
        )
        for burst in bursts
    )
    first_emission_seconds = emission_times[0]
    end_seconds = max(
        float(
            _first_present(
                burst.get("endSeconds"),
                burst.get("peakSeconds"),
                burst.get("burstSeconds"),
                first_emission_seconds,
            )
        )
        for burst in bursts
    )
    end_seconds = min(
        max(first_emission_seconds, float(source_duration_seconds)),
        max(first_emission_seconds, end_seconds),
    )
    particle_fade_seconds = statistics.median(
        max(
            0.1,
            float(
                _first_present(
                    burst.get("fadeSeconds"),
                    float(
                        _first_present(
                            burst.get("endSeconds"),
                            burst.get("burstSeconds"),
                            first_emission_seconds,
                        )
                    )
                    - float(
                        _first_present(
                            burst.get("burstSeconds"),
                            burst.get("peakSeconds"),
                            first_emission_seconds,
                        )
                    ),
                    0.1,
                )
            ),
        )
        for burst in bursts
    )
    cadence_reachable = True
    cadence_error_seconds = 0.0
    if geometry == "roman_candle" and len(emission_times) > 1:
        intervals = [
            right - left for left, right in zip(emission_times, emission_times[1:])
        ]
        emission_interval_seconds = statistics.median(intervals)
        emission_duration_seconds = emission_interval_seconds * len(emission_times)
        ideal_cue_start_seconds = (
            first_emission_seconds - emission_interval_seconds * 0.5
        )
        cue_start_seconds = max(0.0, ideal_cue_start_seconds)
        predicted = [
            cue_start_seconds
            + (index + 0.5) * emission_duration_seconds / len(emission_times)
            for index in range(len(emission_times))
        ]
        cadence_error_seconds = max(
            abs(actual - expected)
            for actual, expected in zip(emission_times, predicted, strict=True)
        )
        cadence_reachable = (
            ideal_cue_start_seconds >= 0
            and 0 < emission_interval_seconds
            and len(emission_times) <= 60
            and 1 <= emission_duration_seconds <= 30
            and cadence_error_seconds <= max(ENGINE_FIXED_STEP_SECONDS, 0.08)
        )
    elif geometry == "roman_candle":
        emission_duration_seconds = max(1.0, particle_fade_seconds)
        ideal_cue_start_seconds = (
            first_emission_seconds - emission_duration_seconds * 0.5
        )
        cue_start_seconds = max(0.0, ideal_cue_start_seconds)
        cadence_error_seconds = abs(
            first_emission_seconds
            - (cue_start_seconds + emission_duration_seconds * 0.5)
        )
        cadence_reachable = (
            ideal_cue_start_seconds >= 0
            and 1 <= emission_duration_seconds <= 30
            and cadence_error_seconds <= ENGINE_FIXED_STEP_SECONDS
        )
    else:
        cue_start_seconds = min(
            float(
                _first_present(
                    burst.get("launchSeconds"),
                    burst.get("burstSeconds"),
                    burst.get("peakSeconds"),
                    first_emission_seconds,
                )
            )
            for burst in bursts
        )
        emission_duration_seconds = max(0.5, end_seconds - cue_start_seconds)
        cadence_reachable = 1 <= emission_duration_seconds <= 30
    strongest = max(
        bursts,
        key=lambda burst: (
            float(burst.get("peakIntensity") or 0.0),
            float(burst.get("confidence") or 0.0),
        ),
    )
    colour_weights: dict[str, float] = {}
    for burst in bursts:
        for colour in burst.get("colours", []):
            if not isinstance(colour, dict) or not isinstance(colour.get("hex"), str):
                continue
            colour_hex = colour["hex"].lower()
            colour_weights[colour_hex] = colour_weights.get(colour_hex, 0.0) + float(
                colour.get("weight") or 0.0
            )
    total_colour_weight = sum(colour_weights.values()) or 1.0
    return {
        **strongest,
        "launchSeconds": cue_start_seconds,
        "burstSeconds": first_emission_seconds,
        "peakSeconds": float(
            _first_present(strongest.get("peakSeconds"), first_emission_seconds)
        ),
        "endSeconds": end_seconds,
        "liftSeconds": 0.0,
        "fadeSeconds": particle_fade_seconds,
        "emissionDurationSeconds": emission_duration_seconds,
        "emissionTimesSeconds": emission_times,
        "emissionCadenceReachable": cadence_reachable,
        "emissionCadenceErrorSeconds": cadence_error_seconds,
        "spreadAtPeak": max(
            float(burst.get("spreadAtPeak") or 0.0) for burst in bursts
        ),
        "confidence": sum(float(burst.get("confidence") or 0.0) for burst in bursts)
        / len(bursts),
        "colours": [
            {"hex": colour, "weight": round(weight / total_colour_weight, 5)}
            for colour, weight in sorted(
                colour_weights.items(),
                key=lambda item: (-item[1], item[0]),
            )[:12]
        ],
        "sequencePeakCount": len(bursts),
        "launchTrajectory": None,
    }


def _ground_event_time(value: dict[str, Any]) -> float:
    return float(
        _first_present(
            value.get("launchSeconds"),
            value.get("timeOffsetSeconds"),
            value.get("burstSeconds"),
            value.get("burstTimeSeconds"),
            value.get("peakSeconds"),
            0.0,
        )
    )


def _group_continuous_ground_activations(
    shots: list[dict[str, Any]],
    bursts: list[dict[str, Any]],
    source_duration_seconds: float,
    geometry: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Aggregate one physical activation without erasing separate positions."""

    if not shots:
        return [], []
    observations_by_shot: dict[int, list[dict[str, Any]]] = {
        index: [] for index in range(len(shots))
    }
    assignment_exact = len(shots) == 1 or len(bursts) == len(shots)
    if len(shots) == 1:
        observations_by_shot[0].extend(bursts)
    elif len(bursts) == len(shots):
        for index, burst in enumerate(bursts):
            observations_by_shot[index].append(burst)
    else:
        for burst in bursts:
            nearest_index = min(
                range(len(shots)),
                key=lambda index: abs(
                    _ground_event_time(shots[index]) - _ground_event_time(burst)
                ),
            )
            observations_by_shot[nearest_index].append(burst)

    grouped_shots: list[dict[str, Any]] = []
    grouped_observations: list[dict[str, Any]] = []
    for index, shot in enumerate(shots):
        observations = observations_by_shot[index]
        grouped_shots.append(dict(shot))
        grouped_observation = (
            _aggregate_continuous_ground_observation(
                observations,
                source_duration_seconds,
                geometry,
            )
            if observations
            else {}
        )
        grouped_observations.append(
            {
                **grouped_observation,
                "activationAssignmentExact": assignment_exact,
            }
        )
    return grouped_shots, grouped_observations


def _renderer_tuning(
    shell: dict[str, Any],
    shot: dict[str, Any],
) -> dict[str, Any]:
    shell_tuning = (
        shell.get("rendererTuning")
        if isinstance(shell.get("rendererTuning"), dict)
        else {}
    )
    shot_tuning = (
        shot.get("rendererTuning")
        if isinstance(shot.get("rendererTuning"), dict)
        else {}
    )
    return {
        key: value
        for key, value in {**shell_tuning, **shot_tuning}.items()
        if key in RENDERER_TUNING_PROPERTIES and value is not None
    }


def _tuned_number(
    tuning: dict[str, Any],
    key: str,
    minimum: float,
    maximum: float,
    fallback: float,
) -> float:
    if key not in tuning:
        return _clamp(fallback, minimum, maximum, fallback)
    return _clamp(tuning[key], minimum, maximum, fallback)


def _ordered_tuned_range(
    tuning: dict[str, Any],
    minimum_key: str,
    maximum_key: str,
    minimum: float,
    maximum: float,
    fallback: tuple[float, float],
) -> list[float]:
    first = _tuned_number(tuning, minimum_key, minimum, maximum, fallback[0])
    second = _tuned_number(tuning, maximum_key, minimum, maximum, fallback[1])
    return [round(min(first, second), 4), round(max(first, second), 4)]


ENGINE_FIXED_STEP_SECONDS = 1 / 60
ENGINE_SHELL_DRAG_K = 0.5 * 0.47 * 1.22 * (math.pi / 10_000)
ENGINE_SHELL_MASS = 0.5
ENGINE_GRAVITY = 9.82
MIN_ENGINE_LIFT_VELOCITY = 4.0
MAX_ENGINE_LIFT_VELOCITY = 40.0
SHELL_APEX_SURVIVAL_MARGIN_SECONDS = 0.5
MIN_PROVISIONAL_RENDERER_DURATION_SECONDS = 8.0
PROVISIONAL_RENDERER_TAIL_HEADROOM_SECONDS = 6.0


def estimate_engine_lift_time_seconds(
    lift_velocity: float,
    shell_life_seconds: float,
    *,
    pan_degrees: float = 0.0,
) -> float:
    """Mirror the engine's fixed-step shell ascent until its apex."""

    pan_radians = math.radians(_clamp(pan_degrees, -30, 30, 0))
    vertical_factor = max(0.82, math.cos(pan_radians) * 0.96)
    velocity_y = max(0.0, float(lift_velocity)) * vertical_factor
    elapsed = 0.0
    life_limit = _clamp(shell_life_seconds, 0, 60, 60)
    while velocity_y > 0 and elapsed < life_limit:
        drag_acceleration_y = (
            -ENGINE_SHELL_DRAG_K * velocity_y * abs(velocity_y)
        ) / ENGINE_SHELL_MASS
        drag_velocity = velocity_y + drag_acceleration_y * ENGINE_FIXED_STEP_SECONDS
        if velocity_y != 0 and math.copysign(1, drag_velocity) != math.copysign(
            1, velocity_y
        ):
            drag_velocity = 0
        velocity_y = drag_velocity - ENGINE_GRAVITY * ENGINE_FIXED_STEP_SECONDS
        elapsed += ENGINE_FIXED_STEP_SECONDS
    return elapsed


def solve_engine_lift_velocity(
    target_seconds: float,
    *,
    pan_degrees: float = 0.0,
) -> float:
    """Invert fixed-step ascent so the rendered apex matches the measured burst."""

    target = _clamp(target_seconds, 0.05, 20, 1.15)
    shell_life = min(
        60.0,
        max(2.0, target + SHELL_APEX_SURVIVAL_MARGIN_SECONDS),
    )
    minimum_duration = estimate_engine_lift_time_seconds(
        MIN_ENGINE_LIFT_VELOCITY,
        shell_life,
        pan_degrees=pan_degrees,
    )
    maximum_duration = estimate_engine_lift_time_seconds(
        MAX_ENGINE_LIFT_VELOCITY,
        shell_life,
        pan_degrees=pan_degrees,
    )
    minimum_steps = _engine_step_count(minimum_duration)
    maximum_steps = _engine_step_count(maximum_duration)
    target_steps = _engine_step_count(target)
    bounded_target_steps = max(minimum_steps, min(maximum_steps, target_steps))
    if bounded_target_steps == minimum_steps:
        return MIN_ENGINE_LIFT_VELOCITY
    low = MIN_ENGINE_LIFT_VELOCITY
    high = MAX_ENGINE_LIFT_VELOCITY
    for _iteration in range(28):
        midpoint = (low + high) / 2
        duration = estimate_engine_lift_time_seconds(
            midpoint,
            shell_life,
            pan_degrees=pan_degrees,
        )
        duration_steps = _engine_step_count(duration)
        if duration_steps < bounded_target_steps:
            low = midpoint
        else:
            high = midpoint
    # Preserve the first velocity that reaches the target step. Rounding the
    # midpoint down can move the burst one fixed frame early at a step boundary.
    return math.ceil(high * 10_000) / 10_000


def _engine_apex_displacement_angle_degrees(
    lift_velocity: float,
    pan_degrees: float,
    *,
    lateral_limit: float,
) -> float:
    """Simulate the imported carrier's world-space angle at detonation."""

    pan_radians = math.radians(_clamp(pan_degrees, -30, 30, 0))
    velocity_x = math.sin(pan_radians) * max(1.2, lift_velocity * 0.62)
    velocity_y = lift_velocity * max(0.82, math.cos(pan_radians) * 0.96)
    position_x = 0.0
    position_y = 0.0
    while velocity_y > 0:
        drag_x = (-ENGINE_SHELL_DRAG_K * velocity_x * abs(velocity_x)) / (
            ENGINE_SHELL_MASS
        )
        drag_y = (-ENGINE_SHELL_DRAG_K * velocity_y * abs(velocity_y)) / (
            ENGINE_SHELL_MASS
        )
        next_x = velocity_x + drag_x * ENGINE_FIXED_STEP_SECONDS
        next_y = velocity_y + drag_y * ENGINE_FIXED_STEP_SECONDS
        if velocity_x and math.copysign(1, next_x) != math.copysign(1, velocity_x):
            next_x = 0.0
        if velocity_y and math.copysign(1, next_y) != math.copysign(1, velocity_y):
            next_y = 0.0
        velocity_x = max(-lateral_limit, min(lateral_limit, next_x))
        velocity_y = max(-4.0, next_y - ENGINE_GRAVITY * ENGINE_FIXED_STEP_SECONDS)
        position_x += velocity_x * ENGINE_FIXED_STEP_SECONDS * 100
        position_y += velocity_y * ENGINE_FIXED_STEP_SECONDS * 100
    return math.degrees(math.atan2(position_x, max(1.0, position_y)))


def _pan_for_observed_trajectory(
    target_angle_degrees: float,
    target_lift_seconds: float,
    *,
    lateral_limit: float,
) -> int:
    direction = -1 if target_angle_degrees < 0 else 1
    target = abs(_clamp(target_angle_degrees, -89, 89, 0))

    def angle_for(pan: float) -> float:
        signed_pan = direction * pan
        lift_velocity = solve_engine_lift_velocity(
            target_lift_seconds,
            pan_degrees=signed_pan,
        )
        return abs(
            _engine_apex_displacement_angle_degrees(
                lift_velocity,
                signed_pan,
                lateral_limit=lateral_limit,
            )
        )

    if target <= 0:
        return 0
    if target >= angle_for(30):
        return direction * 30
    low = 0.0
    high = 30.0
    for _iteration in range(16):
        midpoint = (low + high) / 2
        if angle_for(midpoint) < target:
            low = midpoint
        else:
            high = midpoint
    candidate_pans = {
        max(0, min(30, round(value) + offset))
        for value in (low, high)
        for offset in (-1, 0, 1)
    }
    best = min(candidate_pans, key=lambda pan: (abs(angle_for(pan) - target), pan))
    return direction * best


def _observed_launch_screen_angle_degrees(
    launch_trajectory: dict[str, Any],
) -> float | None:
    launch_points = (
        launch_trajectory.get("points")
        if isinstance(launch_trajectory.get("points"), list)
        else []
    )
    confidence = _clamp(launch_trajectory.get("confidence"), 0, 1, 0)
    if len(launch_points) < 2 or confidence < 0.35:
        return None
    delta_x = float(launch_points[-1].get("x") or 0.0) - float(
        launch_points[0].get("x") or 0.0
    )
    delta_y = float(launch_points[0].get("y") or 0.0) - float(
        launch_points[-1].get("y") or 0.0
    )
    aspect_ratio = _clamp(
        launch_trajectory.get("frameAspectRatio"),
        0.2,
        5,
        1,
    )
    return math.degrees(math.atan2(delta_x * aspect_ratio, max(0.001, abs(delta_y))))


def _renderer_pan_degrees(
    shot: dict[str, Any],
    launch: dict[str, Any],
    observation: dict[str, Any],
    tuning: dict[str, Any],
    target_lift_seconds: float,
    *,
    is_ground_emitter: bool,
) -> int:
    if is_ground_emitter:
        return 0
    if tuning.get("panDegrees") is not None:
        return round(_clamp(tuning["panDegrees"], -30, 30, 0))
    launch_trajectory = (
        observation.get("launchTrajectory")
        if isinstance(observation.get("launchTrajectory"), dict)
        else {}
    )
    screen_angle = _observed_launch_screen_angle_degrees(launch_trajectory)
    observed_pan = None
    if screen_angle is not None:
        observed_pan = _pan_for_observed_trajectory(
            screen_angle,
            target_lift_seconds,
            lateral_limit=6.0 if launch.get("enabled", True) else 18.0,
        )
    return round(
        _clamp(
            observed_pan
            if observed_pan is not None
            else _first_present(shot.get("panDegrees"), launch.get("panDegrees")),
            -30,
            30,
            0,
        )
    )


def _target_engine_lift_time_seconds(
    shot: dict[str, Any],
    launch: dict[str, Any],
    observation: dict[str, Any],
    tuning: dict[str, Any],
    *,
    is_ground_emitter: bool,
) -> float:
    if is_ground_emitter:
        return 0.0
    observed_lift_time = observation.get("liftSeconds")
    if isinstance(observed_lift_time, (int, float)) and not isinstance(
        observed_lift_time, bool
    ):
        return _clamp(observed_lift_time, 0.05, 20, 1.15)
    measured_lift_time = _clamp(
        _first_present(shot.get("liftTimeSeconds"), launch.get("liftTimeSeconds")),
        0.05,
        20,
        1.15,
    )
    if "liftTimeSeconds" not in tuning:
        return measured_lift_time
    return _clamp(tuning["liftTimeSeconds"], 0.35, 3.9, measured_lift_time)


def renderer_design_from_spec(
    spec: dict[str, Any], shot: dict[str, Any], observation: dict[str, Any]
) -> dict[str, Any]:
    effect = spec.get("effectSpec") if isinstance(spec.get("effectSpec"), dict) else {}
    shell = effect.get("shell") if isinstance(effect.get("shell"), dict) else {}
    launch = effect.get("launch") if isinstance(effect.get("launch"), dict) else {}
    family = str(shell.get("family") or "peony")
    tuning = _renderer_tuning(shell, shot)
    geometry, effect_slug, trail_profile, geometry_evidence = _renderer_identity(
        shell, shot
    )
    geometry_evidence = _merge_observed_geometry_evidence(
        geometry_evidence,
        observation,
    )
    is_ground_emitter = geometry in {"upward_fan", "roman_candle", "fountain"}
    colours = (
        shot.get("colorPalette")
        if isinstance(shot.get("colorPalette"), list)
        else effect.get("colorPalette", [])
    )
    primary = (
        tuning.get("headColour")
        or shot.get("color")
        or shell.get("color")
        or (colours[0] if colours else None)
    )
    secondary = (
        tuning.get("trailColour")
        or shell.get("secondColor")
        or (colours[1] if len(colours) > 1 else None)
    )
    lift_time = _target_engine_lift_time_seconds(
        shot,
        launch,
        observation,
        tuning,
        is_ground_emitter=is_ground_emitter,
    )
    pan_degrees = _renderer_pan_degrees(
        shot,
        launch,
        observation,
        tuning,
        lift_time,
        is_ground_emitter=is_ground_emitter,
    )
    fade_seconds = _clamp(
        observation.get("fadeSeconds"),
        0.15,
        30,
        max(0.5, float(spec.get("durationSeconds") or 3) - lift_time),
    )
    spread = _clamp(observation.get("spreadAtPeak"), 0.005, 0.5, 0.12)
    trajectory = (
        observation.get("trajectory")
        if isinstance(observation.get("trajectory"), dict)
        else {}
    )
    measured_gravity = abs(_clamp(trajectory.get("normalisedGravity"), -8, 8, 0.7))
    gravity = -_clamp(0.06 + measured_gravity * 0.22, 0.05, 1.6, 0.22)
    burst_speed = _clamp(1.2 + spread * 32, 0.5, 14, 4)
    trail_enabled = trail_profile != "none"
    is_strobe = effect_slug == "strobe" or trail_profile == "blink"
    is_crackle = effect_slug == "crackle" or trail_profile == "crackle"
    launch_colour = (
        tuning.get("launchHeadColour")
        or observation.get("launchColour")
        or launch.get("tracerColor")
        or primary
    )
    launch_trail_colour = (
        tuning.get("launchTrailColour")
        or observation.get("launchColour")
        or launch.get("tailColor")
        or primary
    )
    star_count = round(
        _tuned_number(
            tuning,
            "starCount",
            1,
            100,
            _clamp(
                float(shell.get("size") or 3)
                * float(shell.get("starDensity") or 1)
                * 22,
                1,
                100,
                72,
            ),
        )
    )
    speed_range = _ordered_tuned_range(
        tuning,
        "burstSpeedMin",
        "burstSpeedMax",
        0,
        20,
        (burst_speed * 0.82, burst_speed * 1.18),
    )
    gravity_range = _ordered_tuned_range(
        tuning,
        "gravityMin",
        "gravityMax",
        -2,
        1,
        (gravity * 1.2, gravity * 0.8),
    )
    life_range = _ordered_tuned_range(
        tuning,
        "starLifeMinSeconds",
        "starLifeMaxSeconds",
        0.05,
        30,
        (fade_seconds * 0.72, fade_seconds * 1.18),
    )
    burst = {
        "speed": speed_range,
        "gravity": gravity_range,
        "life": life_range,
        "airResistancePercent": round(
            _tuned_number(tuning, "airResistancePercent", 0, 300, 100),
            4,
        ),
        "terminalVelocity": round(
            _tuned_number(tuning, "terminalVelocity", 0, 18, 18),
            4,
        ),
        "flairColorMode": "mixed" if secondary else "bombColor",
    }
    burst_trail = {
        "version": 2,
        "enabled": trail_enabled,
        "preset": PRESET_BY_FAMILY.get(
            family,
            PRESET_BY_TRAIL.get(
                trail_profile, "sparkDust" if trail_enabled else "none"
            ),
        ),
        "colourMode": "starFade" if secondary else "star",
        "particlesPerStar": round(
            _tuned_number(
                tuning,
                "trailParticlesPerStar",
                0,
                2_000,
                _clamp(float(shell.get("starDensity") or 1) * 72, 0, 2_000, 72),
            )
        ),
        "lifetime": {
            "mode": "fixed",
            "percent": round(
                _clamp(fade_seconds / max(0.1, lift_time + fade_seconds), 0, 2, 0.4), 2
            ),
            "baseSeconds": round(
                _tuned_number(
                    tuning,
                    "trailLifetimeBaseSeconds",
                    0.05,
                    8,
                    _clamp(fade_seconds * 0.7, 0.05, 8, 1),
                ),
                4,
            ),
            "variationPercent": round(
                _tuned_number(
                    tuning,
                    "trailLifetimeVariationPercent",
                    0,
                    100,
                    22,
                ),
                4,
            ),
            "afterglowSeconds": round(
                _tuned_number(
                    tuning,
                    "trailAfterglowSeconds",
                    0,
                    6,
                    _clamp(fade_seconds * 0.08, 0, 6, 0.2),
                ),
                4,
            ),
        },
        "intensity": {
            "brightness": round(
                _tuned_number(tuning, "trailBrightness", 0, 3, 1),
                4,
            ),
            "fadeSoftness": round(
                _tuned_number(tuning, "trailFadeSoftness", 0.2, 4, 1),
                4,
            ),
        },
        "motion": {
            "gravity": round(
                _tuned_number(
                    tuning,
                    "trailGravity",
                    -2,
                    1,
                    _clamp(gravity * 0.22, -2, 1, -0.04),
                ),
                4,
            ),
            "drag": round(_tuned_number(tuning, "trailDrag", 0, 6, 1.4), 4),
            "inheritedVelocity": round(
                _tuned_number(
                    tuning,
                    "trailInheritedVelocity",
                    0,
                    1,
                    0.04,
                ),
                4,
            ),
            "turbulence": round(
                _tuned_number(tuning, "trailTurbulence", 0, 2, 0.04),
                4,
            ),
            "driftX": 0,
            "driftY": -0.012,
            "driftZ": 0,
            "spin": 0,
        },
    }
    lift_velocity = (
        0.0
        if is_ground_emitter
        else solve_engine_lift_velocity(lift_time, pan_degrees=pan_degrees)
    )
    if is_ground_emitter:
        ground_emission_duration = (
            _clamp(
                observation.get("emissionDurationSeconds"),
                0.5,
                30,
                fade_seconds,
            )
            if geometry in {"roman_candle", "fountain"}
            else fade_seconds
        )
        shell_life = _tuned_number(
            tuning,
            "shellLifeSeconds",
            2,
            60,
            _clamp(ground_emission_duration, 2, 60, 2),
        )
    else:
        rendered_lift_time = estimate_engine_lift_time_seconds(
            lift_velocity,
            60,
            pan_degrees=pan_degrees,
        )
        minimum_shell_life = min(
            60.0,
            max(
                2.0,
                lift_time + SHELL_APEX_SURVIVAL_MARGIN_SECONDS,
                rendered_lift_time + SHELL_APEX_SURVIVAL_MARGIN_SECONDS,
            ),
        )
        shell_life = max(
            minimum_shell_life,
            _tuned_number(
                tuning,
                "shellLifeSeconds",
                2,
                60,
                minimum_shell_life,
            ),
        )
    design = {
        "colour": {"enabled": True},
        "color": _rgb(primary),
        "secondaryColorRatio": 0.24 if secondary else 0,
        "liftVelocity": round(lift_velocity, 4),
        "shellLife": round(shell_life, 4),
        "pattern": "strobe" if is_strobe else "fibonacci",
        "geometry": geometry,
        "trailProfile": trail_profile,
        "stars": {
            "outer": {
                "enabled": True,
                "count": star_count,
                "color": _rgb(primary),
                "burst": burst,
                "burstTrail": burst_trail,
                "head": {
                    "visible": True,
                    "size": round(
                        _tuned_number(tuning, "headSize", 10, 1000, 360),
                        4,
                    ),
                },
            },
            "core": {
                "enabled": bool(shell.get("pistil")),
                "count": max(1, round(star_count * 0.38)),
                "color": _rgb(shell.get("pistilColor") or secondary or primary),
            },
        },
        "launch": {
            "shell": {
                "visible": bool(launch.get("enabled", True)) and not is_ground_emitter,
                "colour": _rgb(launch_colour),
                "brightness": 1.15,
            },
            "liftParticles": {
                "appearanceMode": "custom",
                "enabled": bool(launch.get("enabled", True)) and not is_ground_emitter,
                "amount": round(
                    _clamp(
                        35 + float(shell.get("smokeAmount") or 0.28) * 140, 0, 1_000, 74
                    )
                ),
                "colour": _rgb(launch_trail_colour),
                "height": 100,
                "lifetime": {
                    "baseSeconds": round(_clamp(lift_time * 0.75, 0.1, 8, 0.8), 3),
                    "variationPercent": 28,
                    "afterglowSeconds": 0.12,
                },
            },
            "smoke": {
                "enabled": float(shell.get("smokeAmount") or 0.0) > 0.02,
                "particles": round(
                    _clamp(float(shell.get("smokeAmount") or 0.28) * 180, 0, 500, 50)
                ),
                "opacity": round(
                    _clamp(float(shell.get("smokeAmount") or 0.28), 0, 1, 0.28), 3
                ),
            },
        },
        "crackle": {"enabled": is_crackle},
        "strobe": {
            "enabled": is_strobe,
            "frequencyHz": 12,
            "dutyCycle": 0.45,
            "amountPercent": 100,
        },
        "split": {"enabled": geometry == "split_cross"},
    }
    geometry_tuning = _geometry_tuning(
        geometry,
        geometry_evidence,
        emission_duration_seconds=(
            _clamp(
                observation.get("emissionDurationSeconds"),
                0.5,
                30,
                fade_seconds,
            )
            if geometry in {"roman_candle", "fountain"}
            else None
        ),
        emission_peak_count=(
            int(observation.get("sequencePeakCount") or 1)
            if geometry == "roman_candle"
            else None
        ),
    )
    if geometry_tuning:
        design["geometryTuning"] = geometry_tuning
    if secondary:
        design["secondaryColor"] = _rgb(secondary)
        burst_trail["closing"] = {
            "colour": {
                "enabled": True,
                "color": _rgb(secondary),
                "fadePercent": 22,
            }
        }
    return design


def build_renderer_reconstruction(
    spec: dict[str, Any],
    video_observations: dict[str, Any],
    audio_observations: dict[str, Any],
    diagnostics: dict[str, Any],
) -> dict[str, Any]:
    effect = spec.get("effectSpec") if isinstance(spec.get("effectSpec"), dict) else {}
    launch = effect.get("launch") if isinstance(effect.get("launch"), dict) else {}
    duration = _clamp(
        video_observations.get("durationSeconds") or spec.get("durationSeconds"),
        0.1,
        60,
        3,
    )
    shell = effect.get("shell") if isinstance(effect.get("shell"), dict) else {}
    shots = effect.get("shots") if isinstance(effect.get("shots"), list) else []
    if not shots:
        shots = [
            {
                "index": 0,
                "timeOffsetSeconds": 0,
                "liftTimeSeconds": launch.get("liftTimeSeconds", 1.15),
            }
        ]
    shot_geometries = {
        str(
            shot.get("geometry")
            or shell.get("geometry")
            or shell.get("family")
            or effect.get("type")
            or ""
        )
        for shot in shots
        if isinstance(shot, dict)
    }
    continuous_ground_emitter = len(shot_geometries) == 1 and next(
        iter(shot_geometries), ""
    ) in {"roman_candle", "fountain"}
    continuous_ground_geometry = (
        next(iter(shot_geometries)) if continuous_ground_emitter else None
    )
    designs: list[dict[str, Any]] = []
    design_key_by_signature: dict[str, str] = {}
    renderer_shots: list[dict[str, Any]] = []
    mapping_unknowns: list[str] = []
    observed_bursts = [
        burst
        for burst in video_observations.get("bursts", [])
        if isinstance(burst, dict)
    ]
    if continuous_ground_emitter:
        shots, observed_bursts = _group_continuous_ground_activations(
            [shot for shot in shots if isinstance(shot, dict)],
            observed_bursts,
            duration,
            str(continuous_ground_geometry),
        )
    unused_burst_indexes = set(range(len(observed_bursts)))
    for index, shot in enumerate(shots):
        if not isinstance(shot, dict):
            continue
        model_lift_time = _clamp(
            _first_present(
                shot.get("liftTimeSeconds"),
                launch.get("liftTimeSeconds"),
            ),
            0,
            20,
            0,
        )
        model_fire_time = _clamp(shot.get("timeOffsetSeconds"), 0, duration, 0)
        model_burst_time = _clamp(
            _first_present(
                shot.get("burstTimeSeconds"),
                model_fire_time + model_lift_time,
            ),
            model_fire_time,
            duration,
            model_fire_time,
        )
        if len(observed_bursts) == len(shots) and index < len(observed_bursts):
            observation_index = index
        elif unused_burst_indexes:
            observation_index = min(
                unused_burst_indexes,
                key=lambda candidate_index: abs(
                    float(
                        observed_bursts[candidate_index].get(
                            "burstSeconds",
                            observed_bursts[candidate_index].get("peakSeconds", 0),
                        )
                    )
                    - model_burst_time
                ),
            )
        else:
            observation_index = None
        observation = (
            observed_bursts[observation_index] if observation_index is not None else {}
        )
        if observation_index is not None:
            unused_burst_indexes.discard(observation_index)
        observed_burst_time = _clamp(
            _first_present(
                observation.get("burstSeconds"),
                observation.get("peakSeconds"),
            ),
            0,
            duration,
            model_burst_time,
        )
        observed_launch_time = observation.get("launchSeconds")
        source_fire_time = _clamp(
            observed_launch_time, 0, observed_burst_time, model_fire_time
        )
        shot_geometry, _effect_slug, _trail_profile, _geometry_evidence = (
            _renderer_identity(shell, shot)
        )
        is_ground_emitter = shot_geometry in {
            "upward_fan",
            "roman_candle",
            "fountain",
        }
        requested_fire_time = source_fire_time
        if not is_ground_emitter:
            # Aerial cue time is the only hidden pre-roll control. The observed
            # burst remains authoritative and the mapper derives lift from the
            # remaining interval, so conflicting model tuning cannot move the
            # engine apex away from source evidence.
            requested_fire_time = min(source_fire_time, model_fire_time)
        requested_fire_time = _clamp(
            requested_fire_time,
            0,
            observed_burst_time,
            source_fire_time,
        )
        fire_time = _quantise_engine_time_seconds(requested_fire_time)
        if fire_time > min(requested_fire_time, observed_burst_time):
            fire_time = (
                math.floor(
                    (min(requested_fire_time, observed_burst_time) + 1e-9)
                    / ENGINE_FIXED_STEP_SECONDS
                )
                * ENGINE_FIXED_STEP_SECONDS
            )
        fire_time = _clamp(
            fire_time,
            0,
            min(requested_fire_time, observed_burst_time),
            requested_fire_time,
        )
        burst_time = max(fire_time, observed_burst_time)
        lift_time = _clamp(
            burst_time - fire_time,
            0,
            20,
            burst_time - fire_time if burst_time > fire_time else model_lift_time,
        )
        renderer_observation = {**observation, "liftSeconds": lift_time}
        model_palette = _canonical_palette(
            shot.get("colorPalette")
            if isinstance(shot.get("colorPalette"), list)
            else effect.get("colorPalette", [])
        )
        observed_palette = _canonical_palette(
            [
                colour.get("hex")
                for colour in observation.get("colours", [])
                if isinstance(colour, dict)
            ]
        )
        palette = observed_palette or model_palette
        if not palette:
            palette = ["#ffffff"]
        observed_design_duration = _clamp(
            float(
                observation.get("endSeconds")
                or burst_time
                + max(0.1, float(spec.get("durationSeconds") or 3) - lift_time)
            )
            - fire_time,
            0.1,
            60,
            3,
        )
        design_duration = min(
            max(0.1, 60.0 - fire_time),
            max(
                MIN_PROVISIONAL_RENDERER_DURATION_SECONDS,
                observed_design_duration + PROVISIONAL_RENDERER_TAIL_HEADROOM_SECONDS,
            ),
        )
        design_height = _clamp(
            shot.get("heightMeters")
            or launch.get("heightMeters")
            or effect.get("heightMeters"),
            0,
            220,
            60,
        )
        renderer_shot = {
            **shot,
            "colorPalette": palette,
            "color": palette[0],
        }
        _geometry, effect_slug, _trail_profile, _geometry_evidence = _renderer_identity(
            shell,
            renderer_shot,
        )
        if (
            _geometry == "roman_candle"
            and renderer_observation.get("emissionCadenceReachable") is False
        ):
            mapping_unknowns.append(
                "Engine limit: the observed Roman candle cadence cannot be represented "
                "by one regular half-interval engine sequence without pre-roll or timing error."
            )
        if (
            _geometry == "fountain"
            and renderer_observation.get("emissionCadenceReachable") is False
        ):
            mapping_unknowns.append(
                "Engine limit: the observed fountain emission window is outside the "
                "renderer-supported 1 to 30 second range."
            )
        if (
            _geometry in {"roman_candle", "fountain"}
            and renderer_observation.get("activationAssignmentExact") is False
        ):
            mapping_unknowns.append(
                "Engine limit: separately activated ground-emitter observations "
                "could not be assigned one-to-one to the model's activation cues."
            )
        design_value = renderer_design_from_spec(
            spec,
            renderer_shot,
            renderer_observation,
        )
        signature_value = {
            "effectSlug": effect_slug,
            "durationSeconds": round(design_duration, 4),
            "heightMeters": round(design_height, 4),
            "caliber": None,
            "colorPalette": palette,
            "design": design_value,
        }
        signature = json.dumps(signature_value, sort_keys=True, separators=(",", ":"))
        design_id = design_key_by_signature.get(signature)
        if design_id is None:
            if len(designs) >= 64:
                raise RuntimeError(
                    "Reconstruction contains more than 64 distinct renderer designs; split the source or refine the reconstruction"
                )
            design_id = f"design-{len(designs) + 1:03d}"
            design_key_by_signature[signature] = design_id
            designs.append(
                {
                    "key": design_id,
                    "label": f"{spec.get('name') or 'Imported firework'} shot {index + 1}",
                    "confidence": _clamp(
                        observation.get("confidence"), 0, 1, spec.get("confidence", 0.5)
                    ),
                    **signature_value,
                }
            )
        raw_position = (
            shot.get("position") if isinstance(shot.get("position"), dict) else {}
        )
        tuning = _renderer_tuning(shell, renderer_shot)
        is_ground_emitter = _geometry in {
            "upward_fan",
            "roman_candle",
            "fountain",
        }
        target_lift_time = _target_engine_lift_time_seconds(
            renderer_shot,
            launch,
            renderer_observation,
            tuning,
            is_ground_emitter=is_ground_emitter,
        )
        pan_degrees = _renderer_pan_degrees(
            renderer_shot,
            launch,
            renderer_observation,
            tuning,
            target_lift_time,
            is_ground_emitter=is_ground_emitter,
        )
        if not is_ground_emitter:
            rendered_lift_time = estimate_engine_lift_time_seconds(
                float(design_value.get("liftVelocity") or 0.0),
                float(design_value.get("shellLife") or 60.0),
                pan_degrees=pan_degrees,
            )
            if (
                abs(rendered_lift_time - target_lift_time)
                > ENGINE_FIXED_STEP_SECONDS + 0.0001
            ):
                mapping_unknowns.append(
                    "Engine limit: shot "
                    f"{index + 1} target lift {target_lift_time:.3f}s but the "
                    f"nearest supported ascent is {rendered_lift_time:.3f}s."
                )
            rendered_burst_time = fire_time + rendered_lift_time
            if (
                abs(rendered_burst_time - observed_burst_time)
                > ENGINE_FIXED_STEP_SECONDS + 0.0001
            ):
                mapping_unknowns.append(
                    "Engine limit: shot "
                    f"{index + 1} schedules its rendered apex at "
                    f"{rendered_burst_time:.3f}s, but the observed burst starts at "
                    f"{observed_burst_time:.3f}s. Refine timeOffsetSeconds; the "
                    "worker will derive the canonical lift from the remaining interval."
                )
            launch_trajectory = (
                renderer_observation.get("launchTrajectory")
                if isinstance(renderer_observation.get("launchTrajectory"), dict)
                else {}
            )
            screen_angle = _observed_launch_screen_angle_degrees(launch_trajectory)
            if screen_angle is not None and abs(pan_degrees) == 30:
                lateral_limit = 6.0 if launch.get("enabled", True) else 18.0
                rendered_angle = _engine_apex_displacement_angle_degrees(
                    float(design_value.get("liftVelocity") or 0.0),
                    pan_degrees,
                    lateral_limit=lateral_limit,
                )
                if abs(rendered_angle - screen_angle) > 2.0:
                    mapping_unknowns.append(
                        "Engine limit: shot "
                        f"{index + 1} measured launch angle {screen_angle:.2f} degrees "
                        f"but the supported carrier reaches {rendered_angle:.2f} degrees."
                    )
        renderer_shots.append(
            {
                "designKey": design_id,
                "timeOffsetSeconds": round(fire_time, 4),
                "sourceTimeOffsetSeconds": round(source_fire_time, 4),
                "observedBurstTimeSeconds": round(
                    _clamp(
                        _first_present(
                            observation.get("burstSeconds"),
                            observation.get("peakSeconds"),
                        ),
                        fire_time,
                        duration,
                        burst_time,
                    ),
                    4,
                ),
                "observedFadeEndSeconds": round(
                    _clamp(
                        observation.get("endSeconds"), burst_time, duration, burst_time
                    ),
                    4,
                ),
                "position": {
                    "x": _clamp(raw_position.get("x"), -1_000, 1_000, 0),
                    "y": _clamp(raw_position.get("y"), -1_000, 1_000, 0),
                    "z": _clamp(raw_position.get("z"), -1_000, 1_000, 0),
                },
                "launchPositionIndex": max(
                    0, min(2, int(shot.get("launchPositionIndex") or 0))
                ),
                "panDegrees": pan_degrees,
                "tiltDegrees": round(
                    _clamp(
                        _first_present(
                            shot.get("tiltDegrees"),
                            float(_first_present(launch.get("tiltDegrees"), 90)) - 90,
                        ),
                        -50,
                        50,
                        0,
                    )
                ),
                "scale": _clamp(shot.get("scale"), 0.2, 2, 1),
                "seed": abs(
                    int(effect.get("seed") or 1)
                    + int(shot.get("seedOffset") or index * 101)
                )
                % 2_147_483_647,
            }
        )

    duration_by_design_key = {
        str(design.get("key")): float(design.get("durationSeconds") or 0.1)
        for design in designs
        if isinstance(design, dict)
    }
    product_duration = max(
        duration,
        *(
            float(shot.get("timeOffsetSeconds") or 0.0)
            + duration_by_design_key.get(str(shot.get("designKey")), 0.1)
            for shot in renderer_shots
        ),
    )
    product_duration = round(min(60.0, product_duration), 4)

    score = score_candidate(spec, video_observations)
    model_observations = (
        spec.get("observations") if isinstance(spec.get("observations"), dict) else {}
    )
    events = []
    for event in model_observations.get("observedEvents", []):
        if not isinstance(event, dict):
            continue
        events.append(
            {
                "timeSeconds": _clamp(event.get("timeSeconds"), 0, 60, 0),
                "type": str(event.get("type") or "unknown")[:80],
                "confidence": _clamp(event.get("confidence"), 0, 1, 0.5),
                "notes": str(event.get("description") or "")[:500],
            }
        )
    return {
        "version": RECONSTRUCTION_CONTRACT_VERSION,
        "source": "video_inferred",
        "name": str(spec.get("name") or "Imported firework")[:180],
        "description": (
            str(spec.get("description"))[:1_200] if spec.get("description") else None
        ),
        "durationSeconds": product_duration,
        "heightMeters": _clamp(effect.get("heightMeters"), 0, 220, 60)
        if effect.get("heightMeters") is not None
        else None,
        "caliber": None,
        "confidence": _clamp(spec.get("confidence"), 0, 1, 0.5),
        "designs": designs,
        "shots": renderer_shots,
        "observations": {
            "observedEvents": events,
            "fieldConfidence": {
                "timing": score["timing"],
                "shotCount": score["shotCount"],
                "colour": score["colour"],
                "duration": score["duration"],
                "physics": round(
                    sum(
                        float(burst.get("trajectory", {}).get("confidence", 0))
                        for burst in video_observations.get("bursts", [])
                        if isinstance(burst, dict)
                        and isinstance(burst.get("trajectory"), dict)
                    )
                    / max(1, len(video_observations.get("bursts", []))),
                    5,
                ),
                "audio": 1.0 if audio_observations.get("hasAudio") else 0.0,
                "synthesis": float(
                    diagnostics.get("scores", [{}])[0].get(
                        "combinedScore", score["score"]
                    )
                )
                if diagnostics.get("scores")
                else score["score"],
            },
            "unknowns": [
                str(value)[:500]
                for value in model_observations.get("unknowns", [])
                if str(value).strip()
            ][: max(0, 200 - len(mapping_unknowns))]
            + mapping_unknowns[:200],
        },
    }


def build_reconstruction_validation(
    spec: dict[str, Any],
    video_observations: dict[str, Any],
    diagnostics: dict[str, Any],
) -> dict[str, Any]:
    score = score_candidate(spec, video_observations)
    model_observations = (
        spec.get("observations") if isinstance(spec.get("observations"), dict) else {}
    )
    review_fields = model_observations.get("suggestedManualReviewFields", [])
    checks = [
        {
            "name": "observed_burst_alignment",
            "passed": score["timing"] >= 0.55,
            "score": score["timing"],
        },
        {
            "name": "colour_evidence",
            "passed": score["colour"] >= 0.35,
            "score": score["colour"],
        },
        {
            "name": "duration_alignment",
            "passed": score["duration"] >= 0.75,
            "score": score["duration"],
        },
    ]
    return {
        "valid": all(check["passed"] for check in checks),
        "requiresReview": bool(review_fields)
        or not all(check["passed"] for check in checks),
        "score": score,
        "checks": checks,
        "manualReviewFields": review_fields,
        "synthesis": diagnostics,
    }
