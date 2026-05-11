import base64
import json
import os
import re
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
DEFAULT_MODEL = os.getenv("DEFAULT_OPENROUTER_MODEL", "openai/gpt-4.1")


# Validated in-process after the model returns JSON. OpenRouter JSON-schema support
# varies by model, so we use response_format json_object and validate locally.
# The renderer owns visual quality: the model infers structured FireworkEffectSpecV3
# parameters and observations, never per-frame drawing instructions.
SPEC_SCHEMA = {
    "type": "object",
    "additionalProperties": True,
    "required": ["name", "description", "durationSeconds", "confidence", "effectSpec", "observations"],
    "properties": {
        "name": {"type": "string"},
        "description": {"type": ["string", "null"]},
        "durationSeconds": {"type": "number", "minimum": 0.1, "maximum": 60},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "effectSpec": {
            "type": "object",
            "additionalProperties": True,
            "required": [
                "version",
                "name",
                "source",
                "confidence",
                "seed",
                "type",
                "durationSeconds",
                "colorPalette",
            ],
            "properties": {
                "version": {"type": "integer", "enum": [2, 3]},
                "name": {"type": "string"},
                "description": {"type": ["string", "null"]},
                "source": {
                    "type": "string",
                    "enum": ["manual", "video_inferred", "llm_generated", "catalogue", "legacy_migrated"],
                },
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "seed": {"type": "integer"},
                "type": {
                    "type": "string",
                    "enum": ["shell", "cake", "candle", "mine", "comet", "single_shot", "rocket", "fountain", "flame", "combo", "custom"],
                },
                "durationSeconds": {"type": "number", "minimum": 0.1, "maximum": 60},
                "heightMeters": {"type": "number", "minimum": 0, "maximum": 220},
                "colorPalette": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 12,
                    "items": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                },
                "shotSequence": {
                    "type": "object",
                    "additionalProperties": True,
                    "required": ["shotCount", "durationSeconds", "cadenceMode", "firingPattern", "shots"],
                    "properties": {
                        "shotCount": {"type": "integer", "minimum": 1, "maximum": 500},
                        "durationSeconds": {"type": "number", "minimum": 0, "maximum": 60},
                        "cadenceMode": {
                            "type": "string",
                            "enum": ["even", "custom", "accelerando", "decelerando", "volleys", "zipper", "randomized"],
                        },
                        "firingPattern": {
                            "type": "string",
                            "enum": ["STR", "STL", "STT", "FNR", "FNL", "FNT", "Z_SHAPE", "W_SHAPE", "V_SHAPE", "CENTER_OUT", "OUTSIDE_IN", "CUSTOM"],
                        },
                        "shots": {"type": "array", "maxItems": 500},
                    },
                },
                "shell": {"type": "object"},
                "shots": {"type": "array", "maxItems": 500},
                "effectLayers": {"type": "array", "maxItems": 40},
                "renderProfile": {"type": "object"},
                "launch": {"type": "object"},
                "audio": {"type": "object"},
                "metadata": {"type": "object"},
            },
        },
        "observations": {
            "type": "object",
            "additionalProperties": True,
            "required": ["observedEvents", "unknowns", "suggestedManualReviewFields", "confidence"],
            "properties": {
                "observedEvents": {
                    "type": "array",
                    "maxItems": 200,
                    "items": {
                        "type": "object",
                        "additionalProperties": True,
                        "required": [
                            "timeSeconds",
                            "type",
                            "confidence",
                        ],
                        "properties": {
                            "timeSeconds": {"type": "number", "minimum": 0, "maximum": 60},
                            "type": {
                                "type": "string",
                                "enum": ["launch", "mine", "break", "secondary_break", "crackle", "strobe", "glitter", "smoke", "fade", "report", "unknown"],
                            },
                            "color": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                            "estimatedHeight": {"type": "number", "minimum": 0, "maximum": 220},
                            "description": {"type": "string"},
                            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        },
                    },
                },
                "unknowns": {"type": "array", "items": {"type": "string"}},
                "suggestedManualReviewFields": {"type": "array", "items": {"type": "string"}},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
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
    return float(ffprobe_media(path).get("duration") or 0.0)


def ffprobe_media(path):
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
    )
    payload = json.loads(result.stdout or "{}")
    streams = payload.get("streams") or []
    video_stream = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
    audio_stream = next((stream for stream in streams if stream.get("codec_type") == "audio"), {})
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


def needs_browser_normalization(media_info):
    video_codec = (media_info.get("video_codec") or "").lower()
    audio_codec = media_info.get("audio_codec")
    if video_codec != "h264":
        return True
    if audio_codec is None:
        return False
    return audio_codec.lower() != "aac"


def normalized_preview_storage_path(storage_path):
    base = storage_path.rsplit("/", 1)[-1]
    if "." in base:
        stem = storage_path[: -len(base)] + base.rsplit(".", 1)[0]
    else:
        stem = storage_path
    return f"{stem}-browser-h264.mp4"


def create_browser_normalized_video(source_path, out_dir):
    output_path = out_dir / "browser-preview.mp4"
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
            "-c:v",
            "libx264",
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
    )
    return output_path


def upload_browser_normalized_video(supabase, storage_path, preview_path):
    preview_storage_path = normalized_preview_storage_path(storage_path)
    with preview_path.open("rb") as handle:
        supabase.storage.from_(BUCKET).upload(
            preview_storage_path,
            handle,
            {"content-type": "video/mp4", "upsert": "true"},
        )
    return preview_storage_path


def build_media_metadata(existing_metadata, source_probe, normalized_preview=None):
    metadata = existing_metadata if isinstance(existing_metadata, dict) else {}
    merged = dict(metadata)
    merged["sourceProbe"] = {
        "durationSeconds": round(float(source_probe.get("duration") or 0.0), 3),
        "formatName": source_probe.get("format_name"),
        "videoCodec": source_probe.get("video_codec"),
        "audioCodec": source_probe.get("audio_codec"),
        "width": source_probe.get("width"),
        "height": source_probe.get("height"),
        "pixelFormat": source_probe.get("pixel_format"),
        "frameRate": source_probe.get("frame_rate"),
        "videoProfile": source_probe.get("video_profile"),
    }
    if normalized_preview:
        merged["normalizedPreview"] = normalized_preview
    return merged


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


# Sensor cores in firework footage clip to white; sampling them as "the colour" loses the
# actual hue. We split each frame into:
#   - chroma pixels: bright AND saturated AND below the clipped-white ceiling (this is where
#     the real firework colour lives — the warm shoulder around the white core),
#   - flash pixels: very bright pixels regardless of saturation (used as a "did it explode?" signal).
# Palettes are derived from chroma pixels, not the mean of all bright pixels.
_CHROMA_MIN_VALUE = 70
_CHROMA_MAX_VALUE = 248
_CHROMA_MIN_SAT = 40
_FLASH_VALUE = 220


def _extract_palette(small_bgr, max_colors=5):
    """Return (hex_palette, flashIntensity 0..1, coverage 0..1) for one BGR frame."""
    if small_bgr.size == 0:
        return [], 0.0, 0.0
    hsv = cv2.cvtColor(small_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    flash_intensity = float(np.mean(v > _FLASH_VALUE))
    chroma_mask = (v > _CHROMA_MIN_VALUE) & (v < _CHROMA_MAX_VALUE) & (s > _CHROMA_MIN_SAT)
    pixel_count = small_bgr.shape[0] * small_bgr.shape[1]
    coverage = float(np.count_nonzero(chroma_mask) / max(1, pixel_count))

    chroma_pixels = small_bgr[chroma_mask]
    if chroma_pixels.shape[0] < 24:
        # Fallback: take any bright-ish pixels so we still surface *some* colour rather than
        # silently emitting an empty palette (which the model otherwise reads as "white").
        soft_mask = v > 130
        soft_pixels = small_bgr[soft_mask]
        if soft_pixels.shape[0] == 0:
            return [], flash_intensity, coverage
        return [bgr_to_hex(np.median(soft_pixels, axis=0))], flash_intensity, coverage

    # Bin by hue into 18 buckets of 10 degrees. Median colour per top bucket.
    # IMPORTANT: shift hue by +10 (mod 180) before binning. Red sits at both ends of the
    # OpenCV hue range (≈0 and ≈179) and a naive histogram splits it across bin 0 and
    # bin 17, dropping red below the per-bin threshold even when it dominates the frame.
    # The shift collapses all red into bin 0.
    chroma_hsv = hsv[chroma_mask]
    shifted_hue = (chroma_hsv[:, 0].astype(np.int32) + 10) % 180
    hue_hist, hue_edges = np.histogram(shifted_hue, bins=18, range=(0, 180))
    bin_order = np.argsort(hue_hist)[::-1]
    palette = []
    min_count = max(20, int(chroma_pixels.shape[0] * 0.04))
    for bin_idx in bin_order[:max_colors]:
        if hue_hist[bin_idx] < min_count:
            break
        in_bin = (
            (shifted_hue >= hue_edges[bin_idx])
            & (shifted_hue < hue_edges[bin_idx + 1])
        )
        bin_pixels = chroma_pixels[in_bin]
        if bin_pixels.size == 0:
            continue
        palette.append(bgr_to_hex(np.median(bin_pixels, axis=0)))
    return palette, flash_intensity, coverage


def _region_colors(small_bgr):
    """Dominant colour per vertical region — distinguishes head vs trail vs ground-level mine."""
    rows = small_bgr.shape[0]
    bands = {
        "upper": small_bgr[: rows // 3],
        "middle": small_bgr[rows // 3 : 2 * rows // 3],
        "lower": small_bgr[2 * rows // 3 :],
    }
    out = {}
    for label, band in bands.items():
        palette, _, _ = _extract_palette(band, max_colors=2)
        out[label] = palette[0] if palette else None
    return out


def _coarse_brightness_curve(capture, duration, samples_per_second=12):
    """Cheap brightness scan to find candidate burst times; used to pick detail-sample timestamps."""
    if duration <= 0:
        return []
    samples = max(48, min(360, int(duration * samples_per_second)))
    times = np.linspace(0, max(0.01, duration - 0.02), samples)
    out = []
    for seconds in times:
        capture.set(cv2.CAP_PROP_POS_MSEC, float(seconds) * 1000)
        ok, frame = capture.read()
        if not ok:
            continue
        tiny = cv2.resize(frame, (96, 54), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(tiny, cv2.COLOR_BGR2GRAY)
        out.append((float(seconds), float(np.mean(gray))))
    return out


def _peak_times(curve, max_peaks=80, min_separation_seconds=0.18):
    if len(curve) < 3:
        return [t for t, _ in curve]
    values = np.array([c[1] for c in curve], dtype=np.float32)
    times = np.array([c[0] for c in curve], dtype=np.float32)
    if values.max() <= values.min():
        return []
    norm = (values - values.min()) / (values.max() - values.min())
    threshold = max(0.4, float(np.mean(norm) + 0.55 * np.std(norm)))
    sample_dt = float(times[1] - times[0]) if len(times) > 1 else 0.05
    min_distance_indices = max(1, int(round(min_separation_seconds / max(sample_dt, 1e-3))))
    indices = find_local_peaks(norm.tolist(), threshold, min_distance_indices)
    indices = sorted(indices, key=lambda i: norm[i], reverse=True)[:max_peaks]
    return sorted({round(float(times[i]), 3) for i in indices})


def _sample_evenly(values, limit):
    if limit <= 0:
        return []
    if len(values) <= limit:
        return values
    indices = np.linspace(0, len(values) - 1, limit)
    return [values[int(round(i))] for i in indices]


def _build_timeline(peak_times, frames):
    """One entry per detected burst with the colour palette of the closest detail frame.

    The model keeps drifting on timing when given only a list of seconds, so we hand it a
    pre-resolved list it can copy 1:1 into shotSequence.shots and observedEvents.
    """
    if not peak_times or not frames:
        return []
    timeline = []
    for t in peak_times:
        nearest = min(frames, key=lambda f: abs(f["timeSeconds"] - t))
        timeline.append(
            {
                "burstTimeSeconds": round(float(t), 3),
                "colors": list(nearest.get("peakColors") or []),
                "regionColors": dict(nearest.get("regionColors") or {}),
                "flashIntensity": nearest.get("flashIntensity"),
            }
        )
    return timeline


def _global_palette(per_frame_palettes, max_colors=6):
    """Aggregate per-frame palettes into a 'show palette' weighted by brightness coverage."""
    weighted_hsv = []
    for entry in per_frame_palettes:
        weight = max(0.05, entry.get("brightCoverage") or 0.05)
        for hex_color in entry.get("peakColors") or []:
            try:
                rgb = np.array(
                    [int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)],
                    dtype=np.uint8,
                )
            except (ValueError, IndexError):
                continue
            bgr = rgb[::-1].reshape(1, 1, 3)
            hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[0, 0]
            weighted_hsv.append((float(hsv[0]), float(hsv[1]), float(hsv[2]), float(weight)))
    if not weighted_hsv:
        return []
    arr = np.array(weighted_hsv, dtype=np.float32)
    hue_bins = 18
    histogram = np.zeros(hue_bins, dtype=np.float32)
    bucketed = {}
    for hue, sat, val, weight in arr:
        # Same +10 shift as the per-frame histogram so red doesn't split across both ends
        # and slip below the dominance threshold.
        shifted = (hue + 10.0) % 180.0
        bin_idx = min(hue_bins - 1, int(shifted / (180.0 / hue_bins)))
        histogram[bin_idx] += weight
        bucketed.setdefault(bin_idx, []).append((hue, sat, val, weight))
    order = np.argsort(histogram)[::-1]
    palette = []
    for bin_idx in order[:max_colors]:
        if histogram[bin_idx] <= 0:
            break
        members = bucketed.get(int(bin_idx)) or []
        if not members:
            continue
        weights = np.array([m[3] for m in members], dtype=np.float32)
        members_arr = np.array([(m[0], m[1], m[2]) for m in members], dtype=np.float32)
        weighted = (members_arr.T * weights).sum(axis=1) / max(1e-6, weights.sum())
        hsv_pixel = np.array([[weighted]], dtype=np.uint8)
        bgr_pixel = cv2.cvtColor(hsv_pixel, cv2.COLOR_HSV2BGR)[0, 0]
        palette.append(bgr_to_hex(bgr_pixel))
    return palette


def analyse_frames(path, duration):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError("Could not open video for frame analysis")

    try:
        # Coarse brightness scan first so we can spend our detail-sample budget at the bursts,
        # not just at uniform-spaced timestamps that often miss the actual flash.
        coarse = _coarse_brightness_curve(capture, duration, samples_per_second=12)
        peak_times = _peak_times(coarse, max_peaks=min(80, max(14, int(duration * 2.2))))

        uniform_count = min(48, max(8, int(duration * 1.6)))
        uniform_times = np.linspace(0, max(0.01, duration - 0.05), uniform_count).tolist()
        peak_candidates = sorted({round(float(t), 3) for t in peak_times})
        uniform_candidates = sorted(
            {
                round(float(t), 3)
                for t in uniform_times
                if all(abs(float(t) - p) > 0.08 for p in peak_candidates)
            }
        )
        # Keep all detected peaks when possible, then fill the remaining detail budget
        # evenly through the whole clip. This stops long multi-shot cakes from only
        # sampling their first few seconds.
        detail_cap = min(90, max(32, int(duration * 1.6)))
        if len(peak_candidates) >= detail_cap:
            all_times = _sample_evenly(peak_candidates, detail_cap)
        else:
            all_times = sorted(
                {
                    *peak_candidates,
                    *_sample_evenly(uniform_candidates, detail_cap - len(peak_candidates)),
                }
            )

        frames = []
        for idx, seconds in enumerate(all_times):
            capture.set(cv2.CAP_PROP_POS_MSEC, float(seconds) * 1000)
            ok, frame = capture.read()
            if not ok:
                continue
            # Bigger sample (480x270) lets the LLM see colour gradients on trails and embers.
            small = cv2.resize(frame, (480, 270), interpolation=cv2.INTER_AREA)
            peak_colors, flash_intensity, coverage = _extract_palette(small, max_colors=5)
            region = _region_colors(small)
            mean_v = float(np.mean(cv2.cvtColor(small, cv2.COLOR_BGR2HSV)[:, :, 2]) / 255.0)
            _, encoded = cv2.imencode(".jpg", small, [int(cv2.IMWRITE_JPEG_QUALITY), 86])
            frames.append(
                {
                    "index": idx,
                    "timeSeconds": round(float(seconds), 3),
                    "brightCoverage": round(coverage, 4),
                    "flashIntensity": round(flash_intensity, 4),
                    "meanBrightness": round(mean_v, 4),
                    "isPeak": any(abs(seconds - p) < 0.06 for p in peak_times),
                    "peakColors": peak_colors,
                    "regionColors": region,
                    "jpegBase64": base64.b64encode(encoded).decode("ascii"),
                }
            )
    finally:
        capture.release()

    summary = [
        {key: value for key, value in frame.items() if key != "jpegBase64"}
        for frame in frames
    ]
    global_palette = _global_palette(summary)
    timeline = _build_timeline(peak_times, summary)
    return (
        {
            "globalPalette": global_palette,
            "peakTimesSeconds": [round(t, 3) for t in peak_times],
            "timeline": timeline,
            "frames": summary,
        },
        # Send up to 16 images, biased to peak frames so the model sees the actual bursts.
        sorted(frames, key=lambda f: (not f["isPeak"], -f["brightCoverage"]))[:16],
    )


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


def _clamp_confidence(value):
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.5
    return max(0.0, min(1.0, numeric))


def _coerce_enum(value, allowed, fallback):
    if value in allowed:
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        for item in allowed:
            if lowered == str(item).lower():
                return item
        synonyms = {
            "firework": "custom",
            "fireworks": "custom",
            "single shot": "single_shot",
            "single-shot": "single_shot",
            "single": "single_shot",
            "burst": "break",
        }
        mapped = synonyms.get(lowered)
        if mapped in allowed:
            return mapped
    return fallback


_TEXT_COLOR_MAP = [
    ("red", "#FF0043"),
    ("green", "#14FC56"),
    ("blue", "#1E7FFF"),
    ("purple", "#E60AFF"),
    ("violet", "#E60AFF"),
    ("gold", "#FFBF36"),
    ("golden", "#FFBF36"),
    ("silver", "#FFFFFF"),
    ("white", "#FFFFFF"),
]


def _is_hex_color(value):
    return isinstance(value, str) and re.match(r"^#[0-9a-fA-F]{6}$", value) is not None


def _dedupe_colors(values):
    out = []
    seen = set()
    for value in values or []:
        if not _is_hex_color(value):
            continue
        color = value.upper()
        if color in seen:
            continue
        seen.add(color)
        out.append(color)
    return out


def _palette_from_text(*parts):
    text = " ".join(str(part or "") for part in parts).lower()
    colors = []
    for word, color in _TEXT_COLOR_MAP:
        if re.search(rf"\b{re.escape(word)}\b", text):
            colors.append(color)
    return _dedupe_colors(colors)


def _is_white_color(value):
    if not _is_hex_color(value):
        return False
    r = int(value[1:3], 16)
    g = int(value[3:5], 16)
    b = int(value[5:7], 16)
    return r > 224 and g > 224 and b > 224


def _first_non_white(colors):
    for color in colors:
        if not _is_white_color(color):
            return color
    return colors[0] if colors else None


_LAYER_ROLES = {
    "primary_stars",
    "secondary_stars",
    "micro_sparks",
    "trail_sparks",
    "glitter",
    "strobe",
    "crackle",
    "smoke",
    "flash",
    "falling_leaves",
    "comets",
    "embers",
}

_LAYER_ROLE_SYNONYMS = {
    "primary": "primary_stars",
    "stars": "primary_stars",
    "secondary": "secondary_stars",
    "trails": "trail_sparks",
    "trail": "trail_sparks",
    "sparks": "micro_sparks",
    "ember": "embers",
    "comet": "comets",
}


def _coerce_layer_role(value):
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in _LAYER_ROLES:
            return lowered
        mapped = _LAYER_ROLE_SYNONYMS.get(lowered)
        if mapped:
            return mapped
    return "primary_stars"


def _coerce_effect_layers(value):
    if isinstance(value, list):
        result = []
        for index, entry in enumerate(value):
            if not isinstance(entry, dict):
                continue
            layer = dict(entry)
            layer["role"] = _coerce_layer_role(layer.get("role"))
            if not isinstance(layer.get("id"), str) or not layer["id"].strip():
                layer["id"] = f"{layer['role']}_{index}"
            result.append(layer)
        return result
    if isinstance(value, dict):
        result = []
        for index, (key, entry) in enumerate(value.items()):
            if not isinstance(entry, dict):
                continue
            layer = dict(entry)
            layer["role"] = _coerce_layer_role(layer.get("role") or key)
            if not isinstance(layer.get("id"), str) or not layer["id"].strip():
                layer["id"] = str(key) if isinstance(key, str) and key.strip() else f"{layer['role']}_{index}"
            result.append(layer)
        return result
    return []


_SHELL_FAMILIES = [
    "chrysanthemum",
    "ghost",
    "strobe",
    "palm",
    "ring",
    "crossette",
    "floral",
    "falling_leaves",
    "willow",
    "crackle",
    "horsetail",
    "peony",
    "comet",
    "mine",
    "custom",
]


def _infer_shell_family(effect_spec, observations):
    text = " ".join(
        str(part or "")
        for part in [
            effect_spec.get("name"),
            effect_spec.get("description"),
            observations.get("unknowns") if isinstance(observations, dict) else "",
        ]
    ).lower()
    for family in _SHELL_FAMILIES:
        if family.replace("_", " ") in text or family in text:
            return family
    if "willow" in text or "brocade" in text:
        return "willow"
    if "crackle" in text:
        return "crackle"
    if "strobe" in text:
        return "strobe"
    return "peony"


def normalize_import_spec(spec, source_name, duration):
    if not isinstance(spec, dict):
        raise RuntimeError("Model output must be a JSON object")

    normalized = dict(spec)
    effect_spec = normalized.get("effectSpec")
    if not isinstance(effect_spec, dict):
        effect_spec = {}
    effect_spec = dict(effect_spec)

    inferred_name = (
        normalized.get("name")
        or effect_spec.get("name")
        or f"Inferred effect from {source_name}"
    )

    normalized["name"] = str(inferred_name)
    normalized["description"] = normalized.get("description", None)
    normalized["durationSeconds"] = float(normalized.get("durationSeconds") or duration)
    normalized["confidence"] = _clamp_confidence(normalized.get("confidence"))

    version = int(effect_spec.get("version") or 3)
    effect_spec["version"] = version if version in (2, 3) else 3
    effect_spec["name"] = str(effect_spec.get("name") or normalized["name"])
    effect_spec["source"] = _coerce_enum(
        effect_spec.get("source"),
        ["manual", "video_inferred", "llm_generated", "catalogue", "legacy_migrated"],
        "video_inferred",
    )
    effect_spec["confidence"] = _clamp_confidence(effect_spec.get("confidence", normalized["confidence"]))
    effect_spec["seed"] = int(effect_spec.get("seed") or 1)
    type_allowed = ["shell", "cake", "mine", "comet", "single_shot", "combo", "custom"] if effect_spec["version"] == 3 else ["shell", "cake", "candle", "mine", "comet", "single_shot", "rocket", "fountain", "flame", "combo", "custom"]
    effect_spec["type"] = _coerce_enum(
        effect_spec.get("type"),
        type_allowed,
        "custom",
    )
    effect_spec["durationSeconds"] = float(effect_spec.get("durationSeconds") or normalized["durationSeconds"])
    effect_spec["renderProfile"] = effect_spec.get("renderProfile") if isinstance(effect_spec.get("renderProfile"), dict) else {}
    effect_spec["launch"] = effect_spec.get("launch") if isinstance(effect_spec.get("launch"), dict) else {}
    effect_spec["audio"] = effect_spec.get("audio") if isinstance(effect_spec.get("audio"), dict) else {}
    effect_spec["metadata"] = effect_spec.get("metadata") if isinstance(effect_spec.get("metadata"), dict) else {}

    color_palette = effect_spec.get("colorPalette")
    color_palette = color_palette if isinstance(color_palette, list) else []
    color_palette = _dedupe_colors(
        [
            *color_palette,
            *_palette_from_text(source_name, normalized["name"], normalized["description"]),
        ]
    )
    if not color_palette:
        color_palette = ["#FFFFFF"]
    effect_spec["colorPalette"] = color_palette

    observations = normalized.get("observations")
    if not isinstance(observations, dict):
        observations = {}

    if effect_spec["version"] == 3:
        shell = effect_spec.get("shell")
        if not isinstance(shell, dict):
            shell = {}
        shell["family"] = _coerce_enum(shell.get("family"), _SHELL_FAMILIES, _infer_shell_family(effect_spec, observations))
        shell["size"] = float(shell.get("size") or 3)
        shell["starDensity"] = float(shell.get("starDensity") or 1)
        shell_palette = _dedupe_colors(
            [
                *(shell.get("colorPalette") if isinstance(shell.get("colorPalette"), list) else []),
                shell.get("outerColor"),
                shell.get("color"),
                shell.get("secondColor"),
                shell.get("innerColor"),
                shell.get("pistilColor"),
                *color_palette,
            ]
        )
        if not shell_palette:
            shell_palette = color_palette
        shell["colorPalette"] = shell_palette
        shell_color = shell.get("outerColor") or shell.get("color")
        shell["color"] = shell_color if _is_hex_color(shell_color) else _first_non_white(shell_palette)
        if not shell.get("secondColor"):
            second = next((color for color in shell_palette if color != shell["color"] and not _is_white_color(color)), None)
            if second:
                shell["secondColor"] = second
        if not shell.get("pistilColor"):
            white = next((color for color in shell_palette if _is_white_color(color)), None)
            if white and any(not _is_white_color(color) for color in shell_palette):
                shell["pistil"] = True
                shell["pistilColor"] = white
        shell["glitter"] = _coerce_enum(shell.get("glitter"), ["none", "light", "medium", "heavy", "thick", "streamer", "willow"], "light")
        shell["smokeAmount"] = float(shell.get("smokeAmount") or 0.28)
        effect_spec["shell"] = shell

        launch = effect_spec["launch"]
        launch["enabled"] = bool(launch.get("enabled", True))
        launch["fuseTimeSeconds"] = float(launch.get("fuseTimeSeconds") or 0)
        launch["liftTimeSeconds"] = float(launch.get("liftTimeSeconds") or 1.15)
        launch["heightMeters"] = float(launch.get("heightMeters") or effect_spec.get("heightMeters") or 60)
        launch["startPosition"] = launch.get("startPosition") if isinstance(launch.get("startPosition"), dict) else {"x": 0, "y": 0, "z": 0}
        launch["panDegrees"] = float(launch.get("panDegrees") or 0)
        launch["tiltDegrees"] = float(launch.get("tiltDegrees") or 90)
        launch_palette = _palette_from_text(source_name, "tail", launch.get("tailType"), launch.get("description"))
        launch["tracerColor"] = launch.get("tracerColor") or (launch_palette[0] if launch_palette else color_palette[0])
        if not launch.get("tailColor"):
            launch["tailColor"] = launch["tracerColor"]
        effect_spec["launch"] = launch
        effect_spec["heightMeters"] = launch["heightMeters"]
        normalized["heightMeters"] = launch["heightMeters"]

        shots = effect_spec.get("shots")
        if not isinstance(shots, list) or not shots:
            shots = [{"index": 0, "timeOffsetSeconds": 0, "position": {"x": 0, "y": 0, "z": 0}, "scale": 1, "seedOffset": 0}]
        normalized_shots = []
        for index, shot in enumerate(shots):
            if not isinstance(shot, dict):
                shot = {}
            shot_palette = _dedupe_colors(
                [
                    *(shot.get("colorPalette") if isinstance(shot.get("colorPalette"), list) else []),
                    *(shot.get("colors") if isinstance(shot.get("colors"), list) else []),
                    shot.get("color"),
                    *color_palette,
                ]
            )
            burst_time = shot.get("burstTimeSeconds")
            if burst_time is not None and not shot.get("timeOffsetSeconds"):
                try:
                    shot["timeOffsetSeconds"] = max(0.0, float(burst_time) - launch["liftTimeSeconds"])
                except (TypeError, ValueError):
                    pass
            normalized_shots.append({
                **shot,
                "index": int(shot.get("index", index)),
                "timeOffsetSeconds": max(0.0, min(60.0, float(shot.get("timeOffsetSeconds") or 0))),
                "position": shot.get("position") if isinstance(shot.get("position"), dict) else {"x": 0, "y": 0, "z": 0},
                "scale": float(shot.get("scale") or 1),
                "seedOffset": int(shot.get("seedOffset") or index * 101),
                "colorPalette": shot_palette,
                "color": shot.get("color") or _first_non_white(shot_palette),
                "tailColor": shot.get("tailColor") or launch.get("tailColor"),
                "liftTimeSeconds": float(shot.get("liftTimeSeconds") or launch["liftTimeSeconds"]),
                "heightMeters": float(shot.get("heightMeters") or launch["heightMeters"]),
            })
        effect_spec["shots"] = normalized_shots
        effect_spec["metadata"]["normalizedAs"] = "FireworkEffectSpecV3"
        normalized["effectSpec"] = effect_spec
    else:
        effect_spec["heightMeters"] = float(effect_spec.get("heightMeters") or 60)
        normalized["heightMeters"] = effect_spec["heightMeters"]

    shot_sequence = effect_spec.get("shotSequence")
    if not isinstance(shot_sequence, dict):
        shot_sequence = {}
    shots = (
        effect_spec.get("shots")
        if effect_spec["version"] == 3 and isinstance(effect_spec.get("shots"), list)
        else shot_sequence.get("shots")
    )
    if not isinstance(shots, list):
        shots = []
    shot_count = int(shot_sequence.get("shotCount") or max(1, len(shots)))
    shot_sequence["shotCount"] = max(1, shot_count)
    shot_sequence["durationSeconds"] = float(shot_sequence.get("durationSeconds") or effect_spec["durationSeconds"])
    shot_sequence["cadenceMode"] = _coerce_enum(
        shot_sequence.get("cadenceMode"),
        ["even", "custom", "accelerando", "decelerando", "volleys", "zipper", "randomized"],
        "custom",
    )
    shot_sequence["firingPattern"] = _coerce_enum(
        shot_sequence.get("firingPattern"),
        ["STR", "STL", "STT", "FNR", "FNL", "FNT", "Z_SHAPE", "W_SHAPE", "V_SHAPE", "CENTER_OUT", "OUTSIDE_IN", "CUSTOM"],
        "CUSTOM",
    )
    shot_sequence["shots"] = shots
    effect_spec["shotSequence"] = shot_sequence

    if effect_spec["version"] == 2:
        effect_spec["effectLayers"] = _coerce_effect_layers(effect_spec.get("effectLayers"))

    normalized["effectSpec"] = effect_spec

    raw_events = observations.get("observedEvents")
    normalized_events = []
    if isinstance(raw_events, list):
        for event in raw_events:
            if not isinstance(event, dict):
                continue
            normalized_events.append(
                {
                    **event,
                    "timeSeconds": max(0.0, min(60.0, float(event.get("timeSeconds") or 0.0))),
                    "type": _coerce_enum(
                        event.get("type"),
                        ["launch", "mine", "break", "secondary_break", "crackle", "strobe", "glitter", "smoke", "fade", "report", "unknown"],
                        "unknown",
                    ),
                    "confidence": _clamp_confidence(event.get("confidence")),
                }
            )
    observations["observedEvents"] = normalized_events
    observations["unknowns"] = observations.get("unknowns") if isinstance(observations.get("unknowns"), list) else []
    review_fields = observations.get("suggestedManualReviewFields")
    observations["suggestedManualReviewFields"] = review_fields if isinstance(review_fields, list) else ["effectSpec"]
    observations["confidence"] = _clamp_confidence(observations.get("confidence", normalized["confidence"]))
    normalized["observations"] = observations

    return normalized


def validate_import_spec(spec):
    try:
        jsonschema.validate(instance=spec, schema=SPEC_SCHEMA)
    except jsonschema.ValidationError as exc:
        path = ".".join(str(p) for p in (exc.absolute_path or [])) or "(root)"
        raise RuntimeError(f"Model output failed schema validation at {path}: {exc.message}") from exc


def call_openrouter(model, source_name, duration, frame_summary, frame_images, audio, refinement_prompt):
    api_key = env_required("OPENROUTER_API_KEY")
    global_palette = frame_summary.get("globalPalette") or []
    peak_times = frame_summary.get("peakTimesSeconds") or []
    timeline = frame_summary.get("timeline") or []
    instructions = (
        "Reconstruct this consumer firework video as a parametric 3D particle animation by "
        "filling in a structured FireworkEffectSpecV3. The renderer owns visual fidelity; your "
        "job is to capture what was actually fired (counts, timings, colours, shapes), not to "
        "describe per-frame drawings.\n"
        "\n"
        "OUTPUT: a single JSON object only (no markdown fences, no commentary). Top-level keys: "
        "name, description (string or null), durationSeconds, confidence, effectSpec, observations.\n"
        "\n"
        "TIMELINE IS AUTHORITATIVE. The `timeline` array lists every detected burst with its "
        "`burstTimeSeconds` and the chroma actually observed at that moment. You MUST emit "
        "exactly one shot in effectSpec.shots per timeline entry, in order, and the resulting "
        "burst time (`shot.timeOffsetSeconds + effectSpec.launch.liftTimeSeconds`) must equal "
        "`burstTimeSeconds` within ±0.05s. Set `effectSpec.launch.liftTimeSeconds` so each launch "
        "begins 0.6–1.4s before its burst. Mirror each timeline entry as a `break` observedEvent at the "
        "same `timeSeconds`. Do not invent extra bursts and do not skip any.\n"
        "\n"
        "COLOUR — read this carefully. Sources of truth, in priority order:\n"
        "  1. `timeline[i].colors` — the chroma at burst i. The effect colorPalette and the "
        "associated `break` observedEvent's `color` MUST come from this list.\n"
        "  2. `timeline[i].regionColors` (upper/middle/lower) — drives layered colour "
        "gradients (e.g. upper=blue head, lower=gold trail).\n"
        "  3. `globalPalette` — weighted top hues across the whole show; use it to populate the "
        "spec-level `colorPalette` (3–6 hues).\n"
        "  4. Product/source name colour words are authoritative when the image is clipped or "
        "dim (e.g. 'Silver tail to Red' means silver/white launch tail and red burst; "
        "'Red Green and Blue' means all three burst colours must appear).\n"
        "Do NOT default to white or yellow. White is only allowed when a timeline entry has "
        "`flashIntensity > 0.5` AND its `colors` array is empty (a true white strobe). If a "
        "timeline entry's colors include '#C9302F' or '#3FA7FF', the corresponding break event "
        "and break colorPalette MUST list that exact hue — never substitute '#FFFFFF'.\n"
        "For multicolour shells: use effectSpec.colorPalette and each shot.colorPalette. "
        "Set shell.color/outerColor to the OUTER or dominant non-white colour, set shell.pistil=true "
        "and shell.pistilColor/innerColor for a white or coloured centre, and set shell.secondColor "
        "only when there is a visible secondary outer colour or a colour change over time. "
        "A red outside / white inside shell is NOT white: shell.color='#FF0043', "
        "shell.pistil=true, shell.pistilColor='#FFFFFF', colorPalette includes both.\n"
        "\n"
        "AUDIO. `audio.onsets` and `audio.energyPeaks` are launch/report cues. Use them to "
        "place launches before the matching timeline burst (0.6–1.4s lead) and reports at the "
        "burst time itself.\n"
        "\n"
        "STRUCTURE.\n"
        "- effectSpec.version = 3, source = 'video_inferred', seed = any int.\n"
        "- effectSpec.type chosen from shell, cake, mine, comet, single_shot, combo, custom "
        "(cakes have many shots over time; choose 'shell' only "
        "for a single rising-then-bursting effect).\n"
        "- effectSpec.shell is required. Use family ∈ chrysanthemum, ghost, strobe, palm, ring, "
        "crossette, floral, falling_leaves, willow, crackle, horsetail, peony, comet, mine, custom. "
        "Include size, starDensity, color, outerColor, innerColor, colorPalette, secondColor when seen, "
        "glitter, glitterColor, pistil, pistilColor, streamers, crackle/strobe/horsetail booleans, "
        "tailType when the lift has a flare/silver/gold/crackle trail, and smokeAmount.\n"
        "- effectSpec.launch is required. Include fuseTimeSeconds, liftTimeSeconds, heightMeters, "
        "panDegrees, tiltDegrees, tracerColor, tailColor, tailType, sparkFrequency, sparkLifeMs, "
        "sparkSpeed, randomWobble. Silver tail means tracerColor/tailColor '#FFFFFF' and a streamer tail.\n"
        "- effectSpec.shots: ONE entry per visible launch/break. Cakes, fans, "
        "zippers, rows and volleys MUST be represented as multiple shots, not one giant burst. "
        "Each shot needs index, timeOffsetSeconds (the launch start time, so burst time = "
        "timeOffsetSeconds + liftTimeSeconds), position {x,y,z}, panDegrees/tiltDegrees if "
        "different from launch, scale, seedOffset, colorPalette, color, tailColor, heightMeters. "
        "Do not embed per-shot particle layers.\n"
        "- launch.tracerColor must come from observed launch-time chroma, not "
        "white, when `peakColors` at the launch time has chroma.\n"
        "\n"
        "OBSERVATIONS. observations.observedEvents[].type ∈ {launch, mine, break, "
        "secondary_break, crackle, strobe, glitter, smoke, fade, report, unknown}. Each event "
        "needs timeSeconds, type, color (hex), confidence; estimatedHeight and description "
        "encouraged. Also include `unknowns`, `suggestedManualReviewFields`, `confidence`.\n"
        "\n"
        "RANGES. Times within [0, durationSeconds]. launch.heightMeters 6–120 for these preview clips "
        "(prefer 35–80 unless the frame clearly reaches very high). launch.liftTimeSeconds 0.7–1.8. "
        "shell.size 0.2–8, starDensity 0.1–3, shell duration/star life should preserve long fades and trails.\n"
        "\n"
        "BAD OUTPUT TO AVOID: a generic single gold chrysanthemum like "
        "{\"shellType\":\"crysanthemum\",\"spreadSize\":4.6,\"starLifeMs\":1400,\"color\":\"#ffbf36\",\"glitter\":\"light\"}. "
        "That is a fallback, not a reconstruction.\n"
    )

    context = (
        f"Source name: {source_name}. Duration: {duration:.3f}s.\n"
        f"Global palette (weighted, white-clipped cores excluded): {json.dumps(global_palette)}.\n"
        f"Peak burst timestamps (seconds): {json.dumps(peak_times)}.\n"
        f"Timeline (one entry per burst — emit one shot per entry): {json.dumps(timeline)}.\n"
        f"Per-frame analysis: {json.dumps(frame_summary.get('frames'))[:14000]}.\n"
        f"Audio analysis: {json.dumps(audio)[:6000]}.\n"
        f"Refinement request: {refinement_prompt or 'none'}.\n"
    )

    content = [{"type": "text", "text": instructions + "\n" + context}]
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
    spec = normalize_import_spec(parse_model_json(message), source_name, duration)
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

        source_probe = ffprobe_media(video_path)
        duration = float(source_probe.get("duration") or 0.0)
        if duration > MAX_DURATION_SECONDS:
            raise RuntimeError(f"Video is {duration:.2f}s; maximum is 60s")

        analysis_video_path = video_path
        preview_metadata = None
        if needs_browser_normalization(source_probe):
            try:
                normalized_video_path = create_browser_normalized_video(video_path, tmp_dir)
                normalized_probe = ffprobe_media(normalized_video_path)
                preview_storage_path = upload_browser_normalized_video(
                    supabase,
                    storage_path,
                    normalized_video_path,
                )
                preview_metadata = {
                    "storagePath": preview_storage_path,
                    "mimeType": "video/mp4",
                    "videoCodec": normalized_probe.get("video_codec"),
                    "audioCodec": normalized_probe.get("audio_codec"),
                }
                analysis_video_path = normalized_video_path
            except Exception as exc:
                print(f"browser normalization failed for {job_id}: {exc}")

        supabase.table("media_assets").update(
            {
                "duration_seconds": duration,
                "width": source_probe.get("width"),
                "height": source_probe.get("height"),
                "metadata": build_media_metadata(
                    media.get("metadata"),
                    source_probe,
                    normalized_preview=preview_metadata,
                ),
            }
        ).eq("id", media_id).execute()
        supabase.table("import_jobs").update({"processing_progress": 20}).eq("id", job_id).execute()

        frame_summary, frame_images = analyse_frames(analysis_video_path, duration)
        supabase.table("import_outputs").insert(
            {
                "import_job_id": job_id,
                "output_type": "frame_analysis",
                "payload": frame_summary,
            }
        ).execute()

        supabase.table("import_jobs").update({"processing_progress": 45}).eq("id", job_id).execute()
        audio_path = extract_audio(analysis_video_path, tmp_dir)
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
