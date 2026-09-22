import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { JamendoSearchTrack } from '@/lib/music-library.types';
import type { ProductTimingProfiles } from '@/lib/cue-generation/music-product-matching';
import {
  cadenceCompatibility,
  localBeatIntervalSeconds,
} from '@/lib/cue-generation/music-product-matching';

export type AssortmentMusicItem = { catalogueItemId: string; quantity: number };

export type AssortmentMusicRecommendation = {
  track: JamendoSearchTrack;
  score: number;
  reasons: string[];
  evidence: 'analysed' | 'duration-only';
};

const DURATION_ONLY_REASON =
  'Initial suggestion based on track length; rhythm has not been analysed.';

const finitePositive = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value > 0;
const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value));

function completeNormalProfile(profiles: ProductTimingProfiles, productId: string) {
  const profile = profiles.get(productId)?.normal;
  return profile?.completeness === 'complete' ? profile : undefined;
}

function assortmentCapacity(
  items: readonly AssortmentMusicItem[],
  profiles: ProductTimingProfiles,
) {
  let capacity = 0;
  let known = 0;
  for (const item of items) {
    const profile = completeNormalProfile(profiles, item.catalogueItemId);
    if (!finitePositive(item.quantity) || !profile || !finitePositive(profile.totalDurationSeconds))
      continue;
    capacity += profile.totalDurationSeconds * item.quantity;
    known += item.quantity;
  }
  return known > 0 && finitePositive(capacity) ? capacity : null;
}

function durationFit(duration: number, capacity: number | null) {
  if (!finitePositive(duration) || !finitePositive(capacity)) return 0.5;
  const ratio = duration / capacity;
  return ratio <= 1 ? clamp(0.45 + ratio * 0.55) : Math.exp(-2.5 * (ratio - 1));
}

function dynamicFit(analysis: AnalyserResult): number | null {
  const energies = analysis.energy_timeline.map((point) => point.energy).filter(Number.isFinite);
  const contrast = analysis.music_profile?.raw_metrics?.section_contrast;
  const prominence = analysis.key_moments.map((point) => point.prominence).filter(Number.isFinite);
  if (!energies.length && !finitePositive(contrast) && !prominence.length) return null;
  const range = energies.length > 1 ? clamp(Math.max(...energies) - Math.min(...energies)) : 0.5;
  const contrastScore = Number.isFinite(contrast) ? clamp(contrast ?? 0) : 0.5;
  const prominenceScore = prominence.length
    ? clamp(prominence.reduce((sum, value) => sum + value, 0) / prominence.length)
    : 0.5;
  return clamp(range * 0.45 + contrastScore * 0.35 + prominenceScore * 0.2);
}

function finaleFit(analysis: AnalyserResult): number | null {
  const points = analysis.energy_timeline.filter(
    (point) => Number.isFinite(point.time) && Number.isFinite(point.energy),
  );
  if (points.length < 2) return null;
  const maximum = Math.max(...points.map((point) => point.energy), 1);
  const finaleWindow = analysis.derived?.finale_window;
  if (
    finaleWindow &&
    Number.isFinite(finaleWindow.start) &&
    Number.isFinite(finaleWindow.end) &&
    finaleWindow.end >= finaleWindow.start
  ) {
    const finalePoints = points.filter(
      (point) => point.time >= finaleWindow.start && point.time <= finaleWindow.end,
    );
    if (finalePoints.length) {
      return clamp(Math.max(...finalePoints.map((point) => point.energy)) / maximum);
    }
  }
  const start = points[0].time + ((points.at(-1)?.time ?? points[0].time) - points[0].time) * 0.75;
  const tail = points.filter((point) => point.time >= start);
  return tail.length ? clamp(Math.max(...tail.map((point) => point.energy)) / maximum) : null;
}

function cadenceFit(
  items: readonly AssortmentMusicItem[],
  profiles: ProductTimingProfiles,
  analysis: AnalyserResult,
) {
  const beat = localBeatIntervalSeconds(analysis, 0);
  if (!beat) return null;
  let total = 0;
  let weight = 0;
  for (const item of items) {
    const profile = completeNormalProfile(profiles, item.catalogueItemId);
    const fit = cadenceCompatibility(profile, beat);
    if (fit == null) continue;
    total += fit * item.quantity;
    weight += item.quantity;
  }
  return weight ? clamp(total / weight) : null;
}

export function buildAssortmentMusicProfile(
  items: readonly AssortmentMusicItem[],
  profiles: ProductTimingProfiles,
) {
  let pieceCount = 0;
  let knownPieceCount = 0;
  let rhythmicCount = 0;
  let sustainedCount = 0;
  let finaleCapacity = 0;
  for (const item of items) {
    if (!finitePositive(item.quantity)) continue;
    pieceCount += item.quantity;
    const profile = completeNormalProfile(profiles, item.catalogueItemId);
    if (!profile) continue;
    knownPieceCount += item.quantity;
    if ((profile.intervals?.regularityScore ?? 0) >= 0.65) rhythmicCount += item.quantity;
    if ((profile.totalDurationSeconds ?? 0) >= 8) sustainedCount += item.quantity;
    const span = (profile.lastImpactOffsetSeconds ?? 0) - (profile.firstImpactOffsetSeconds ?? 0);
    if (
      (profile.resolvedShotCount ?? 0) >= 4 &&
      span > 0 &&
      (profile.resolvedShotCount ?? 0) / span >= 2
    )
      finaleCapacity += item.quantity;
  }
  return {
    pieceCount,
    knownPieceCount,
    rhythmicCount,
    sustainedCount,
    finaleCapacity,
    capacitySeconds: knownPieceCount === pieceCount ? assortmentCapacity(items, profiles) : null,
  };
}

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
  const unique = new Map<string, JamendoSearchTrack>();
  for (const track of tracks) {
    if (
      track.provider === 'jamendo' &&
      finitePositive(track.durationSeconds) &&
      !unique.has(track.trackId)
    )
      unique.set(track.trackId, track);
  }
  return [...unique.values()]
    .map((track) => {
      const analysis = analyses.get(track.trackId);
      const components: Array<[number, number]> = [
        [durationFit(track.durationSeconds, pack.capacitySeconds), 60],
      ];
      const reasons: string[] = [];
      if (pack.capacitySeconds != null && components[0][0] >= 0.7)
        reasons.push('A suitable length for this assortment.');
      if (!analysis) reasons.push(DURATION_ONLY_REASON);
      else if (pack.knownPieceCount > 0) {
        const rhythmic = pack.rhythmicCount / pack.knownPieceCount;
        const cadence = cadenceFit(items, timingProfiles, analysis);
        const beatStability = analysis.music_profile?.raw_metrics?.beat_stability;
        if (cadence != null) {
          const stabilityAdjusted = Number.isFinite(beatStability)
            ? cadence * (0.5 + 0.5 * clamp(beatStability ?? 0))
            : cadence;
          components.push([stabilityAdjusted, 20 * rhythmic]);
          if (stabilityAdjusted >= 0.7)
            reasons.push('A steady rhythm suits the timed sequences in this assortment.');
        }
        const dense = pack.finaleCapacity / pack.knownPieceCount;
        const dynamic = dynamicFit(analysis);
        if (dynamic != null) {
          components.push([
            clamp(
              1 -
                Math.abs(
                  dynamic -
                    (0.3 + 0.4 * (pack.sustainedCount / pack.knownPieceCount) + 0.3 * dense),
                ),
            ),
            10,
          ]);
        }
        const finale = finaleFit(analysis);
        if (finale != null && dense > 0) {
          components.push([finale, 10 * dense]);
          if (finale >= 0.7) reasons.push('A strong ending suits this assortment.');
        }
        const tempo = analysis.tempo_bpm;
        if (finitePositive(tempo) && rhythmic < 0.5 && dense < 0.5) {
          const sparsePackFit = clamp(1 - Math.max(0, tempo - 90) / 120);
          components.push([sparsePackFit, 10]);
          if (sparsePackFit >= 0.8)
            reasons.push('Gentler pacing leaves room for individual effects.');
        }
      }
      if (!reasons.length) reasons.push('An analysed alternative to preview with this assortment.');
      const weight = components.reduce((sum, [, value]) => sum + value, 0);
      return {
        track,
        score: Math.round(
          (100 * components.reduce((sum, [fit, value]) => sum + fit * value, 0)) / weight,
        ),
        reasons,
        evidence: analysis ? ('analysed' as const) : ('duration-only' as const),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.track.trackId.localeCompare(right.track.trackId),
    )
    .slice(0, 5);
}
