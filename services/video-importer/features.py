"""Image-space shot descriptors and launch/peak/fade crops for deterministic evidence."""

import math
from pathlib import Path

import numpy as np
from PIL import Image

from decode import AUDIO_RATE, FPS, MS_PER_SECOND, Clip
from onsets import VISIBLE_BYTE

# Visual tuning in normalised RGB: ignore near-white flashes for chromatic colour summaries.
COLOUR_SATURATION_FLOOR = 0.2
# Quantisation in byte units produces a small stable palette despite MP4 ringing.
COLOUR_BIN_BYTES = 32
PALETTE_SIZE = 3
# JSON colour/fraction precision in decimal places, sufficient for compressed byte RGB.
COLOUR_DECIMAL_PLACES = 4
# Projected angle precision in decimal places, avoiding meaningless sub-millidegree output.
ANGLE_DECIMAL_PLACES = 3
# Chromatic summaries use bright cores rather than low-intensity codec ringing (byte units).
COLOUR_BRIGHT_BYTE = 80
# Keep the most chromatic quarter of visible pixels to resist white-core/codec blending.
COLOUR_SATURATION_QUANTILE = 0.75
# Temporal sample spacing in seconds keeps per-shot JSON bounded.
COLOUR_INTERVAL_S = 0.25
# Early flight window in seconds estimates projected tilt before a burst dominates.
ANGLE_WINDOW_S = 0.45
# Tail-shape judgement: vertical extent must exceed width by this dimensionless ratio.
TRAIL_ASPECT_RATIO = 2.5
# Strobe proxy: fractional frame-brightness jumps above this threshold count as flicker.
FLICKER_CHANGE_FRACTION = 0.3
STROBE_MIN_CHANGES = 4
# Crackle proxy: audio energy above 2 kHz as a fraction of total spectral energy.
CRACKLE_HIGH_HZ = 2000
CRACKLE_ENERGY_FRACTION = 0.35
# PNG crop padding in pixels, a visual margin around the measured luminous envelope.
CROP_PADDING_PX = 4


def palette(pixels: np.ndarray) -> list[dict]:
    """Return up to three dominant chromatic RGB swatches and their pixel fractions."""
    values = pixels.astype(float)
    if not values.size:
        return []
    saturation = (values.max(axis=1) - values.min(axis=1)) / np.maximum(1, values.max(axis=1))
    values = values[
        (saturation >= COLOUR_SATURATION_FLOOR) & (values.max(axis=1) >= COLOUR_BRIGHT_BYTE)
    ]
    if not values.size:
        return []
    saturation = (values.max(axis=1) - values.min(axis=1)) / values.max(axis=1)
    values = values[saturation >= np.quantile(saturation, COLOUR_SATURATION_QUANTILE)]
    bins = (values // COLOUR_BIN_BYTES).astype(int)
    unique, counts = np.unique(bins, axis=0, return_counts=True)
    selected = np.argsort(-counts, kind="stable")[:PALETTE_SIZE]
    return [
        {
            "rgb": np.round(
                values[np.all(bins == unique[index], axis=1)].mean(axis=0) / np.iinfo(np.uint8).max,
                COLOUR_DECIMAL_PLACES,
            ).tolist(),
            "fraction": round(float(counts[index] / counts.sum()), COLOUR_DECIMAL_PLACES),
        }
        for index in selected
    ]


def frame_facts(frame: np.ndarray, box: tuple) -> dict:
    """Measure one content raster's luminous envelope, centroid and chromatic palette."""
    left, top, width, height = box
    content = frame[top : top + height, left : left + width]
    mask = content.max(axis=2) >= VISIBLE_BYTE
    rows, columns = np.nonzero(mask)
    if not len(rows):
        return {"energy": 0, "bounds": None, "centre": None, "palette": []}
    weights = content.max(axis=2)[mask].astype(float)
    return {
        "energy": float(weights.sum()),
        "bounds": [int(columns.min()), int(rows.min()), int(columns.max()), int(rows.max())],
        "centre": [
            float(np.dot(columns, weights) / weights.sum()),
            float(np.dot(rows, weights) / weights.sum()),
        ],
        "palette": palette(content[mask]),
    }


def colour_samples(facts: list[dict], start: int) -> list[dict]:
    """Sample chromatic palettes at fixed spacing with absolute video times in milliseconds."""
    return [
        {"t_ms": round((start + index) / FPS * MS_PER_SECOND), "colours": fact["palette"]}
        for index, fact in enumerate(facts)
        if index % max(1, round(COLOUR_INTERVAL_S * FPS)) == 0
    ]


def tail_length_px(facts: list[dict], peak: int) -> int:
    """Return greatest pre-peak vertical luminous extent in content pixels as a trail proxy."""
    return max(
        (
            fact["bounds"][3] - fact["bounds"][1]
            for fact in facts[: max(1, peak)]
            if fact["bounds"] is not None
        ),
        default=0,
    )


def describe_shot(clip: Clip, shot: dict, end_index: int, directory: Path, shot_index: int):
    """Compute image ratios, observed life in ms and evidence flags; save three PNG crops.

    Geometry is projected into the content raster, not metres. The observation window
    ends at the next launch, so overlapping effects are explicitly marked truncated.
    Crackle/strobe/trail are heuristic indicators, not effect-template classifications.
    Mutates shot x/angle fields; returns feature and keyframe records.
    """
    start = round(shot["t_ms"] / MS_PER_SECOND * FPS)
    facts = [frame_facts(frame, clip.content_box) for frame in clip.frames[start:end_index]]
    energies = np.array([fact["energy"] for fact in facts])
    visible = np.flatnonzero(energies > 0)
    if not len(visible):
        raise ValueError("Shot has no visible feature evidence")
    peak = max(visible, key=lambda index: facts[index]["bounds"][2] - facts[index]["bounds"][0])
    peak = int(peak)
    fade = int(visible[-1])
    bounds = np.array([fact["bounds"] for fact in facts if fact["bounds"] is not None])
    envelope = [
        int(bounds[:, 0].min()),
        int(bounds[:, 1].min()),
        int(bounds[:, 2].max()),
        int(bounds[:, 3].max()),
    ]
    width = clip.content_box[2]
    height = clip.content_box[3]
    angle = projected_angle(facts)
    shot["angle_deg"] = angle
    shot["x"] = facts[int(visible[0])]["centre"][0] / width
    extent_x = envelope[2] - envelope[0] + 1
    extent_y = envelope[3] - envelope[1] + 1
    flicker = np.abs(np.diff(energies)) / max(1, float(energies.max()))
    feature = {
        "shot_index": shot_index,
        "space": "normalised_content",
        "content_box_px": list(clip.content_box),
        "colours": facts[peak]["palette"],
        "colours_over_time": colour_samples(facts, start),
        "apex_ratio": (height - envelope[1]) / height,
        "radius_ratio": extent_x / (2 * width),
        "life_ms": round((fade - int(visible[0]) + 1) / FPS * MS_PER_SECOND),
        "trail_present": extent_y / max(1, extent_x) >= TRAIL_ASPECT_RATIO,
        "trail_length_ratio": tail_length_px(facts, peak) / height,
        "crackle": crackle(clip, start, end_index),
        "strobe": int(np.sum(flicker > FLICKER_CHANGE_FRACTION)) >= STROBE_MIN_CHANGES,
        "truncated": fade == len(facts) - 1,
        "bounds": envelope,
    }
    crops = save_crops(clip, directory, shot_index, start, peak, fade, envelope)
    return feature, crops


def projected_angle(facts: list[dict]) -> float | None:
    """Fit an early centroid line; return degrees right of vertical, or None without ascent."""
    centres = [
        fact["centre"]
        for fact in facts[: round(ANGLE_WINDOW_S * FPS)]
        if fact["centre"] is not None
    ]
    if len(centres) < 2:
        return None
    points = np.array(centres)
    elapsed = np.arange(len(points)) / FPS
    vx = float(np.polyfit(elapsed, points[:, 0], 1)[0])
    upward_speed = -float(np.polyfit(elapsed, points[:, 1], 1)[0])
    if upward_speed <= 0:
        return None
    return round(math.degrees(math.atan2(vx, upward_speed)), ANGLE_DECIMAL_PLACES)


def crackle(clip: Clip, start: int, end: int) -> bool | None:
    """Return a high-frequency audio proxy over the shot window, or None for silent audio."""
    audio = clip.audio[start * AUDIO_RATE // FPS : end * AUDIO_RATE // FPS]
    energy = np.abs(np.fft.rfft(audio)) ** 2
    if energy.sum() == 0:
        return None
    frequencies = np.fft.rfftfreq(len(audio), 1 / AUDIO_RATE)
    return bool(
        energy[frequencies >= CRACKLE_HIGH_HZ].sum() / energy.sum() >= CRACKLE_ENERGY_FRACTION
    )


def save_crops(
    clip: Clip,
    directory: Path,
    shot_index: int,
    start: int,
    peak: int,
    fade: int,
    envelope: list[int],
) -> dict:
    """Write lossless PNGs using one shared padded envelope and absolute MP4 times in ms."""
    left, top, width, height = clip.content_box
    x0, y0, x1, y1 = envelope
    crop_box = (
        left + max(0, x0 - CROP_PADDING_PX),
        top + max(0, y0 - CROP_PADDING_PX),
        left + min(width, x1 + CROP_PADDING_PX + 1),
        top + min(height, y1 + CROP_PADDING_PX + 1),
    )
    result = {"shot_index": shot_index, "crop_box_px": list(crop_box)}
    for label, offset in (("launch", 0), ("peak", peak), ("fade", fade)):
        filename = f"shot-{shot_index}-{label}.png"
        Image.fromarray(clip.frames[start + offset]).crop(crop_box).save(directory / filename)
        result[label] = {"path": filename, "t_ms": round((start + offset) / FPS * MS_PER_SECOND)}
    return result
