"""Fuse launch-region brightness transients and audio energy rises without fabricating shots."""

from dataclasses import dataclass

import numpy as np

from decode import AUDIO_RATE, FPS, MS_PER_SECOND, Clip

# Visual tuning: suppress compression noise while retaining dim launch tails (RGB byte units).
VISIBLE_BYTE = 24
# Lower 35% of content is the assumed launch region; requires a static camera with ground visible.
LAUNCH_REGION_FRACTION = 0.35
# Minimum spacing in seconds separates distinct tubes from one launch's flicker.
MIN_SHOT_GAP_S = 0.3
# Audio can arrive late at the camera; associate within this symmetric seconds window.
FUSION_WINDOW_S = 0.25
# Dimensionless noise rejection relative to the strongest energy/brightness rise.
RELATIVE_PEAK_FLOOR = 0.08
# Confidence weights are visual judgement, not calibrated probabilities.
AUDIO_WEIGHT = 0.45
VISUAL_WEIGHT = 0.55
# Normalised duration disagreement budget for supplier metadata (fraction of decoded length).
PRIOR_DURATION_FRACTION = 0.2
# Operational shot-count cap for bounded supplier metadata.
MAX_SHOTS = 200
# Evidence score serialisation precision, in decimal places.
SCORE_DECIMAL_PLACES = 4
# Backtrack a launch rise by at most half a second to its first luminous frame.
ONSET_BACKTRACK_S = 0.5


@dataclass(frozen=True)
class Priors:
    """Supplier constraints in shots and milliseconds, never a source of invented onsets."""

    shot_count: int | None = None
    duration_ms: int | None = None

    @classmethod
    def parse(cls, value: dict):
        """Validate known numeric priors, retaining effect-name metadata outside the measurer."""
        if not isinstance(value, dict):
            raise ValueError("Priors must be an object")
        count = value.get("shot_count")
        duration = value.get("duration_ms")
        if count is not None and (type(count) is not int or not 1 <= count <= MAX_SHOTS):
            raise ValueError("Invalid supplier shot count")
        if duration is not None and (type(duration) is not int or duration <= 0):
            raise ValueError("Invalid supplier duration")
        return cls(count, duration)


def rising_peaks(values: np.ndarray) -> tuple[list[int], np.ndarray]:
    """Return separated positive-rise maxima and their normalised evidence strengths."""
    rises = np.maximum(0, np.diff(values, prepend=0))
    maximum = float(rises.max(initial=0))
    strengths = rises / maximum if maximum > 0 else rises
    ranked = np.argsort(-strengths, kind="stable")
    selected = []
    for index in ranked:
        if strengths[index] < RELATIVE_PEAK_FLOOR:
            break
        if all(abs(index - other) >= MIN_SHOT_GAP_S * FPS for other in selected):
            selected.append(int(index))
    return sorted(selected), strengths


def sensor_signals(clip: Clip) -> tuple[np.ndarray, np.ndarray]:
    """Return ground-region RGB energy and mono audio RMS on the shared analysis clock."""
    left, top, width, height = clip.content_box
    launch_top = top + int(height * (1 - LAUNCH_REGION_FRACTION))
    brightness = np.array(
        [
            np.maximum(
                frame[launch_top : top + height, left : left + width].max(axis=2).astype(float)
                - VISIBLE_BYTE,
                0,
            ).sum()
            for frame in clip.frames
        ]
    )
    samples_per_frame = AUDIO_RATE // FPS
    energy = np.sqrt(
        np.mean(
            clip.audio[: len(clip.frames) * samples_per_frame].reshape(-1, samples_per_frame) ** 2,
            axis=1,
        )
    )
    return brightness, energy


def backtrack_launches(
    peaks: list[int], strengths: np.ndarray, brightness: np.ndarray
) -> list[int]:
    """Return first luminous indices; update strength slots in place to retain climb evidence."""
    original_peaks = peaks
    visual_peaks = []
    for index in original_peaks:
        onset = index
        while onset > max(0, index - round(ONSET_BACKTRACK_S * FPS)) and brightness[onset - 1] > 0:
            onset -= 1
        visual_peaks.append(onset)
        strengths[onset] = max(strengths[onset], strengths[index])
    return visual_peaks


def detect_shots(clip: Clip, priors: Priors) -> list[dict]:
    """Return firing times in ms from video start and confidence; geometry is measured separately.

    Ground-visible transients anchor the visual clock. Audio strengthens matching
    transients and supplies audio-only evidence when launches are obscured. A count
    prior ranks observed evidence; insufficient candidates fail rather than interpolate.
    """
    if priors.duration_ms is not None and abs(
        priors.duration_ms / MS_PER_SECOND - clip.duration_s
    ) > max(1 / FPS, clip.duration_s * PRIOR_DURATION_FRACTION):
        raise ValueError("Supplier duration disagrees with the decoded clip")
    brightness, energy = sensor_signals(clip)
    visual_peaks, visual_strength = rising_peaks(brightness)
    audio_peaks, audio_strength = rising_peaks(energy)
    visual_peaks = backtrack_launches(visual_peaks, visual_strength, brightness)
    candidates = fuse(visual_peaks, audio_peaks, visual_strength, audio_strength)
    if priors.shot_count is not None:
        if len(candidates) < priors.shot_count:
            raise ValueError("Insufficient observed shots for supplier count")
        candidates = sorted(candidates, key=lambda item: (-item[1], item[0]))[: priors.shot_count]
    if not candidates:
        raise ValueError("No firing evidence detected")
    shots = []
    for index, confidence, evidence in sorted(candidates):
        shots.append(
            {
                "t_ms": round(index / FPS * MS_PER_SECOND),
                "confidence": round(confidence, SCORE_DECIMAL_PLACES),
                "x": None,
                "angle_deg": None,
                "evidence": evidence,
            }
        )
    return shots


def fuse(
    visual: list[int], audio: list[int], visual_strength: np.ndarray, audio_strength: np.ndarray
) -> list[tuple[int, float, str]]:
    """Associate nearby energy rises, keeping visual time to avoid acoustic travel delay."""
    candidates = []
    used_audio = set()
    for index in visual:
        nearby = [other for other in audio if abs(other - index) <= FUSION_WINDOW_S * FPS]
        match = max(nearby, key=lambda other: audio_strength[other]) if nearby else None
        strength = VISUAL_WEIGHT * float(visual_strength[index])
        if match is not None:
            used_audio.add(match)
            strength += AUDIO_WEIGHT * float(audio_strength[match])
        candidates.append((index, strength, "audio_visual" if match is not None else "visual"))
    for index in audio:
        if index not in used_audio:
            candidates.append((index, AUDIO_WEIGHT * float(audio_strength[index]), "audio"))
    ranked = sorted(candidates, key=lambda item: (-item[1], item[0]))
    selected = []
    for item in ranked:
        if all(abs(item[0] - other[0]) >= MIN_SHOT_GAP_S * FPS for other in selected):
            selected.append(item)
    return selected
