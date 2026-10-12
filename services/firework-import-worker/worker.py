"""Firework video import worker: measure, interpret and fit renderer designs."""

import hashlib
import json
import math
import os
import re
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from fit import NodeScorer, fit_proposal
from interpret import PROMPT_VERSION, interpret, response_schema, system_prompt
from measure import EXTRACTOR, measure
from openrouter import OpenRouterClient

try:
    from supabase import create_client
except ModuleNotFoundError as exc:
    raise SystemExit(
        "Missing worker dependency. Run `pip install -r requirements.txt` "
        "inside services/firework-import-worker before starting the worker."
    ) from exc


BUCKET = "import-videos"
MAX_DURATION_SECONDS = 60.0
MAX_SOURCE_WIDTH = 7_680
MAX_SOURCE_HEIGHT = 4_320
MAX_SOURCE_PIXELS = MAX_SOURCE_WIDTH * MAX_SOURCE_HEIGHT
MAX_SOURCE_FRAME_RATE = 120.0
ANALYSIS_MAX_EDGE = 1_920
ANALYSIS_MAX_PIXELS = 1_920 * 1_080
ANALYSIS_MAX_FRAME_RATE = 30.0
WORKER_VERSION = os.getenv("WORKER_VERSION", "firework-import-worker/v3")
PIPELINE_VERSION = "firework-video-fit-v1"
DESIGN_SCHEMA_VERSION = "showcrafter.renderer-design.v1"
RECONSTRUCTION_SCHEMA_VERSION = "showcrafter.firework-reconstruction.v2"
FIT_EVIDENCE_SCHEMA_VERSION = "showcrafter.import-fit-evidence.v1"
MEASUREMENT_SCHEMA_VERSION = "showcrafter.video-measurement.v1"
PROPOSAL_SCHEMA_VERSION = "showcrafter.video-proposal.v1"
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "8"))
DEFAULT_MODEL = os.getenv("DEFAULT_OPENROUTER_MODEL", "openai/gpt-5.4")
PROMPT_CONFIGS_TABLE = "prompt_configs"
# The stored prompt from before renderer fitting describes the retired spec format.
LEGACY_PROMPT_MARKER = "FireworkEffectSpecV3"
TRANSIENT_RPC_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}
TRANSIENT_POSTGRES_CODES = {
    "40001",
    "40P01",
    "55P03",
    "53300",
    "53400",
    "57P01",
    "57P02",
    "57P03",
    "PGRST000",
}
# Shot pan bounds in whole degrees, matching multishot_fireworks.pan_degrees.
MAX_PAN_DEGREES = 30
MS_PER_SECOND = 1000
# Product timings are stored to the millisecond.
TIME_DECIMAL_PLACES = 3
SCORE_DECIMAL_PLACES = 4


def env_required(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def validate_worker_environment():
    """Validate model and fitting settings before a queued run acquires a lease."""

    env_required("OPENROUTER_API_KEY")
    for name, default, minimum, maximum in (
        ("IMPORT_FIT_SECONDS", "300", 10, 1_200),
        ("IMPORT_FIT_ITERATIONS", "30", 1, 60),
        ("IMPORT_MAX_MODEL_IMAGES", "24", 0, 60),
        ("IMPORT_MODEL_MAX_CALLS", "2", 1, 4),
    ):
        try:
            value = float(os.getenv(name, default))
        except ValueError as exc:
            raise RuntimeError(f"{name} must be numeric") from exc
        if not math.isfinite(value) or not minimum <= value <= maximum:
            raise RuntimeError(f"{name} must be between {minimum} and {maximum}")
        if name != "IMPORT_FIT_SECONDS" and not value.is_integer():
            raise RuntimeError(f"{name} must be an integer")


def remaining_subprocess_timeout(deadline_monotonic, cap_seconds, operation):
    cap_seconds = max(1.0, float(cap_seconds))
    if deadline_monotonic is None:
        return cap_seconds
    remaining = float(deadline_monotonic) - time.monotonic() - 5.0
    if remaining < 1.0:
        raise RuntimeError(f"{operation} could not start before the run deadline")
    return min(cap_seconds, remaining)


def ffprobe_media(path, deadline_monotonic=None):
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "stream=index,codec_name,codec_type,profile,pix_fmt,width,height,avg_frame_rate:format=format_name,duration",
                "-of",
                "json",
                str(path),
            ],
            check=True,
            text=True,
            capture_output=True,
            timeout=remaining_subprocess_timeout(
                deadline_monotonic,
                float(os.getenv("IMPORT_FFPROBE_TIMEOUT_SECONDS", "30")),
                "Media probing",
            ),
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Media probing exceeded its bounded timeout") from exc
    except subprocess.CalledProcessError as exc:
        message = (exc.stderr or "").strip()[:1_000]
        raise RuntimeError(
            f"Media probing failed: {message or 'ffprobe rejected the source'}"
        ) from exc
    payload = json.loads(result.stdout or "{}")
    streams = payload.get("streams") or []
    video_stream = next(
        (stream for stream in streams if stream.get("codec_type") == "video"), {}
    )
    audio_stream = next(
        (stream for stream in streams if stream.get("codec_type") == "audio"), {}
    )
    fmt = payload.get("format") or {}
    duration = fmt.get("duration")
    try:
        duration = float(duration) if duration is not None else 0.0
    except (TypeError, ValueError):
        duration = 0.0
    return {
        "duration": duration,
        "format_name": fmt.get("format_name"),
        "video_codec": video_stream.get("codec_name"),
        "audio_codec": audio_stream.get("codec_name"),
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "video_profile": video_stream.get("profile"),
        "pixel_format": video_stream.get("pix_fmt"),
        "frame_rate": video_stream.get("avg_frame_rate"),
    }


def parse_frame_rate(value):
    try:
        if isinstance(value, str) and "/" in value:
            numerator, denominator = value.split("/", 1)
            rate = float(numerator) / float(denominator)
        else:
            rate = float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0
    return rate if math.isfinite(rate) and rate > 0 else 0.0


def validate_source_video(media_info):
    if not media_info.get("video_codec"):
        raise RuntimeError("The source does not contain a decodable video stream")
    try:
        width = int(media_info.get("width") or 0)
        height = int(media_info.get("height") or 0)
    except (TypeError, ValueError) as exc:
        raise RuntimeError("The source video dimensions are invalid") from exc
    if width <= 0 or height <= 0:
        raise RuntimeError("The source video dimensions could not be measured")
    if (
        max(width, height) > MAX_SOURCE_WIDTH
        or min(width, height) > MAX_SOURCE_HEIGHT
        or width * height > MAX_SOURCE_PIXELS
    ):
        raise RuntimeError(
            f"The source video is {width}x{height}; the maximum decoded long and short edges are "
            f"{MAX_SOURCE_WIDTH} and {MAX_SOURCE_HEIGHT} pixels"
        )
    frame_rate = parse_frame_rate(media_info.get("frame_rate"))
    if frame_rate > MAX_SOURCE_FRAME_RATE:
        raise RuntimeError(
            f"The source video is {frame_rate:.2f} fps; maximum decoded frame rate is "
            f"{MAX_SOURCE_FRAME_RATE:.0f} fps"
        )


def needs_analysis_normalization(media_info):
    width = int(media_info.get("width") or 0)
    height = int(media_info.get("height") or 0)
    frame_rate = parse_frame_rate(media_info.get("frame_rate"))
    return (
        max(width, height) > ANALYSIS_MAX_EDGE
        or width * height > ANALYSIS_MAX_PIXELS
        or frame_rate > ANALYSIS_MAX_FRAME_RATE
    )


def needs_browser_normalization(media_info):
    video_codec = (media_info.get("video_codec") or "").lower()
    audio_codec = media_info.get("audio_codec")
    formats = {
        value.strip().lower()
        for value in str(media_info.get("format_name") or "").split(",")
        if value.strip()
    }
    pixel_format = (media_info.get("pixel_format") or "").lower()
    if (
        video_codec != "h264"
        or not formats.intersection({"mov", "mp4", "m4v"})
        or pixel_format not in {"yuv420p", "yuvj420p"}
        or needs_analysis_normalization(media_info)
    ):
        return True
    if audio_codec is None:
        return False
    return audio_codec.lower() != "aac"


def normalized_preview_storage_path(storage_path, artefact_key=None):
    base = storage_path.rsplit("/", 1)[-1]
    if "." in base:
        stem = storage_path[: -len(base)] + base.rsplit(".", 1)[0]
    else:
        stem = storage_path
    suffix = ""
    if artefact_key:
        safe_key = re.sub(r"[^a-zA-Z0-9_-]", "-", str(artefact_key)).strip("-")
        suffix = f"-{safe_key[:120]}" if safe_key else ""
    return f"{stem}-browser-h264{suffix}.mp4"


def create_browser_normalized_video(
    source_path,
    out_dir,
    media_info,
    deadline_monotonic=None,
):
    output_path = out_dir / "browser-preview.mp4"
    width = int(media_info.get("width") or 0)
    height = int(media_info.get("height") or 0)
    target_width, target_height = (1_920, 1_080) if width >= height else (1_080, 1_920)
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source_path),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-vf",
                (
                    f"scale={target_width}:{target_height}:"
                    "force_original_aspect_ratio=decrease:force_divisible_by=2,"
                    f"fps={ANALYSIS_MAX_FRAME_RATE:g}"
                ),
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "15",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            check=True,
            capture_output=True,
            timeout=remaining_subprocess_timeout(
                deadline_monotonic,
                float(os.getenv("IMPORT_NORMALISE_TIMEOUT_SECONDS", "240")),
                "Video normalisation",
            ),
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Video normalisation exceeded its bounded timeout") from exc
    except subprocess.CalledProcessError as exc:
        message = exc.stderr.decode("utf-8", errors="replace")[:1_000]
        raise RuntimeError(f"Video normalisation failed: {message}") from exc
    return output_path


def upload_browser_normalized_video(
    supabase,
    storage_path,
    preview_path,
    artefact_key=None,
):
    preview_storage_path = normalized_preview_storage_path(storage_path, artefact_key)
    with preview_path.open("rb") as handle:
        supabase.storage.from_(BUCKET).upload(
            preview_storage_path,
            handle,
            {"content-type": "video/mp4", "upsert": "true"},
        )
    return preview_storage_path


def create_required_browser_normalized_video(
    supabase,
    source_path,
    output_dir,
    media_info,
    storage_path,
    artefact_key=None,
    deadline_monotonic=None,
):
    """Create and upload the browser-safe comparison source or fail the run."""

    try:
        normalized_path = create_browser_normalized_video(
            source_path,
            output_dir,
            media_info,
            deadline_monotonic=deadline_monotonic,
        )
        normalized_probe = ffprobe_media(
            normalized_path,
            deadline_monotonic=deadline_monotonic,
        )
        normalized_storage_path = upload_browser_normalized_video(
            supabase,
            storage_path,
            normalized_path,
            artefact_key=artefact_key,
        )
    except Exception as exc:
        raise RuntimeError(
            "Could not create and store the required browser-safe comparison video"
        ) from exc
    return normalized_path, normalized_probe, normalized_storage_path

def fetch_prompt_config(supabase, key):
    result = (
        supabase.table(PROMPT_CONFIGS_TABLE)
        .select("system_prompt_text")
        .eq("key", key)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    rows = result.data if isinstance(result.data, list) else []
    data = rows[0] if rows and isinstance(rows[0], dict) else {}
    prompt = data.get("system_prompt_text")
    return prompt.strip() if isinstance(prompt, str) and prompt.strip() else None


def create_openrouter_client(
    model,
    *,
    deadline_monotonic=None,
    attempt_budget=None,
):
    return OpenRouterClient(
        env_required("OPENROUTER_API_KEY"),
        model,
        site_url=os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
        app_name=os.getenv("OPENROUTER_APP_NAME", "ShowCrafter"),
        timeout_seconds=float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "150")),
        max_attempts=int(os.getenv("OPENROUTER_MAX_ATTEMPTS", "4")),
        base_delay_seconds=float(os.getenv("OPENROUTER_RETRY_BASE_SECONDS", "1")),
        max_delay_seconds=float(os.getenv("OPENROUTER_RETRY_MAX_SECONDS", "12")),
        deadline_monotonic=deadline_monotonic,
        attempt_budget=attempt_budget,
    )


def canonical_json_hash(value):
    encoded = json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _transient_rpc_error(exc):
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return True
    error_name = type(exc).__name__.lower()
    if "timeout" in error_name or "connection" in error_name or "network" in error_name:
        return True

    status = getattr(exc, "status_code", None)
    response = getattr(exc, "response", None)
    if status is None and response is not None:
        status = getattr(response, "status_code", None)
    details = exc.args[0] if exc.args and isinstance(exc.args[0], dict) else {}
    if status is None:
        status = details.get("status") or details.get("status_code")
    try:
        if int(status) in TRANSIENT_RPC_STATUS_CODES:
            return True
    except (TypeError, ValueError):
        pass

    code = str(getattr(exc, "code", None) or details.get("code") or "").upper()
    return code in TRANSIENT_POSTGRES_CODES or code.startswith("08")


def execute_rpc_with_retry(supabase, rpc_name, arguments):
    """Retry only transient RPC transport failures with an identical request."""

    max_attempts = max(
        1,
        min(4, int(os.getenv("IMPORT_RPC_MAX_ATTEMPTS", "3"))),
    )
    base_seconds = max(
        0.0,
        min(5.0, float(os.getenv("IMPORT_RPC_RETRY_BASE_SECONDS", "0.5"))),
    )
    request_hash = canonical_json_hash(arguments)
    for attempt in range(1, max_attempts + 1):
        try:
            return supabase.rpc(rpc_name, arguments).execute()
        except Exception as exc:
            if (
                not _transient_rpc_error(exc)
                or attempt >= max_attempts
                or canonical_json_hash(arguments) != request_hash
            ):
                raise
            time.sleep(base_seconds * (2 ** (attempt - 1)))
    raise RuntimeError(f"{rpc_name} exhausted its retry budget")

def first_rpc_row(data):
    if isinstance(data, list):
        return data[0] if data else None
    return data if isinstance(data, dict) else None


def claim_reconstruction_run(supabase, requested_run_id=None):
    result = supabase.rpc(
        "claim_firework_import_run",
        {
            "p_processor_version": WORKER_VERSION,
            "p_requested_run_id": requested_run_id,
            "p_lease_seconds": max(
                60, min(3_600, int(os.getenv("IMPORT_RUN_LEASE_SECONDS", "900")))
            ),
        },
    ).execute()
    return first_rpc_row(result.data)


def heartbeat_reconstruction_run(supabase, run, stage, progress):
    execute_rpc_with_retry(
        supabase,
        "heartbeat_firework_import_run",
        {
            "p_run_id": run["run_id"],
            "p_lease_token": run["lease_token"],
            "p_stage": stage,
            "p_progress": max(1, min(99, int(progress))),
            "p_lease_seconds": max(
                60, min(3_600, int(os.getenv("IMPORT_RUN_LEASE_SECONDS", "900")))
            ),
        },
    )


def record_reconstruction_media_probe(
    supabase,
    run,
    duration,
    source_probe,
    normalized_preview,
):
    arguments = {
        "p_run_id": run["run_id"],
        "p_lease_token": run["lease_token"],
        "p_duration_seconds": duration,
        "p_width": source_probe.get("width"),
        "p_height": source_probe.get("height"),
        "p_source_probe": source_probe,
        "p_normalized_preview": normalized_preview,
    }
    return execute_rpc_with_retry(
        supabase,
        "record_firework_import_media_probe",
        arguments,
    ).data


def append_reconstruction_output(
    supabase,
    run,
    *,
    stage,
    sequence,
    output_type,
    schema_version,
    payload,
    storage_path=None,
):
    content_hash = canonical_json_hash(payload)
    arguments = {
        "p_run_id": run["run_id"],
        "p_lease_token": run["lease_token"],
        "p_stage": stage,
        "p_sequence": sequence,
        "p_output_type": output_type,
        "p_schema_version": schema_version,
        "p_payload": payload,
        "p_content_hash": content_hash,
        "p_storage_path": storage_path,
    }
    result = execute_rpc_with_retry(
        supabase,
        "append_firework_import_run_output",
        arguments,
    )
    return result.data


def complete_reconstruction_run(supabase, run, candidates, selected_ordinal):
    arguments = {
        "p_run_id": run["run_id"],
        "p_lease_token": run["lease_token"],
        "p_candidates": candidates,
        "p_selected_ordinal": selected_ordinal,
    }
    return execute_rpc_with_retry(
        supabase,
        "complete_firework_import_run",
        arguments,
    ).data


def fail_reconstruction_run(supabase, run, exc):
    execute_rpc_with_retry(
        supabase,
        "fail_firework_import_run",
        {
            "p_run_id": run["run_id"],
            "p_lease_token": run["lease_token"],
            "p_error_message": str(exc)[:2_000],
        },
    )



def admin_guidance(supabase):
    """Return the admin's video prompt unless it still describes the retired spec format."""
    prompt = fetch_prompt_config(supabase, "firework_video_reconstruction")
    if prompt and LEGACY_PROMPT_MARKER in prompt:
        return None
    return prompt


def persist_run_context(supabase, run, *, source_sha256, model, guidance, catalogue):
    effective_prompt = system_prompt(guidance)
    template_keys = [template["key"] for template in catalogue["templates"]]
    prompt_snapshot = {
        "version": PROMPT_VERSION,
        "sha256": hashlib.sha256(effective_prompt.encode("utf-8")).hexdigest(),
        "effectiveGuidance": effective_prompt,
        "adminGuidanceSha256": hashlib.sha256(guidance.encode("utf-8")).hexdigest()
        if guidance
        else None,
    }
    model_snapshot = {
        "interpretationModel": model,
        "structuredOutput": {
            "type": "json_schema",
            "strict": True,
            "schemaSha256": canonical_json_hash(response_schema(template_keys)),
        },
        "measurement": {"extractor": EXTRACTOR},
        "fit": {
            "seconds": float(os.getenv("IMPORT_FIT_SECONDS", "300")),
            "iterations": int(os.getenv("IMPORT_FIT_ITERATIONS", "30")),
            "rendererVersion": catalogue.get("renderer"),
        },
        "maxModelImages": int(os.getenv("IMPORT_MAX_MODEL_IMAGES", "24")),
    }
    modal_call_id = run.get("modal_call_id")
    if modal_call_id:
        model_snapshot["modalInputId"] = str(modal_call_id)
    execute_rpc_with_retry(
        supabase,
        "record_firework_import_run_context",
        {
            "p_run_id": run["run_id"],
            "p_lease_token": run["lease_token"],
            "p_source_sha256": source_sha256,
            "p_pipeline_version": PIPELINE_VERSION,
            "p_engine_schema_version": DESIGN_SCHEMA_VERSION,
            "p_video_model": model,
            "p_prompt_snapshot": prompt_snapshot,
            "p_model_snapshot": model_snapshot,
            "p_modal_call_id": str(modal_call_id) if modal_call_id else None,
        },
    )


def load_proposal_checkpoint(supabase, run, measurement_hash):
    """Reuse this run's paid interpretation when a retry measures the same evidence."""
    rows = (
        supabase.table("import_run_outputs")
        .select("payload")
        .eq("import_run_id", run["run_id"])
        .eq("stage", "model")
        .order("sequence")
        .execute()
        .data
        or []
    )
    for row in reversed(rows):
        payload = row.get("payload") if isinstance(row, dict) else None
        if (
            isinstance(payload, dict)
            and payload.get("kind") == "proposal"
            and payload.get("measurementHash") == measurement_hash
            and isinstance(payload.get("proposal"), dict)
        ):
            return payload["proposal"]
    return None


def parent_proposal(run):
    """Return the refined candidate's proposal from a renderer-fitted parent."""
    parent = run.get("parent_candidate")
    proposal = parent.get("proposal") if isinstance(parent, dict) else None
    return proposal if isinstance(proposal, dict) else None


def pan_degrees(angle_deg):
    """Whole-degree launch pan from a projected tube angle, within multishot bounds."""
    if not isinstance(angle_deg, (int, float)) or not math.isfinite(angle_deg):
        return 0
    return int(max(-MAX_PAN_DEGREES, min(MAX_PAN_DEGREES, round(angle_deg))))


def build_reconstruction(name, measurement, proposal, summary):
    """Express a scored proposal as the stored renderer reconstruction contract.

    Shot times are seconds from the first measured firing, so a product starts at
    zero; the source offset is kept for side-by-side review.
    """
    tubes = proposal["composition"]["tubes"]
    first_ms = tubes[0]["t_ms"]
    designs = []
    for letter in sorted(proposal["effects"]):
        entry = summary[letter]
        designs.append(
            {
                "key": letter,
                "template": entry["template"],
                "label": entry["name"],
                "design": entry["design"],
                "durationSeconds": round(float(entry["durationSeconds"]), TIME_DECIMAL_PLACES),
                "colorPalette": entry["palette"],
            }
        )
    duration_by_key = {design["key"]: design["durationSeconds"] for design in designs}
    shots = []
    for tube in tubes:
        kind = summary[tube["letter"]]["design"].get("kind")
        aerial = kind in ("shell", "rocket", "comet")
        shots.append(
            {
                "id": str(tube["i"]),
                "designKey": tube["letter"],
                "timeOffsetSeconds": round((tube["t_ms"] - first_ms) / MS_PER_SECOND, TIME_DECIMAL_PLACES),
                "panDegrees": pan_degrees(tube["angle_deg"]) if aerial else 0,
                "x": measurement["shots"][tube["i"]].get("x"),
            }
        )
    duration = max(
        shot["timeOffsetSeconds"] + duration_by_key[shot["designKey"]] for shot in shots
    )
    return {
        "version": 2,
        "name": str(name or "Imported firework")[:180],
        "description": None,
        "durationSeconds": round(duration, TIME_DECIMAL_PLACES),
        "designs": designs,
        "shots": shots,
        "source": {
            "durationSeconds": round(measurement["duration_ms"] / MS_PER_SECOND, TIME_DECIMAL_PLACES),
            "firstShotSeconds": round(first_ms / MS_PER_SECOND, TIME_DECIMAL_PLACES),
            "extractor": measurement.get("extractor"),
        },
        "proposal": proposal,
    }


def fit_evidence(candidate, renderer_version, *, iterations=None, timed_out=False, initial=None):
    """Per-shot similarity evidence for review, bounded to [0, 1]."""
    shots = []
    for index, score in enumerate(candidate["scores"]["shots"]):
        shots.append(
            {
                "index": index,
                "overall": round(float(score["overall"]), SCORE_DECIMAL_PLACES),
                "distances": {
                    key: None if value is None else round(float(value), SCORE_DECIMAL_PLACES)
                    for key, value in score["distances"].items()
                },
            }
        )
    evidence = {
        "schemaVersion": FIT_EVIDENCE_SCHEMA_VERSION,
        "rendererVersion": renderer_version,
        "overall": round(float(candidate["overall"]), SCORE_DECIMAL_PLACES),
        "shots": shots,
        "timedOut": bool(timed_out),
    }
    if iterations is not None:
        evidence["iterations"] = iterations
    if initial is not None:
        evidence["initialOverall"] = round(float(initial), SCORE_DECIMAL_PLACES)
    return evidence


def candidate_rows(name, measurement, evidence, fitted_result, scorer):
    """Return the fitted candidate first, plus the unfitted model proposal when it differs."""
    rows = []
    seen = set()
    entries = [
        ("fitted", fitted_result["fitted"]),
        ("model", fitted_result["initial"]),
    ]
    for source, candidate in entries:
        summary = scorer.request(
            {"evidence": evidence, "proposal": candidate["proposal"], "summary": True}
        )
        reconstruction = build_reconstruction(
            name, measurement, candidate["proposal"], summary["designs"]
        )
        content_hash = canonical_json_hash(reconstruction)
        if content_hash in seen:
            continue
        seen.add(content_hash)
        fit = fit_evidence(
            candidate,
            summary["renderer"],
            iterations=fitted_result["iterations"] if source == "fitted" else None,
            timed_out=fitted_result["timed_out"] if source == "fitted" else False,
            initial=fitted_result["initial"]["overall"] if source == "fitted" else None,
        )
        rows.append(
            {
                "ordinal": len(rows),
                "schemaVersion": RECONSTRUCTION_SCHEMA_VERSION,
                "reconstruction": reconstruction,
                "score": max(0.0, min(1.0, fit["overall"])),
                "metrics": {"source": source, "fit": fit},
                "validation": {
                    "valid": True,
                    "validatorVersion": RECONSTRUCTION_SCHEMA_VERSION,
                    "issues": [],
                },
                "contentHash": content_hash,
            }
        )
    return rows


def process_reconstruction_run(supabase, run):
    run_started_monotonic = time.monotonic()
    deadline_seconds = max(
        300,
        min(3_300, int(os.getenv("IMPORT_RUN_DEADLINE_SECONDS", "3000"))),
    )
    deadline_monotonic = run_started_monotonic + deadline_seconds
    run_id = run["run_id"]
    model = run.get("selected_model") or DEFAULT_MODEL
    storage_path = run.get("storage_path")
    if not storage_path:
        raise RuntimeError("Reconstruction run has no source storage path")

    append_reconstruction_output(
        supabase,
        run,
        stage="started",
        sequence=0,
        output_type="processing_log",
        schema_version=PIPELINE_VERSION,
        payload={
            "message": "Firework reconstruction started",
            "workerVersion": WORKER_VERSION,
        },
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        video_path = tmp_dir / "source-video.mp4"
        video_bytes = supabase.storage.from_(BUCKET).download(storage_path)
        video_path.write_bytes(video_bytes)
        source_hash = hashlib.sha256(video_bytes).hexdigest()
        del video_bytes

        source_probe = ffprobe_media(
            video_path,
            deadline_monotonic=deadline_monotonic,
        )
        validate_source_video(source_probe)
        duration = float(source_probe.get("duration") or 0.0)
        if duration <= 0:
            raise RuntimeError("Video duration could not be measured")
        if duration > MAX_DURATION_SECONDS:
            raise RuntimeError(f"Video is {duration:.2f}s; maximum is 60s")

        append_reconstruction_output(
            supabase,
            run,
            stage="probe",
            sequence=0,
            output_type="probe",
            schema_version="showcrafter.media-probe.v1",
            payload={"source": source_probe, "sourceSha256": source_hash},
        )
        heartbeat_reconstruction_run(supabase, run, "normalise", 12)

        analysis_video_path = video_path
        preview_metadata = None
        if needs_browser_normalization(source_probe):
            (
                normalized_video_path,
                normalized_probe,
                preview_storage_path,
            ) = create_required_browser_normalized_video(
                supabase,
                video_path,
                tmp_dir,
                source_probe,
                storage_path,
                artefact_key=f"{run_id}-{source_hash[:12]}",
                deadline_monotonic=deadline_monotonic,
            )
            preview_metadata = {
                "storagePath": preview_storage_path,
                "mimeType": "video/mp4",
                "videoCodec": normalized_probe.get("video_codec"),
                "audioCodec": normalized_probe.get("audio_codec"),
            }
            analysis_video_path = normalized_video_path

        if preview_metadata:
            append_reconstruction_output(
                supabase,
                run,
                stage="normalised_preview",
                sequence=0,
                output_type="processing_log",
                schema_version="showcrafter.browser-preview.v1",
                payload=preview_metadata,
                storage_path=preview_metadata["storagePath"],
            )
        record_reconstruction_media_probe(
            supabase,
            run,
            duration,
            source_probe,
            preview_metadata,
        )

        heartbeat_reconstruction_run(supabase, run, "video_analysis", 20)
        try:
            measurement, keyframes = measure(
                analysis_video_path,
                {},
                timeout_s=remaining_subprocess_timeout(
                    deadline_monotonic,
                    float(os.getenv("IMPORT_DECODE_TIMEOUT_SECONDS", "180")),
                    "Video measurement",
                ),
            )
        except ValueError as exc:
            raise RuntimeError(f"Video measurement failed: {exc}") from exc
        measurement_hash = canonical_json_hash(measurement)
        append_reconstruction_output(
            supabase,
            run,
            stage="video_analysis",
            sequence=0,
            output_type="video_observations",
            schema_version=MEASUREMENT_SCHEMA_VERSION,
            payload={"measurement": measurement, "measurementHash": measurement_hash},
        )
        evidence = {
            "duration_ms": measurement["duration_ms"],
            "shots": measurement["shots"],
            "features": measurement["features"],
        }

        fit_seconds = remaining_subprocess_timeout(
            deadline_monotonic,
            float(os.getenv("IMPORT_FIT_SECONDS", "300")) + 120,
            "Renderer fitting",
        )
        with NodeScorer(seconds=fit_seconds) as scorer:
            catalogue = scorer.request({"catalogue": True})
            guidance = admin_guidance(supabase)
            persist_run_context(
                supabase,
                run,
                source_sha256=source_hash,
                model=model,
                guidance=guidance,
                catalogue=catalogue,
            )
            proposal = load_proposal_checkpoint(supabase, run, measurement_hash)
            if proposal is None:
                client = create_openrouter_client(
                    model,
                    deadline_monotonic=deadline_monotonic,
                    attempt_budget=max(
                        1,
                        min(60, int(os.getenv("IMPORT_OPENROUTER_ATTEMPT_BUDGET", "12"))),
                    ),
                )

                def before_model_call():
                    if time.monotonic() >= deadline_monotonic - 5:
                        raise RuntimeError("Reconstruction run deadline was exhausted")
                    heartbeat_reconstruction_run(supabase, run, "candidate_synthesis", 45)

                proposal, response = interpret(
                    client,
                    scorer,
                    source_name=run.get("source_name") or "Imported firework",
                    measurement=measurement,
                    keyframes=keyframes,
                    catalogue=catalogue,
                    admin_guidance=guidance,
                    refinement_prompt=run.get("request_prompt"),
                    parent_proposal=parent_proposal(run),
                    before_model_call=before_model_call,
                    max_images=int(os.getenv("IMPORT_MAX_MODEL_IMAGES", "24")),
                    max_calls=int(os.getenv("IMPORT_MODEL_MAX_CALLS", "2")),
                )
                append_reconstruction_output(
                    supabase,
                    run,
                    stage="model",
                    sequence=0,
                    output_type="candidate_draft",
                    schema_version=PROPOSAL_SCHEMA_VERSION,
                    payload={
                        "kind": "proposal",
                        "measurementHash": measurement_hash,
                        "proposal": proposal,
                        "response": response,
                    },
                )

            heartbeat_reconstruction_run(supabase, run, "renderer_fit", 60)
            fitted = fit_proposal(
                scorer,
                evidence,
                proposal,
                max_iterations=int(os.getenv("IMPORT_FIT_ITERATIONS", "30")),
            )
            heartbeat_reconstruction_run(supabase, run, "candidate_selection", 90)
            rows = candidate_rows(
                run.get("source_name"), measurement, evidence, fitted, scorer
            )
        append_reconstruction_output(
            supabase,
            run,
            stage="render",
            sequence=0,
            output_type="render_metrics",
            schema_version=FIT_EVIDENCE_SCHEMA_VERSION,
            payload={
                "kind": "renderer_fit",
                "fit": rows[0]["metrics"]["fit"],
                "durationSeconds": round(fitted["duration_seconds"], TIME_DECIMAL_PLACES),
            },
        )
        heartbeat_reconstruction_run(supabase, run, "complete", 98)
        complete_reconstruction_run(supabase, run, rows, 0)


def process_reconstruction_run_by_id(supabase, run_id, modal_call_id=None):
    validate_worker_environment()
    claimed = claim_reconstruction_run(supabase, str(uuid.UUID(str(run_id))))
    if not claimed:
        return {"status": "skipped", "runId": str(run_id)}
    if modal_call_id:
        claimed["modal_call_id"] = str(modal_call_id)
    try:
        process_reconstruction_run(supabase, claimed)
        return {
            "status": "needs_review",
            "runId": claimed["run_id"],
            "jobId": claimed["job_id"],
        }
    except Exception as exc:
        try:
            fail_reconstruction_run(supabase, claimed, exc)
        except Exception as failure_error:
            print(
                f"could not mark reconstruction run {claimed['run_id']} failed: {failure_error}"
            )
        raise


def process_next_reconstruction_run(supabase, modal_call_id=None):
    validate_worker_environment()
    claimed = claim_reconstruction_run(supabase)
    if not claimed:
        return {"status": "idle"}
    if modal_call_id:
        claimed["modal_call_id"] = str(modal_call_id)
    try:
        process_reconstruction_run(supabase, claimed)
        return {
            "status": "needs_review",
            "runId": claimed["run_id"],
            "jobId": claimed["job_id"],
        }
    except Exception as exc:
        try:
            fail_reconstruction_run(supabase, claimed, exc)
        except Exception as failure_error:
            print(
                f"could not mark reconstruction run {claimed['run_id']} failed: {failure_error}"
            )
        raise


def main():
    validate_worker_environment()
    supabase = create_client(
        env_required("SUPABASE_URL"), env_required("SUPABASE_SERVICE_ROLE_KEY")
    )
    print(f"{WORKER_VERSION} polling every {POLL_SECONDS}s")
    while True:
        try:
            run_result = process_next_reconstruction_run(supabase)
        except Exception as exc:
            print(f"failed durable reconstruction run: {exc}")
            time.sleep(POLL_SECONDS)
            continue
        if run_result["status"] == "idle":
            time.sleep(POLL_SECONDS)
        else:
            print(f"completed reconstruction run {run_result['runId']}")


if __name__ == "__main__":
    main()
