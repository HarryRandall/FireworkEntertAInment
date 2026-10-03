"""CPU beat clocks behind the shared analysis contract, with pinned neural weights."""

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from importlib.metadata import version
from pathlib import Path

import librosa
import numpy as np

from asset_integrity import file_sha256
from beat_metrics import clock_tempo, validate_clock

SERVICE = Path(__file__).resolve().parent
MODEL_MANIFEST = SERVICE / "beat-this-model.json"
# Evaluation controls deployment selection; no automatic fallback on model failure.
DEFAULT_TRACKER = "beat-this"
LIBROSA_ALGORITHM = "librosa-1.4.0"
# Beat This! release plus held-out-fold model identity, separate from schema version.
NEURAL_ALGORITHM = "beat-this-1.1.0-fold0"
# Two CPU threads bound inference concurrency in the shared worker container.
CPU_THREADS = 2
# Existing analyser resolution: samples per onset/spectral frame at 22,050 Hz.
HOP_LENGTH = 512
# Dominant pop metre fallback when fewer than two reliable bars are detected.
DEFAULT_BEATS_PER_BAR = 4
# Metres supported by the shared Pydantic/planner contract.
SUPPORTED_METRES = (2, 3, 4)


@dataclass(frozen=True)
class BeatGrid:
    """Beat/downbeat seconds from audio start, BPM and estimated beats per bar."""

    beats: np.ndarray
    downbeats: np.ndarray
    tempo: float
    beats_per_bar: int
    frames: np.ndarray | None = None


def algorithm_for(tracker: str) -> str:
    """Return the immutable database algorithm identity for a supported tracker."""
    if tracker == "librosa":
        return LIBROSA_ALGORITHM
    if tracker == "beat-this":
        return NEURAL_ALGORITHM
    raise ValueError("Unknown beat tracker")


@lru_cache(maxsize=1)
def neural_model():
    """Load one checksum-verified CPU model per process, without implicit downloads."""
    import torch
    from beat_this.inference import Audio2Beats

    manifest = json.loads(MODEL_MANIFEST.read_text())
    if version("beat-this") != manifest["package_version"]:
        raise ValueError("Beat tracker package version mismatch")
    path = Path(
        os.environ.get("BEAT_THIS_CHECKPOINT", str(SERVICE / ".cache/fold0.ckpt"))
    )
    if file_sha256(path) != manifest["sha256"]:
        raise ValueError("Beat tracker checkpoint checksum mismatch")
    torch.set_num_threads(CPU_THREADS)
    return Audio2Beats(
        checkpoint_path=str(path), device="cpu", float16=False, dbn=False
    )


def neural_grid(beats: np.ndarray, downbeats: np.ndarray, duration: float) -> BeatGrid:
    """Validate model seconds, discard padding, and infer metre from complete bar spans.

    Bar length is the modal count of detected beats between successive downbeats,
    rather than a ratio of clocks that includes partial bars at the file edges.
    """
    beats = validate_clock(beats.tolist())
    downbeats = validate_clock(downbeats.tolist())
    beats = beats[beats <= duration]
    downbeats = downbeats[downbeats <= duration]
    bar_indices = np.searchsorted(beats, downbeats)
    spans = np.diff(bar_indices)
    spans = spans[spans > 0]
    metre = int(np.bincount(spans).argmax()) if spans.size else DEFAULT_BEATS_PER_BAR
    if metre not in SUPPORTED_METRES:
        # Missing bars or unsupported metres cannot supply a trusted contract bar grid.
        downbeats = np.array([])
        metre = DEFAULT_BEATS_PER_BAR
    return BeatGrid(beats, downbeats, clock_tempo(beats.tolist()), metre)


def track_audio(y: np.ndarray, sr: int, tracker: str, onset_env=None) -> BeatGrid:
    """Track mono samples at sr Hz; return seconds and BPM without mutating audio.

    Librosa retains the existing onset/refinement/bar heuristic for comparison.
    Neural inference uses minimal postprocessing, no madmom/DBN dependency.
    """
    algorithm_for(tracker)
    if tracker == "beat-this":
        beats, downbeats = neural_model()(y, sr)
        return neural_grid(beats, downbeats, len(y) / sr)
    # Import at invocation time to keep the pipeline and adapter free of import cycles.
    from showcrafter import estimate_downbeats, refine_event_times

    if onset_env is None:
        onset_env = librosa.onset.onset_strength(
            y=y, sr=sr, hop_length=HOP_LENGTH, aggregate=np.median
        )
    tempo, frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, hop_length=HOP_LENGTH, trim=False
    )
    beats = np.asarray(refine_event_times(frames, onset_env, sr, HOP_LENGTH))
    downbeats, metre = estimate_downbeats(beats, onset_env, sr, HOP_LENGTH)
    return BeatGrid(
        beats, np.asarray(downbeats), float(np.atleast_1d(tempo)[0]), metre, frames
    )
