import type { SlotVibe } from '@/lib/beat-grid.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { ProductTimingProfile } from '@/lib/fireworks/timing-profile';
import type { CueEmphasis } from './schemas';

export type ProductTimingProfiles = ReadonlyMap<
  string,
  Readonly<Record<CueEmphasis, ProductTimingProfile>>
>;

function finitePositive(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function cadenceCompatibility(
  profile: ProductTimingProfile | null | undefined,
  beatIntervalSeconds: number | null,
): number | null {
  if (
    !profile ||
    profile.completeness !== 'complete' ||
    !finitePositive(beatIntervalSeconds) ||
    !profile.intervals ||
    profile.intervals.count < 2 ||
    profile.intervals.regularityScore == null
  ) {
    return null;
  }
  const impacts = profile.shots.map((shot) => shot.impactOffsetSeconds).sort((a, b) => a - b);
  const intervals = impacts.slice(1).map((impact, index) => impact - impacts[index]);
  if (intervals.length < 2 || intervals.some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }
  const scores = [0.5, 1, 2].map((multiple) => {
    const target = beatIntervalSeconds * multiple;
    const tolerance = Math.max(0.04, target * 0.12);
    return (
      intervals.reduce(
        (sum, interval) => sum + clamp(1 - Math.abs(interval - target) / tolerance),
        0,
      ) / intervals.length
    );
  });
  return clamp(Math.max(...scores) * clamp(profile.intervals.regularityScore));
}

function nearestIndex(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function localBeatIntervalSeconds(
  analysis: AnalyserResult | null,
  timeSeconds: number,
): number | null {
  const beats = analysis?.beat_times ?? [];
  if (beats.length >= 2) {
    const index = nearestIndex(beats, Number.isFinite(timeSeconds) ? timeSeconds : 0);
    const start = Math.max(0, index - 3);
    const end = Math.min(beats.length - 1, index + 3);
    const gaps: number[] = [];
    for (let i = start; i < end; i += 1) {
      const gap = beats[i + 1] - beats[i];
      if (finitePositive(gap)) gaps.push(gap);
    }
    if (gaps.length > 0) {
      gaps.sort((a, b) => a - b);
      const middle = Math.floor(gaps.length / 2);
      return gaps.length % 2 === 0 ? (gaps[middle - 1] + gaps[middle]) / 2 : gaps[middle];
    }
  }
  const fallback = finitePositive(analysis?.tempo_bpm) ? 60 / analysis.tempo_bpm : null;
  return finitePositive(fallback) ? fallback : null;
}

/** Soft role preference. Missing timing evidence remains neutral. */
export function musicTimingPreference(
  profile: ProductTimingProfile | undefined,
  context: {
    beatIntervalSeconds: number | null;
    vibe: SlotVibe;
    isDownbeat: boolean;
    nearClimax: boolean;
    finale: boolean;
  },
): number {
  if (!profile || profile.completeness !== 'complete') return 0;
  const cadence = cadenceCompatibility(profile, context.beatIntervalSeconds);
  const direct = profile.shotCount === 1 && profile.resolvedShotCount === 1;
  const sustained =
    finitePositive(profile.totalDurationSeconds) && profile.totalDurationSeconds >= 2.5;
  const irregular = (profile.intervals?.regularityScore ?? 1) < 0.65;
  const phraseVibe = ['chorus', 'drop', 'buildup'].includes(context.vibe);
  let score = 0;
  if (cadence != null && phraseVibe) score += (cadence - 0.5) * 0.35;
  if (sustained && (!context.isDownbeat || context.vibe === 'intro' || context.vibe === 'verse')) {
    score += 0.16;
  }
  if (irregular && (!context.isDownbeat || ['bridge', 'verse'].includes(context.vibe)))
    score += 0.12;
  if (direct && (context.isDownbeat || context.nearClimax || context.finale)) score += 0.3;
  if ((context.nearClimax || context.finale) && cadence != null) score += (cadence - 0.5) * 0.18;
  if (context.isDownbeat && phraseVibe) score += 0.08;
  return Math.max(-0.5, Math.min(0.5, score));
}
