"""Independent beat/downbeat event scoring and strict tempo accuracy in seconds."""

import numpy as np

# Standard beat F-measure matching window from mir_eval, in seconds.
MATCH_WINDOW_SECONDS = 0.070
# Standard Acc1 relative tempo tolerance, with no half/double-tempo forgiveness.
TEMPO_RELATIVE_TOLERANCE = 0.04
# Beats per minute converts a median interval measured in seconds.
SECONDS_PER_MINUTE = 60


def validate_clock(values: list[float]) -> np.ndarray:
    """Require finite, non-negative, strictly increasing seconds from audio start."""
    clock = np.asarray(values, dtype=float)
    if clock.ndim != 1 or not np.all(np.isfinite(clock)) or np.any(clock < 0):
        raise ValueError("Invalid annotated clock")
    if np.any(np.diff(clock) <= 0):
        raise ValueError("Clock must be strictly increasing")
    return clock


def f_measure(reference: list[float], estimated: list[float]) -> float:
    """Return one-to-one event F1 within 70 ms, penalising missing and extra events.

    Both clocks use seconds from audio start. Earliest feasible pairs maximise
    matches in sorted interval windows; a prediction cannot match two labels.
    Empty reference clocks are invalid for an accuracy evaluation.
    """
    truth = validate_clock(reference)
    prediction = validate_clock(estimated)
    if not truth.size:
        raise ValueError("Independent labels required")
    reference_index = 0
    estimated_index = 0
    matches = 0
    while reference_index < truth.size and estimated_index < prediction.size:
        delta = prediction[estimated_index] - truth[reference_index]
        if abs(delta) <= MATCH_WINDOW_SECONDS:
            matches += 1
            reference_index += 1
            estimated_index += 1
        elif delta < 0:
            estimated_index += 1
        else:
            reference_index += 1
    return 2 * matches / (truth.size + prediction.size)


def clock_tempo(beats: list[float]) -> float:
    """Return BPM from median beat spacing in seconds, or zero without an interval."""
    clock = validate_clock(beats)
    return (
        float(SECONDS_PER_MINUTE / np.median(np.diff(clock))) if clock.size > 1 else 0.0
    )


def score_track(labels: dict, grid: object) -> dict:
    """Score full-file beat/downbeat clocks and strict tempo accuracy against labels."""
    tempo = clock_tempo(labels["beats"])
    return {
        "beat_f_measure": f_measure(labels["beats"], grid.beats.tolist()),
        "downbeat_f_measure": f_measure(labels["downbeats"], grid.downbeats.tolist()),
        "reference_tempo_bpm": tempo,
        "estimated_tempo_bpm": grid.tempo,
        "tempo_correct": abs(grid.tempo - tempo) <= tempo * TEMPO_RELATIVE_TOLERANCE,
        "beats_per_bar": grid.beats_per_bar,
    }


def is_better(summary: dict) -> bool:
    """Require higher beat and downbeat F1 with no strict-tempo accuracy regression."""
    baseline = summary["librosa"]
    neural = summary["beat-this"]
    return (
        neural["beat_f_measure"] > baseline["beat_f_measure"]
        and neural["downbeat_f_measure"] > baseline["downbeat_f_measure"]
        and neural["tempo_correct"] >= baseline["tempo_correct"]
    )
