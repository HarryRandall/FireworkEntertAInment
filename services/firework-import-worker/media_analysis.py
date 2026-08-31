"""Deterministic media observations for firework reconstruction.

The analyser deliberately records measurements instead of naming effects. The
model synthesis stage can interpret those measurements, while tests and future
processors can compare the same stable observation contract.
"""

from __future__ import annotations

import base64
import math
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import cv2
import numpy as np


OBSERVATION_SCHEMA_VERSION = "showcrafter.video-observations.v1"
DEFAULT_SAMPLE_FPS = 20.0
MAX_SAMPLED_FRAMES = 1_800
MAX_TRACKS = 240
MAX_BURSTS = 160
MAX_MODEL_IMAGES = 24
MAX_MODEL_FRAME_DIMENSION = 1_280


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, float(value)))


def _round(value: float, digits: int = 4) -> float:
    return round(float(value), digits)


def _rgb_hex(rgb: Iterable[float]) -> str:
    red, green, blue = (int(_clamp(channel, 0, 255)) for channel in rgb)
    return f"#{red:02x}{green:02x}{blue:02x}"


def _weighted_palette(
    frame_bgr: np.ndarray, mask: np.ndarray, limit: int = 6
) -> list[dict[str, Any]]:
    pixels_bgr = frame_bgr[mask > 0]
    if pixels_bgr.size == 0:
        return []

    if len(pixels_bgr) > 8_000:
        stride = max(1, len(pixels_bgr) // 8_000)
        pixels_bgr = pixels_bgr[::stride]

    pixels_rgb = cv2.cvtColor(
        pixels_bgr.reshape(-1, 1, 3),
        cv2.COLOR_BGR2RGB,
    ).reshape(-1, 3)
    pixels_hsv = cv2.cvtColor(
        pixels_bgr.reshape(-1, 1, 3),
        cv2.COLOR_BGR2HSV,
    ).reshape(-1, 3)
    saturation = pixels_hsv[:, 1].astype(np.float64) / 255.0
    brightness = pixels_hsv[:, 2].astype(np.float64) / 255.0
    # Camera clipping creates large white cores. Keep genuine white effects,
    # but weight chromatic trail pixels more strongly so their chemistry is not
    # erased by a small overexposed centre.
    weights = (0.12 + 0.88 * np.power(saturation, 1.35)) * np.power(brightness, 0.35)
    quantised = (pixels_rgb // 24) * 24 + 12
    colours, inverse = np.unique(quantised, axis=0, return_inverse=True)
    totals = np.bincount(inverse, weights=weights, minlength=len(colours))
    ranked = np.argsort(totals)[::-1][:limit]
    total = max(1e-9, float(totals.sum()))
    return [
        {
            "hex": _rgb_hex(colours[index]),
            "weight": _round(float(totals[index]) / total, 3),
        }
        for index in ranked
    ]


def _merge_palettes(
    palettes: Iterable[list[dict[str, Any]]], limit: int = 8
) -> list[dict[str, Any]]:
    totals: dict[str, float] = {}
    for palette in palettes:
        for colour in palette:
            value = colour.get("hex")
            if isinstance(value, str):
                totals[value.lower()] = totals.get(value.lower(), 0.0) + float(
                    colour.get("weight", 0.0)
                )
    denominator = max(1e-6, sum(totals.values()))
    return [
        {"hex": colour, "weight": _round(weight / denominator, 3)}
        for colour, weight in sorted(
            totals.items(), key=lambda item: (-item[1], item[0])
        )[:limit]
    ]


def _encode_jpeg(frame: np.ndarray) -> dict[str, Any] | None:
    """Encode a bounded evidence image so 4K sources do not inflate model requests."""

    height, width = frame.shape[:2]
    scale = min(1.0, MAX_MODEL_FRAME_DIMENSION / max(1, width, height))
    if scale < 1:
        frame = cv2.resize(
            frame,
            (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_AREA,
        )
    encoded_height, encoded_width = frame.shape[:2]
    ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 86])
    if not ok:
        return None
    return {
        "jpegBase64": base64.b64encode(encoded.tobytes()).decode("ascii"),
        "width": encoded_width,
        "height": encoded_height,
    }


def _component_colour(frame_bgr: np.ndarray, labels: np.ndarray, label: int) -> str:
    pixels = frame_bgr[labels == label]
    if pixels.size == 0:
        return "#ffffff"
    rgb = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2RGB).reshape(-1, 3)
    weights = np.maximum(1.0, np.max(rgb, axis=1).astype(np.float32))
    return _rgb_hex(np.average(rgb, axis=0, weights=weights))


def _observe_frame(frame_bgr: np.ndarray, time_seconds: float) -> dict[str, Any]:
    height, width = frame_bgr.shape[:2]
    scale = min(1.0, 360.0 / max(1, width))
    if scale < 1.0:
        working = cv2.resize(
            frame_bgr,
            (round(width * scale), round(height * scale)),
            interpolation=cv2.INTER_AREA,
        )
    else:
        working = frame_bgr

    work_height, work_width = working.shape[:2]
    hsv = cv2.cvtColor(working, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    adaptive = max(72.0, float(np.percentile(value, 98.5)) * 0.56)
    mask = ((value >= adaptive) & ((saturation >= 24) | (value >= 184))).astype(
        np.uint8
    ) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))

    label_count, labels, stats, centroids = cv2.connectedComponentsWithStats(
        mask, connectivity=8
    )
    min_area = max(2, round(work_width * work_height * 0.000018))
    components: list[dict[str, Any]] = []
    for label in range(1, label_count):
        x, y, component_width, component_height, area = (
            int(value) for value in stats[label]
        )
        if area < min_area:
            continue
        centre_x, centre_y = centroids[label]
        components.append(
            {
                "x": _round(centre_x / max(1, work_width - 1)),
                "y": _round(centre_y / max(1, work_height - 1)),
                "width": _round(component_width / max(1, work_width)),
                "height": _round(component_height / max(1, work_height)),
                "area": _round(area / max(1, work_width * work_height), 6),
                "brightness": _round(float(value[labels == label].mean()) / 255.0),
                "colour": _component_colour(working, labels, label),
            }
        )

    components.sort(
        key=lambda component: (-component["area"], component["y"], component["x"])
    )
    detected_component_count = len(components)
    components = components[:32]
    visible = mask > 0
    visible_count = int(visible.sum())
    if visible_count:
        y_positions, x_positions = np.nonzero(visible)
        centroid = {
            "x": _round(float(x_positions.mean()) / max(1, work_width - 1)),
            "y": _round(float(y_positions.mean()) / max(1, work_height - 1)),
        }
        spread = _round(
            math.sqrt(float(np.var(x_positions)) + float(np.var(y_positions)))
            / max(1.0, math.hypot(work_width, work_height))
        )
        normalised_x = (
            x_positions.astype(np.float64) - float(x_positions.mean())
        ) / max(
            1,
            work_width,
        )
        normalised_y = (
            y_positions.astype(np.float64) - float(y_positions.mean())
        ) / max(
            1,
            work_height,
        )
        coordinates = np.column_stack((normalised_x, normalised_y))
        covariance = (
            np.cov(coordinates, rowvar=False) if len(coordinates) >= 3 else np.eye(2)
        )
        eigenvalues, eigenvectors = np.linalg.eigh(covariance)
        major_index = int(np.argmax(eigenvalues))
        major_value = max(1e-12, float(eigenvalues[major_index]))
        minor_value = max(0.0, float(eigenvalues[1 - major_index]))
        major_vector = eigenvectors[:, major_index]
        radii = np.hypot(normalised_x, normalised_y)
        radial_mean = max(1e-9, float(radii.mean()))
        radial_cutoff = float(np.percentile(radii, 90))
        outer = radii >= radial_cutoff * 0.28
        angular_histogram, _ = np.histogram(
            np.arctan2(normalised_y[outer], normalised_x[outer]),
            bins=24,
            range=(-math.pi, math.pi),
        )
        bounding_width = (int(x_positions.max()) - int(x_positions.min()) + 1) / max(
            1,
            work_width,
        )
        bounding_height = (int(y_positions.max()) - int(y_positions.min()) + 1) / max(
            1,
            work_height,
        )
        shape_evidence = {
            "boundingWidth": _round(bounding_width),
            "boundingHeight": _round(bounding_height),
            "aspectRatio": _round(bounding_width / max(1e-6, bounding_height)),
            "majorAxisAngleDegrees": _round(
                math.degrees(
                    math.atan2(-float(major_vector[1]), float(major_vector[0]))
                ),
                2,
            ),
            "anisotropy": _round(1.0 - minor_value / major_value),
            "radialMean": _round(radial_mean),
            "radialVariation": _round(float(radii.std()) / radial_mean),
            "angularOccupancy": _round(
                float(np.count_nonzero(angular_histogram)) / 24.0
            ),
            "visibleComponentCount": detected_component_count,
            "confidence": _round(
                _clamp(
                    math.sqrt(
                        visible_count / max(1.0, work_width * work_height * 0.018)
                    )
                )
            ),
        }
    else:
        centroid = None
        spread = 0.0
        shape_evidence = None

    palette = _weighted_palette(working, mask)
    observation = {
        "timeSeconds": _round(time_seconds, 3),
        "meanBrightness": _round(float(value.mean()) / 255.0),
        "flashIntensity": _round(float(np.mean(value >= 224))),
        "brightCoverage": _round(visible_count / max(1, work_width * work_height)),
        "centroid": centroid,
        "spread": spread,
        "shapeEvidence": shape_evidence,
        "palette": palette,
        "components": components,
    }
    return observation


def _track_components(
    frames: list[dict[str, Any]], expected_step: float
) -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []
    next_track_id = 1
    max_gap = max(0.18, expected_step * 3.2)

    for frame in frames:
        time_seconds = float(frame["timeSeconds"])
        assignments: list[tuple[float, int, int]] = []
        for component_index, component in enumerate(frame["components"]):
            for track_index, track in enumerate(tracks):
                last = track["points"][-1]
                elapsed = time_seconds - float(last["timeSeconds"])
                if elapsed <= 0 or elapsed > max_gap:
                    continue
                distance = math.hypot(
                    float(component["x"]) - float(last["x"]),
                    float(component["y"]) - float(last["y"]),
                )
                permitted = (
                    0.035
                    + elapsed * 0.7
                    + math.sqrt(max(float(component["area"]), float(last["area"])))
                    * 1.5
                )
                if distance <= permitted:
                    assignments.append((distance, track_index, component_index))

        used_tracks: set[int] = set()
        used_components: set[int] = set()
        for _, track_index, component_index in sorted(assignments):
            if track_index in used_tracks or component_index in used_components:
                continue
            component = frame["components"][component_index]
            point = {"timeSeconds": frame["timeSeconds"], **component}
            tracks[track_index]["points"].append(point)
            component["trackId"] = tracks[track_index]["id"]
            used_tracks.add(track_index)
            used_components.add(component_index)

        for component_index, component in enumerate(frame["components"]):
            if component_index in used_components or len(tracks) >= MAX_TRACKS:
                continue
            track_id = f"track-{next_track_id:03d}"
            next_track_id += 1
            component["trackId"] = track_id
            tracks.append(
                {
                    "id": track_id,
                    "points": [{"timeSeconds": frame["timeSeconds"], **component}],
                }
            )

    output: list[dict[str, Any]] = []
    for track in tracks:
        points = track["points"]
        if len(points) < 2:
            continue
        duration = float(points[-1]["timeSeconds"]) - float(points[0]["timeSeconds"])
        vertical_travel = float(points[-1]["y"]) - float(points[0]["y"])
        output.append(
            {
                "id": track["id"],
                "startSeconds": points[0]["timeSeconds"],
                "endSeconds": points[-1]["timeSeconds"],
                "durationSeconds": _round(duration, 3),
                "verticalTravel": _round(vertical_travel),
                "direction": "rising"
                if vertical_travel < -0.025
                else "falling"
                if vertical_travel > 0.025
                else "lateral",
                "points": points,
            }
        )
    return output


def _smoothed(values: np.ndarray, sample_fps: float) -> np.ndarray:
    if values.size < 3:
        return values
    window = max(3, min(11, round(sample_fps * 0.18)))
    if window % 2 == 0:
        window += 1
    kernel = np.ones(window, dtype=np.float64) / window
    return np.convolve(values, kernel, mode="same")


def _detect_peaks(
    frames: list[dict[str, Any]], sample_fps: float
) -> tuple[np.ndarray, list[int]]:
    signal = np.asarray(
        [
            float(frame["flashIntensity"]) * 2.8
            + float(frame["brightCoverage"]) * 8.0
            + float(frame["meanBrightness"]) * 0.38
            + float(frame["spread"]) * 0.85
            for frame in frames
        ],
        dtype=np.float64,
    )
    smooth = _smoothed(signal, sample_fps)
    if smooth.size == 0:
        return smooth, []
    median = float(np.median(smooth))
    mad = float(np.median(np.abs(smooth - median)))
    threshold = max(float(np.percentile(smooth, 68)), median + max(0.006, mad * 2.2))
    minimum_distance = max(2, round(sample_fps * 0.16))
    candidates = [
        index
        for index in range(1, len(smooth) - 1)
        if smooth[index] >= threshold
        and smooth[index] >= smooth[index - 1]
        and smooth[index] >= smooth[index + 1]
    ]
    selected: list[int] = []
    for index in sorted(candidates, key=lambda item: (-smooth[item], item)):
        if all(abs(index - previous) >= minimum_distance for previous in selected):
            selected.append(index)
        if len(selected) >= MAX_BURSTS:
            break
    if not selected and float(smooth.max()) > median + 0.004:
        selected = [int(np.argmax(smooth))]
    return smooth, sorted(selected)


def _fit_trajectory(
    track: dict[str, Any], start: float, end: float
) -> dict[str, Any] | None:
    points = [
        point
        for point in track["points"]
        if start <= float(point["timeSeconds"]) <= end
    ]
    if len(points) < 3:
        return None
    times = np.asarray(
        [float(point["timeSeconds"]) for point in points], dtype=np.float64
    )
    times -= times[0]
    x_values = np.asarray([float(point["x"]) for point in points], dtype=np.float64)
    y_values = np.asarray([float(point["y"]) for point in points], dtype=np.float64)
    degree = 2 if len(points) >= 5 and float(times[-1]) > 0.18 else 1
    x_coefficients = np.polyfit(times, x_values, 1)
    y_coefficients = np.polyfit(times, y_values, degree)
    predicted_y = np.polyval(y_coefficients, times)
    residual = float(np.mean(np.abs(predicted_y - y_values)))
    acceleration = float(2.0 * y_coefficients[0]) if degree == 2 else 0.0
    return {
        "trackId": track["id"],
        "pointCount": len(points),
        "horizontalVelocity": _round(x_coefficients[0]),
        "initialVerticalVelocity": _round(y_coefficients[-2]),
        "normalisedGravity": _round(acceleration),
        "fitResidual": _round(residual),
        "confidence": _round(_clamp((len(points) / 14.0) * (1.0 - residual * 8.0))),
        "points": points,
    }


def _track_palette(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    weighted = []
    for point in points:
        colour = point.get("colour")
        if not isinstance(colour, str):
            continue
        weighted.append(
            {
                "hex": colour,
                "weight": max(
                    0.001,
                    float(point.get("brightness") or 0.0)
                    * float(point.get("area") or 0.0),
                ),
            }
        )
    return _merge_palettes([weighted], limit=4)


def _has_consistent_visible_rise(points: list[dict[str, Any]]) -> bool:
    """Require visible upward displacement without accepting oscillating track noise."""

    if len(points) < 3:
        return False
    y_values = [float(point["y"]) for point in points]
    vertical_travel = y_values[-1] - y_values[0]
    if vertical_travel > -0.03:
        return False

    deltas = np.diff(np.asarray(y_values, dtype=np.float64))
    upward_distance = float(np.maximum(-deltas, 0.0).sum())
    downward_distance = float(np.maximum(deltas, 0.0).sum())
    upward_steps = int(np.count_nonzero(deltas < -0.001))
    return (
        upward_steps >= max(2, math.ceil(len(deltas) * 0.5))
        and upward_distance >= downward_distance * 3.0
    )


def _launch_observation(
    tracks: list[dict[str, Any]],
    burst_seconds: float,
    burst_centroid: dict[str, float] | None,
) -> dict[str, Any] | None:
    candidates: list[tuple[float, dict[str, Any]]] = []
    for track in tracks:
        points = [
            point
            for point in track.get("points", [])
            if float(point.get("timeSeconds") or 0.0) <= burst_seconds + 0.08
        ]
        if len(points) < 3:
            continue
        launch_seconds = float(points[0]["timeSeconds"])
        last_seconds = float(points[-1]["timeSeconds"])
        lift_seconds = burst_seconds - launch_seconds
        end_gap = burst_seconds - last_seconds
        if (
            lift_seconds < 0.12
            or lift_seconds > 4.5
            or end_gap < -0.08
            or end_gap > 0.75
        ):
            continue
        if not _has_consistent_visible_rise(points):
            continue
        trajectory = _fit_trajectory(track, launch_seconds, burst_seconds + 0.08)
        if trajectory is None:
            continue
        if burst_centroid:
            distance = math.hypot(
                float(points[-1]["x"]) - float(burst_centroid["x"]),
                float(points[-1]["y"]) - float(burst_centroid["y"]),
            )
        else:
            distance = 0.4
        origin_penalty = max(0.0, 0.48 - float(points[0]["y"])) * 0.6
        score = (
            distance
            + end_gap * 0.45
            + origin_penalty
            - float(trajectory["confidence"]) * 0.2
        )
        colours = _track_palette(points)
        candidates.append(
            (
                score,
                {
                    "launchSeconds": _round(launch_seconds, 3),
                    "liftSeconds": _round(lift_seconds, 3),
                    "launchTrajectory": trajectory,
                    "launchColour": colours[0]["hex"] if colours else None,
                    "launchColours": colours,
                    "origin": {"x": points[0]["x"], "y": points[0]["y"]},
                    "confidence": _round(
                        _clamp(
                            float(trajectory["confidence"]) * 0.65
                            + (1.0 - min(1.0, distance * 3.0)) * 0.35
                        )
                    ),
                },
            )
        )
    return (
        min(candidates, key=lambda candidate: candidate[0])[1] if candidates else None
    )


def _burst_observations(
    frames: list[dict[str, Any]],
    tracks: list[dict[str, Any]],
    signal: np.ndarray,
    peaks: list[int],
    sample_fps: float,
) -> list[dict[str, Any]]:
    if signal.size == 0:
        return []
    baseline = float(np.median(signal))
    bursts: list[dict[str, Any]] = []
    for burst_number, peak_index in enumerate(peaks, start=1):
        peak_value = float(signal[peak_index])
        edge = baseline + max(0.004, (peak_value - baseline) * 0.14)
        start_index = peak_index
        while start_index > 0 and float(signal[start_index - 1]) > edge:
            start_index -= 1
        end_index = peak_index
        while end_index + 1 < len(signal) and float(signal[end_index + 1]) > edge:
            end_index += 1

        start_seconds = float(frames[start_index]["timeSeconds"])
        peak_seconds = float(frames[peak_index]["timeSeconds"])
        end_seconds = float(frames[end_index]["timeSeconds"])
        colour_window = max(2, round(sample_fps * 0.28))
        palette = _merge_palettes(
            frame["palette"]
            for frame in frames[
                max(0, peak_index - colour_window) : min(
                    len(frames), peak_index + colour_window + 1
                )
            ]
        )

        peak_centroid = frames[peak_index].get("centroid")
        launch = _launch_observation(tracks, start_seconds, peak_centroid)
        trajectory_candidates: list[tuple[float, dict[str, Any]]] = []
        for track in tracks:
            trajectory = _fit_trajectory(track, start_seconds, end_seconds)
            if trajectory is None:
                continue
            first_point = trajectory["points"][0]
            if peak_centroid:
                distance = math.hypot(
                    float(first_point["x"]) - peak_centroid["x"],
                    float(first_point["y"]) - peak_centroid["y"],
                )
            else:
                distance = 0.5
            falling_bonus = (
                -0.08 if float(trajectory.get("normalisedGravity") or 0.0) > 0 else 0.0
            )
            trajectory_candidates.append(
                (distance + falling_bonus - trajectory["confidence"] * 0.12, trajectory)
            )
        trajectory = (
            min(trajectory_candidates, key=lambda candidate: candidate[0])[1]
            if trajectory_candidates
            else None
        )

        frames_after_peak = max(1, end_index - peak_index)
        half_level = baseline + (peak_value - baseline) * 0.5
        half_index = next(
            (
                index
                for index in range(peak_index, end_index + 1)
                if float(signal[index]) <= half_level
            ),
            end_index,
        )
        fade_seconds = max(0.0, end_seconds - peak_seconds)
        bursts.append(
            {
                "id": f"burst-{burst_number:03d}",
                "startSeconds": _round(start_seconds, 3),
                "burstSeconds": _round(start_seconds, 3),
                "peakSeconds": _round(peak_seconds, 3),
                "endSeconds": _round(end_seconds, 3),
                "riseSeconds": _round(peak_seconds - start_seconds, 3),
                "fadeSeconds": _round(fade_seconds, 3),
                "halfLifeSeconds": _round(
                    float(frames[half_index]["timeSeconds"]) - peak_seconds, 3
                ),
                "fadeRatePerSecond": _round(
                    (peak_value - float(signal[end_index]))
                    / max(1 / sample_fps, fade_seconds)
                ),
                "peakIntensity": _round(peak_value),
                "spreadAtPeak": frames[peak_index]["spread"],
                "centroidAtPeak": peak_centroid,
                "shapeAtPeak": frames[peak_index].get("shapeEvidence"),
                "colours": palette,
                "trajectory": trajectory,
                "launchSeconds": launch.get("launchSeconds") if launch else None,
                "liftSeconds": launch.get("liftSeconds") if launch else None,
                "launchTrajectory": launch.get("launchTrajectory") if launch else None,
                "launchColour": launch.get("launchColour") if launch else None,
                "launchColours": launch.get("launchColours", []) if launch else [],
                "launchConfidence": launch.get("confidence", 0.0) if launch else 0.0,
                "confidence": _round(
                    _clamp(
                        (peak_value - baseline) * 8.0
                        + min(0.35, frames_after_peak / sample_fps * 0.18)
                    )
                ),
            }
        )
    return bursts


def _select_model_frame_indexes(
    frames: list[dict[str, Any]],
    peaks: list[int],
    limit: int,
    bursts: list[dict[str, Any]] | None = None,
) -> list[int]:
    if not frames:
        return []
    limit = max(1, limit)
    event_priorities: dict[int, int] = {}

    def add_event(time_seconds: Any, priority: int) -> None:
        if not isinstance(time_seconds, (int, float)) or not math.isfinite(
            float(time_seconds)
        ):
            return
        index = min(
            range(len(frames)),
            key=lambda item: abs(
                float(frames[item]["timeSeconds"]) - float(time_seconds)
            ),
        )
        event_priorities[index] = min(priority, event_priorities.get(index, priority))

    for burst in bursts or []:
        # Keep the visible lift and the burst itself in the bounded image set. The
        # deterministic timeline still carries every event when the image cap is full.
        add_event(burst.get("launchSeconds"), 0)
        add_event(burst.get("burstSeconds"), 1)
        add_event(burst.get("peakSeconds"), 0)
        add_event(burst.get("endSeconds"), 2)

    indexes = set(peaks)
    indexes.update(event_priorities)
    for peak in peaks:
        indexes.update(
            {
                max(0, peak - 2),
                max(0, peak - 1),
                min(len(frames) - 1, peak + 1),
                min(len(frames) - 1, peak + 3),
            }
        )
    uniform_count = min(8, len(frames))
    if uniform_count:
        indexes.update(
            int(value) for value in np.linspace(0, len(frames) - 1, uniform_count)
        )

    ranked = sorted(
        indexes,
        key=lambda index: (
            event_priorities.get(index, 0 if index in peaks else 3),
            -float(frames[index]["flashIntensity"]),
            -float(frames[index]["brightCoverage"]),
            index,
        ),
    )[:limit]
    return sorted(ranked)


def _decode_model_frames(
    video_path: str | Path,
    frames: list[dict[str, Any]],
    source_frame_indexes: list[int],
    peaks: list[int],
    limit: int,
    bursts: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Decode only selected evidence frames instead of retaining every JPEG."""

    selected = _select_model_frame_indexes(frames, peaks, limit, bursts)
    targets = {
        source_frame_indexes[index]: (index, frames[index]) for index in selected
    }
    if not targets:
        return []

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError("Unable to reopen video for evidence frame extraction")
    output: list[dict[str, Any]] = []
    source_index = 0
    last_target = max(targets)
    try:
        while source_index <= last_target:
            ok, frame = capture.read()
            if not ok:
                break
            target = targets.get(source_index)
            if target is not None:
                _, observation = target
                encoded = _encode_jpeg(frame)
                if encoded:
                    time_seconds = float(observation["timeSeconds"])
                    output.append(
                        {
                            "timeSeconds": _round(time_seconds, 3),
                            "label": f"Source video frame at t={time_seconds:.3f}s",
                            **encoded,
                        }
                    )
            source_index += 1
    finally:
        capture.release()
    return output


@dataclass(frozen=True)
class VideoAnalysisConfig:
    sample_fps: float = DEFAULT_SAMPLE_FPS
    max_sampled_frames: int = MAX_SAMPLED_FRAMES
    max_model_images: int = MAX_MODEL_IMAGES


def analyse_firework_video(
    video_path: str | Path,
    duration_seconds: float,
    config: VideoAnalysisConfig | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Analyse a video into timestamped, renderer-relevant observations."""

    config = config or VideoAnalysisConfig(
        sample_fps=float(os.getenv("IMPORT_VIDEO_SAMPLE_FPS", str(DEFAULT_SAMPLE_FPS))),
        max_sampled_frames=int(
            os.getenv("IMPORT_MAX_SAMPLED_FRAMES", str(MAX_SAMPLED_FRAMES))
        ),
        max_model_images=int(
            os.getenv("IMPORT_MAX_MODEL_IMAGES", str(MAX_MODEL_IMAGES))
        ),
    )
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError("Unable to open video for deterministic analysis")

    source_fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    if not math.isfinite(source_fps) or source_fps <= 0:
        source_fps = 30.0
    source_width = max(1, round(float(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 1)))
    source_height = max(1, round(float(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1)))
    sample_fps = _clamp(config.sample_fps, 2.0, 60.0)
    sample_interval = 1.0 / sample_fps
    next_sample_seconds = 0.0
    frame_limit = max(1, min(MAX_SAMPLED_FRAMES, int(config.max_sampled_frames)))
    frames: list[dict[str, Any]] = []
    source_frame_indexes: list[int] = []
    source_index = 0
    truncated = False
    try:
        while True:
            if len(frames) >= frame_limit:
                truncated = True
                break
            ok, frame = capture.read()
            if not ok:
                break
            timestamp = float(capture.get(cv2.CAP_PROP_POS_MSEC) or 0.0) / 1_000.0
            if timestamp <= 0:
                timestamp = source_index / source_fps
            if duration_seconds > 0 and timestamp > duration_seconds + 0.1:
                break
            if timestamp + 1e-6 >= next_sample_seconds:
                frames.append(_observe_frame(frame, timestamp))
                source_frame_indexes.append(source_index)
                while next_sample_seconds <= timestamp + 1e-6:
                    next_sample_seconds += sample_interval
            source_index += 1
    finally:
        capture.release()

    if not frames:
        raise RuntimeError("No decodable frames were found in the source video")

    positive_steps = [
        float(right["timeSeconds"]) - float(left["timeSeconds"])
        for left, right in zip(frames, frames[1:])
        if float(right["timeSeconds"]) > float(left["timeSeconds"])
    ]
    effective_fps = (
        1.0 / float(np.median(positive_steps))
        if positive_steps
        else min(source_fps, sample_fps)
    )
    tracks = _track_components(frames, 1.0 / max(0.001, effective_fps))
    signal, peaks = _detect_peaks(frames, effective_fps)
    bursts = _burst_observations(frames, tracks, signal, peaks, effective_fps)
    frame_aspect_ratio = _round(source_width / source_height, 6)
    for burst in bursts:
        for key in ("launchTrajectory", "trajectory"):
            trajectory = burst.get(key)
            if isinstance(trajectory, dict):
                trajectory["frameAspectRatio"] = frame_aspect_ratio
    global_palette = _merge_palettes(frame["palette"] for frame in frames)
    image_limit = max(1, min(MAX_MODEL_IMAGES, int(config.max_model_images)))
    images = _decode_model_frames(
        video_path,
        frames,
        source_frame_indexes,
        peaks,
        image_limit,
        bursts,
    )

    for frame, intensity in zip(frames, signal.tolist(), strict=False):
        frame["activity"] = _round(intensity)

    duration = float(frames[-1]["timeSeconds"])
    summary = {
        "schemaVersion": OBSERVATION_SCHEMA_VERSION,
        "durationSeconds": _round(
            duration_seconds if duration_seconds > 0 else duration, 3
        ),
        "sourceFps": _round(source_fps, 3),
        "sourceWidth": source_width,
        "sourceHeight": source_height,
        "sampleFps": _round(effective_fps, 3),
        "sampledFrameCount": len(frames),
        "globalPalette": [colour["hex"] for colour in global_palette],
        "globalPaletteWeights": global_palette,
        "peakTimesSeconds": [burst["burstSeconds"] for burst in bursts],
        "bursts": bursts,
        "tracks": tracks,
        "timeline": [
            {
                "timeSeconds": frame["timeSeconds"],
                "brightness": frame["meanBrightness"],
                "flash": frame["flashIntensity"],
                "coverage": frame["brightCoverage"],
                "spread": frame["spread"],
                "activity": frame["activity"],
            }
            for frame in frames
        ],
        "frames": frames,
        "quality": {
            "temporalCoverage": _round(
                _clamp(len(frames) / max(1.0, duration_seconds * effective_fps))
            ),
            "labelledImageCount": len(images),
            "trackCount": len(tracks),
            "burstCount": len(bursts),
            "truncated": truncated,
        },
    }
    return summary, images


def extract_audio_optional(
    video_path: str | Path,
    output_dir: str | Path,
    probe: dict[str, Any] | None = None,
    *,
    timeout_seconds: float = 60,
) -> Path | None:
    """Extract mono PCM audio, returning None when a source is genuinely silent."""

    if probe and not probe.get("audio_codec"):
        return None
    audio_path = Path(output_dir) / "audio.f32"
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(video_path),
                "-map",
                "0:a:0?",
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-f",
                "f32le",
                str(audio_path),
            ],
            check=False,
            capture_output=True,
            timeout=max(1.0, min(120.0, float(timeout_seconds))),
        )
    except subprocess.TimeoutExpired as exc:
        audio_path.unlink(missing_ok=True)
        raise RuntimeError("Audio extraction exceeded its bounded timeout") from exc
    if (
        result.returncode != 0
        or not audio_path.exists()
        or audio_path.stat().st_size < 4
    ):
        audio_path.unlink(missing_ok=True)
        return None
    return audio_path


def analyse_audio_features(
    audio_path: str | Path | None, expected_duration: float
) -> dict[str, Any]:
    sample_rate = 16_000
    if audio_path is None:
        return {
            "schemaVersion": OBSERVATION_SCHEMA_VERSION,
            "hasAudio": False,
            "sampleRate": sample_rate,
            "durationSeconds": _round(expected_duration, 3),
            "events": [],
            "energyTimeline": [],
        }

    samples = np.fromfile(str(audio_path), dtype=np.float32)
    if samples.size == 0:
        return analyse_audio_features(None, expected_duration)
    window = 1_024
    hop = 512
    if samples.size < window:
        samples = np.pad(samples, (0, window - samples.size))
    energies: list[float] = []
    for start in range(0, samples.size - window + 1, hop):
        frame = samples[start : start + window]
        energies.append(float(np.sqrt(np.mean(np.square(frame)) + 1e-12)))
    energy = np.asarray(energies, dtype=np.float64)
    median = float(np.median(energy)) if energy.size else 0.0
    mad = float(np.median(np.abs(energy - median))) if energy.size else 0.0
    threshold = median + max(0.006, mad * 4.0)
    minimum_distance = max(1, round(0.12 * sample_rate / hop))
    candidates = [
        index
        for index in range(1, max(1, len(energy) - 1))
        if energy[index] >= threshold
        and energy[index] >= energy[index - 1]
        and energy[index] >= energy[index + 1]
    ]
    selected: list[int] = []
    for index in sorted(candidates, key=lambda item: (-energy[item], item)):
        if all(abs(index - previous) >= minimum_distance for previous in selected):
            selected.append(index)
    selected.sort()
    maximum = max(1e-9, float(energy.max()) if energy.size else 0.0)
    return {
        "schemaVersion": OBSERVATION_SCHEMA_VERSION,
        "hasAudio": True,
        "sampleRate": sample_rate,
        "durationSeconds": _round(samples.size / sample_rate, 3),
        "events": [
            {
                "timeSeconds": _round(index * hop / sample_rate, 3),
                "relativeEnergy": _round(float(energy[index]) / maximum),
                "kind": "impulse",
            }
            for index in selected[:240]
        ],
        "energyTimeline": [
            {
                "timeSeconds": _round(index * 4 * hop / sample_rate, 3),
                "relativeEnergy": _round(float(value) / maximum),
            }
            for index, value in enumerate(energy[::4])
        ],
    }
