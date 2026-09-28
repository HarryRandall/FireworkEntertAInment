/**
 * Show-quality metrics drawn from professional pyromusical practice: density
 * should follow the music, quiet passages should be real troughs, the finale
 * should be the busiest passage, bursts should land on the music and no
 * single product should dominate. Used for logs, tests and planner tuning;
 * none of these is a hard generation gate.
 */
import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { ProductTimingProfiles } from './music-product-matching';
import type { CueEmphasis } from './schemas';

type MetricCue = {
  timeSeconds: number;
  impactTimeSeconds: number;
  productId: string;
  emphasis: CueEmphasis;
};

export type ShowMetrics = {
  cueCount: number;
  distinctProducts: number;
  /** Largest share of cues taken by one product, 0-1. */
  maxProductShare: number;
  /** Spearman correlation between cue rate and music energy per window. */
  energyCorrelation: number | null;
  /** Busy-window rate over quiet-window rate (90th / 20th percentile). */
  dynamicRange: number | null;
  /** Finale cue rate relative to the rest of the show. */
  finaleRateRatio: number | null;
  /** Visible-burst error against the intended musical time, in milliseconds. */
  syncErrorP50Ms: number | null;
  syncErrorP95Ms: number | null;
};

const WINDOW_SECONDS = 4;

export function evaluateShowMetrics(params: {
  cues: readonly MetricCue[];
  analysis: AnalyserResult | null;
  songDuration: number;
  finaleStartSeconds: number | null;
  timingProfiles?: ProductTimingProfiles;
}): ShowMetrics {
  const { cues, analysis, songDuration, finaleStartSeconds, timingProfiles } = params;
  const usage = new Map<string, number>();
  for (const cue of cues) usage.set(cue.productId, (usage.get(cue.productId) ?? 0) + 1);

  const windowCount = Math.max(1, Math.ceil(songDuration / WINDOW_SECONDS));
  const rates = Array.from({ length: windowCount }, () => 0);
  for (const cue of cues) {
    const index = Math.min(windowCount - 1, Math.floor(cue.impactTimeSeconds / WINDOW_SECONDS));
    if (index >= 0) rates[index] += 1;
  }
  const timeline = analysis?.energy_timeline ?? [];
  const energies = rates.map((_, index) => {
    const points = timeline.filter(
      (point) => point.time >= index * WINDOW_SECONDS && point.time < (index + 1) * WINDOW_SECONDS,
    );
    return points.length
      ? points.reduce((sum, point) => sum + point.energy, 0) / points.length
      : null;
  });
  const paired = rates
    .map((rate, index) => [rate, energies[index]] as const)
    .filter((pair): pair is readonly [number, number] => pair[1] != null);

  const sortedRates = [...rates].sort((a, b) => a - b);
  const quiet = percentile(sortedRates, 0.2);
  const busy = percentile(sortedRates, 0.9);

  let finaleRateRatio: number | null = null;
  if (finaleStartSeconds != null && finaleStartSeconds > 0 && finaleStartSeconds < songDuration) {
    const inFinale = cues.filter((cue) => cue.impactTimeSeconds >= finaleStartSeconds).length;
    const finaleRate = inFinale / (songDuration - finaleStartSeconds);
    const bodyRate = (cues.length - inFinale) / finaleStartSeconds;
    finaleRateRatio = bodyRate > 0 ? round2(finaleRate / bodyRate) : null;
  }

  const syncErrors = cues
    .map((cue) => {
      const profile = timingProfiles?.get(cue.productId)?.[cue.emphasis];
      if (profile?.completeness !== 'complete' || profile.firstImpactOffsetSeconds == null) {
        return null;
      }
      return (
        Math.abs(cue.timeSeconds + profile.firstImpactOffsetSeconds - cue.impactTimeSeconds) * 1000
      );
    })
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

  return {
    cueCount: cues.length,
    distinctProducts: usage.size,
    maxProductShare: cues.length ? round2(Math.max(...usage.values()) / cues.length) : 0,
    energyCorrelation: paired.length >= 4 ? round2(spearman(paired)) : null,
    dynamicRange: cues.length ? round2((busy + 0.5) / (quiet + 0.5)) : null,
    finaleRateRatio,
    syncErrorP50Ms: syncErrors.length ? Math.round(percentile(syncErrors, 0.5)) : null,
    syncErrorP95Ms: syncErrors.length ? Math.round(percentile(syncErrors, 0.95)) : null,
  };
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1))),
  );
  return sorted[index] ?? 0;
}

function spearman(pairs: ReadonlyArray<readonly [number, number]>): number {
  const ranks = (values: number[]) => {
    const order = values
      .map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value);
    const result = new Array<number>(values.length).fill(0);
    for (let start = 0; start < order.length; ) {
      let end = start;
      while (end + 1 < order.length && order[end + 1]?.value === order[start]?.value) end += 1;
      const rank = (start + end) / 2;
      for (let k = start; k <= end; k += 1) result[order[k]?.index ?? 0] = rank;
      start = end + 1;
    }
    return result;
  };
  const x = ranks(pairs.map((pair) => pair[0]));
  const y = ranks(pairs.map((pair) => pair[1]));
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const mx = mean(x);
  const my = mean(y);
  let covariance = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = (x[i] ?? 0) - mx;
    const dy = (y[i] ?? 0) - my;
    covariance += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  return vx && vy ? covariance / Math.sqrt(vx * vy) : 0;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
