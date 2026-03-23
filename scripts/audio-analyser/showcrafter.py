"""
ShowCrafter - Song Analysis Pipeline
Extracts musical structure from an audio file for pyromusical choreography.
Output: a Markdown file of timestamped musical events ready to feed into an LLM.
"""

import librosa
import numpy as np
import json
import os
import scipy.ndimage
import scipy.sparse.csgraph
import sklearn.cluster
from scipy.signal import find_peaks, savgol_filter


def analyse_song(file_path: str) -> dict:
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
    rms_normalised = (rms - rms.min()) / (rms.max() - rms.min())
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

    peaks, _ = find_peaks(smoothed, height=0.5, distance=sr // hop_length * 3, prominence=0.1)
    peak_times_arr = librosa.frames_to_time(peaks, sr=sr, hop_length=hop_length)

    key_moments = [
        {
            "time": round(float(peak_times_arr[i]), 2),
            "energy": round(float(smoothed[peaks[i]]), 3),
            "type": "climax" if smoothed[peaks[i]] > 0.8 else "build",
        }
        for i in range(len(peaks))
    ]

    # ──────────────────────────────────────────────
    # 6. BUILD-UP DETECTION
    # ──────────────────────────────────────────────
    buildups = detect_buildups(smoothed, sr, hop_length)

    # ──────────────────────────────────────────────
    # 7. FIREWORK CUES
    # ──────────────────────────────────────────────
    firework_cues = generate_firework_cues(
        beat_times, onset_times, sections, key_moments, buildups, smoothed, sr, hop_length
    )

    # ──────────────────────────────────────────────
    # ASSEMBLE OUTPUT
    # ──────────────────────────────────────────────
    return {
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
            "intensity": classify_intensity(avg_energy),
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


def classify_intensity(energy: float) -> str:
    if energy > 0.7:
        return "high"
    elif energy > 0.4:
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

    peaks, _ = find_peaks(smoothed, height=0.6, distance=int(fps * 5), prominence=0.15)

    for peak in peaks:
        start = max(0, peak - window)
        segment = smoothed[start:peak]
        if len(segment) < int(fps * 2):
            continue

        energy_rise = float(segment[-1] - segment[0])
        if energy_rise > 0.2:
            start_time = float(librosa.frames_to_time(start, sr=sr, hop_length=hop_length))
            peak_time = float(librosa.frames_to_time(peak, sr=sr, hop_length=hop_length))
            buildups.append({
                "start": round(start_time, 2),
                "peak": round(peak_time, 2),
                "duration": round(peak_time - start_time, 2),
                "energy_rise": round(energy_rise, 3),
            })

    return buildups


def generate_firework_cues(
    beat_times, onset_times, sections, key_moments, buildups, smoothed, sr, hop_length
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

    # Beats during chorus → accent on every 2nd beat
    for i, t in enumerate(beat_times):
        if in_ranges(t, chorus_ranges):
            if i % 2 == 0:
                cues.append({
                    "time": round(t, 3),
                    "effect": "accent",
                    "reason": "chorus_beat",
                    "energy": round(get_energy_at(t), 3),
                })
        elif in_ranges(t, high_ranges):
            if i % 4 == 0:
                cues.append({
                    "time": round(t, 3),
                    "effect": "accent",
                    "reason": "high_energy_beat",
                    "energy": round(get_energy_at(t), 3),
                })

    # Downbeats during verses → sparse single shots
    for i, t in enumerate(beat_times):
        if not in_ranges(t, chorus_ranges) and not in_ranges(t, high_ranges):
            if i % 8 == 0 and get_energy_at(t) > 0.2:
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
            deduped.append(cue)

    return deduped


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
    lines.append("| Time | Effect | Reason | Energy |")
    lines.append("|------|--------|--------|--------|")
    for c in r['firework_cues']:
        end_str = f" - {fmt_time(c['end'])} ({c['end']}s)" if 'end' in c else ""
        lines.append(
            f"| {fmt_time(c['time'])} ({c['time']}s){end_str} | "
            f"{c['effect'].upper()} | "
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
                        cue_text = f"{R}{BLD}FIREWORK *** BARRAGE ***{RST}"
                    elif eff == "accent":
                        cue_text = f"{O}{BLD}FIREWORK * ACCENT *{RST}"
                    elif eff == "crackle":
                        cue_text = f"{Y}FIREWORK ~ crackle ~{RST}"
                    else:
                        cue_text = f"{C}FIREWORK . single .{RST}"
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
            lines.append(f"  {DIM}{result['tempo_bpm']} BPM  |  {len(result['firework_cues'])} cues  |  Ctrl+C to stop{RST}")
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


# ──────────────────────────────────────────────
# USAGE
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    path = args[0] if args else "song.mp3"

    print("Analysing...", flush=True)
    result = analyse_song(path)

    if "--play" in flags:
        live_player(result, path)
    else:
        # Write markdown output
        song_name = os.path.splitext(os.path.basename(path))[0]
        output_path = f"{song_name}_analysis.md"
        write_markdown(result, output_path)
        print(f"Analysis written to: {output_path}")

        # Also print JSON to stdout for programmatic use
        if "--json" in flags:
            print(json.dumps(result, indent=2))
