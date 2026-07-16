"""Protected FireworksEngine validation for reconstructed import candidates."""

from __future__ import annotations

import base64
import binascii
import copy
import hashlib
import hmac
import math
import os
import re
import secrets
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit, urlunsplit


AUTH_MESSAGE_VERSION = "showcrafter.import-render.v1"
SIGNING_KEY_CONTEXT = b"showcrafter.import-render.signing-key.v1"
RESULT_SCHEMA_VERSION = "showcrafter.import-render-result.v1"
METRICS_SCHEMA_VERSION = "showcrafter.engine-render-metrics.v2"
RENDERER_VERSION = "showcrafter.fireworks-engine.import-renderer.v1+sha256.087d491030064d3e194ba5e0d72d65a3b47356e49ee6a2e05479103ccce32441"
MAX_CAPABILITY_SECONDS = 300
MAX_METRIC_FRAMES = 180
MAX_REVIEW_FRAMES = 48
MAX_REVIEW_PNG_BYTES = 16 * 1024 * 1024
ENGINE_FIXED_STEP_SECONDS = 1 / 60
STORAGE_ETAG_PATTERN = re.compile(r"^[0-9a-f]{32}(?:-[1-9][0-9]*)?$")


def trusted_render_url(
    value: str,
    *,
    allow_insecure_local: bool | None = None,
) -> str:
    parsed = urlsplit(value.strip())
    if allow_insecure_local is None:
        allow_insecure_local = os.getenv(
            "FIREWORK_IMPORT_ALLOW_INSECURE_LOCAL_RENDER",
            "",
        ).strip().lower() in {"1", "true", "yes"}
    local_http = (
        parsed.scheme == "http"
        and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        and allow_insecure_local
    )
    if (
        (parsed.scheme != "https" and not local_http)
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path.rstrip("/") != "/internal/import-render"
    ):
        raise RuntimeError(
            "FIREWORK_IMPORT_RENDER_URL must be a trusted HTTPS /internal/import-render URL; "
            "explicitly enabled loopback HTTP is allowed only for local development"
        )
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def signed_render_url(
    render_url: str,
    shared_secret: str,
    run_id: str,
    *,
    now_seconds: int | None = None,
    nonce: str | None = None,
    ttl_seconds: int = 240,
) -> str:
    base_url = trusted_render_url(render_url)
    parsed_run_id = str(uuid.UUID(str(run_id)))
    if len(shared_secret) < 32:
        raise RuntimeError(
            "FIREWORK_IMPORT_SHARED_SECRET must contain at least 32 characters"
        )
    now_seconds = int(time.time()) if now_seconds is None else int(now_seconds)
    ttl_seconds = max(30, min(MAX_CAPABILITY_SECONDS, int(ttl_seconds)))
    expires = now_seconds + ttl_seconds
    nonce = nonce or secrets.token_urlsafe(18)
    if not nonce or len(nonce) > 200:
        raise RuntimeError("Render capability nonce is invalid")
    derived_key = hmac.new(
        shared_secret.encode("utf-8"),
        SIGNING_KEY_CONTEXT,
        hashlib.sha256,
    ).digest()
    message = f"{AUTH_MESSAGE_VERSION}\n{parsed_run_id}\n{expires}\n{nonce}".encode(
        "utf-8"
    )
    signature = (
        base64.urlsafe_b64encode(
            hmac.new(derived_key, message, hashlib.sha256).digest()
        )
        .decode("ascii")
        .rstrip("=")
    )
    parsed = urlsplit(base_url)
    query = urlencode(
        {
            "runId": parsed_run_id,
            "expires": expires,
            "nonce": nonce,
            "signature": signature,
        }
    )
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))


def _renderer_tail_frame_count(
    reconstruction: dict[str, Any],
    source_duration_seconds: float,
) -> int:
    reconstruction_duration = float(reconstruction.get("durationSeconds") or 0.0)
    nearest_source_boundary = (
        math.floor(source_duration_seconds / ENGINE_FIXED_STEP_SECONDS + 0.5)
        * ENGINE_FIXED_STEP_SECONDS
    )
    source_boundary = (
        nearest_source_boundary
        if nearest_source_boundary <= source_duration_seconds + 0.0001
        else math.floor(source_duration_seconds / ENGINE_FIXED_STEP_SECONDS)
        * ENGINE_FIXED_STEP_SECONDS
    )
    required_boundary = (
        math.ceil(reconstruction_duration / ENGINE_FIXED_STEP_SECONDS)
        * ENGINE_FIXED_STEP_SECONDS
    )
    tail_seconds = max(0.0, required_boundary - source_boundary)
    exact_count = max(1, math.ceil(tail_seconds / 0.25)) if tail_seconds > 0.0001 else 0
    conservative_tail_seconds = max(
        0.0,
        reconstruction_duration - max(0.001, source_duration_seconds - 0.001),
    )
    conservative_count = (
        max(1, math.ceil(conservative_tail_seconds / 0.25))
        if conservative_tail_seconds > 0.001
        else 0
    )
    return max(exact_count, conservative_count)


def _event_boundary_timestamps(
    reconstruction: dict[str, Any],
    video_observations: dict[str, Any],
    source_duration_seconds: float,
) -> list[float]:
    timestamps: set[float] = set()

    def add(value: Any) -> None:
        if not isinstance(value, (int, float)):
            return
        numeric = float(value)
        if not math.isfinite(numeric):
            return
        timestamps.add(round(max(0.0, min(source_duration_seconds, numeric)), 4))

    for burst in video_observations.get("bursts", []):
        if not isinstance(burst, dict):
            continue
        add(burst.get("launchSeconds"))
        add(
            burst.get("burstSeconds")
            if burst.get("burstSeconds") is not None
            else burst.get("peakSeconds")
        )
        fade_end = burst.get("endSeconds")
        if fade_end is None and isinstance(burst.get("fadeSeconds"), (int, float)):
            burst_time = (
                burst.get("burstSeconds")
                if burst.get("burstSeconds") is not None
                else burst.get("peakSeconds")
            )
            if isinstance(burst_time, (int, float)):
                fade_end = float(burst_time) + float(burst["fadeSeconds"])
        add(fade_end)

    for shot in reconstruction.get("shots", []):
        if not isinstance(shot, dict):
            continue
        add(
            shot.get("sourceTimeOffsetSeconds")
            if shot.get("sourceTimeOffsetSeconds") is not None
            else shot.get("timeOffsetSeconds")
        )
        add(shot.get("observedBurstTimeSeconds"))
        add(shot.get("observedFadeEndSeconds"))
    return sorted(timestamps)


def _sample_evenly(values: list[float], limit: int) -> list[float]:
    if len(values) <= limit:
        return list(values)
    if limit <= 1:
        return values[:limit]
    indexes = {round(index * (len(values) - 1) / (limit - 1)) for index in range(limit)}
    return [values[index] for index in sorted(indexes)]


def build_render_timestamp_plan(
    reconstruction: dict[str, Any],
    video_observations: dict[str, Any],
    *,
    limit: int = 36,
    max_capture_frames: int = MAX_METRIC_FRAMES,
) -> dict[str, Any]:
    """Keep exact event boundaries ahead of optional contextual samples."""

    source_duration = float(video_observations.get("durationSeconds") or 0.0)
    reconstruction_duration = float(reconstruction.get("durationSeconds") or 0.0)
    duration = min(source_duration, reconstruction_duration)
    if duration <= 0:
        raise RuntimeError("A positive source and reconstruction duration is required")
    max_capture_frames = max(2, min(MAX_METRIC_FRAMES, int(max_capture_frames)))
    tail_frame_count = _renderer_tail_frame_count(reconstruction, source_duration)
    source_capacity = max_capture_frames - tail_frame_count
    if source_capacity < 2:
        raise RuntimeError(
            "Renderer tail is too long for the bounded engine validation evidence"
        )

    event_boundaries = _event_boundary_timestamps(
        reconstruction,
        video_observations,
        duration,
    )
    last_context_timestamp = max(0.001, duration - 0.001)
    required_timestamps = sorted(
        {*event_boundaries, 0.0, round(last_context_timestamp, 4)}
    )
    event_complete = len(required_timestamps) <= source_capacity
    timestamps = set(
        required_timestamps
        if event_complete
        else _sample_evenly(required_timestamps, source_capacity)
    )
    requested = max(2, min(source_capacity, int(limit)))
    target = min(source_capacity, max(requested, len(timestamps)))

    context_candidates: list[float] = []
    for timestamp in event_boundaries:
        context_candidates.extend(
            (
                round(max(0.0, timestamp - 0.05), 4),
                round(min(duration, timestamp + 0.05), 4),
            )
        )
    uniform_count = max(2, target)
    context_candidates.extend(
        round(last_context_timestamp * index / max(1, uniform_count - 1), 4)
        for index in range(uniform_count)
    )
    for timestamp in context_candidates:
        if len(timestamps) >= target:
            break
        timestamps.add(timestamp)

    ordered = sorted(timestamps)
    if len(ordered) < 2:
        raise RuntimeError("Engine validation requires two unique timestamps")
    return {
        "timestamps": ordered,
        "eventComplete": event_complete,
        "eventBoundaryCount": len(event_boundaries),
        "requiredSourceFrameCount": len(required_timestamps),
        "sourceFrameCapacity": source_capacity,
        "rendererTailFrameCount": tail_frame_count,
        "maxCaptureFrames": max_capture_frames,
    }


def event_evidence_capacity_issue(plan: dict[str, Any]) -> str | None:
    if plan.get("eventComplete") is not False:
        return None
    return (
        "Engine limit: event-complete validation needs "
        f"{int(plan.get('eventBoundaryCount') or 0)} exact launch, burst and fade "
        "boundary frames, source endpoints and "
        f"{int(plan.get('rendererTailFrameCount') or 0)} "
        f"renderer-tail frames, exceeding the {int(plan.get('maxCaptureFrames') or 0)}-frame "
        "harness limit. Publication requires a shorter source or fewer independently "
        "timed events."
    )


def build_render_timestamps(
    reconstruction: dict[str, Any],
    video_observations: dict[str, Any],
    *,
    limit: int = 36,
) -> list[float]:
    return build_render_timestamp_plan(
        reconstruction,
        video_observations,
        limit=limit,
    )["timestamps"]


def build_review_timestamps(
    reconstruction: dict[str, Any],
    video_observations: dict[str, Any],
    *,
    source_limit: int = 40,
) -> list[float]:
    """Reserve the harness's quarter-second renderer-tail export slots."""

    source_duration = float(video_observations.get("durationSeconds") or 0.0)
    required_duration = float(reconstruction.get("durationSeconds") or 0.0)
    if source_duration <= 0 or required_duration <= 0:
        raise RuntimeError(
            "Review rendering requires positive source and product durations"
        )
    desired_tail_frames = _renderer_tail_frame_count(reconstruction, source_duration)
    available_source_frames = MAX_REVIEW_FRAMES - desired_tail_frames
    if available_source_frames < 2:
        raise RuntimeError(
            "Renderer tail is too long for the bounded 48-frame review artefact"
        )
    return build_render_timestamp_plan(
        reconstruction,
        video_observations,
        limit=min(max(2, int(source_limit)), available_source_frames),
        max_capture_frames=MAX_REVIEW_FRAMES,
    )["timestamps"]


def provisional_renderer_durations(
    reconstruction: dict[str, Any],
) -> dict[str, Any]:
    """Give the trusted harness safe metadata headroom before exact estimates."""

    output = copy.deepcopy(reconstruction)
    designs = output.get("designs") if isinstance(output.get("designs"), list) else []
    design_by_key = {}
    latest_start_by_key: dict[str, float] = {}
    for design in designs:
        if not isinstance(design, dict):
            continue
        observed = float(design.get("durationSeconds") or 0.1)
        design["durationSeconds"] = round(min(60.0, max(8.0, observed)), 4)
        design_by_key[str(design.get("key"))] = design
    for shot in output.get("shots", []):
        if not isinstance(shot, dict):
            continue
        design_key = str(shot.get("designKey"))
        if design_key not in design_by_key:
            continue
        start = float(shot.get("timeOffsetSeconds") or 0.0)
        latest_start_by_key[design_key] = max(
            latest_start_by_key.get(design_key, 0.0), start
        )

    required = float(output.get("durationSeconds") or 0.1)
    for design_key, design in design_by_key.items():
        latest_start = latest_start_by_key.get(design_key, 0.0)
        available = max(0.1, 60.0 - latest_start)
        design["durationSeconds"] = round(
            min(float(design["durationSeconds"]), available),
            4,
        )
        required = max(required, latest_start + float(design["durationSeconds"]))
    output["durationSeconds"] = round(min(60.0, required), 4)
    return output


def apply_trusted_renderer_durations(
    reconstruction: dict[str, Any],
    result: dict[str, Any],
    *,
    source_duration_seconds: float,
) -> dict[str, Any]:
    durations = result.get("rendererDurations")
    required = result.get("requiredProductDurationSeconds")
    if not isinstance(durations, list) or not isinstance(required, (int, float)):
        raise RuntimeError("Engine harness omitted trusted renderer duration metadata")
    required = float(required)
    if not math.isfinite(required) or required <= 0 or required > 60:
        raise RuntimeError("Engine harness returned an invalid product duration")
    by_key: dict[str, float] = {}
    for entry in durations:
        if not isinstance(entry, dict) or not isinstance(
            entry.get("durationSeconds"),
            (int, float),
        ):
            raise RuntimeError("Engine harness returned malformed renderer durations")
        duration = float(entry["durationSeconds"])
        if not math.isfinite(duration) or duration <= 0 or duration > 60:
            raise RuntimeError("Engine harness returned an invalid renderer duration")
        design_key = str(entry.get("designKey"))
        if design_key in by_key:
            raise RuntimeError("Engine harness returned duplicate renderer durations")
        by_key[design_key] = math.ceil(duration * 1_000) / 1_000

    output = copy.deepcopy(reconstruction)
    designs = output.get("designs") if isinstance(output.get("designs"), list) else []
    expected_keys = {
        str(design.get("key")) for design in designs if isinstance(design, dict)
    }
    if set(by_key) != expected_keys:
        raise RuntimeError(
            "Engine harness renderer durations do not match reconstruction designs"
        )
    for design in designs:
        design["durationSeconds"] = by_key[str(design.get("key"))]
    product_duration = (
        math.ceil(max(float(source_duration_seconds), required) * 10_000) / 10_000
    )
    if not math.isfinite(product_duration) or product_duration > 60:
        raise RuntimeError(
            "The engine-validated reconstruction exceeds the 60 second product limit"
        )
    output["durationSeconds"] = product_duration
    return output


def compact_engine_result(
    result: dict[str, Any],
    reconstruction: dict[str, Any],
) -> dict[str, Any]:
    metrics = result.get("metrics")
    if (
        result.get("schemaVersion") != RESULT_SCHEMA_VERSION
        or result.get("rendererVersion") != RENDERER_VERSION
        or not isinstance(metrics, dict)
        or metrics.get("schemaVersion") != METRICS_SCHEMA_VERSION
        or not isinstance(metrics.get("priorityIssues"), list)
        or not isinstance(metrics.get("overallScore"), (int, float))
    ):
        raise RuntimeError("Engine harness returned an invalid result contract")
    score = float(metrics["overallScore"])
    if not math.isfinite(score) or score < 0 or score > 1:
        raise RuntimeError("Engine harness returned an invalid overall score")
    engine = metrics.get("engine")
    if (
        not isinstance(engine, dict)
        or engine.get("rendererVersion") != RENDERER_VERSION
    ):
        raise RuntimeError("Engine harness returned an unrecognised renderer version")
    component_scores = {}
    for key in ("timing", "trajectory", "palette", "fade", "perceptual"):
        component = metrics.get(key)
        component_score = (
            component.get("score") if isinstance(component, dict) else None
        )
        if not isinstance(component_score, (int, float)):
            raise RuntimeError(f"Engine harness omitted the {key} component score")
        component_score = float(component_score)
        if not math.isfinite(component_score) or not 0 <= component_score <= 1:
            raise RuntimeError(f"Engine harness returned an invalid {key} score")
        component_scores[key] = component_score
    perceptual = metrics.get("perceptual")
    active_frame_count = (
        perceptual.get("activeFrameCount") if isinstance(perceptual, dict) else None
    )
    foreground_weight_total = (
        perceptual.get("foregroundWeightTotal")
        if isinstance(perceptual, dict)
        else None
    )
    if (
        not isinstance(active_frame_count, int)
        or active_frame_count < 2
        or not isinstance(foreground_weight_total, (int, float))
        or not math.isfinite(float(foreground_weight_total))
        or float(foreground_weight_total) <= 0
    ):
        raise RuntimeError(
            "Engine harness perceptual evidence lacks active firework frames"
        )
    return {
        "schemaVersion": result["schemaVersion"],
        "harnessVersion": result.get("harnessVersion"),
        "rendererVersion": result.get("rendererVersion"),
        "source": result.get("source"),
        "rendererDurations": result.get("rendererDurations"),
        "requiredProductDurationSeconds": result.get("requiredProductDurationSeconds"),
        "metrics": metrics,
        "priorityIssues": metrics["priorityIssues"],
        "componentScores": component_scores,
        "reconstruction": reconstruction,
        "renderedVideoPath": None,
    }


class EngineRenderValidator:
    """One bounded browser session reused across every candidate in a run."""

    def __init__(
        self,
        *,
        render_url: str,
        shared_secret: str,
        run_id: str,
        source_video_path: str | Path,
        timeout_seconds: float = 320,
    ) -> None:
        self.render_url = trusted_render_url(render_url)
        self.shared_secret = shared_secret
        self.run_id = str(uuid.UUID(str(run_id)))
        self.source_video_path = Path(source_video_path)
        self.timeout_seconds = max(60.0, min(330.0, float(timeout_seconds)))
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None

    def __enter__(self):
        if not self.source_video_path.is_file():
            raise RuntimeError("Engine validation source video is unavailable")
        try:
            from playwright.sync_api import sync_playwright
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "Playwright is required for FireworksEngine import validation"
            ) from exc

        self._playwright = sync_playwright().start()
        try:
            self._browser = self._playwright.chromium.launch(
                headless=True,
                args=[
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-unsafe-swiftshader",
                    "--disable-gpu-sandbox",
                ],
            )
            self._context = self._browser.new_context(
                ignore_https_errors=False,
                service_workers="block",
            )
            self._page = self._context.new_page()
            self._page.set_default_timeout(min(60_000, self.timeout_seconds * 1_000))
            capability_url = signed_render_url(
                self.render_url,
                self.shared_secret,
                self.run_id,
            )
            response = self._page.goto(
                capability_url,
                wait_until="domcontentloaded",
                timeout=min(60_000, self.timeout_seconds * 1_000),
            )
            if response is None or not response.ok:
                raise RuntimeError(
                    "Engine validation harness did not return a successful response"
                )
            expected = urlsplit(self.render_url)
            actual = urlsplit(self._page.url)
            if (
                actual.scheme != expected.scheme
                or actual.netloc != expected.netloc
                or actual.path.rstrip("/") != expected.path.rstrip("/")
            ):
                raise RuntimeError(
                    "Engine validation harness redirected outside its trusted URL"
                )
            self._page.wait_for_function(
                "() => Boolean(window.__SHOWCRAFTER_IMPORT_RENDER__)",
                timeout=min(60_000, self.timeout_seconds * 1_000),
            )
            self._attach_source_video()
            return self
        except Exception:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, _exc_type, _exc, _traceback):
        if self._context is not None:
            self._context.close()
            self._context = None
        if self._browser is not None:
            self._browser.close()
            self._browser = None
        if self._playwright is not None:
            self._playwright.stop()
            self._playwright = None
        self._page = None

    def _attach_source_video(self) -> None:
        """Restore the source after a harness reload before any render call."""

        if self._page is None:
            raise RuntimeError("Engine validation browser is not running")
        self._page.wait_for_function(
            "() => Boolean(window.__SHOWCRAFTER_IMPORT_RENDER__)",
            timeout=min(60_000, self.timeout_seconds * 1_000),
        )
        self._page.locator(
            '[data-testid="import-render-source-video"]'
        ).set_input_files(str(self.source_video_path))
        self._page.wait_for_function(
            """() => document.querySelector(
              '[data-testid="import-render-source-video"]'
            )?.files?.length === 1""",
            timeout=min(10_000, self.timeout_seconds * 1_000),
        )

    def render_candidate(
        self,
        reconstruction: dict[str, Any],
        timestamps_seconds: list[float],
        *,
        include_rendered_frames: bool,
        timeout_seconds: float | None = None,
    ) -> dict[str, Any]:
        if self._page is None:
            raise RuntimeError("Engine validation browser is not running")
        request = {
            "reconstruction": reconstruction,
            "timestampsSeconds": timestamps_seconds,
            "includeRenderedFrames": include_rendered_frames,
            "maxRenderEdge": 960,
        }
        call_timeout = max(
            1.0,
            min(
                self.timeout_seconds,
                float(timeout_seconds)
                if timeout_seconds is not None
                else self.timeout_seconds,
            ),
        )
        result = None
        for attempt in range(2):
            self._attach_source_video()
            try:
                result = self._page.evaluate(
                    """async ({ request, timeoutMs }) => {
                      const api = window.__SHOWCRAFTER_IMPORT_RENDER__;
                      if (!api) throw new Error('Import render harness is unavailable.');
                      return await Promise.race([
                        api.renderCandidate(request),
                        new Promise((_, reject) => window.setTimeout(
                          () => reject(new Error('Worker render validation timed out.')),
                          timeoutMs,
                        )),
                      ]);
                    }""",
                    {
                        "request": request,
                        "timeoutMs": round(call_timeout * 1_000),
                    },
                )
                break
            except Exception as exc:
                if attempt == 0 and "Attach the browser-normalised source video" in str(
                    exc
                ):
                    continue
                raise
        if not isinstance(result, dict):
            raise RuntimeError("Engine validation harness returned a non-object result")
        compact_engine_result(result, reconstruction)
        return result


def encode_rendered_review_video(
    rendered_frames: list[dict[str, Any]],
    output_dir: str | Path,
    *,
    timeout_seconds: float = 90,
) -> Path:
    if not 2 <= len(rendered_frames) <= MAX_REVIEW_FRAMES:
        raise RuntimeError("Review render must contain between 2 and 48 frames")
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    frame_paths: list[Path] = []
    timestamps: list[float] = []
    total_bytes = 0
    for index, frame in enumerate(rendered_frames):
        encoded = frame.get("pngBase64") if isinstance(frame, dict) else None
        if not isinstance(encoded, str) or not encoded:
            raise RuntimeError("Review render frame is missing PNG bytes")
        try:
            png = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise RuntimeError("Review render frame contains invalid base64") from exc
        if not png.startswith(b"\x89PNG\r\n\x1a\n"):
            raise RuntimeError("Review render frame is not a PNG")
        total_bytes += len(png)
        if total_bytes > MAX_REVIEW_PNG_BYTES:
            raise RuntimeError("Review render exceeds the 16 MB PNG budget")
        frame_path = output_dir / f"engine-frame-{index:03d}.png"
        frame_path.write_bytes(png)
        frame_paths.append(frame_path)
        timestamps.append(float(frame.get("timeSeconds") or 0.0))

    manifest = output_dir / "engine-frames.ffconcat"
    lines = ["ffconcat version 1.0"]
    for index, frame_path in enumerate(frame_paths):
        lines.append(f"file '{frame_path.name}'")
        lines.append("option framerate 1000")
        if index + 1 < len(frame_paths):
            duration = max(1 / 30, timestamps[index + 1] - timestamps[index])
            lines.append(f"duration {duration:.6f}")
    manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    output_path = output_dir / "engine-review.mp4"
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(manifest),
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-fps_mode",
                "vfr",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            check=True,
            capture_output=True,
            cwd=output_dir,
            timeout=max(10.0, min(120.0, float(timeout_seconds))),
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Review video encoding exceeded its timeout") from exc
    except subprocess.CalledProcessError as exc:
        message = exc.stderr.decode("utf-8", errors="replace")[:1_000]
        raise RuntimeError(f"Review video encoding failed: {message}") from exc
    return output_path


def rendered_review_storage_path(
    source_storage_path: str,
    run_id: str,
    candidate_hash: str,
) -> str:
    folder = source_storage_path.rsplit("/", 1)[0] if "/" in source_storage_path else ""
    name = f"engine-review-{uuid.UUID(str(run_id))}-{candidate_hash[:16]}.mp4"
    return f"{folder}/{name}" if folder else name


def _normalise_storage_etag(value: Any) -> str:
    etag = str(value or "").strip().removeprefix("W/").strip('"').lower()
    if not STORAGE_ETAG_PATTERN.fullmatch(etag):
        raise RuntimeError("Retained review video has no valid storage checksum")
    return etag


def _review_storage_object(storage, storage_path: str) -> dict[str, Any]:
    folder, _, filename = storage_path.rpartition("/")
    listed = storage.list(
        folder or None,
        {
            "limit": 100,
            "offset": 0,
            "search": filename,
            "sortBy": {"column": "name", "order": "asc"},
        },
    )
    matches = [
        item
        for item in listed
        if isinstance(item, dict) and item.get("name") == filename
    ]
    if len(matches) != 1:
        raise RuntimeError("Retained review video metadata was not found exactly once")
    return matches[0]


def verify_rendered_review_video(
    storage,
    storage_path: str,
    expected_sha256: str,
    expected_byte_size: int,
) -> dict[str, Any]:
    """Verify the immutable object bytes and the metadata used by the SQL seal."""

    storage_object = _review_storage_object(storage, storage_path)
    metadata = storage_object.get("metadata")
    if not isinstance(metadata, dict):
        raise RuntimeError("Retained review video has no storage metadata")
    try:
        metadata_size = int(metadata.get("size"))
    except (TypeError, ValueError) as exc:
        raise RuntimeError(
            "Retained review video has an invalid stored byte size"
        ) from exc
    if metadata_size != expected_byte_size:
        raise RuntimeError(
            "Retained review video byte size does not match the encoded MP4"
        )
    if metadata.get("mimetype") != "video/mp4":
        raise RuntimeError("Retained review video has an invalid storage MIME type")
    storage_etag = _normalise_storage_etag(
        metadata.get("eTag")
        if metadata.get("eTag") is not None
        else metadata.get("etag")
    )

    retained_bytes = storage.download(storage_path)
    if not isinstance(retained_bytes, bytes):
        raise RuntimeError("Retained review video download returned invalid bytes")
    retained_sha256 = hashlib.sha256(retained_bytes).hexdigest()
    if len(retained_bytes) != expected_byte_size or retained_sha256 != expected_sha256:
        raise RuntimeError("Retained review video bytes do not match the encoded MP4")
    return {
        "storagePath": storage_path,
        "sha256": expected_sha256,
        "byteSize": expected_byte_size,
        "storageETag": storage_etag,
    }


def upload_rendered_review_video(
    supabase,
    bucket: str,
    source_storage_path: str,
    run_id: str,
    candidate_hash: str,
    review_path: str | Path,
) -> dict[str, Any]:
    storage_path = rendered_review_storage_path(
        source_storage_path,
        run_id,
        candidate_hash,
    )
    encoded_mp4 = Path(review_path).read_bytes()
    if not encoded_mp4:
        raise RuntimeError("Encoded review video is empty")
    expected_sha256 = hashlib.sha256(encoded_mp4).hexdigest()
    expected_byte_size = len(encoded_mp4)
    storage = supabase.storage.from_(bucket)
    upload_error: Exception | None = None
    try:
        storage.upload(
            storage_path,
            encoded_mp4,
            {"content-type": "video/mp4"},
        )
    except Exception as exc:  # The SDK has no stable cross-version error subtype.
        upload_error = exc

    try:
        return verify_rendered_review_video(
            storage,
            storage_path,
            expected_sha256,
            expected_byte_size,
        )
    except Exception as verification_error:
        if upload_error is not None:
            raise RuntimeError(
                "Review video upload failed and the retained object is not an exact replay"
            ) from verification_error
        raise
