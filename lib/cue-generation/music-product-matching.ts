import type { SlotVibe } from '../beat-grid.server';
import type { CueEmphasis } from './schemas';
import type { AnalyserResult } from '../show-analysis.types';
import type { ProductTimingProfile } from '../fireworks/timing-profile';

/** Timing profiles keyed by product id and render emphasis. */
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

/**
 * Compare every resolved impact interval with half-, single- and double-beat
 * subdivisions. A 40 ms floor or 12% relative tolerance reflects catalogue
 * and analyser uncertainty; this is a suitability score, not physical timing
 * precision. Irregular intervals reduce the result even when their median
 * happens to match a subdivision.
 */
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
    profile.intervals.regularityScore == null ||
    !Number.isFinite(profile.intervals.regularityScore)
  ) {
    return null;
  }

  const impacts = profile.shots.map((shot) => shot.impactOffsetSeconds);
  if (impacts.some((value) => !Number.isFinite(value))) return null;
  const intervals = impacts
    .slice()
    .sort((a, b) => a - b)
    .map((impact, index, sorted) => (index === 0 ? null : impact - sorted[index - 1]))
    .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  if (intervals.length < 2) return null;

  const subdivisionScores = [0.5, 1, 2].map((multiple) => {
    const target = beatIntervalSeconds * multiple;
    if (!finitePositive(target)) return 0;
    const scores = intervals.map((interval) => {
      const tolerance = Math.max(0.04, target * 0.12);
      return clamp(1 - Math.abs(interval - target) / tolerance);
    });
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  });
  const commonSubdivisionScore = Math.max(...subdivisionScores);
  return clamp(commonSubdivisionScore * clamp(profile.intervals.regularityScore));
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

/** Return the median of a few nearby real beat gaps, with tempo as last resort. */
export function localBeatIntervalSeconds(
  analysis: AnalyserResult | null,
  timeSeconds: number,
): number | null {
  const target = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  const beats = analysis?.beat_times ?? [];
  if (beats.length >= 2) {
    const index = nearestIndex(beats, target);
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
      return gaps.length % 2 === 0 ? gaps[middle - 1] / 2 + gaps[middle] / 2 : gaps[middle];
    }
  }
  const tempo = analysis?.tempo_bpm;
  const fallback = finitePositive(tempo) ? 60 / tempo : null;
  return finitePositive(fallback) ? fallback : null;
}

/**
 * A soft planner preference. It nudges choices towards a musical role and
 * never makes a product ineligible; unavailable timing evidence stays neutral.
 */
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
  const intervals = profile.intervals;
  // A long tail does not prevent the initial single burst from being precise.
  const direct = profile.shotCount === 1 && profile.resolvedShotCount === 1;
  const isSustained =
    finitePositive(profile.totalDurationSeconds) && profile.totalDurationSeconds >= 2.5;
  const irregular = intervals?.regularityScore != null && intervals.regularityScore < 0.65;
  let score = 0;
  const phraseVibe =
    context.vibe === 'chorus' || context.vibe === 'drop' || context.vibe === 'buildup';
  if (cadence != null && phraseVibe) score += (cadence - 0.5) * 0.35;
  if (isSustained && (!context.isDownbeat || context.vibe === 'intro' || context.vibe === 'verse'))
    score += 0.16;
  if (irregular && (!context.isDownbeat || context.vibe === 'bridge' || context.vibe === 'verse'))
    score += 0.12;
  if (direct && (context.isDownbeat || context.nearClimax || context.finale)) score += 0.3;
  if ((context.nearClimax || context.finale) && cadence != null) score += (cadence - 0.5) * 0.18;
  if (context.isDownbeat && (context.vibe === 'chorus' || context.vibe === 'drop')) score += 0.08;
  return clamp(score, -0.5, 0.5);
}
