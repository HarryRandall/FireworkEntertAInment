"""Bounded local FFmpeg decoding onto a fixed image and audio measurement clock."""

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np

# Operational input limits, chosen for whole-cake CPU work rather than arbitrary movies.
MAX_BYTES = 64 * 1024 * 1024
MAX_DURATION_S = 120
MAX_SOURCE_PIXELS = 3840 * 2160
DECODE_TIMEOUT_S = 180
# Analysis raster and clock: visual tuning balancing small sparks against CPU memory.
WIDTH = 256
HEIGHT = 192
FPS = 20
AUDIO_RATE = 8000
RGB_CHANNELS = 3
MS_PER_SECOND = 1000


@dataclass
class Clip:
    """RGB uint8 frames and mono float32 audio, both starting at the MP4 presentation origin."""

    frames: np.ndarray
    audio: np.ndarray
    duration_s: float
    content_box: tuple[int, int, int, int]


def run_decoder(arguments: list[str]) -> bytes:
    """Run an argument-only subprocess with a wall-clock cap; never expose media diagnostics."""
    try:
        return subprocess.run(
            arguments, check=True, capture_output=True, timeout=DECODE_TIMEOUT_S
        ).stdout
    except (subprocess.SubprocessError, OSError):
        raise ValueError("Media decoder failed or exceeded its deadline") from None


def probe_video(path: Path) -> tuple[dict, bool]:
    """Validate MP4 metadata, source budgets and geometry assumptions; report audio presence."""
    if not 0 < path.stat().st_size <= MAX_BYTES:
        raise ValueError("Video exceeds the byte budget or is empty")
    probe = json.loads(
        run_decoder(
            [
                "ffprobe",
                "-v",
                "error",
                "-protocol_whitelist",
                "file",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(path),
            ]
        )
    )
    if "mp4" not in probe["format"]["format_name"].split(","):
        raise ValueError("MP4 container required")
    duration = float(probe["format"]["duration"])
    streams = probe["streams"]
    video = next((stream for stream in streams if stream["codec_type"] == "video"), None)
    if video is None or not 0 < duration <= MAX_DURATION_S:
        raise ValueError("Video stream and bounded duration required")
    audio_stream = next((stream for stream in streams if stream["codec_type"] == "audio"), None)
    if (
        audio_stream
        and abs(float(audio_stream.get("start_time", 0)) - float(video.get("start_time", 0)))
        > 1 / FPS
    ):
        raise ValueError("Aligned audio and video presentation starts required")
    width = int(video["width"])
    height = int(video["height"])
    if not 0 < width * height <= MAX_SOURCE_PIXELS:
        raise ValueError("Source dimensions exceed the pixel budget")
    # Rotate/SAR metadata would invalidate normalised geometry; reject rather than guess.
    if video.get("sample_aspect_ratio", "1:1") not in ("1:1", "N/A") or any(
        side.get("rotation", 0) for side in video.get("side_data_list", [])
    ):
        raise ValueError("Square pixels and unrotated video required")
    return video, audio_stream is not None


def content_box(video: dict) -> tuple[int, int, int, int]:
    """Fit square-pixel dimensions into the fixed raster; return left/top/width/height in px."""
    width = int(video["width"])
    height = int(video["height"])
    scale = min(WIDTH / width, HEIGHT / height)
    scaled_width = max(2, int(width * scale) // 2 * 2)
    scaled_height = max(2, int(height * scale) // 2 * 2)
    box = ((WIDTH - scaled_width) // 2, (HEIGHT - scaled_height) // 2, scaled_width, scaled_height)
    return box


def decode_audio(
    common: list[str], temporary: Path, frame_count: int, has_audio: bool
) -> np.ndarray:
    """Return bounded mono float32 samples on the analysis clock; pad missing audio."""
    audio = np.zeros(frame_count * AUDIO_RATE // FPS, dtype=np.float32)
    if has_audio:
        audio_path = temporary / "audio.f32"
        run_decoder(
            common
            + [
                "-map",
                "0:a:0",
                "-vn",
                "-af",
                "asetpts=PTS-STARTPTS",
                "-ac",
                "1",
                "-ar",
                str(AUDIO_RATE),
                "-f",
                "f32le",
                str(audio_path),
            ]
        )
        samples = np.fromfile(audio_path, dtype="<f4")
        audio[: min(len(audio), len(samples))] = samples[: len(audio)]
    return audio


def decode(path: Path, temporary: Path) -> Clip:
    """Decode a bounded MP4 to disk-backed RGB and mono audio at a zero-based clock.

    File-only protocols prevent remote resources. Aspect ratio is preserved and
    content_box excludes black bars. The caller owns the temporary files lifetime.
    """
    video, has_audio = probe_video(path)
    box = content_box(video)
    scaled_width = box[2]
    scaled_height = box[3]
    frames_path = temporary / "frames.rgb"
    common = [
        "ffmpeg",
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-protocol_whitelist",
        "file",
        "-i",
        str(path),
        "-t",
        str(MAX_DURATION_S),
    ]
    run_decoder(
        common
        + [
            "-map",
            "0:v:0",
            "-an",
            "-vf",
            f"setpts=PTS-STARTPTS,fps={FPS},scale={scaled_width}:{scaled_height},"
            f"pad={WIDTH}:{HEIGHT}:{box[0]}:{box[1]}",
            "-frames:v",
            str(MAX_DURATION_S * FPS),
            "-pix_fmt",
            "rgb24",
            "-f",
            "rawvideo",
            str(frames_path),
        ]
    )
    frame_count = frames_path.stat().st_size // (WIDTH * HEIGHT * RGB_CHANNELS)
    if not frame_count:
        raise ValueError("No decoded frames")
    frames = np.memmap(
        frames_path, dtype=np.uint8, mode="r", shape=(frame_count, HEIGHT, WIDTH, RGB_CHANNELS)
    )
    audio = decode_audio(common, temporary, frame_count, has_audio)
    return Clip(frames, audio, frame_count / FPS, box)
