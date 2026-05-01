import base64
import json
import os
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import jsonschema
import numpy as np
import requests

try:
    import cv2
    from supabase import create_client
except ModuleNotFoundError as exc:
    raise SystemExit(
        "Missing worker dependency. Run `pip install -r requirements.txt` "
        "inside workers/firework-import-worker before starting the worker."
    ) from exc


BUCKET = "import-videos"
MAX_DURATION_SECONDS = 60.0
WORKER_VERSION = os.getenv("WORKER_VERSION", "firework-import-worker/v1")
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "8"))
DEFAULT_MODEL = os.getenv("DEFAULT_OPENROUTER_MODEL", "google/gemini-2.5-flash-lite")


# Validated in-process after the model returns JSON. OpenRouter+Gemini rejects rich
# json_schema constraints ("too many states"); we use response_format json_object instead.
SPEC_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["name", "description", "durationSeconds", "confidence", "renderSpec"],
    "properties": {
        "name": {"type": "string"},
        "description": {"type": ["string", "null"]},
        "durationSeconds": {"type": "number", "minimum": 0.1, "maximum": 60},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "renderSpec": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "particleCount",
                "burstDuration",
                "secondaryBursts",
                "colors",
                "spread",
                "launchHeight",
                "gravity",
                "drag",
                "sparkSize",
                "trailLength",
                "sections",
                "audioSync",
            ],
            "properties": {
                "particleCount": {"type": "integer", "minimum": 40, "maximum": 900},
                "burstDuration": {"type": "number", "minimum": 0.25, "maximum": 8},
                "colors": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 8,
                    "items": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                },
                "spread": {"type": "number", "minimum": 0.4, "maximum": 8},
                "launchHeight": {"type": "number", "minimum": 0.5, "maximum": 8},
                "gravity": {"type": "number", "minimum": -6, "maximum": 1},
                "drag": {"type": "number", "minimum": 0.05, "maximum": 0.99},
                "sparkSize": {"type": "number", "minimum": 0.015, "maximum": 0.22},
                "trailLength": {"type": "number", "minimum": 0, "maximum": 2.5},
                "secondaryBursts": {"type": "integer", "minimum": 0, "maximum": 4},
                "audioSync": {
                    "type": "array",
                    "maxItems": 80,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["timeSeconds", "kind", "confidence"],
                        "properties": {
                            "timeSeconds": {"type": "number", "minimum": 0, "maximum": 60},
                            "kind": {
                                "type": "string",
                                "enum": ["launch", "burst", "crackle", "fade"],
                            },
                            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        },
                    },
                },
                "sections": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 24,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": [
                            "id",
                            "label",
                            "phase",
                            "startTimeSeconds",
                            "endTimeSeconds",
                            "burstTimeSeconds",
                            "secondaryBursts",
                            "colors",
                            "particleCount",
                            "spread",
                            "launchHeight",
                            "burstDuration",
                            "gravity",
                            "drag",
                            "sparkSize",
                            "trailLength",
                            "confidence",
                        ],
                        "properties": {
                            "id": {"type": "string"},
                            "label": {"type": "string"},
                            "phase": {
                                "type": "string",
                                "enum": ["launch", "burst", "afterglow", "secondary"],
                            },
                            "startTimeSeconds": {"type": "number", "minimum": 0, "maximum": 60},
                            "endTimeSeconds": {"type": "number", "minimum": 0, "maximum": 60},
                            "burstTimeSeconds": {"type": "number", "minimum": 0, "maximum": 60},
                            "colors": {
                                "type": "array",
                                "minItems": 1,
                                "maxItems": 8,
                                "items": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                            },
                            "particleCount": {"type": "integer", "minimum": 40, "maximum": 900},
                            "spread": {"type": "number", "minimum": 0.4, "maximum": 8},
                            "launchHeight": {"type": "number", "minimum": 0.5, "maximum": 8},
                            "burstDuration": {"type": "number", "minimum": 0.25, "maximum": 8},
                            "gravity": {"type": "number", "minimum": -6, "maximum": 1},
                            "drag": {"type": "number", "minimum": 0.05, "maximum": 0.99},
                            "sparkSize": {"type": "number", "minimum": 0.015, "maximum": 0.22},
                            "trailLength": {"type": "number", "minimum": 0, "maximum": 2.5},
                            "secondaryBursts": {"type": "integer", "minimum": 0, "maximum": 4},
                            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        },
                    },
                },
            },
        },
    },
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def env_required(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def ffprobe_duration(path):
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        text=True,
        capture_output=True,
    )
    return float(result.stdout.strip())


def extract_audio(path, out_dir):
    raw_path = out_dir / "audio.f32le"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "22050",
            "-f",
            "f32le",
            str(raw_path),
        ],
        check=True,
        capture_output=True,
    )
    return raw_path


def find_local_peaks(values, min_height, min_distance):
    peaks = []
    last_peak = -min_distance
    for idx in range(1, len(values) - 1):
        if idx - last_peak < min_distance:
            continue
        if values[idx] < min_height:
            continue
        if values[idx] >= values[idx - 1] and values[idx] > values[idx + 1]:
            peaks.append(idx)
            last_peak = idx
    return peaks


def bgr_to_hex(color):
    b, g, r = [int(max(0, min(255, c))) for c in color]
    return f"#{r:02X}{g:02X}{b:02X}"


def analyse_frames(path, duration):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError("Could not open video for frame analysis")

    sample_count = min(18, max(6, int(duration * 2)))
    times = np.linspace(0, max(0.01, duration - 0.05), sample_count)
    frames = []
    for idx, seconds in enumerate(times):
        capture.set(cv2.CAP_PROP_POS_MSEC, float(seconds) * 1000)
        ok, frame = capture.read()
        if not ok:
            continue
        small = cv2.resize(frame, (320, 180), interpolation=cv2.INTER_AREA)
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        mask = (hsv[:, :, 2] > 135) & (hsv[:, :, 1] > 35)
        bright_pixels = small[mask]
        if bright_pixels.size == 0:
            dominant = ["#FFFFFF"]
            coverage = 0.0
        else:
            dominant = [bgr_to_hex(np.mean(bright_pixels, axis=0))]
            coverage = float(bright_pixels.shape[0] / (small.shape[0] * small.shape[1]))
        _, encoded = cv2.imencode(".jpg", small, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
        frames.append(
            {
                "index": idx,
                "timeSeconds": round(float(seconds), 3),
                "brightCoverage": round(coverage, 4),
                "dominantColors": dominant,
                "jpegBase64": base64.b64encode(encoded).decode("ascii"),
            }
        )
    capture.release()
    summary = [
        {
            "index": frame["index"],
            "timeSeconds": frame["timeSeconds"],
            "brightCoverage": frame["brightCoverage"],
            "dominantColors": frame["dominantColors"],
        }
        for frame in frames
    ]
    return summary, frames[:12]


def analyse_audio(path):
    try:
        sr = 22050
        y = np.fromfile(path, dtype=np.float32)
    except Exception as exc:
        return {"error": str(exc), "events": [], "durationSeconds": 0}

    if y.size == 0:
        return {"durationSeconds": 0, "energyPeaks": [], "onsets": []}

    duration = y.size / sr
    frame_length = 1024
    hop_length = 512
    frame_count = max(1, 1 + (len(y) - frame_length) // hop_length)
    rms = np.zeros(frame_count, dtype=np.float32)
    for idx in range(frame_count):
        start = idx * hop_length
        frame = y[start : start + frame_length]
        if frame.size:
            rms[idx] = float(np.sqrt(np.mean(frame * frame)))

    if np.max(rms) > np.min(rms):
        energy = (rms - np.min(rms)) / (np.max(rms) - np.min(rms))
    else:
        energy = rms
    peaks = find_local_peaks(
        energy,
        min_height=0.35,
        min_distance=max(1, int(sr / hop_length * 0.35)),
    )
    onset_strength = np.maximum(0, np.diff(energy, prepend=energy[0]))
    onsets = find_local_peaks(
        onset_strength,
        min_height=max(0.08, float(np.mean(onset_strength) + np.std(onset_strength))),
        min_distance=max(1, int(sr / hop_length * 0.12)),
    )
    return {
        "durationSeconds": round(float(duration), 3),
        "energyPeaks": [
            {
                "timeSeconds": round(float(p * hop_length / sr), 3),
                "energy": round(float(energy[p]), 3),
            }
            for p in peaks[:30]
        ],
        "onsets": [round(float(p * hop_length / sr), 3) for p in onsets[:80]],
    }


def latest_refinement(outputs):
    refinements = [row for row in outputs if row.get("output_type") == "refinement"]
    if not refinements:
        return None
    payload = refinements[-1].get("payload") or {}
    prompt = payload.get("prompt")
    return prompt if isinstance(prompt, str) and prompt.strip() else None


def parse_model_json(message):
    text = (message or "").strip()
    if not text:
        raise ValueError("model returned empty message content")
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:] if lines else []
        while lines and lines[-1].strip() == "```":
            lines.pop()
        text = "\n".join(lines).strip()
    return json.loads(text)


def validate_import_spec(spec):
    try:
        jsonschema.validate(instance=spec, schema=SPEC_SCHEMA)
    except jsonschema.ValidationError as exc:
        path = ".".join(str(p) for p in (exc.absolute_path or [])) or "(root)"
        raise RuntimeError(f"Model output failed schema validation at {path}: {exc.message}") from exc


def call_openrouter(model, source_name, duration, frame_summary, frame_images, audio, refinement_prompt):
    api_key = env_required("OPENROUTER_API_KEY")
    content = [
        {
            "type": "text",
            "text": (
                "Reconstruct this consumer firework video as a parametric 3D particle animation. "
                "Match timing, launch, burst shape, dominant colours, secondary bursts, fade, "
                "and audio sync as closely as possible.\n"
                "Reply with a single JSON object only (no markdown code fences, no commentary). "
                'Top-level keys: name, description (string or null), durationSeconds, confidence, '
                'renderSpec. renderSpec has particleCount, burstDuration, secondaryBursts, colors '
                "(array of #RRGGBB hex strings), spread, launchHeight, gravity, drag, sparkSize, "
                "trailLength, sections, audioSync. Each section needs id, label, phase "
                '(launch|burst|afterglow|secondary), startTimeSeconds, endTimeSeconds, '
                "burstTimeSeconds, secondaryBursts, colors, particleCount, spread, launchHeight, "
                "burstDuration, gravity, drag, sparkSize, trailLength, confidence. "
                "audioSync items: timeSeconds, kind (launch|burst|crackle|fade), confidence. "
                "Use realistic numeric ranges (e.g. particleCount 40-900, times within video duration).\n"
                f"Source name: {source_name}. Duration: {duration:.3f}s. "
                f"Frame analysis: {json.dumps(frame_summary)[:9000]}. "
                f"Audio analysis: {json.dumps(audio)[:9000]}. "
                f"Refinement request: {refinement_prompt or 'none'}."
            ),
        }
    ]
    for frame in frame_images:
        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{frame['jpegBase64']}",
                },
            }
        )

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "ShowCrafter"),
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "response_format": {"type": "json_object"},
        },
        timeout=120,
    )
    if not response.ok:
        body = (response.text or "")[:4000]
        raise RuntimeError(
            f"OpenRouter {response.status_code} {response.reason}: {body or '(empty body)'}"
        )
    data = response.json()
    message = data["choices"][0]["message"]["content"]
    spec = parse_model_json(message)
    validate_import_spec(spec)
    return spec, data


def process_job(supabase, job):
    job_id = job["id"]
    model = job.get("selected_model") or DEFAULT_MODEL
    supabase.table("import_jobs").update(
        {
            "status": "processing",
            "processing_progress": 5,
            "processor_version": WORKER_VERSION,
            "started_at": now_iso(),
            "error_message": None,
        }
    ).eq("id", job_id).execute()

    media_id = job.get("media_asset_id")
    if not media_id:
        raise RuntimeError("Import job has no media asset")

    media_result = supabase.table("media_assets").select("*").eq("id", media_id).single().execute()
    media = media_result.data
    storage_path = media.get("storage_path")
    if not storage_path:
        raise RuntimeError("Media asset has no storage path")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        video_path = tmp_dir / "source-video"
        video_bytes = supabase.storage.from_(BUCKET).download(storage_path)
        video_path.write_bytes(video_bytes)

        duration = ffprobe_duration(video_path)
        if duration > MAX_DURATION_SECONDS:
            raise RuntimeError(f"Video is {duration:.2f}s; maximum is 60s")

        supabase.table("media_assets").update({"duration_seconds": duration}).eq("id", media_id).execute()
        supabase.table("import_jobs").update({"processing_progress": 20}).eq("id", job_id).execute()

        frame_summary, frame_images = analyse_frames(video_path, duration)
        supabase.table("import_outputs").insert(
            {
                "import_job_id": job_id,
                "output_type": "frame_analysis",
                "payload": {"frames": frame_summary},
            }
        ).execute()

        supabase.table("import_jobs").update({"processing_progress": 45}).eq("id", job_id).execute()
        audio_path = extract_audio(video_path, tmp_dir)
        audio = analyse_audio(audio_path)
        supabase.table("import_outputs").insert(
            {
                "import_job_id": job_id,
                "output_type": "audio_analysis",
                "payload": audio,
            }
        ).execute()

        outputs = (
            supabase.table("import_outputs")
            .select("output_type,payload,created_at")
            .eq("import_job_id", job_id)
            .order("created_at")
            .execute()
            .data
        )
        refinement_prompt = latest_refinement(outputs)
        supabase.table("import_jobs").update({"processing_progress": 70}).eq("id", job_id).execute()

        spec, raw_model_output = call_openrouter(
            model,
            job["source_name"],
            duration,
            frame_summary,
            frame_images,
            audio,
            refinement_prompt,
        )
        supabase.table("import_outputs").insert(
            {
                "import_job_id": job_id,
                "output_type": "model_output",
                "payload": raw_model_output,
            }
        ).execute()
        supabase.table("import_outputs").insert(
            {
                "import_job_id": job_id,
                "output_type": "generated_spec",
                "payload": {
                    "model": model,
                    "processorVersion": WORKER_VERSION,
                    "refinementPrompt": refinement_prompt,
                    "spec": spec,
                },
            }
        ).execute()

    supabase.table("import_jobs").update(
        {
            "status": "needs_review",
            "processing_progress": 100,
            "completed_at": now_iso(),
            "error_message": None,
        }
    ).eq("id", job_id).execute()


def main():
    supabase = create_client(env_required("SUPABASE_URL"), env_required("SUPABASE_SERVICE_ROLE_KEY"))
    print(f"{WORKER_VERSION} polling every {POLL_SECONDS}s")
    while True:
        jobs = (
            supabase.table("import_jobs")
            .select("*")
            .eq("kind", "firework_video")
            .eq("status", "queued")
            .order("created_at")
            .limit(1)
            .execute()
            .data
        )
        if not jobs:
            time.sleep(POLL_SECONDS)
            continue
        job = jobs[0]
        try:
            print(f"processing import {job['id']}")
            process_job(supabase, job)
            print(f"completed import {job['id']}")
        except Exception as exc:
            print(f"failed import {job['id']}: {exc}")
            supabase.table("import_jobs").update(
                {
                    "status": "failed",
                    "processing_progress": 100,
                    "completed_at": now_iso(),
                    "error_message": str(exc)[:2000],
                }
            ).eq("id", job["id"]).execute()


if __name__ == "__main__":
    main()
