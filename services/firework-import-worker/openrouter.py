"""Bounded OpenRouter client for strict JSON Schema responses."""

from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from typing import Any, Callable

import jsonschema
import requests

RETRYABLE_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}


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
