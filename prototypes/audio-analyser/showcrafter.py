"""
ShowCrafter - Song Analysis Pipeline
Extracts musical structure from an audio file for pyromusical choreography.
Output: a Markdown file of timestamped musical events ready to feed into an LLM.
"""

import argparse
import librosa
import numpy as np
import json
import os
import scipy.ndimage
import scipy.sparse.csgraph
import sklearn.cluster
from scipy.signal import find_peaks, savgol_filter


# Bumped when the output contract changes. Downstream harnesses can read
# `schema_version` from the result / LLM payload to gate compatibility.
#
# 1.1.0 — added `key_moments[].prominence`; `key_moments[].type` is now
#         decided by relative prominence ranking (top quartile = climax)
#         instead of an absolute energy threshold.
# 1.0.0 — initial versioned contract.
SCHEMA_VERSION = "1.1.0"

# Anchor windows around climaxes and build-up peaks (seconds before/after).
ANCHOR_PRE_SEC = 3.0
ANCHOR_POST_SEC = 4.0

# Max time gap (seconds) between a build-up peak and the final climax for
# that build-up to count as the lead-in when computing finale_window.start.
# Build-ups and key_moments come from find_peaks calls with different
# parameters and can disagree by a couple of frames on the same musical
# event, so a small tolerance is needed.
FINALE_BUILDUP_TOLERANCE_SEC = 3.0

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
) -> dict:
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)[0]
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


def analyse_song(file_path: str, personality_preset: str = "balanced") -> dict:
    """
    Analyse a song and return structured data for firework choreography.
    Uses Laplacian spectral clustering for accurate structural segmentation.
    """
    # Load audio (mono, 22050Hz is fine for analysis)
    y, sr = librosa.load(file_path, sr=22050, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    # ──────────────────────────────────────────────
    # 1. TEMPO & BEATS
    # ──────────────────────────────────────────────
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    # ──────────────────────────────────────────────
    # 2. ENERGY CURVE (RMS, normalised 0-1)
    # ──────────────────────────────────────────────
    hop_length = 512
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    if rms.size:
        # Percentile clip to reduce outlier-driven normalization.
        rms_low = np.percentile(rms, 5)
        rms_high = np.percentile(rms, 95)
        rms = np.clip(rms, rms_low, rms_high)
    rms_normalised = normalise_series(rms)
    rms_times = librosa.frames_to_time(range(len(rms)), sr=sr, hop_length=hop_length)

    # Downsample energy to ~1 reading per second
    step = max(1, int(sr / hop_length))
    energy_timeline = [
        {"time": round(float(rms_times[i]), 2), "energy": round(float(rms_normalised[i]), 3)}
        for i in range(0, len(rms), step)
    ]

    # ──────────────────────────────────────────────
    # 3. ONSET DETECTION
    # ──────────────────────────────────────────────
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length).tolist()

    # ──────────────────────────────────────────────
    # 4. STRUCTURAL SEGMENTATION (Laplacian spectral clustering)
    #    Based on McFee & Ellis 2014 — beat-synchronised CQT + MFCC
    #    with recurrence + path similarity for clean boundaries.
    # ──────────────────────────────────────────────
    sections = laplacian_segment(y, sr, beat_frames, rms_normalised, hop_length, duration)

    # ──────────────────────────────────────────────
    # 5. KEY MOMENTS (energy peaks — climaxes and drops)
    # ──────────────────────────────────────────────
    if len(rms_normalised) > 51:
        smoothed = savgol_filter(rms_normalised, window_length=51, polyorder=3)
    else:
        smoothed = rms_normalised

    peaks, peak_props = find_peaks(
        smoothed, height=0.5, distance=sr // hop_length * 3, prominence=0.1
    )
    peak_times_arr = librosa.frames_to_time(peaks, sr=sr, hop_length=hop_length)
    prominences = peak_props.get("prominences", np.zeros(len(peaks)))

    # Top quartile of detected peaks (by prominence) are climaxes; the rest
    # are builds. Replaces the old absolute energy threshold (>0.8), which
    # silently produced zero climaxes on loudness-flat mixes (modern EDM /
    # heavily compressed pop) and starved the show of barrage cues.
    n_climaxes = max(1, len(peaks) // 4) if len(peaks) > 0 else 0
    climax_idx = (
        set(np.argsort(prominences)[-n_climaxes:].tolist()) if n_climaxes > 0 else set()
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
    music_profile = analyse_music_personality(
        y,
        sr,
        hop_length,
        duration,
        float(np.atleast_1d(tempo)[0]),
        beat_times,
        onset_times,
        rms_normalised,
        sections,
        key_moments,
        buildups,
    )
    show_personality = build_show_personality(music_profile, personality_preset)

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
    return {
        "schema_version": SCHEMA_VERSION,
        "file": file_path,
        "duration_seconds": round(duration, 2),
        "tempo_bpm": round(float(np.atleast_1d(tempo)[0]), 1),
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
    C = librosa.amplitude_to_db(
        np.abs(librosa.cqt(y=y, sr=sr, bins_per_octave=BINS_PER_OCTAVE,
                           n_bins=N_OCTAVES * BINS_PER_OCTAVE)),
        ref=np.max)

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
    KM = sklearn.cluster.KMeans(n_clusters=k, n_init=50, random_state=0)
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
            avg_energy = float(np.mean(rms_normalised[start_frame:end_frame]))
            peak_energy = float(np.max(rms_normalised[start_frame:end_frame]))
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

    return sections


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
    for s in sections:
        if s["label"] != "unknown":
            continue
        cid = s["cluster_id"]
        if cid == chorus_cluster:
            s["label"] = "chorus"
        elif cid == verse_cluster:
            s["label"] = "verse"
        elif cluster_avg_energy.get(cid, 0) > median_energy * 1.2:
            s["label"] = "bridge"
        elif cluster_avg_energy.get(cid, 0) < median_energy * 0.7:
            s["label"] = "pre-chorus"
        else:
            # Check if it precedes a chorus section
            idx = sections.index(s)
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

    return buildups


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

    return {
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
        "firework_cues_baseline": cues,
        "user_constraints": {},
        "inventory": [],
    }


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


def live_player(result: dict, file_path: str):
    """Real-time terminal visualizer with smooth output."""
    import sounddevice as sd
    import soundfile as sf
    import time
    import shutil
    import sys
    import bisect
    import re

    data, playback_sr = sf.read(file_path, dtype="float32")
    if data.ndim == 1:
        data = data.reshape(-1, 1)

    beat_times = sorted(result["beat_times"])
    cue_list = sorted(result["firework_cues"], key=lambda c: c["time"])
    cue_times = [c["time"] for c in cue_list]
    energy_times = [e["time"] for e in result["energy_timeline"]]
    energy_vals = [e["energy"] for e in result["energy_timeline"]]
    sections = result["sections"]
    buildups = result.get("buildups", [])
    duration = result["duration_seconds"]
    genre_hint = result["music_profile"]["genre_hint"]
    preset = result["show_personality"]["preset"]
    cols = shutil.get_terminal_size().columns

    # ANSI
    RST = "\033[0m"
    BLD = "\033[1m"
    DIM = "\033[2m"
    R = "\033[91m"
    O = "\033[38;5;208m"
    Y = "\033[93m"
    C = "\033[96m"
    G = "\033[92m"
    W = "\033[97m"
    M = "\033[95m"

    SEC_CLR = {
        "chorus": R, "verse": C, "bridge": Y, "pre-chorus": M,
        "intro": DIM, "outro": DIM,
    }

    def get_energy(t):
        i = bisect.bisect_right(energy_times, t)
        if i == 0:
            return energy_vals[0]
        if i >= len(energy_vals):
            return energy_vals[-1]
        t0, t1 = energy_times[i - 1], energy_times[i]
        e0, e1 = energy_vals[i - 1], energy_vals[i]
        frac = (t - t0) / (t1 - t0) if t1 != t0 else 0
        return e0 + (e1 - e0) * frac

    def get_section_idx(t):
        for i, s in enumerate(sections):
            if s["start"] <= t <= s["end"]:
                return i
        return -1

    def is_buildup(t):
        for bu in buildups:
            if bu["start"] <= t <= bu["peak"]:
                return True
        return False

    def vlen(s):
        return len(re.sub(r'\033\[[0-9;]*m', '', s))

    def pad(s, width):
        return s + " " * max(0, width - vlen(s))

    def fmt_time_short(t):
        m, s = divmod(int(t), 60)
        return f"{m}:{s:02d}"

    section_map_lines = []
    for i, s in enumerate(sections):
        label = s["label"]
        clr = SEC_CLR.get(label, DIM)
        dur_str = fmt_time_short(s["duration"])
        time_range = f"{fmt_time_short(s['start'])} - {fmt_time_short(s['end'])}"
        num = f"{i + 1}."
        section_map_lines.append({
            "num": num,
            "label": label.upper(),
            "time_range": time_range,
            "dur": dur_str,
            "clr": clr,
        })

    # State
    beat_brightness = 0.0
    cue_text = ""
    cue_fade = 0.0
    fired_cues = set()
    REFRESH = 1 / 30

    n_sections = len(sections)
    DISPLAY_LINES = 3 + n_sections + 1 + 4

    sys.stdout.write("\033[?25l")
    for _ in range(DISPLAY_LINES):
        print()

    sd.play(data, playback_sr)
    start_wall = time.time()

    try:
        while True:
            now = time.time() - start_wall
            if now >= duration:
                break

            energy = get_energy(now)
            current_idx = get_section_idx(now)
            current_sec = sections[current_idx] if current_idx >= 0 else None
            buildup = is_buildup(now)

            bi = bisect.bisect_right(beat_times, now)
            if bi > 0 and (now - beat_times[bi - 1]) < 0.08:
                beat_brightness = 1.0
            beat_brightness = max(0.0, beat_brightness - REFRESH * 5)

            ci = bisect.bisect_right(cue_times, now)
            if ci > 0 and (ci - 1) not in fired_cues:
                cue = cue_list[ci - 1]
                if abs(now - cue["time"]) < 0.15:
                    fired_cues.add(ci - 1)
                    eff = cue["effect"]
                    if eff == "barrage":
                        cue_text = f"{R}{BLD}FIREWORK *** BARRAGE *** [{cue['shape']}]{RST}"
                    elif eff == "accent":
                        cue_text = f"{O}{BLD}FIREWORK * ACCENT * [{cue['shape']}]{RST}"
                    elif eff == "crackle":
                        cue_text = f"{Y}FIREWORK ~ crackle ~ [{cue['shape']}]{RST}"
                    else:
                        cue_text = f"{C}FIREWORK . single . [{cue['shape']}]{RST}"
                    cue_fade = 1.0
            cue_fade = max(0.0, cue_fade - REFRESH * 2.5)

            m, s = divmod(int(now), 60)
            tm, ts = divmod(int(duration), 60)
            time_str = f"{m}:{s:02d} / {tm}:{ts:02d}"

            bar_w = min(50, cols - 35)
            filled = int(energy * bar_w)
            if energy > 0.7:
                bc = R
            elif energy > 0.4:
                bc = O
            else:
                bc = G
            if beat_brightness > 0.3:
                pulse = f"{W}{BLD}" if beat_brightness > 0.6 else f"{bc}{BLD}"
            else:
                pulse = bc
            bar = f"{pulse}{'█' * filled}{RST}{DIM}{'░' * (bar_w - filled)}{RST}"

            prog_w = min(50, cols - 35)
            prog_filled = int((now / duration) * prog_w)
            prog = f"{DIM}{'━' * prog_filled}{'╸' if prog_filled < prog_w else ''}{' ' * max(0, prog_w - prog_filled - 1)}{RST}"

            lines = []
            lines.append(f"  {BLD}ShowCrafter{RST}  {DIM}{result['file']}{RST}")
            lines.append(
                f"  {DIM}{result['tempo_bpm']} BPM  |  {genre_hint}  |  {preset} preset  |  "
                f"{len(result['firework_cues'])} cues  |  Ctrl+C to stop{RST}"
            )
            lines.append("")

            for i, sm in enumerate(section_map_lines):
                if i == current_idx:
                    marker = f"{sm['clr']}{BLD}>{RST}"
                    line = f"  {marker} {sm['clr']}{BLD}{sm['num']:>3} {sm['label']:<12}{RST}  {sm['time_range']}  {DIM}({sm['dur']}){RST}"
                    if current_sec:
                        sec_progress = (now - current_sec["start"]) / max(current_sec["duration"], 0.1)
                        sec_bar_w = 15
                        sec_filled = int(sec_progress * sec_bar_w)
                        line += f"  {sm['clr']}{'▓' * sec_filled}{'░' * (sec_bar_w - sec_filled)}{RST}"
                else:
                    line = f"    {DIM}{sm['num']:>3} {sm['label']:<12}  {sm['time_range']}  ({sm['dur']}){RST}"
                lines.append(line)

            lines.append("")

            sec_label = current_sec["label"].upper() if current_sec else "---"
            sec_clr = SEC_CLR.get(current_sec["label"], DIM) if current_sec else DIM
            buildup_str = f"  {Y}{BLD}▲ BUILDUP{RST}" if buildup else ""
            fw_str = f"  {cue_text}" if cue_fade > 0.1 else ""

            lines.append(f"  {DIM}{time_str}{RST}  {sec_clr}{BLD}{sec_label}{RST}{buildup_str}")
            lines.append(f"  {bar}{fw_str}")
            lines.append(f"  {prog}")
            lines.append("")

            sys.stdout.write(f"\033[{DISPLAY_LINES}A\r")
            for line in lines:
                sys.stdout.write(pad(line, cols)[:cols] + "\n")
            for _ in range(DISPLAY_LINES - len(lines)):
                sys.stdout.write(" " * cols + "\n")

            sys.stdout.flush()
            time.sleep(REFRESH)

    except KeyboardInterrupt:
        pass
    finally:
        sd.stop()
        sys.stdout.write("\033[?25h")
        print(f"\n  {DIM}Done.{RST}\n")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Analyse a song and generate style-aware firework cues.")
    parser.add_argument("path", nargs="?", default="song.mp3", help="Path to the audio file")
    parser.add_argument("--json", dest="json_output", action="store_true", help="Also print full JSON to stdout")
    parser.add_argument("--play", action="store_true", help="Play audio with the live terminal visualizer")
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
    result = analyse_song(options.path, personality_preset=options.personality)

    if options.play:
        live_player(result, options.path)
    else:
        song_name = os.path.splitext(os.path.basename(options.path))[0]
        md_path = f"{song_name}_analysis.md"
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
