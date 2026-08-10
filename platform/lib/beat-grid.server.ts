/**
 * Beat-aligned cue slot grid generation (server-only).
 *
 * Given an analyser result (beats, sections, key moments) we produce a fixed
 * number of {@link CueSlot}s spread across three launch tubes. The grid is
 * deterministic given the same analyser input so re-running cue generation
 * never reshuffles slot timing.
 *
 * Consumed by the cue-generation pipeline (`lib/cue-generation.server.ts`).
 */
import 'server-only';

import type { AnalyserResult } from '@/lib/show-analysis.types';

export type SlotVibe =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'drop'
  | 'bridge'
  | 'buildup'
  | 'outro';

export type SlotEmphasis = 'normal' | 'accent' | 'peak';

export type CueSlot = {
  index: number;
  time: number; // seconds, millisecond precision
  tube: 0 | 1 | 2;
  intensity: number; // 0..1
  sectionLabel: string;
  vibe: SlotVibe;
  nearClimax: boolean;
  /** True when the slot lands on a detected bar downbeat. */
  isDownbeat: boolean;
  /** Beat-in-bar position (0 = downbeat), or -1 for a non-beat onset accent. */
  barPosition: number;
  /** Render + product-size emphasis derived from musical importance. */
  emphasis: SlotEmphasis;
  /** True when the slot falls inside the analyser's finale window. */
  finale: boolean;
};

const TARGET_SLOTS = 160;
const MAX_TARGET_SLOTS = 220;
const MIN_INTENSITY = 0.1;

function vibeFor(label: string): SlotVibe {
  const l = label.toLowerCase();
  if (l.includes('chorus') && l.includes('pre')) return 'pre-chorus';
  if (l.includes('chorus')) return 'chorus';
  if (l.includes('drop')) return 'drop';
  if (l.includes('verse')) return 'verse';
  if (l.includes('bridge')) return 'bridge';
  if (l.includes('build') || l.includes('rise')) return 'buildup';
  if (l.includes('intro') || l.includes('opening')) return 'intro';
  if (l.includes('outro') || l.includes('end') || l.includes('finale')) return 'outro';
  return 'verse';
}

function vibeBoost(vibe: SlotVibe): number {
  switch (vibe) {
    case 'chorus':
    case 'drop':
      return 0.36;
    case 'pre-chorus':
    case 'buildup':
      return 0.24;
    case 'bridge':
      return 0.05;
    case 'verse':
      return 0;
    case 'intro':
    case 'outro':
      return -0.06;
  }
}

export function buildCueSlots(
  analysis: AnalyserResult | null,
  songDuration: number,
  maxTubes: 1 | 2 | 3 = 3,
): CueSlot[] {
  if (!songDuration || songDuration <= 0) return [];

  const sections = analysis?.sections ?? [];
  const buildups = analysis?.buildups ?? [];
  const keyMoments = analysis?.key_moments ?? [];
  const tempoBpm = clampTempo(analysis?.tempo_bpm ?? 120);
  const beatsPerBar = clampBeatsPerBar(analysis?.beats_per_bar ?? 4);
  const finaleWindow = analysis?.derived?.finale_window ?? null;

  // 1. Beat times: prefer AI's, fall back to synthetic from tempo if sparse.
  //    Keep only finite beats inside the song, sorted, with exact duplicates
  //    removed, so a stray analyser value can't place cues before 0 or past the
  //    end of the song.
  const cleanedBeats = (analysis?.beat_times ?? [])
    .filter((t) => Number.isFinite(t) && t >= 0 && t < songDuration)
    .sort((a, b) => a - b);
  let beats = cleanedBeats.filter((t, i) => i === 0 || t !== cleanedBeats[i - 1]);
  const lastBeat = beats.length ? beats[beats.length - 1] : 0;
  const needsSynth = beats.length < 20 || lastBeat < songDuration * 0.75;
  if (needsSynth) {
    const interval = 60 / tempoBpm;
    beats = [];
    for (let t = interval; t < songDuration - 0.25; t += interval) {
      beats.push(Number(t.toFixed(3)));
    }
  }

  // Bar / downbeat grid (schema 1.4.0). When the analyser provides downbeats
  // we lock sparse sections to one fire per bar; without downbeats (older
  // 1.3.0 analyses) we fall back to the original every-beat windowed sampling
  // so nothing regresses.
  const downbeatTimes = (analysis?.downbeat_times ?? [])
    .filter((t) => Number.isFinite(t) && t >= 0 && t < songDuration)
    .map((t) => Number(t.toFixed(3)));
  const hasDownbeats = downbeatTimes.length > 0 && !needsSynth;
  const nearDownbeat = (t: number) => downbeatTimes.some((d) => Math.abs(d - t) <= 0.06);

  const finaleStart = finaleWindow?.start ?? null;
  const finaleEnd = finaleWindow?.end ?? null;
  const inFinale = (t: number) =>
    finaleStart != null && finaleEnd != null && t >= finaleStart && t <= finaleEnd;
  const buildupPeaks = buildups.map((b) => b.peak);

  // 2. Score each beat by section + climax proximity + buildup ramp, and tag
  //    it with downbeat / bar / emphasis / finale metadata.
  type Scored = {
    time: number;
    intensity: number;
    sectionLabel: string;
    vibe: SlotVibe;
    nearClimax: boolean;
    isDownbeat: boolean;
    barPosition: number;
    emphasis: SlotEmphasis;
    finale: boolean;
  };

  let barCounter = 0;
  const scored: Scored[] = beats.map((t, i) => {
    const section = sections.find((s) => t >= s.start && t < s.end);
    const sectionLabel = section?.label ?? 'unknown';
    const vibe = vibeFor(sectionLabel);

    const base = clamp01(section?.avg_energy ?? 0.45);
    const labelBoost =
      section?.intensity === 'high' ? 0.2 : section?.intensity === 'low' ? -0.15 : 0;
    let intensity = base + labelBoost + vibeBoost(vibe);

    let nearClimax = false;
    for (const m of keyMoments) {
      const dt = Math.abs(m.time - t);
      if (dt < 1.5) {
        intensity += m.type === 'climax' ? 0.3 : 0.15;
        if (m.type === 'climax') nearClimax = true;
      }
    }

    for (const b of buildups) {
      if (b.peak <= b.start) continue;
      if (t >= b.start && t <= b.peak) {
        const progress = (t - b.start) / (b.peak - b.start);
        const ramp = 0.4 + 0.55 * progress;
        intensity = Math.max(intensity, ramp);
      }
    }

    const isDownbeat = hasDownbeats ? nearDownbeat(t) : i % beatsPerBar === 0;
    let barPosition: number;
    if (isDownbeat) {
      barPosition = 0;
      barCounter = 1;
    } else {
      barPosition = barCounter;
      barCounter = (barCounter + 1) % beatsPerBar;
    }

    const finale = inFinale(t);
    const atBuildupPeak = buildupPeaks.some((p) => Math.abs(p - t) <= 0.25);
    let emphasis: SlotEmphasis = 'normal';
    if (nearClimax || atBuildupPeak) {
      emphasis = 'peak';
    } else if (finale && isDownbeat && (vibe === 'chorus' || vibe === 'drop')) {
      emphasis = 'peak';
    } else if (
      isDownbeat &&
      (vibe === 'chorus' || vibe === 'drop' || vibe === 'buildup' || vibe === 'pre-chorus')
    ) {
      emphasis = 'accent';
    } else if (finale && isDownbeat) {
      emphasis = 'accent';
    }

    return {
      time: t,
      intensity: clamp01(intensity),
      sectionLabel,
      vibe,
      nearClimax,
      isDownbeat,
      barPosition,
      emphasis,
      finale,
    };
  });

  // 3. Drop silent stretches.
  const live = scored.filter((b) => b.intensity > MIN_INTENSITY);
  if (live.length === 0) return [];

  // 4. Select slots. Must-keep beats: choruses/drops (every beat), climaxes,
  //    and - when we have a bar grid - every downbeat so verses lock to the
  //    bar. Remaining beats fill build/bridge texture toward the target.
  const WINDOW_COUNT = 12;
  const tubesForBeat = (beat: { intensity: number; nearClimax: boolean; vibe: SlotVibe }) =>
    Math.min(tubeCountForBeat(beat), maxTubes);
  const isMustKeep = (b: Scored) =>
    b.vibe === 'chorus' || b.vibe === 'drop' || b.nearClimax || (hasDownbeats && b.isDownbeat);
  const isFillEligible = (b: Scored) => {
    if (isMustKeep(b)) return false;
    if (!hasDownbeats) return true; // 1.3.0: original windowed fill everywhere.
    // With a bar grid, sparse sections are represented by their downbeats;
    // only allow off-beat fill in build/bridge sections to shape ramps.
    return b.vibe === 'buildup' || b.vibe === 'pre-chorus' || b.vibe === 'bridge';
  };

  const fullCoverage = live.filter(isMustKeep);
  const sampled: Scored[] = [...fullCoverage];
  let sampledSlotCount = fullCoverage.reduce((total, beat) => total + tubesForBeat(beat), 0);
  const remainingTarget = Math.max(0, TARGET_SLOTS - sampledSlotCount);

  if (remainingTarget > 0) {
    const sampledBeatKeys = new Set(fullCoverage.map(beatKey));
    const sampledCandidates = live.filter(
      (b) => !sampledBeatKeys.has(beatKey(b)) && isFillEligible(b),
    );

    // Keep coverage across the whole song by bucketing into windows and taking
    // the strongest eligible beats in each window.
    const windowSize = songDuration / WINDOW_COUNT;
    const buckets: Scored[][] = Array.from({ length: WINDOW_COUNT }, () => []);
    for (const b of sampledCandidates) {
      const idx = Math.min(WINDOW_COUNT - 1, Math.floor(b.time / windowSize));
      buckets[idx].push(b);
    }
    for (const bucket of buckets) {
      bucket.sort((a, b) => b.intensity - a.intensity);
    }

    let madeProgress = true;
    while (sampledSlotCount < TARGET_SLOTS && madeProgress) {
      madeProgress = false;
      for (const bucket of buckets) {
        const candidate = bucket.shift();
        if (!candidate) continue;
        const candidateSlotCount = tubesForBeat(candidate);
        if (sampledSlotCount + candidateSlotCount > MAX_TARGET_SLOTS) continue;
        sampled.push(candidate);
        sampledSlotCount += candidateSlotCount;
        madeProgress = true;
        if (sampledSlotCount >= TARGET_SLOTS) break;
      }
    }
  }

  sampled.sort((a, b) => a.time - b.time);

  // 5. Expand into per-tube slots based on intensity. Stagger tubes across
  //    consecutive beats so the same tube doesn't fire back-to-back too often
  //    (single-shot products are short but not zero).
  const slots: CueSlot[] = [];
  let idx = 0;
  let rotor: 0 | 1 | 2 = 0;
  for (const b of sampled) {
    const tubeCount = tubesForBeat(b);
    const tubes: Array<0 | 1 | 2> = [];
    for (let i = 0; i < tubeCount; i++) {
      tubes.push(((rotor + i) % maxTubes) as 0 | 1 | 2);
    }
    rotor = ((rotor + 1) % maxTubes) as 0 | 1 | 2;
    for (const tube of tubes) {
      slots.push({
        index: idx++,
        time: Number(b.time.toFixed(3)),
        tube,
        intensity: Number(b.intensity.toFixed(3)),
        sectionLabel: b.sectionLabel,
        vibe: b.vibe,
        nearClimax: b.nearClimax,
        isDownbeat: b.isDownbeat,
        barPosition: b.barPosition,
        emphasis: b.emphasis,
        finale: b.finale,
      });
    }
  }

  // 6. Onset accents: a few sharp non-beat hits inside chorus/drop/high
  //    sections so snare/kick accents land without cluttering verses.
  const onsetTimes = (analysis?.onset_times ?? []).filter(
    (t) => Number.isFinite(t) && t >= 0 && t < songDuration,
  );
  if (onsetTimes.length > 0) {
    const energyTimeline = analysis?.energy_timeline ?? [];
    const energyAt = (t: number) => {
      let best = 0;
      for (const p of energyTimeline) {
        if (Math.abs(p.time - t) <= 1.0) best = Math.max(best, p.energy);
      }
      return best;
    };
    const isStrongSection = (t: number) => {
      const s = sections.find((sec) => t >= sec.start && t < sec.end);
      if (!s) return false;
      const v = vibeFor(s.label);
      return v === 'chorus' || v === 'drop' || s.intensity === 'high';
    };
    const nearBeat = (t: number) => beats.some((b) => Math.abs(b - t) <= 0.08);
    const chosen: number[] = [];
    for (const t of onsetTimes) {
      if (chosen.length >= 12) break;
      if (!isStrongSection(t)) continue;
      if (energyAt(t) < 0.5) continue;
      if (nearBeat(t)) continue;
      if (chosen.some((c) => Math.abs(c - t) < 0.3)) continue;
      chosen.push(Number(t.toFixed(3)));
    }
    for (const t of chosen) {
      const section = sections.find((s) => t >= s.start && t < s.end);
      const vibe = section ? vibeFor(section.label) : 'verse';
      slots.push({
        index: idx++,
        time: Number(t.toFixed(3)),
        tube: (rotor % maxTubes) as 0 | 1 | 2,
        intensity: 0.6,
        sectionLabel: section?.label ?? 'unknown',
        vibe,
        nearClimax: false,
        isDownbeat: false,
        barPosition: -1,
        emphasis: 'accent',
        finale: inFinale(t),
      });
      rotor = ((rotor + 1) % maxTubes) as 0 | 1 | 2;
    }
  }

  // Re-sort after adding interleaved onset accents, then cap whole timestamp
  // groups so a three-tube accent can never be truncated into one or two tubes.
  slots.sort((a, b) => a.time - b.time || a.tube - b.tube);
  const cappedSlots = capSlotGroups(slots, MAX_TARGET_SLOTS);
  cappedSlots.forEach((s, i) => (s.index = i));
  return cappedSlots;
}

function capSlotGroups(slots: CueSlot[], maxSlots: number): CueSlot[] {
  if (slots.length <= maxSlots) return slots;

  const slotsByTime = new Map<number, CueSlot[]>();
  for (const slot of slots) {
    const group = slotsByTime.get(slot.time);
    if (group) {
      group.push(slot);
    } else {
      slotsByTime.set(slot.time, [slot]);
    }
  }

  const groups = [...slotsByTime.entries()].map(([time, groupSlots]) => ({
    time,
    slots: groupSlots,
    nearClimax: groupSlots.some((slot) => slot.nearClimax),
    peak: groupSlots.some((slot) => slot.emphasis === 'peak'),
    finale: groupSlots.some((slot) => slot.finale),
    downbeat: groupSlots.some((slot) => slot.isDownbeat),
    accent: groupSlots.some((slot) => slot.emphasis === 'accent'),
    intensity: Math.max(...groupSlots.map((slot) => slot.intensity)),
  }));

  const rankedGroups = [...groups].sort(
    (a, b) =>
      Number(b.nearClimax) - Number(a.nearClimax) ||
      Number(b.peak) - Number(a.peak) ||
      Number(b.finale) - Number(a.finale) ||
      Number(b.downbeat) - Number(a.downbeat) ||
      Number(b.accent) - Number(a.accent) ||
      b.intensity - a.intensity ||
      a.time - b.time,
  );

  const selectedTimes = new Set<number>();
  let selectedSlotCount = 0;
  for (const group of rankedGroups) {
    if (selectedSlotCount + group.slots.length > maxSlots) continue;
    selectedTimes.add(group.time);
    selectedSlotCount += group.slots.length;
  }

  return groups
    .filter((group) => selectedTimes.has(group.time))
    .sort((a, b) => a.time - b.time)
    .flatMap((group) => group.slots);
}

function clampBeatsPerBar(value: number): number {
  if (!Number.isFinite(value)) return 4;
  const v = Math.round(value);
  if (v === 2 || v === 3) return v;
  return 4;
}

function tubeCountForBeat(beat: { intensity: number; nearClimax: boolean; vibe: SlotVibe }) {
  if (beat.intensity >= 0.62 || beat.nearClimax || beat.vibe === 'chorus' || beat.vibe === 'drop') {
    return 3;
  }
  if (beat.intensity >= 0.4 || beat.vibe === 'pre-chorus' || beat.vibe === 'buildup') {
    return 2;
  }
  return 1;
}

function beatKey(beat: { time: number; sectionLabel: string; vibe: SlotVibe }): string {
  return `${beat.time}:${beat.sectionLabel}:${beat.vibe}`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampTempo(value: number): number {
  if (!Number.isFinite(value)) return 120;
  return Math.min(220, Math.max(50, value));
}
