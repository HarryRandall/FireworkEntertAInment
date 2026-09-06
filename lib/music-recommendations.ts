import type { AnalyserResult } from './show-analysis.types';
import type { JamendoSearchTrack } from './music-library.types';
import {
  cadenceCompatibility,
  localBeatIntervalSeconds,
  type ProductTimingProfiles,
} from './cue-generation/music-product-matching';
import type { ProductTimingProfile } from './fireworks/timing-profile';

export type AssortmentMusicItem = {
  catalogueItemId: string;
  quantity: number;
};

export type AssortmentMusicRecommendation = {
  track: JamendoSearchTrack;
  score: number;
  reasons: string[];
  evidence: 'analysed' | 'duration-only';
};

const DURATION_ONLY_REASON =
  'Initial suggestion based on track length; rhythm has not been analysed.';

function finitePositive(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function completeNormalProfile(
  timingProfiles: ProductTimingProfiles,
  productId: string,
): ProductTimingProfile | undefined {
  const profile = timingProfiles.get(productId)?.normal;
  return profile?.completeness === 'complete' ? profile : undefined;
}

function weightedPackCapacity(
  items: readonly AssortmentMusicItem[],
  timingProfiles: ProductTimingProfiles,
): number | null {
  let capacity = 0;
  let weightedItems = 0;
  for (const item of items) {
    if (!finitePositive(item.quantity)) continue;
    const profile = completeNormalProfile(timingProfiles, item.catalogueItemId);
    if (!profile || !finitePositive(profile.totalDurationSeconds)) continue;
    capacity += profile.totalDurationSeconds * item.quantity;
    weightedItems += item.quantity;
  }
  return weightedItems > 0 && finitePositive(capacity) ? capacity : null;
}

function durationFit(durationSeconds: number, capacitySeconds: number | null): number {
  if (!finitePositive(durationSeconds) || !finitePositive(capacitySeconds)) return 0.5;
  const ratio = durationSeconds / capacitySeconds;
  // Fill the pack where possible, but make an overlong track fall away quickly.
  return ratio <= 1 ? clamp(0.45 + ratio * 0.55) : Math.exp(-2.5 * (ratio - 1));
}

function dynamicFit(analysis: AnalyserResult): number | null {
  const energies = analysis.energy_timeline
    .map((point) => point.energy)
    .filter((value) => Number.isFinite(value));
  const contrast = analysis.music_profile?.raw_metrics?.section_contrast;
  const keyProminence = analysis.key_moments
    .map((moment) => moment.prominence)
    .filter((value) => Number.isFinite(value));
  if (energies.length === 0 && !finitePositive(contrast) && keyProminence.length === 0) {
    return null;
  }
  const energyRange =
    energies.length > 1 ? clamp((Math.max(...energies) - Math.min(...energies)) / 1) : 0.5;
  const contrastScore = Number.isFinite(contrast) ? clamp(contrast ?? 0) : 0.5;
  const prominenceScore =
    keyProminence.length > 0
      ? clamp(keyProminence.reduce((sum, value) => sum + value, 0) / keyProminence.length)
      : 0.5;
  return clamp(energyRange * 0.45 + contrastScore * 0.35 + prominenceScore * 0.2);
}

function finaleFit(analysis: AnalyserResult): number | null {
  const points = analysis.energy_timeline.filter(
    (point) => Number.isFinite(point.time) && Number.isFinite(point.energy),
  );
  const window = analysis.derived?.finale_window;
  if (points.length === 0 && !window) return null;
  if (window && Number.isFinite(window.start) && Number.isFinite(window.end)) {
    const finalePoints = points.filter(
      (point) => point.time >= window.start && point.time <= window.end,
    );
    if (finalePoints.length > 0) {
      const maximum = Math.max(...points.map((point) => point.energy), 1);
      return clamp(Math.max(...finalePoints.map((point) => point.energy)) / maximum);
    }
  }
  if (points.length < 2) return null;
  const maximum = Math.max(...points.map((point) => point.energy), 1);
  const lastPoint = points.at(-1);
  if (!lastPoint) return null;
  const lastQuarterStart = points[0].time + (lastPoint.time - points[0].time) * 0.75;
  const tail = points.filter((point) => point.time >= lastQuarterStart);
  return tail.length > 0 ? clamp(Math.max(...tail.map((point) => point.energy)) / maximum) : null;
}

function cadenceFit(
  items: readonly AssortmentMusicItem[],
  timingProfiles: ProductTimingProfiles,
  analysis: AnalyserResult,
): number | null {
  const beatInterval = localBeatIntervalSeconds(analysis, 0);
  if (beatInterval == null) return null;
  let weighted = 0;
  let weight = 0;
  for (const item of items) {
    if (!finitePositive(item.quantity)) continue;
    const profile = completeNormalProfile(timingProfiles, item.catalogueItemId);
    const cadence = cadenceCompatibility(profile, beatInterval);
    if (cadence == null) continue;
    weighted += cadence * item.quantity;
    weight += item.quantity;
  }
  return weight > 0 ? clamp(weighted / weight) : null;
}

export type AssortmentMusicProfile = {
  pieceCount: number;
  knownPieceCount: number;
  precisionCount: number;
  rhythmicCount: number;
  sustainedCount: number;
  finaleCapacity: number;
  capacitySeconds: number | null;
};

export function buildAssortmentMusicProfile(
  items: readonly AssortmentMusicItem[],
  timingProfiles: ProductTimingProfiles,
): AssortmentMusicProfile {
  let pieceCount = 0,
    knownPieceCount = 0,
    precisionCount = 0,
    rhythmicCount = 0,
    sustainedCount = 0,
    finaleCapacity = 0;
  for (const item of items) {
    if (!finitePositive(item.quantity)) continue;
    pieceCount += item.quantity;
    const profile = completeNormalProfile(timingProfiles, item.catalogueItemId);
    if (!profile) continue;
    knownPieceCount += item.quantity;
    if (profile.resolvedShotCount === 1) precisionCount += item.quantity;
    if ((profile.intervals?.regularityScore ?? 0) >= 0.65) rhythmicCount += item.quantity;
    if ((profile.totalDurationSeconds ?? 0) >= 8) sustainedCount += item.quantity;
    // This is a timing-based density proxy, not a claim about colour or visual power.
    const span = (profile.lastImpactOffsetSeconds ?? 0) - (profile.firstImpactOffsetSeconds ?? 0);
    if (profile.resolvedShotCount >= 4 && span > 0 && profile.resolvedShotCount / span >= 2)
      finaleCapacity += item.quantity;
  }
  return {
    pieceCount,
    knownPieceCount,
    precisionCount,
    rhythmicCount,
    sustainedCount,
    finaleCapacity,
    capacitySeconds:
      knownPieceCount === pieceCount ? weightedPackCapacity(items, timingProfiles) : null,
  };
}

function recommendationFor(
  track: JamendoSearchTrack,
  items: readonly AssortmentMusicItem[],
  timingProfiles: ProductTimingProfiles,
  analyses: ReadonlyMap<string, AnalyserResult>,
  pack: AssortmentMusicProfile,
): AssortmentMusicRecommendation {
  const analysis = analyses.get(track.trackId);
  const duration = durationFit(track.durationSeconds, pack.capacitySeconds);
  const reasons: string[] = [];
  const components: Array<[number, number]> = [[duration, 60]];
  if (pack.capacitySeconds != null && duration >= 0.7)
    reasons.push('A suitable length for this assortment.');
  if (!analysis) {
    reasons.push(DURATION_ONLY_REASON);
  } else if (pack.knownPieceCount > 0) {
    const rhythmic = pack.rhythmicCount / pack.knownPieceCount;
    const cadence = cadenceFit(items, timingProfiles, analysis);
    const stability = analysis.music_profile?.raw_metrics?.beat_stability;
    if (cadence != null) {
      const fit = Number.isFinite(stability)
        ? cadence * (0.5 + 0.5 * clamp(stability ?? 0))
        : cadence;
      components.push([fit, 20 * rhythmic]);
      if (fit >= 0.7) reasons.push('A steady rhythm suits the timed sequences in this assortment.');
    }
    const dynamic = dynamicFit(analysis);
    const sustained = pack.sustainedCount / pack.knownPieceCount;
    // Sparse packs favour gentler pacing; sustained and dense packs support greater contrast.
    const dense = pack.finaleCapacity / pack.knownPieceCount;
    if (dynamic != null)
      components.push([clamp(1 - Math.abs(dynamic - (0.3 + 0.4 * sustained + 0.3 * dense))), 10]);
    const tempo = analysis.tempo_bpm;
    if (finitePositive(tempo) && rhythmic < 0.5 && dense < 0.5) {
      const fit = clamp(1 - Math.max(0, tempo - 90) / 120);
      components.push([fit, 10]);
      if (fit >= 0.8) reasons.push('Gentler pacing leaves room for individual effects.');
    }
    const finale = finaleFit(analysis);
    if (finale != null && dense > 0) {
      components.push([finale, 10 * dense]);
      if (finale >= 0.7)
        reasons.push('A strong ending suits the denser sequences in this assortment.');
    }
  }
  if (!reasons.length) reasons.push('An analysed alternative to preview with this assortment.');
  const weight = components.reduce((sum, [, value]) => sum + value, 0);
  const score = Math.round(
    (100 * components.reduce((sum, [fit, value]) => sum + fit * value, 0)) / weight,
  );
  return {
    track,
    score: clamp(score, 0, 100),
    reasons,
    evidence: analysis ? 'analysed' : 'duration-only',
  };
}

/** Rank provider tracks using bounded, deterministic assortment evidence. */
export function rankAssortmentMusic({
  items,
  timingProfiles,
  tracks,
  analyses,
}: {
  items: readonly AssortmentMusicItem[];
  timingProfiles: ProductTimingProfiles;
  tracks: readonly JamendoSearchTrack[];
  analyses: ReadonlyMap<string, AnalyserResult>;
}): AssortmentMusicRecommendation[] {
  const pack = buildAssortmentMusicProfile(items, timingProfiles);
  const byTrackId = new Map<string, JamendoSearchTrack>();
  for (const track of tracks) {
    if (
      !finitePositive(track.durationSeconds) ||
      track.provider !== 'jamendo' ||
      typeof track.trackId !== 'string' ||
      track.trackId.length === 0
    )
      continue;
    const existing = byTrackId.get(track.trackId);
    if (!existing || track.title.localeCompare(existing.title) < 0)
      byTrackId.set(track.trackId, track);
  }
  return [...byTrackId.values()]
    .map((track) => recommendationFor(track, items, timingProfiles, analyses, pack))
    .sort(
      (left, right) =>
        right.score - left.score || left.track.trackId.localeCompare(right.track.trackId),
    )
    .slice(0, 5);
}
