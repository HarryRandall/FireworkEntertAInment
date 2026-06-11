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

export type CueSlot = {
  index: number;
  time: number; // seconds, 2 decimals
  tube: 0 | 1 | 2;
  intensity: number; // 0..1
  sectionLabel: string;
  vibe: SlotVibe;
  nearClimax: boolean;
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

  // 1. Beat times: prefer AI's, fall back to synthetic from tempo if sparse.
  let beats = (analysis?.beat_times ?? []).slice().sort((a, b) => a - b);
  const lastBeat = beats.length ? beats[beats.length - 1] : 0;
  const needsSynth = beats.length < 20 || lastBeat < songDuration * 0.75;
  if (needsSynth) {
    const interval = 60 / tempoBpm;
    beats = [];
    for (let t = interval; t < songDuration - 0.25; t += interval) {
      beats.push(Number(t.toFixed(2)));
    }
  }

  // 2. Score each beat by section + climax proximity + buildup ramp.
  type Scored = {
    time: number;
    intensity: number;
    sectionLabel: string;
    vibe: SlotVibe;
    nearClimax: boolean;
  };

  const scored: Scored[] = beats.map((t) => {
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

    return {
      time: t,
      intensity: clamp01(intensity),
      sectionLabel,
      vibe,
      nearClimax,
    };
  });

  // 3. Drop silent stretches.
  const live = scored.filter((b) => b.intensity > MIN_INTENSITY);
  if (live.length === 0) return [];

  // 4. Sample quieter sections, but keep every chorus/drop/climax beat.
  const WINDOW_COUNT = 12;
  const tubesForBeat = (beat: { intensity: number; nearClimax: boolean; vibe: SlotVibe }) =>
    Math.min(tubeCountForBeat(beat), maxTubes);
  const fullCoverage = live.filter(isFullCoverageBeat);
  const sampled: Scored[] = [...fullCoverage];
  let sampledSlotCount = fullCoverage.reduce((total, beat) => total + tubesForBeat(beat), 0);
  const remainingTarget = Math.max(0, TARGET_SLOTS - sampledSlotCount);

  if (remainingTarget > 0) {
    const sampledBeatKeys = new Set(fullCoverage.map(beatKey));
    const sampledCandidates = live.filter((b) => !sampledBeatKeys.has(beatKey(b)));

    // Keep coverage across the whole song by bucketing into windows and taking
    // the strongest non-chorus beats in each window.
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
        time: Number(b.time.toFixed(2)),
        tube,
        intensity: Number(b.intensity.toFixed(3)),
        sectionLabel: b.sectionLabel,
        vibe: b.vibe,
        nearClimax: b.nearClimax,
      });
    }
  }
  return slots;
}

function isFullCoverageBeat(beat: { sectionLabel: string; vibe: SlotVibe; nearClimax: boolean }) {
  const label = beat.sectionLabel.toLowerCase();
  return (
    beat.vibe === 'chorus' || beat.vibe === 'drop' || beat.nearClimax || label.includes('climax')
  );
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
