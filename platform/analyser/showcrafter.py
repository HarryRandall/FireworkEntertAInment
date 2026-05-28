"""
ShowCrafter - Song Analysis Pipeline
Extracts musical structure from an audio file for pyromusical choreography.
Output: a Markdown file of timestamped musical events ready to feed into an LLM.
"""

import argparse
import time
from typing import Annotated, Any, Literal
import librosa
import numpy as np
import json
import os
import sys
import scipy.ndimage
import scipy.sparse.csgraph
import sklearn.cluster
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from scipy.signal import find_peaks, savgol_filter


# Bumped when the output contract changes. Downstream harnesses can read
# `schema_version` from the result / LLM payload to gate compatibility.
#
# 1.3.0 - added analyser timing metadata and fast-path runtime markers.
# 1.2.0 - added Pydantic validation for analysis + LLM payloads; compact
#         LLM payload now summarises/samples heuristic cues instead of
#         duplicating the full `firework_cues` list.
# 1.1.0 - added `key_moments[].prominence`; `key_moments[].type` is now
#         decided by relative prominence ranking (top quartile = climax)
#         instead of an absolute energy threshold.
# 1.0.0 - initial versioned contract.
SCHEMA_VERSION = "1.3.0"
ANALYSER_MODE = "fast"
ANALYSER_RUNNER_VERSION = "local-librosa-2"

TIMING_FIELDS = (
    "download_ms",
    "decode_ms",
    "beat_ms",
    "energy_ms",
    "onset_ms",
    "section_ms",
    "profile_ms",
    "validation_ms",
    "total_ms",
)

# Anchor windows around climaxes and build-up peaks (seconds before/after).
ANCHOR_PRE_SEC = 3.0
ANCHOR_POST_SEC = 4.0

# Max time gap (seconds) between a build-up peak and the final climax for
# that build-up to count as the lead-in when computing finale_window.start.
# Build-ups and key_moments come from find_peaks calls with different
# parameters and can disagree by a couple of frames on the same musical
# event, so a small tolerance is needed.
FINALE_BUILDUP_TOLERANCE_SEC = 3.0

# FIR-39 pragmatic tuning: keep musical anchors useful for choreography
# instead of marking every local loudness peak as a climax.
KEY_MOMENT_DISTANCE_SEC = 6.0
CLIMAX_TARGET_SECONDS = 55.0
CLIMAX_MIN_SPACING_SEC = 18.0
MAX_CLIMAXES = 6
BUILDUP_TARGET_SECONDS = 45.0
BUILDUP_MIN_SPACING_SEC = 14.0
MAX_BUILDUPS = 6
PRE_CHORUS_MAX_DURATION_SEC = 24.0

STYLE_DIMENSIONS = (
    "boldness",
    "elegance",
    "playfulness",
    "warmth",
    "brightness",
    "grandeur",
    "tension",
    "precision",
)

PITCH_CLASS_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

PERSONALITY_PRESETS = {
    "balanced": {
        "boldness": 0.55,
        "elegance": 0.55,
        "playfulness": 0.45,
        "warmth": 0.55,
        "brightness": 0.50,
        "grandeur": 0.55,
        "tension": 0.45,
        "precision": 0.60,
    },
    "bold": {
        "boldness": 0.90,
        "elegance": 0.35,
        "playfulness": 0.45,
        "warmth": 0.65,
        "brightness": 0.78,
        "grandeur": 0.88,
        "tension": 0.62,
        "precision": 0.58,
    },
    "elegant": {
        "boldness": 0.38,
        "elegance": 0.92,
        "playfulness": 0.28,
        "warmth": 0.48,
        "brightness": 0.64,
        "grandeur": 0.74,
        "tension": 0.34,
        "precision": 0.82,
    },
    "playful": {
        "boldness": 0.58,
        "elegance": 0.34,
        "playfulness": 0.94,
        "warmth": 0.62,
        "brightness": 0.84,
        "grandeur": 0.52,
        "tension": 0.32,
        "precision": 0.55,
    },
    "cinematic": {
        "boldness": 0.68,
        "elegance": 0.72,
        "playfulness": 0.22,
        "warmth": 0.42,
        "brightness": 0.52,
        "grandeur": 0.96,
        "tension": 0.78,
        "precision": 0.70,
    },
    "intimate": {
        "boldness": 0.24,
        "elegance": 0.76,
        "playfulness": 0.24,
        "warmth": 0.78,
        "brightness": 0.34,
        "grandeur": 0.36,
        "tension": 0.30,
        "precision": 0.66,
    },
}

SchemaVersion = Literal["1.3.0"]
Score = Annotated[float, Field(ge=0.0, le=1.0)]
NonNegativeFloat = Annotated[float, Field(ge=0.0)]
NonNegativeInt = Annotated[int, Field(ge=0)]
SectionLabel = Literal["intro", "verse", "pre-chorus", "chorus", "bridge", "outro", "unknown"]
SectionIntensity = Literal["low", "medium", "high"]
MomentType = Literal["build", "climax"]
CueEffect = Literal["barrage", "accent", "crackle", "single"]
DensityLevel = Literal["low", "medium", "high"]


class SchemaModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class KeySignatureModel(SchemaModel):
    root: str
    mode: Literal["major", "minor"]
    confidence: Score


class StyleVectorModel(SchemaModel):
    boldness: Score
    elegance: Score
    playfulness: Score
    warmth: Score
    brightness: Score
    grandeur: Score
    tension: Score
    precision: Score


class DescriptorModel(SchemaModel):
    energy: Score
    drive: Score
    brightness: Score
    warmth: Score
    tension: Score
    grandeur: Score
    playfulness: Score
    precision: Score
    dynamic_range: Score
    bass_impact: Score
    section_contrast: Score


class RawMetricsModel(SchemaModel):
    tempo_bpm: NonNegativeFloat
    onset_density_per_sec: NonNegativeFloat
    key_moments_per_min: NonNegativeFloat
    buildups_per_min: NonNegativeFloat
    beat_stability: Score
    section_contrast: NonNegativeFloat
    bass_ratio: NonNegativeFloat


class BlendWeightsModel(SchemaModel):
    user: Score
    music: Score


class PaletteDirectionModel(SchemaModel):
    primary: str
    secondary: str
    accent: str


class MusicProfileModel(SchemaModel):
    genre_hint: str
    key_signature: KeySignatureModel
    descriptors: DescriptorModel
    style_vector: StyleVectorModel
    dominant_traits: list[str]
    raw_metrics: RawMetricsModel


class ShowPersonalityModel(SchemaModel):
    preset: Literal["balanced", "bold", "cinematic", "elegant", "intimate", "playful"]
    blend_weights: BlendWeightsModel
    dimensions: StyleVectorModel
    dominant_traits: list[str]
    palette_direction: PaletteDirectionModel
    density_level: DensityLevel
    genre_hint: str


class EnergyPointModel(SchemaModel):
    time: NonNegativeFloat
    energy: Score


class SectionModel(SchemaModel):
    start: NonNegativeFloat
    end: NonNegativeFloat
    duration: NonNegativeFloat
    avg_energy: Score
    peak_energy: Score
    intensity: SectionIntensity
    cluster_id: int
    label: SectionLabel

    @model_validator(mode="after")
    def validate_range(self):
        if self.end < self.start:
            raise ValueError("section end must be greater than or equal to start")
        if abs(self.duration - (self.end - self.start)) > 0.06:
            raise ValueError("section duration must match end - start")
        return self


class CompactSectionModel(SchemaModel):
    index: NonNegativeInt
    label: SectionLabel
    start: NonNegativeFloat
    end: NonNegativeFloat
    duration: NonNegativeFloat
    avg_energy: Score
    peak_energy: Score
    intensity: SectionIntensity
    cue_counts: dict[CueEffect, NonNegativeInt]

    @model_validator(mode="after")
    def validate_range(self):
        if self.end < self.start:
            raise ValueError("section end must be greater than or equal to start")
        if abs(self.duration - (self.end - self.start)) > 0.06:
            raise ValueError("section duration must match end - start")
        return self


class KeyMomentModel(SchemaModel):
    time: NonNegativeFloat
    energy: Score
    prominence: NonNegativeFloat
    type: MomentType


class BuildupModel(SchemaModel):
    start: NonNegativeFloat
    peak: NonNegativeFloat
    duration: NonNegativeFloat
    energy_rise: NonNegativeFloat

    @model_validator(mode="after")
    def validate_range(self):
        if self.peak < self.start:
            raise ValueError("buildup peak must be greater than or equal to start")
        if abs(self.duration - (self.peak - self.start)) > 0.06:
            raise ValueError("buildup duration must match peak - start")
        return self


class FireworkCueModel(SchemaModel):
    time: NonNegativeFloat
    end: NonNegativeFloat | None = None
    effect: CueEffect
    reason: str
    energy: Score
    section: SectionLabel
    palette: str
    shape: str
    height: str
    spread: str
    density: str
    style_tags: list[str]
    genre_hint: str

    @model_validator(mode="after")
    def validate_range(self):
        if self.end is not None and self.end < self.time:
            raise ValueError("cue end must be greater than or equal to time")
        return self


class AnalysisTimingsModel(SchemaModel):
    download_ms: NonNegativeFloat
    decode_ms: NonNegativeFloat
    beat_ms: NonNegativeFloat
    energy_ms: NonNegativeFloat
    onset_ms: NonNegativeFloat
    section_ms: NonNegativeFloat
    profile_ms: NonNegativeFloat
    validation_ms: NonNegativeFloat
    total_ms: NonNegativeFloat


class AnalysisMetaModel(SchemaModel):
    mode: Literal["fast"]
    runner_version: str
    timings_ms: AnalysisTimingsModel


class AnalysisResultModel(SchemaModel):
    schema_version: SchemaVersion
    file: str
    analysis_meta: AnalysisMetaModel
    duration_seconds: NonNegativeFloat
    tempo_bpm: NonNegativeFloat
    total_beats: NonNegativeInt
    beat_times: list[NonNegativeFloat]
    onset_times: list[NonNegativeFloat]
    energy_timeline: list[EnergyPointModel]
    sections: list[SectionModel]
    key_moments: list[KeyMomentModel]
    buildups: list[BuildupModel]
    music_profile: MusicProfileModel
    show_personality: ShowPersonalityModel
    firework_cues: list[FireworkCueModel]

    @model_validator(mode="after")
    def validate_times_within_duration(self):
        duration = self.duration_seconds + 0.75
        timed_values = [
            *self.beat_times,
            *self.onset_times,
            *(point.time for point in self.energy_timeline),
            *(section.end for section in self.sections),
            *(moment.time for moment in self.key_moments),
            *(buildup.peak for buildup in self.buildups),
            *(cue.end if cue.end is not None else cue.time for cue in self.firework_cues),
        ]
        if any(value > duration for value in timed_values):
            raise ValueError("timed analysis fields must not exceed song duration")
        return self


class FinaleWindowModel(SchemaModel):
    start: NonNegativeFloat
    end: NonNegativeFloat

    @model_validator(mode="after")
    def validate_range(self):
        if self.end < self.start:
            raise ValueError("finale window end must be greater than or equal to start")
        return self


class AnchorWindowModel(SchemaModel):
    type: Literal["climax", "buildup"]
    anchor_time: NonNegativeFloat
    start: NonNegativeFloat
    end: NonNegativeFloat
    energy: Score | None = None
    energy_rise: NonNegativeFloat | None = None

    @model_validator(mode="after")
    def validate_anchor_payload(self):
        if self.end < self.start:
            raise ValueError("anchor window end must be greater than or equal to start")
        if self.type == "climax" and self.energy is None:
            raise ValueError("climax anchor windows require energy")
        if self.type == "buildup" and self.energy_rise is None:
            raise ValueError("buildup anchor windows require energy_rise")
        return self


class DerivedFeaturesModel(SchemaModel):
    finale_window: FinaleWindowModel | None
    quietest_section_index: NonNegativeInt | None
    highest_energy_section_index: NonNegativeInt | None
    repeated_chorus_count: NonNegativeInt
    section_rank_by_energy: list[NonNegativeInt]
    anchor_windows: list[AnchorWindowModel]


class SongPayloadModel(SchemaModel):
    duration_seconds: NonNegativeFloat
    tempo_bpm: NonNegativeFloat
    total_beats: NonNegativeInt
    genre_hint: str
    key_signature: KeySignatureModel


class MusicStylePayloadModel(SchemaModel):
    dominant_traits: list[str]
    style_vector: StyleVectorModel
    descriptors: DescriptorModel


class ShowPersonalityPayloadModel(SchemaModel):
    preset: Literal["balanced", "bold", "cinematic", "elegant", "intimate", "playful"]
    blend_weights: BlendWeightsModel
    dimensions: StyleVectorModel
    dominant_traits: list[str]
    palette_direction: PaletteDirectionModel
    density_level: DensityLevel


class AnchorsPayloadModel(SchemaModel):
    key_moments: list[KeyMomentModel]
    buildups: list[BuildupModel]


class SectionCueSummaryModel(SchemaModel):
    section_index: NonNegativeInt
    label: SectionLabel
    start: NonNegativeFloat
    end: NonNegativeFloat
    total_count: NonNegativeInt
    counts_by_effect: dict[CueEffect, NonNegativeInt]


class FireworkCueSummaryModel(SchemaModel):
    total_count: NonNegativeInt
    counts_by_effect: dict[CueEffect, NonNegativeInt]
    counts_by_section: list[SectionCueSummaryModel]


class CueReferenceModel(SchemaModel):
    full_cues_source: Literal["analysis_json"]
    json_path: Literal["firework_cues"]
    note: str


class LLMPayloadModel(SchemaModel):
    schema_version: SchemaVersion
    source_file: str
    song: SongPayloadModel
    music_style: MusicStylePayloadModel
    show_personality: ShowPersonalityPayloadModel
    sections: list[CompactSectionModel]
    anchors: AnchorsPayloadModel
    derived: DerivedFeaturesModel
    firework_cue_summary: FireworkCueSummaryModel
    firework_cue_samples: Annotated[list[FireworkCueModel], Field(max_length=12)]
    cue_reference: CueReferenceModel
    user_constraints: dict[str, Any]
    inventory: list[Any]


def elapsed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000.0, 3)


def normalise_timings(timings: dict[str, float] | None = None) -> dict[str, float]:
    values = {field: 0.0 for field in TIMING_FIELDS}
    for key, value in (timings or {}).items():
        if key in values:
            values[key] = max(0.0, float(value))
    return {key: round(value, 3) for key, value in values.items()}


def validate_schema(model_cls: type[BaseModel], payload: dict, label: str) -> dict:
    try:
        return model_cls.model_validate(payload).model_dump(mode="json", exclude_none=True)
    except ValidationError as exc:
        raise ValueError(f"{label} failed schema {SCHEMA_VERSION} validation:\n{exc}") from exc


def validate_analysis_result(result: dict) -> dict:
    return validate_schema(AnalysisResultModel, result, "analysis result")


def validate_llm_payload(payload: dict) -> dict:
    return validate_schema(LLMPayloadModel, payload, "LLM payload")


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def score01(value: float, low: float, high: float) -> float:
    if high <= low:
        return 0.0
    return clamp01((float(value) - low) / (high - low))


def normalise_series(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    if values.size == 0:
        return values
    value_range = float(values.max() - values.min())
    if value_range <= 1e-10:
        return np.zeros_like(values, dtype=float)
    return (values - values.min()) / value_range


def smooth_energy_curve(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    if values.size > 51:
        values = savgol_filter(values, window_length=51, polyorder=3)
    return np.clip(values, 0.0, 1.0)


def rounded_scores(scores: dict) -> dict:
    return {key: round(clamp01(value), 3) for key, value in scores.items()}


def score_to_label(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def dominant_traits(style_vector: dict, limit: int = 3) -> list:
    ranked = sorted(style_vector.items(), key=lambda item: item[1], reverse=True)
    return [name for name, _ in ranked[:limit]]


def estimate_key_signature(chroma: np.ndarray) -> dict:
    chroma = np.asarray(chroma, dtype=float)
    if chroma.size == 0 or chroma.shape[0] != 12:
        return {"root": "C", "mode": "major", "confidence": 0.0}

    chroma_profile = chroma.mean(axis=1)
    if np.allclose(chroma_profile.sum(), 0.0):
        return {"root": "C", "mode": "major", "confidence": 0.0}

    chroma_profile = chroma_profile / (np.linalg.norm(chroma_profile) + 1e-10)
    major_template = np.array(
        [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
        dtype=float,
    )
    minor_template = np.array(
        [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
        dtype=float,
    )
    major_template /= np.linalg.norm(major_template)
    minor_template /= np.linalg.norm(minor_template)

    major_scores = [float(np.dot(chroma_profile, np.roll(major_template, idx))) for idx in range(12)]
    minor_scores = [float(np.dot(chroma_profile, np.roll(minor_template, idx))) for idx in range(12)]

    best_major_idx = int(np.argmax(major_scores))
    best_minor_idx = int(np.argmax(minor_scores))
    best_major = major_scores[best_major_idx]
    best_minor = minor_scores[best_minor_idx]

    if best_major >= best_minor:
        root = PITCH_CLASS_NAMES[best_major_idx]
        mode = "major"
        chosen = best_major
        alternate = best_minor
    else:
        root = PITCH_CLASS_NAMES[best_minor_idx]
        mode = "minor"
        chosen = best_minor
        alternate = best_major

    confidence = clamp01(0.5 + (chosen - alternate) / (2 * (abs(chosen) + abs(alternate) + 1e-10)))
    return {"root": root, "mode": mode, "confidence": round(confidence, 3)}


def infer_genre_hint(tempo_bpm: float, descriptors: dict, key_signature: dict) -> str:
    drive = descriptors["drive"]
    bass_impact = descriptors["bass_impact"]
    brightness = descriptors["brightness"]
    grandeur = descriptors["grandeur"]
    tension = descriptors["tension"]
    playfulness = descriptors["playfulness"]

    if drive > 0.72 and bass_impact > 0.52 and tempo_bpm >= 118:
        return "edm"
    if bass_impact > 0.58 and 75 <= tempo_bpm <= 105 and brightness < 0.55:
        return "hiphop"
    if grandeur > 0.72 and tension > 0.55 and tempo_bpm < 115:
        return "cinematic"
    if drive > 0.58 and brightness > 0.48 and tempo_bpm >= 96:
        return "rock"
    if playfulness > 0.55 and key_signature["mode"] == "major":
        return "pop"
    if tempo_bpm < 92 and descriptors["energy"] < 0.5:
        return "ballad"
    return "hybrid"


def analyse_music_personality(
    y: np.ndarray,
    sr: int,
    hop_length: int,
    duration: float,
    tempo_bpm: float,
    beat_times: list,
    onset_times: list,
    rms_normalised: np.ndarray,
    sections: list,
    key_moments: list,
    buildups: list,
    chroma: np.ndarray | None = None,
) -> dict:
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)[0]
    if chroma is None:
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)

    stft = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop_length))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    total_energy = float(np.mean(stft)) + 1e-10
    bass_mask = freqs <= 180
    bass_energy = float(np.mean(stft[bass_mask])) if np.any(bass_mask) else 0.0
    bass_ratio = bass_energy / total_energy

    energy_mean = float(np.mean(rms_normalised))
    dynamic_range = float(np.percentile(rms_normalised, 90) - np.percentile(rms_normalised, 10))
    energy_variation = float(np.std(rms_normalised))
    beat_intervals = np.diff(beat_times) if len(beat_times) > 1 else np.array([])
    beat_cv = float(np.std(beat_intervals) / (np.mean(beat_intervals) + 1e-10)) if beat_intervals.size else 1.0
    beat_stability = clamp01(1.0 - beat_cv / 0.25)

    onset_density = len(onset_times) / max(duration, 1.0)
    key_moment_density = len(key_moments) / max(duration / 60.0, 1.0)
    buildup_density = len(buildups) / max(duration / 60.0, 1.0)
    section_contrast = 0.0
    if len(sections) > 1:
        section_energies = [s["avg_energy"] for s in sections]
        section_contrast = float(np.mean(np.abs(np.diff(section_energies))))

    centroid_norm = float(np.mean(spectral_centroid)) / (sr / 2.0 + 1e-10)
    rolloff_norm = float(np.mean(spectral_rolloff)) / (sr / 2.0 + 1e-10)
    brightness = clamp01(0.55 * score01(centroid_norm, 0.08, 0.45) + 0.45 * score01(rolloff_norm, 0.12, 0.7))
    bass_impact = score01(bass_ratio, 0.8, 3.5)
    drive = clamp01(
        0.40 * score01(tempo_bpm, 70, 160)
        + 0.35 * score01(onset_density, 0.8, 4.0)
        + 0.25 * bass_impact
    )

    key_signature = estimate_key_signature(chroma)
    major_bias = key_signature["confidence"] if key_signature["mode"] == "major" else 1.0 - key_signature["confidence"]
    minor_bias = key_signature["confidence"] if key_signature["mode"] == "minor" else 1.0 - key_signature["confidence"]

    warmth = clamp01(0.58 * bass_impact + 0.42 * (1.0 - brightness))
    tension = clamp01(
        0.32 * minor_bias
        + 0.22 * score01(dynamic_range, 0.12, 0.55)
        + 0.20 * score01(energy_variation, 0.08, 0.28)
        + 0.14 * score01(key_moment_density, 1.0, 5.0)
        + 0.12 * score01(buildup_density, 0.5, 3.0)
    )
    grandeur = clamp01(
        0.28 * score01(dynamic_range, 0.12, 0.55)
        + 0.26 * score01(section_contrast, 0.05, 0.25)
        + 0.24 * score01(max(duration, 0.0), 90, 300)
        + 0.22 * score01(key_moment_density, 1.0, 5.0)
    )
    playfulness = clamp01(
        0.34 * brightness
        + 0.30 * major_bias
        + 0.22 * score01(onset_density, 0.8, 4.0)
        + 0.14 * score01(tempo_bpm, 85, 150)
    )
    precision = clamp01(0.72 * beat_stability + 0.28 * (1.0 - score01(energy_variation, 0.08, 0.28)))
    boldness = clamp01(
        0.42 * energy_mean
        + 0.24 * drive
        + 0.18 * bass_impact
        + 0.16 * score01(key_moment_density, 1.0, 5.0)
    )
    elegance = clamp01(
        0.42 * precision
        + 0.26 * grandeur
        + 0.18 * (1.0 - score01(onset_density, 0.8, 4.0))
        + 0.14 * (1.0 - score01(energy_variation, 0.08, 0.28))
    )

    descriptors = rounded_scores(
        {
            "energy": energy_mean,
            "drive": drive,
            "brightness": brightness,
            "warmth": warmth,
            "tension": tension,
            "grandeur": grandeur,
            "playfulness": playfulness,
            "precision": precision,
            "dynamic_range": score01(dynamic_range, 0.12, 0.55),
            "bass_impact": bass_impact,
            "section_contrast": score01(section_contrast, 0.05, 0.25),
        }
    )
    style_vector = rounded_scores(
        {
            "boldness": boldness,
            "elegance": elegance,
            "playfulness": playfulness,
            "warmth": warmth,
            "brightness": brightness,
            "grandeur": grandeur,
            "tension": tension,
            "precision": precision,
        }
    )
    genre_hint = infer_genre_hint(tempo_bpm, descriptors, key_signature)

    return {
        "genre_hint": genre_hint,
        "key_signature": key_signature,
        "descriptors": descriptors,
        "style_vector": style_vector,
        "dominant_traits": dominant_traits(style_vector),
        "raw_metrics": {
            "tempo_bpm": round(float(tempo_bpm), 1),
            "onset_density_per_sec": round(float(onset_density), 3),
            "key_moments_per_min": round(float(key_moment_density), 3),
            "buildups_per_min": round(float(buildup_density), 3),
            "beat_stability": round(float(beat_stability), 3),
            "section_contrast": round(float(section_contrast), 3),
            "bass_ratio": round(float(bass_ratio), 3),
        },
    }


def select_show_palette(style_vector: dict, genre_hint: str) -> dict:
    warmth = style_vector["warmth"]
    brightness = style_vector["brightness"]
    tension = style_vector["tension"]
    playfulness = style_vector["playfulness"]
    boldness = style_vector["boldness"]

    if tension > 0.65:
        palette = {"primary": "deep_blue", "secondary": "silver", "accent": "crimson"}
    elif warmth > 0.65:
        palette = {
            "primary": "gold",
            "secondary": "amber",
            "accent": "red" if boldness > 0.65 else "white",
        }
    elif brightness > 0.68:
        palette = {"primary": "white", "secondary": "ice_blue", "accent": "silver"}
    elif playfulness > 0.68:
        palette = {"primary": "teal", "secondary": "lime", "accent": "gold"}
    else:
        palette = {"primary": "gold", "secondary": "white", "accent": "emerald"}

    if genre_hint == "edm":
        palette["accent"] = "white"
    elif genre_hint == "cinematic":
        palette["secondary"] = "silver"

    return palette


def build_show_personality(music_profile: dict, preset_name: str) -> dict:
    preset_key = preset_name if preset_name in PERSONALITY_PRESETS else "balanced"
    preset_vector = PERSONALITY_PRESETS[preset_key]
    music_style = music_profile["style_vector"]

    combined = {}
    for dimension in STYLE_DIMENSIONS:
        combined[dimension] = 0.55 * preset_vector[dimension] + 0.45 * music_style[dimension]

    genre_hint = music_profile["genre_hint"]
    if genre_hint == "edm":
        combined["boldness"] += 0.05
        combined["brightness"] += 0.04
    elif genre_hint == "cinematic":
        combined["grandeur"] += 0.06
        combined["tension"] += 0.04
    elif genre_hint == "ballad":
        combined["warmth"] += 0.05
        combined["elegance"] += 0.04

    combined = rounded_scores(combined)
    palette_direction = select_show_palette(combined, genre_hint)

    return {
        "preset": preset_key,
        "blend_weights": {"user": 0.55, "music": 0.45},
        "dimensions": combined,
        "dominant_traits": dominant_traits(combined),
        "palette_direction": palette_direction,
        "density_level": score_to_label(
            clamp01(0.5 + (combined["boldness"] - combined["elegance"]) * 0.6 + combined["playfulness"] * 0.25)
        ),
        "genre_hint": genre_hint,
    }


def select_climax_indices(
    peak_times: np.ndarray,
    peak_energies: np.ndarray,
    prominences: np.ndarray,
    sections: list,
    duration: float,
) -> set:
    if len(peak_times) == 0:
        return set()

    target = int(round(duration / CLIMAX_TARGET_SECONDS))
    target = max(1, min(MAX_CLIMAXES, target, len(peak_times)))
    prominence_scores = normalise_series(prominences)

    def section_for_time(t: float) -> dict | None:
        for section in sections:
            if section["start"] <= t <= section["end"]:
                return section
        return None

    ranked = []
    for i, t in enumerate(peak_times):
        section = section_for_time(float(t))
        label = section["label"] if section else "unknown"
        intensity = section["intensity"] if section else "low"
        label_bonus = 0.0
        if label == "chorus":
            label_bonus = 0.35
        elif label == "bridge" or intensity == "high":
            label_bonus = 0.22
        elif label in {"intro", "outro"}:
            label_bonus = -0.18
        elif label == "verse":
            label_bonus = -0.08

        late_show_bonus = 0.08 * score01(float(t), 0.0, max(duration, 1.0))
        score = (
            0.52 * float(prominence_scores[i])
            + 0.34 * float(peak_energies[i])
            + label_bonus
            + late_show_bonus
        )
        ranked.append((score, i))

    ranked.sort(reverse=True)

    def pick_spaced(min_spacing: float) -> list:
        selected = []
        for _, idx in ranked:
            t = float(peak_times[idx])
            if any(abs(t - float(peak_times[chosen])) < min_spacing for chosen in selected):
                continue
            selected.append(idx)
            if len(selected) >= target:
                break
        return selected

    selected = pick_spaced(CLIMAX_MIN_SPACING_SEC)
    if len(selected) < target:
        selected = pick_spaced(CLIMAX_MIN_SPACING_SEC * 0.65)
    return set(selected[:target])


def analyse_song(
    file_path: str,
    personality_preset: str = "balanced",
    *,
    analysis_mode: str = ANALYSER_MODE,
    runner_version: str = ANALYSER_RUNNER_VERSION,
    initial_timings_ms: dict[str, float] | None = None,
) -> dict:
    """
    Analyse a song and return structured data for firework choreography.
    Uses Laplacian spectral clustering for accurate structural segmentation.
    """
    total_start = time.perf_counter()
    timings = normalise_timings(initial_timings_ms)
    mode = analysis_mode if analysis_mode == ANALYSER_MODE else ANALYSER_MODE

    # Load audio (mono, 22050Hz is fine for analysis)
    decode_start = time.perf_counter()
    y, sr = librosa.load(file_path, sr=22050, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    timings["decode_ms"] += elapsed_ms(decode_start)
    hop_length = 512

    # ──────────────────────────────────────────────
    # 1. TEMPO & BEATS
    # ──────────────────────────────────────────────
    beat_start = time.perf_counter()
    onset_env = librosa.onset.onset_strength(
        y=y,
        sr=sr,
        hop_length=hop_length,
        aggregate=np.median,
    )
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop_length,
        trim=False,
    )
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    tempo_value = float(np.atleast_1d(tempo)[0])
    timings["beat_ms"] += elapsed_ms(beat_start)

    # ──────────────────────────────────────────────
    # 2. ENERGY CURVE (RMS, normalised 0-1)
    # ──────────────────────────────────────────────
    energy_start = time.perf_counter()
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    if rms.size:
        # Percentile clip to reduce outlier-driven normalization.
        rms_low = np.percentile(rms, 5)
        rms_high = np.percentile(rms, 95)
        rms = np.clip(rms, rms_low, rms_high)
    rms_normalised = normalise_series(rms)
    energy_curve = smooth_energy_curve(rms_normalised)
    rms_times = librosa.frames_to_time(range(len(rms)), sr=sr, hop_length=hop_length)

    # Downsample energy to ~1 reading per second
    step = max(1, int(sr / hop_length))
    energy_timeline = [
        {"time": round(float(rms_times[i]), 2), "energy": round(float(energy_curve[i]), 3)}
        for i in range(0, len(rms), step)
    ]
    timings["energy_ms"] += elapsed_ms(energy_start)

    # ──────────────────────────────────────────────
    # 3. ONSET DETECTION
    # ──────────────────────────────────────────────
    onset_start = time.perf_counter()
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop_length,
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length).tolist()
    timings["onset_ms"] += elapsed_ms(onset_start)

    # ──────────────────────────────────────────────
    # 4. STRUCTURAL SEGMENTATION (Laplacian spectral clustering)
    #    Based on McFee & Ellis 2014 — beat-synchronised CQT + MFCC
    #    with recurrence + path similarity for clean boundaries.
    # ──────────────────────────────────────────────
    section_start = time.perf_counter()
    sections, cqt_mag = laplacian_segment(y, sr, beat_frames, energy_curve, hop_length, duration)
    timings["section_ms"] += elapsed_ms(section_start)

    # ──────────────────────────────────────────────
    # 5. KEY MOMENTS (energy peaks — climaxes and drops)
    # ──────────────────────────────────────────────
    smoothed = energy_curve
    fps = sr / hop_length
    if smoothed.size:
        energy_span = float(np.percentile(smoothed, 90) - np.percentile(smoothed, 10))
        peak_height = max(0.45, float(np.percentile(smoothed, 55)))
        prominence = max(0.1, 0.2 * energy_span)
    else:
        peak_height = 0.5
        prominence = 0.1

    peaks, peak_props = find_peaks(
        smoothed,
        height=peak_height,
        distance=max(1, int(fps * KEY_MOMENT_DISTANCE_SEC)),
        prominence=prominence,
    )
    peak_times_arr = librosa.frames_to_time(peaks, sr=sr, hop_length=hop_length)
    prominences = peak_props.get("prominences", np.zeros(len(peaks)))

    climax_idx = select_climax_indices(
        peak_times_arr,
        smoothed[peaks] if len(peaks) else np.array([]),
        prominences,
        sections,
        duration,
    )

    key_moments = [
        {
            "time": round(float(peak_times_arr[i]), 2),
            "energy": round(float(smoothed[peaks[i]]), 3),
            "prominence": round(float(prominences[i]), 3),
            "type": "climax" if i in climax_idx else "build",
        }
        for i in range(len(peaks))
    ]

    # ──────────────────────────────────────────────
    # 6. BUILD-UP DETECTION
    # ──────────────────────────────────────────────
    buildups = detect_buildups(smoothed, sr, hop_length)

    # ──────────────────────────────────────────────
    # 7. MUSIC PERSONALITY ANALYSIS
    # ──────────────────────────────────────────────
    profile_start = time.perf_counter()
    chroma = None
    if cqt_mag is not None:
        try:
            chroma = librosa.feature.chroma_cqt(C=cqt_mag, sr=sr, bins_per_octave=36)
        except ValueError:
            chroma = None

    music_profile = analyse_music_personality(
        y,
        sr,
        hop_length,
        duration,
        tempo_value,
        beat_times,
        onset_times,
        rms_normalised,
        sections,
        key_moments,
        buildups,
        chroma=chroma,
    )
    show_personality = build_show_personality(music_profile, personality_preset)
    timings["profile_ms"] += elapsed_ms(profile_start)

    # ──────────────────────────────────────────────
    # 8. FIREWORK CUES
    # ──────────────────────────────────────────────
    firework_cues = generate_firework_cues(
        beat_times,
        onset_times,
        sections,
        key_moments,
        buildups,
        smoothed,
        sr,
        hop_length,
        music_profile,
        show_personality,
    )

    # ──────────────────────────────────────────────
    # ASSEMBLE OUTPUT
    # ──────────────────────────────────────────────
    result = {
        "schema_version": SCHEMA_VERSION,
        "file": file_path,
        "analysis_meta": {
            "mode": mode,
            "runner_version": runner_version,
            "timings_ms": normalise_timings(timings),
        },
        "duration_seconds": round(duration, 2),
        "tempo_bpm": round(tempo_value, 1),
        "total_beats": len(beat_times),
        "beat_times": [round(t, 3) for t in beat_times],
        "onset_times": [round(t, 3) for t in onset_times],
        "energy_timeline": energy_timeline,
        "sections": sections,
        "key_moments": key_moments,
        "buildups": buildups,
        "music_profile": music_profile,
        "show_personality": show_personality,
        "firework_cues": firework_cues,
    }

    validation_start = time.perf_counter()
    validate_analysis_result(result)
    timings["validation_ms"] += elapsed_ms(validation_start)
    timings["total_ms"] = elapsed_ms(total_start) + timings["download_ms"]
    result["analysis_meta"]["timings_ms"] = normalise_timings(timings)
    return validate_analysis_result(result)


def laplacian_segment(y, sr, beat_frames, rms_normalised, hop_length, duration):
    """
    Laplacian spectral clustering segmentation (McFee & Ellis 2014).
    Uses beat-synchronised CQT (harmonic) + MFCC (timbral) features
    with combined recurrence + path similarity matrices.
    Produces clean, musically meaningful boundaries.
    """
    BINS_PER_OCTAVE = 12 * 3
    N_OCTAVES = 7

    # 1. CQT for harmonic content (key for structural similarity)
    cqt_mag = np.abs(
        librosa.cqt(
            y=y,
            sr=sr,
            bins_per_octave=BINS_PER_OCTAVE,
            n_bins=N_OCTAVES * BINS_PER_OCTAVE,
        )
    )
    C = librosa.amplitude_to_db(cqt_mag, ref=np.max)

    # 2. Beat-synchronise features (removes frame-level noise — critical)
    Csync = librosa.util.sync(C, beat_frames, aggregate=np.median)

    # 3. MFCCs for timbral content, also beat-synced
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    Msync = librosa.util.sync(mfcc, beat_frames)

    # 4. Recurrence matrix from CQT (captures long-range harmonic repetitions)
    R = librosa.segment.recurrence_matrix(Csync, width=3, mode='affinity', sym=True)

    # 5. Enhance diagonals with time-lag median filter (cleans up noise)
    df = librosa.segment.timelag_filter(scipy.ndimage.median_filter)
    Rf = df(R, size=(1, 7))

    # 6. Path similarity from MFCCs (captures local continuity)
    path_distance = np.sum(np.diff(Msync, axis=1) ** 2, axis=0)
    sigma = np.median(path_distance)
    path_sim = np.exp(-path_distance / sigma) if sigma > 0 else np.ones_like(path_distance)
    R_path = np.diag(path_sim, k=1) + np.diag(path_sim, k=-1)

    # 7. Balance recurrence + path matrices
    deg_path = np.sum(R_path, axis=1)
    deg_rec = np.sum(Rf, axis=1)
    mu = deg_path.dot(deg_path + deg_rec) / (np.sum((deg_path + deg_rec) ** 2) + 1e-10)
    A = mu * Rf + (1 - mu) * R_path

    # 8. Normalised Laplacian → spectral decomposition
    L = scipy.sparse.csgraph.laplacian(A, normed=True)
    evals, evecs = scipy.linalg.eigh(L)
    evecs = scipy.ndimage.median_filter(evecs, size=(9, 1))
    Cnorm = np.cumsum(evecs ** 2, axis=1) ** 0.5

    # 9. Estimate k (number of section types) from eigenvalue gaps
    #    Pop songs typically have 4-7 distinct section types
    k = estimate_k(evals, min_k=3, max_k=8)

    # 10. Cluster into k segment types
    X = evecs[:, :k] / (Cnorm[:, k - 1:k] + 1e-10)
    KM = sklearn.cluster.KMeans(n_clusters=k, n_init=10, random_state=0)
    seg_ids = KM.fit_predict(X)

    # 11. Extract boundaries (where cluster label changes)
    bound_beats = 1 + np.flatnonzero(seg_ids[:-1] != seg_ids[1:])
    bound_beats = np.concatenate([[0], bound_beats])
    bound_segs = seg_ids[bound_beats].tolist()

    # Convert beat indices to times
    bound_frames = beat_frames[np.minimum(bound_beats, len(beat_frames) - 1)]
    bound_times = librosa.frames_to_time(bound_frames, sr=sr).tolist()
    bound_times[0] = 0.0  # ensure start at 0

    # ── Merge segments into clean, musically meaningful sections ──
    # Step 1: Merge adjacent segments with the same cluster ID
    merged_bounds = [bound_times[0]]
    merged_segs = [bound_segs[0]]
    for i in range(1, len(bound_times)):
        if i < len(bound_segs) and bound_segs[i] == merged_segs[-1]:
            continue  # same cluster — extend previous section
        else:
            merged_bounds.append(bound_times[i])
            if i < len(bound_segs):
                merged_segs.append(bound_segs[i])

    # Step 2: Iteratively absorb short sections until all are >= min_duration
    # Target: ~8-12 sections for a typical pop song (3-5 min)
    min_duration = max(10.0, duration / 15.0)  # at least 10s, scales with song length

    def get_durations(bounds):
        durs = []
        for i in range(len(bounds)):
            end = bounds[i + 1] if i + 1 < len(bounds) else duration
            durs.append(end - bounds[i])
        return durs

    # Keep merging the shortest section until all meet minimum or we have <= 6 sections
    for _ in range(50):  # safety limit
        durs = get_durations(merged_bounds)
        if len(merged_bounds) <= 6:
            break
        # Find shortest section
        short_indices = [i for i, d in enumerate(durs) if d < min_duration]
        if not short_indices:
            break

        # Merge the shortest one with whichever neighbour has the same cluster ID,
        # or the shorter neighbour if neither matches
        idx = min(short_indices, key=lambda i: durs[i])
        if idx == 0:
            # Merge with next
            if len(merged_bounds) > 1:
                merged_bounds.pop(1)
                merged_segs.pop(0)
        elif idx >= len(merged_bounds) - 1:
            # Last section — merge with previous (just remove boundary)
            merged_bounds.pop(-1)
            merged_segs.pop(-1)
        else:
            # Merge with whichever neighbour shares cluster ID, or shorter neighbour
            prev_cluster = merged_segs[idx - 1] if idx - 1 >= 0 else -1
            next_cluster = merged_segs[idx + 1] if idx + 1 < len(merged_segs) else -1
            cur_cluster = merged_segs[idx]

            if cur_cluster == prev_cluster:
                # Merge into previous (remove this boundary)
                merged_bounds.pop(idx)
                merged_segs.pop(idx)
            elif cur_cluster == next_cluster:
                # Merge into next (remove next boundary)
                if idx + 1 < len(merged_bounds):
                    merged_bounds.pop(idx + 1)
                    merged_segs.pop(idx)
            else:
                # Merge into shorter neighbour
                prev_dur = durs[idx - 1] if idx > 0 else float('inf')
                next_dur = durs[idx + 1] if idx + 1 < len(durs) else float('inf')
                if prev_dur <= next_dur:
                    merged_bounds.pop(idx)
                    merged_segs.pop(idx)
                else:
                    if idx + 1 < len(merged_bounds):
                        merged_bounds.pop(idx + 1)
                        merged_segs.pop(idx)

    # Build section list with energy stats
    intensity_low = 0.4
    intensity_high = 0.7
    if rms_normalised.size:
        p40 = float(np.percentile(rms_normalised, 40))
        p70 = float(np.percentile(rms_normalised, 70))
        if p70 - p40 >= 0.05:
            intensity_low = p40
            intensity_high = p70
    sections = []
    for i in range(len(merged_bounds)):
        start = merged_bounds[i]
        end = merged_bounds[i + 1] if i + 1 < len(merged_bounds) else duration

        start_frame = int(start * sr / hop_length)
        end_frame = min(int(end * sr / hop_length), len(rms_normalised))

        if start_frame < end_frame:
            section_energy = rms_normalised[start_frame:end_frame]
            avg_energy = float(np.mean(section_energy))
            peak_energy = float(np.percentile(section_energy, 90))
        else:
            avg_energy = 0.0
            peak_energy = 0.0

        sections.append({
            "start": round(start, 2),
            "end": round(end, 2),
            "duration": round(end - start, 2),
            "avg_energy": round(avg_energy, 3),
            "peak_energy": round(peak_energy, 3),
            "intensity": classify_intensity(avg_energy, intensity_low, intensity_high),
            "cluster_id": merged_segs[i] if i < len(merged_segs) else -1,
            "label": "unknown",
        })

    # Label sections using cluster IDs + energy heuristics
    label_sections_from_clusters(sections)

    return sections, cqt_mag


def estimate_k(evals, min_k=3, max_k=8):
    """
    Estimate the number of section types from eigenvalue gaps.
    Looks for the largest gap in the first few eigenvalues.
    """
    if len(evals) < max_k + 1:
        return min(min_k, len(evals))
    gaps = np.diff(evals[:max_k + 1])
    # Skip the first eigenvalue (always ~0), look at gaps from index 1
    if len(gaps) > min_k:
        best_k = min_k + np.argmax(gaps[min_k - 1:max_k]) + 1
        return min(best_k, max_k)
    return min_k


def label_sections_from_clusters(sections):
    """
    Label sections using cluster IDs and energy heuristics.
    Sections with the same cluster_id sound similar (same musical function).
    Chorus = most-repeated high-energy cluster.
    Verse = most-repeated lower-energy cluster.
    """
    n = len(sections)
    if n == 0:
        return

    # Group sections by cluster ID
    from collections import Counter
    cluster_counts = Counter(s["cluster_id"] for s in sections)
    cluster_energies = {}
    for s in sections:
        cid = s["cluster_id"]
        if cid not in cluster_energies:
            cluster_energies[cid] = []
        cluster_energies[cid].append(s["avg_energy"])

    cluster_avg_energy = {cid: np.mean(energies) for cid, energies in cluster_energies.items()}
    median_energy = float(np.median([s["avg_energy"] for s in sections]))

    # Label intro/outro (edges)
    if sections[0]["avg_energy"] < 0.35 or sections[0]["duration"] < 10:
        sections[0]["label"] = "intro"
    if n > 1 and (sections[-1]["avg_energy"] < 0.35 or sections[-1]["duration"] < 10):
        sections[-1]["label"] = "outro"

    # Find chorus cluster: repeated (2+) with highest energy
    chorus_cluster = None
    best_score = -1
    for cid, count in cluster_counts.items():
        if count >= 2 and cluster_avg_energy[cid] >= median_energy * 0.8:
            score = count * cluster_avg_energy[cid]
            if score > best_score:
                best_score = score
                chorus_cluster = cid

    # Find verse cluster: repeated, lower energy than chorus
    verse_cluster = None
    best_verse_score = -1
    for cid, count in cluster_counts.items():
        if cid == chorus_cluster:
            continue
        if count >= 2:
            score = count * (1.0 - cluster_avg_energy[cid])  # prefer lower energy
            if score > best_verse_score:
                best_verse_score = score
                verse_cluster = cid

    # Assign labels
    for idx, s in enumerate(sections):
        if s["label"] != "unknown":
            continue
        cid = s["cluster_id"]
        precedes_chorus = idx + 1 < n and sections[idx + 1].get("cluster_id") == chorus_cluster
        if cid == chorus_cluster:
            s["label"] = "chorus"
        elif (
            precedes_chorus
            and idx > 0
            and s["duration"] <= PRE_CHORUS_MAX_DURATION_SEC
            and s["avg_energy"] < median_energy
        ):
            s["label"] = "pre-chorus"
        elif s["intensity"] == "high" and s["avg_energy"] >= median_energy:
            s["label"] = "bridge"
        elif cid == verse_cluster:
            s["label"] = "verse"
        elif cluster_avg_energy.get(cid, 0) > median_energy * 1.2:
            s["label"] = "bridge"
        elif cluster_avg_energy.get(cid, 0) < median_energy * 0.7:
            s["label"] = "pre-chorus"
        else:
            # Check if it precedes a chorus section
            if idx + 1 < n and sections[idx + 1].get("label") == "chorus":
                s["label"] = "pre-chorus"
            else:
                s["label"] = "verse"


def classify_intensity(energy: float, low: float, high: float) -> str:
    if energy > high:
        return "high"
    elif energy > low:
        return "medium"
    else:
        return "low"


def filter_buildups(buildups: list, duration: float) -> list:
    if not buildups:
        return []

    target = int(round(duration / BUILDUP_TARGET_SECONDS))
    target = max(1, min(MAX_BUILDUPS, target, len(buildups)))
    ranked = sorted(buildups, key=lambda bu: (bu["energy_rise"], bu["duration"]), reverse=True)

    def pick_spaced(min_spacing: float) -> list:
        selected = []
        for bu in ranked:
            peak = float(bu["peak"])
            if any(abs(peak - float(chosen["peak"])) < min_spacing for chosen in selected):
                continue
            selected.append(bu)
            if len(selected) >= target:
                break
        return selected

    selected = pick_spaced(BUILDUP_MIN_SPACING_SEC)
    if len(selected) < target:
        selected = pick_spaced(BUILDUP_MIN_SPACING_SEC * 0.65)
    return sorted(selected[:target], key=lambda bu: bu["peak"])


def detect_buildups(smoothed: np.ndarray, sr: int, hop_length: int) -> list:
    """
    Detect energy ramps — moments where energy rises steadily before a peak.
    Pre-chorus / pre-drop moments ideal for ramping up firework intensity.
    """
    fps = sr / hop_length
    window = int(fps * 4)
    buildups = []

    peak_height = 0.6
    rise_threshold = 0.2
    if smoothed.size:
        peak_height = float(np.percentile(smoothed, 60))
        rise_span = float(np.percentile(smoothed, 90) - np.percentile(smoothed, 10))
        if rise_span > 0:
            rise_threshold = max(0.12, 0.35 * rise_span)

    peaks, _ = find_peaks(smoothed, height=peak_height, distance=int(fps * 5), prominence=0.15)

    for peak in peaks:
        start = max(0, peak - window)
        segment = smoothed[start:peak]
        if len(segment) < int(fps * 2):
            continue

        energy_rise = float(segment[-1] - segment[0])
        if energy_rise > rise_threshold:
            start_time = float(librosa.frames_to_time(start, sr=sr, hop_length=hop_length))
            peak_time = float(librosa.frames_to_time(peak, sr=sr, hop_length=hop_length))
            buildups.append({
                "start": round(start_time, 2),
                "peak": round(peak_time, 2),
                "duration": round(peak_time - start_time, 2),
                "energy_rise": round(energy_rise, 3),
            })

    duration = len(smoothed) / fps if fps > 0 else 0.0
    return filter_buildups(buildups, duration)


def get_section_at_time(t: float, sections: list) -> dict | None:
    for section in sections:
        if section["start"] <= t <= section["end"]:
            return section
    return None


def cue_steps_from_personality(show_personality: dict) -> dict:
    dims = show_personality["dimensions"]
    density_score = clamp01(
        0.45 * dims["boldness"] + 0.30 * dims["playfulness"] + 0.10 * dims["grandeur"] - 0.25 * dims["elegance"]
    )

    if density_score >= 0.72:
        chorus_step = 1
        high_step = 2
        verse_step = 4
    elif density_score >= 0.48:
        chorus_step = 2
        high_step = 4
        verse_step = 6
    else:
        chorus_step = 4
        high_step = 6
        verse_step = 8

    if dims["precision"] > 0.78 and chorus_step > 1:
        chorus_step -= 1
    if dims["elegance"] > 0.80:
        verse_step = max(verse_step, 8)

    return {
        "chorus": chorus_step,
        "high": high_step,
        "verse": verse_step,
        "onset": 5 if dims["playfulness"] > 0.72 else 8,
    }


def nearest_beat_distance(t: float, beat_times: np.ndarray) -> float:
    if beat_times.size == 0:
        return float("inf")

    idx = int(np.searchsorted(beat_times, t))
    candidates = []
    if idx < beat_times.size:
        candidates.append(abs(float(beat_times[idx]) - t))
    if idx > 0:
        candidates.append(abs(float(beat_times[idx - 1]) - t))
    return min(candidates) if candidates else float("inf")


def style_firework_cue(cue: dict, section: dict | None, music_profile: dict, show_personality: dict) -> dict:
    dims = show_personality["dimensions"]
    palette = show_personality["palette_direction"]
    section_label = section["label"] if section else "unknown"

    if cue["effect"] == "barrage":
        shape = "fan_willow" if dims["elegance"] > 0.78 else (
            "layered_chrysanthemum" if dims["grandeur"] > 0.72 else "chrysanthemum"
        )
        height = "high"
        spread = "fan" if dims["elegance"] > 0.78 else "wide"
        density = "dense" if dims["boldness"] > 0.62 else "layered"
        primary = palette["accent"] if dims["boldness"] > 0.62 else palette["primary"]
        secondary = palette["primary"]
    elif cue["effect"] == "crackle":
        shape = "glitter_comet" if dims["elegance"] > 0.70 else (
            "strobe_fan" if dims["tension"] > 0.65 else "crackle_tail"
        )
        height = "mid_high" if dims["grandeur"] > 0.58 else "mid"
        spread = "fan" if section_label in {"pre-chorus", "bridge"} else "trail"
        density = "sustained"
        primary = "silver" if dims["elegance"] > 0.70 else palette["secondary"]
        secondary = palette["primary"]
    elif cue["effect"] == "accent":
        shape = "ring" if dims["playfulness"] > 0.76 else (
            "comet" if dims["precision"] > 0.72 else ("peony" if dims["boldness"] > 0.64 else "palm")
        )
        height = "high" if cue["energy"] > 0.78 or section_label == "chorus" else "mid"
        spread = "wide" if dims["boldness"] > 0.70 else "focused"
        density = "punchy"
        primary = palette["accent"] if section_label in {"chorus", "bridge"} else palette["secondary"]
        secondary = palette["primary"]
    else:
        shape = "ring" if dims["playfulness"] > 0.76 else ("comet" if dims["elegance"] > 0.68 else "pearl")
        height = "mid" if cue["energy"] > 0.4 else "low"
        spread = "focused" if dims["precision"] > 0.65 else "narrow"
        density = "airy" if dims["elegance"] > 0.68 else "sparse"
        primary = palette["primary"]
        secondary = palette["secondary"]

    return {
        "section": section_label,
        "palette": f"{primary}/{secondary}",
        "shape": shape,
        "height": height,
        "spread": spread,
        "density": density,
        "style_tags": dominant_traits(dims, limit=2),
        "genre_hint": music_profile["genre_hint"],
    }


def generate_firework_cues(
    beat_times,
    onset_times,
    sections,
    key_moments,
    buildups,
    smoothed,
    sr,
    hop_length,
    music_profile,
    show_personality,
) -> list:
    """
    Generate concrete firework cue suggestions:
    - "barrage": full multi-shot display (chorus climaxes, big drops)
    - "accent": single large shell (key beats during high-energy sections)
    - "crackle": sustained crackling effects (build-ups)
    - "single": individual shots (beats during verses)
    """
    cues = []
    fps = sr / hop_length
    beat_array = np.asarray(beat_times, dtype=float)
    step_config = cue_steps_from_personality(show_personality)
    dims = show_personality["dimensions"]

    chorus_ranges = [(s["start"], s["end"]) for s in sections if s["label"] == "chorus"]
    high_ranges = [(s["start"], s["end"]) for s in sections if s["intensity"] == "high"]

    def in_ranges(t, ranges):
        return any(s <= t <= e for s, e in ranges)

    def get_energy_at(t):
        frame = min(int(t * fps), len(smoothed) - 1)
        return float(smoothed[frame]) if frame >= 0 else 0.0

    # Climax moments → barrage
    for moment in key_moments:
        if moment["type"] == "climax":
            cues.append({
                "time": moment["time"],
                "effect": "barrage",
                "reason": "climax",
                "energy": moment["energy"],
            })

    # Build-up peaks → crackle during the ramp
    for bu in buildups:
        cues.append({
            "time": bu["start"],
            "end": bu["peak"],
            "effect": "crackle",
            "reason": "buildup",
            "energy": bu["energy_rise"],
        })

    # Beats during chorus/high-energy sections → density shaped by personality
    for i, t in enumerate(beat_times):
        if in_ranges(t, chorus_ranges):
            if i % step_config["chorus"] == 0:
                cues.append({
                    "time": round(t, 3),
                    "effect": "accent",
                    "reason": "chorus_beat",
                    "energy": round(get_energy_at(t), 3),
                })
        elif in_ranges(t, high_ranges):
            if i % step_config["high"] == 0:
                cues.append({
                    "time": round(t, 3),
                    "effect": "accent",
                    "reason": "high_energy_beat",
                    "energy": round(get_energy_at(t), 3),
                })

    # Syncopated onsets add sparkle for brighter / more playful personalities
    if dims["playfulness"] > 0.60 or music_profile["genre_hint"] in {"edm", "pop"}:
        for i, t in enumerate(onset_times):
            if i % step_config["onset"] != 0:
                continue
            if not (in_ranges(t, chorus_ranges) or in_ranges(t, high_ranges)):
                continue
            if get_energy_at(t) < 0.45:
                continue
            if nearest_beat_distance(t, beat_array) < 0.08:
                continue

            cues.append({
                "time": round(t, 3),
                "effect": "accent",
                "reason": "syncopated_onset",
                "energy": round(get_energy_at(t), 3),
            })

    # Downbeats during verses → sparse single shots
    for i, t in enumerate(beat_times):
        if not in_ranges(t, chorus_ranges) and not in_ranges(t, high_ranges):
            if i % step_config["verse"] == 0 and get_energy_at(t) > 0.2:
                cues.append({
                    "time": round(t, 3),
                    "effect": "single",
                    "reason": "verse_accent",
                    "energy": round(get_energy_at(t), 3),
                })

    # Sort and deduplicate
    effect_priority = {"barrage": 4, "crackle": 3, "accent": 2, "single": 1}
    cues.sort(key=lambda c: (c["time"], -effect_priority.get(c["effect"], 0)))

    deduped = []
    seen_times = set()
    for cue in cues:
        t = cue["time"]
        if t not in seen_times:
            seen_times.add(t)
            section = get_section_at_time(t, sections)
            cue.update(style_firework_cue(cue, section, music_profile, show_personality))
            deduped.append(cue)

    return deduped


def compute_derived_features(result: dict) -> dict:
    """
    Cheap, deterministic derived fields recommended by `llm-harness.md`.
    These reduce reasoning load on the downstream choreography model.

    Defensive: this function does not assume `key_moments` or `buildups`
    arrive in time-sorted order. Both are sorted locally before use so
    the output stays correct even if upstream construction order changes.
    """
    sections = result["sections"]
    duration = float(result["duration_seconds"])
    key_moments = sorted(result["key_moments"], key=lambda m: m["time"])
    buildups = sorted(result["buildups"], key=lambda bu: bu["peak"])

    if not sections:
        return {
            "finale_window": None,
            "quietest_section_index": None,
            "highest_energy_section_index": None,
            "repeated_chorus_count": 0,
            "section_rank_by_energy": [],
            "anchor_windows": [],
        }

    last_climax_t = next(
        (m["time"] for m in reversed(key_moments) if m.get("type") == "climax"),
        None,
    )
    if last_climax_t is None and buildups:
        last_climax_t = buildups[-1]["peak"]

    finale_window = None
    if last_climax_t is not None:
        # Expand the window backwards to include the lead-in into the
        # final climax. Prefer a build-up whose ramp peaks near the
        # climax (within FINALE_BUILDUP_TOLERANCE_SEC); otherwise fall
        # back to the start of the section that contains the climax.
        # Without this, finale_window starts at the climax instant and
        # gives the downstream LLM no room to escalate into it.
        finale_start = float(last_climax_t)
        leading_buildup = next(
            (
                bu for bu in reversed(buildups)
                if abs(bu["peak"] - last_climax_t) <= FINALE_BUILDUP_TOLERANCE_SEC
            ),
            None,
        )
        if leading_buildup is not None:
            finale_start = float(leading_buildup["start"])
        else:
            for s in sections:
                if s["start"] <= last_climax_t <= s["end"]:
                    finale_start = float(s["start"])
                    break
        finale_window = {
            "start": round(finale_start, 2),
            "end": round(duration, 2),
        }

    energies = [s["avg_energy"] for s in sections]
    quietest_idx = min(range(len(energies)), key=lambda i: energies[i])
    loudest_idx = max(range(len(energies)), key=lambda i: energies[i])
    section_rank = sorted(range(len(energies)), key=lambda i: energies[i], reverse=True)
    repeated_chorus_count = sum(1 for s in sections if s["label"] == "chorus")

    anchor_windows = []
    for m in key_moments:
        if m["type"] != "climax":
            continue
        anchor_windows.append({
            "type": "climax",
            "anchor_time": m["time"],
            "start": round(max(0.0, m["time"] - ANCHOR_PRE_SEC), 2),
            "end": round(min(duration, m["time"] + ANCHOR_POST_SEC), 2),
            "energy": m["energy"],
        })
    for bu in buildups:
        anchor_windows.append({
            "type": "buildup",
            "anchor_time": bu["peak"],
            "start": bu["start"],
            "end": round(min(duration, bu["peak"] + ANCHOR_POST_SEC), 2),
            "energy_rise": bu["energy_rise"],
        })
    anchor_windows.sort(key=lambda w: w["anchor_time"])

    return {
        "finale_window": finale_window,
        "quietest_section_index": int(quietest_idx),
        "highest_energy_section_index": int(loudest_idx),
        "repeated_chorus_count": int(repeated_chorus_count),
        "section_rank_by_energy": [int(i) for i in section_rank],
        "anchor_windows": anchor_windows,
    }


def build_firework_cue_summary(cues: list[dict], sections: list[dict]) -> dict:
    counts_by_effect = {}
    for cue in cues:
        effect = cue["effect"]
        counts_by_effect[effect] = counts_by_effect.get(effect, 0) + 1

    counts_by_section = []
    for section in sections:
        section_cues = [
            cue for cue in cues
            if section["start"] <= cue["time"] <= section["end"]
        ]
        section_counts = {}
        for cue in section_cues:
            effect = cue["effect"]
            section_counts[effect] = section_counts.get(effect, 0) + 1
        counts_by_section.append({
            "section_index": section["index"],
            "label": section["label"],
            "start": section["start"],
            "end": section["end"],
            "total_count": len(section_cues),
            "counts_by_effect": section_counts,
        })

    return {
        "total_count": len(cues),
        "counts_by_effect": counts_by_effect,
        "counts_by_section": counts_by_section,
    }


def select_firework_cue_samples(cues: list[dict], limit: int = 12) -> list[dict]:
    """
    Keep a small set of representative heuristic cues in the compact payload.
    The complete list remains in the full analysis JSON at `firework_cues`.
    """
    effect_priority = {"barrage": 4, "crackle": 3, "accent": 2, "single": 1}
    ranked = sorted(
        cues,
        key=lambda cue: (
            -effect_priority.get(cue["effect"], 0),
            -float(cue.get("energy", 0.0)),
            float(cue["time"]),
        ),
    )
    return sorted(ranked[:limit], key=lambda cue: cue["time"])


def build_llm_payload(result: dict) -> dict:
    """
    Compact, token-efficient payload for downstream LLM consumption.
    Shape follows `llm-harness.md`. Raw beat_times / onset_times /
    energy_timeline are intentionally omitted — they remain in the full
    analysis JSON for stages that genuinely need micro-timing.
    """
    music_profile = result["music_profile"]
    show_personality = result["show_personality"]
    cues = result["firework_cues"]
    sections = result["sections"]

    sections_compact = []
    for i, s in enumerate(sections):
        cue_counts = {}
        for c in cues:
            if s["start"] <= c["time"] <= s["end"]:
                cue_counts[c["effect"]] = cue_counts.get(c["effect"], 0) + 1
        sections_compact.append({
            "index": i,
            "label": s["label"],
            "start": s["start"],
            "end": s["end"],
            "duration": s["duration"],
            "avg_energy": s["avg_energy"],
            "peak_energy": s["peak_energy"],
            "intensity": s["intensity"],
            "cue_counts": cue_counts,
        })

    payload = {
        "schema_version": SCHEMA_VERSION,
        "source_file": os.path.basename(result["file"]),
        "song": {
            "duration_seconds": result["duration_seconds"],
            "tempo_bpm": result["tempo_bpm"],
            "total_beats": result["total_beats"],
            "genre_hint": music_profile["genre_hint"],
            "key_signature": music_profile["key_signature"],
        },
        "music_style": {
            "dominant_traits": music_profile["dominant_traits"],
            "style_vector": music_profile["style_vector"],
            "descriptors": music_profile["descriptors"],
        },
        "show_personality": {
            "preset": show_personality["preset"],
            "blend_weights": show_personality["blend_weights"],
            "dimensions": show_personality["dimensions"],
            "dominant_traits": show_personality["dominant_traits"],
            "palette_direction": show_personality["palette_direction"],
            "density_level": show_personality["density_level"],
        },
        "sections": sections_compact,
        "anchors": {
            "key_moments": result["key_moments"],
            "buildups": result["buildups"],
        },
        "derived": compute_derived_features(result),
        "firework_cue_summary": build_firework_cue_summary(cues, sections_compact),
        "firework_cue_samples": select_firework_cue_samples(cues),
        "cue_reference": {
            "full_cues_source": "analysis_json",
            "json_path": "firework_cues",
            "note": "The full heuristic cue list is kept only in the full analysis JSON and is intentionally not duplicated in this compact LLM payload.",
        },
        "user_constraints": {},
        "inventory": [],
    }
    return validate_llm_payload(payload)


def fmt_time(seconds: float) -> str:
    """Format seconds as M:SS."""
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def write_markdown(result: dict, output_path: str):
    """
    Write analysis results to a Markdown file optimised for LLM consumption.
    """
    lines = []
    r = result
    music_profile = r["music_profile"]
    show_personality = r["show_personality"]
    key_signature = music_profile["key_signature"]

    lines.append(f"# Song Analysis: {os.path.basename(r['file'])}")
    lines.append("")
    lines.append("## Overview")
    lines.append("")
    lines.append(f"- **Duration:** {fmt_time(r['duration_seconds'])} ({r['duration_seconds']}s)")
    lines.append(f"- **Tempo:** {r['tempo_bpm']} BPM")
    lines.append(f"- **Total beats:** {r['total_beats']}")
    lines.append(f"- **Total firework cues:** {len(r['firework_cues'])}")
    lines.append(f"- **Climax moments:** {sum(1 for m in r['key_moments'] if m['type'] == 'climax')}")
    lines.append(f"- **Build-ups detected:** {len(r['buildups'])}")
    lines.append(f"- **Genre hint:** {music_profile['genre_hint']}")
    lines.append(
        f"- **Key / mode:** {key_signature['root']} {key_signature['mode']} "
        f"(confidence {key_signature['confidence']})"
    )
    lines.append(f"- **Personality preset:** {show_personality['preset']}")
    lines.append("")

    # ── Personality ──
    lines.append("## Personality Mapping")
    lines.append("")
    lines.append(
        "Quantified style profile derived from the music, then blended with the selected personality preset."
    )
    lines.append("")
    lines.append(f"- **Music dominant traits:** {', '.join(music_profile['dominant_traits'])}")
    lines.append(f"- **Show dominant traits:** {', '.join(show_personality['dominant_traits'])}")
    palette = show_personality["palette_direction"]
    lines.append(
        f"- **Palette direction:** {palette['primary']} / {palette['secondary']} with {palette['accent']} accents"
    )
    lines.append(f"- **Cue density level:** {show_personality['density_level']}")
    lines.append("")
    lines.append("| Dimension | Music Score | Show Score |")
    lines.append("|-----------|-------------|------------|")
    for dimension in STYLE_DIMENSIONS:
        lines.append(
            f"| {dimension} | {music_profile['style_vector'][dimension]} | "
            f"{show_personality['dimensions'][dimension]} |"
        )
    lines.append("")

    # ── Sections ──
    lines.append("## Song Structure")
    lines.append("")
    lines.append("| # | Section | Time | Duration | Avg Energy | Peak Energy | Intensity |")
    lines.append("|---|---------|------|----------|------------|-------------|-----------|")
    for i, s in enumerate(r['sections']):
        lines.append(
            f"| {i + 1} | {s['label'].upper()} | "
            f"{fmt_time(s['start'])} - {fmt_time(s['end'])} | "
            f"{s['duration']}s | "
            f"{s['avg_energy']} | "
            f"{s['peak_energy']} | "
            f"{s['intensity']} |"
        )
    lines.append("")

    # ── Section narrative ──
    lines.append("### Section Details")
    lines.append("")
    for i, s in enumerate(r['sections']):
        energy_bar = int(s['avg_energy'] * 10)
        bar_str = "█" * energy_bar + "░" * (10 - energy_bar)
        lines.append(f"**{i + 1}. {s['label'].upper()}** ({fmt_time(s['start'])} - {fmt_time(s['end'])})")
        lines.append(f"- Energy: `{bar_str}` ({s['avg_energy']})")
        lines.append(f"- Intensity: {s['intensity']}")

        # Count cues in this section
        section_cues = [c for c in r['firework_cues'] if s['start'] <= c['time'] <= s['end']]
        cue_counts = {}
        for c in section_cues:
            cue_counts[c['effect']] = cue_counts.get(c['effect'], 0) + 1
        if cue_counts:
            cue_str = ", ".join(f"{count}x {effect}" for effect, count in sorted(cue_counts.items()))
            lines.append(f"- Firework cues: {cue_str}")
        lines.append("")

    # ── Key Moments ──
    lines.append("## Key Moments")
    lines.append("")
    if r['key_moments']:
        lines.append("| Time | Type | Energy |")
        lines.append("|------|------|--------|")
        for m in r['key_moments']:
            lines.append(f"| {fmt_time(m['time'])} ({m['time']}s) | {m['type'].upper()} | {m['energy']} |")
        lines.append("")
    else:
        lines.append("No key moments detected.")
        lines.append("")

    # ── Build-ups ──
    lines.append("## Build-ups")
    lines.append("")
    if r['buildups']:
        lines.append("These are energy ramps leading into peaks — ideal for gradually ramping up firework intensity.")
        lines.append("")
        for i, bu in enumerate(r['buildups']):
            lines.append(f"- **Build-up {i + 1}:** {fmt_time(bu['start'])} → {fmt_time(bu['peak'])} "
                         f"({bu['duration']}s, energy rise: {bu['energy_rise']})")
        lines.append("")
    else:
        lines.append("No significant build-ups detected.")
        lines.append("")

    # ── Energy Timeline (sampled) ──
    lines.append("## Energy Timeline")
    lines.append("")
    lines.append("Energy values over time (0.0 = silence, 1.0 = max). Sampled ~1/second.")
    lines.append("")
    lines.append("```")
    # Show a compact ASCII energy graph
    timeline = r['energy_timeline']
    graph_width = 60
    for entry in timeline:
        t = entry['time']
        e = entry['energy']
        bar_len = int(e * graph_width)
        lines.append(f"{fmt_time(t):>5} |{'█' * bar_len}{'░' * (graph_width - bar_len)}| {e:.3f}")
    lines.append("```")
    lines.append("")

    # ── Firework Cues ──
    lines.append("## Firework Cues")
    lines.append("")
    lines.append("Effect types:")
    lines.append("- **BARRAGE**: Full multi-shot display (for climaxes and big drops)")
    lines.append("- **ACCENT**: Single large shell (key beats in high-energy sections)")
    lines.append("- **CRACKLE**: Sustained crackling effect (during build-ups)")
    lines.append("- **SINGLE**: Individual shot (sparse beats during verses)")
    lines.append("")
    lines.append("| Time | Effect | Palette | Shape | Height | Reason | Energy |")
    lines.append("|------|--------|---------|-------|--------|--------|--------|")
    for c in r['firework_cues']:
        end_str = f" - {fmt_time(c['end'])} ({c['end']}s)" if 'end' in c else ""
        lines.append(
            f"| {fmt_time(c['time'])} ({c['time']}s){end_str} | "
            f"{c['effect'].upper()} | "
            f"{c['palette']} | "
            f"{c['shape']} | "
            f"{c['height']} | "
            f"{c['reason']} | "
            f"{c['energy']} |"
        )
    lines.append("")

    # ── Beat Times (compact) ──
    lines.append("## Beat Times")
    lines.append("")
    lines.append(f"All {len(r['beat_times'])} beat timestamps (seconds):")
    lines.append("")
    lines.append("```")
    # 10 per line for compactness
    for i in range(0, len(r['beat_times']), 10):
        chunk = r['beat_times'][i:i + 10]
        lines.append("  ".join(f"{t:7.3f}" for t in chunk))
    lines.append("```")
    lines.append("")

    # ── Onset Times (compact) ──
    lines.append("## Onset Times")
    lines.append("")
    lines.append(f"All {len(r['onset_times'])} onset timestamps (note/hit starts, seconds):")
    lines.append("")
    lines.append("```")
    for i in range(0, len(r['onset_times']), 10):
        chunk = r['onset_times'][i:i + 10]
        lines.append("  ".join(f"{t:7.3f}" for t in chunk))
    lines.append("```")
    lines.append("")

    with open(output_path, "w") as f:
        f.write("\n".join(lines))

    return output_path


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Analyse a song and generate style-aware firework cues.")
    parser.add_argument("path", nargs="?", default="song.mp3", help="Path to the audio file")
    parser.add_argument("--json", dest="json_output", action="store_true", help="Also print full JSON to stdout")
    parser.add_argument(
        "--personality",
        default="balanced",
        choices=sorted(PERSONALITY_PRESETS.keys()),
        help="Blend the music with a show personality preset",
    )
    parser.add_argument(
        "--analysis-out",
        default=None,
        help="Path for the full analysis JSON (default: <song>_analysis.json)",
    )
    parser.add_argument(
        "--markdown-out",
        default=None,
        help="Path for the Markdown report (default: <song>_analysis.md)",
    )
    parser.add_argument(
        "--llm-out",
        default=None,
        help="Path for the compact LLM payload JSON (default: <song>_llm.json)",
    )
    parser.add_argument(
        "--no-json-file",
        action="store_true",
        help="Skip writing the analysis/LLM JSON files",
    )
    return parser.parse_args(argv)


# ──────────────────────────────────────────────
# USAGE
# ──────────────────────────────────────────────
if __name__ == "__main__":
    options = parse_args()

    print("Analysing...", flush=True)
    try:
        result = analyse_song(options.path, personality_preset=options.personality)
    except ValueError as exc:
        print(f"Validation error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    song_name = os.path.splitext(os.path.basename(options.path))[0]
    md_path = options.markdown_out or f"{song_name}_analysis.md"
    write_markdown(result, md_path)
    print(f"Markdown report:     {md_path}")

    if not options.no_json_file:
        analysis_path = options.analysis_out or f"{song_name}_analysis.json"
        with open(analysis_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Full analysis JSON:  {analysis_path}")

        llm_path = options.llm_out or f"{song_name}_llm.json"
        with open(llm_path, "w") as f:
            json.dump(build_llm_payload(result), f, indent=2)
        print(f"LLM payload JSON:    {llm_path}")

    if options.json_output:
        print(json.dumps(result, indent=2))
