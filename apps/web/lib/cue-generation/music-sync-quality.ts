import type { CueSlot } from '@/lib/beat-grid.server';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { ProductTimingProfile } from '@/lib/fireworks/timing-profile';
import type { CueEmphasis } from './schemas';
import type { ProductTimingProfiles } from './music-product-matching';
import { cadenceCompatibility, localBeatIntervalSeconds } from './music-product-matching';

export type MusicSyncCue = {
  productId: string;
  slotIndex: number;
  impactTimeSeconds: number;
  timeSeconds?: number;
  emphasis?: CueEmphasis;
};

export type MusicSyncQuality = {
  score: number | null;
  anchorAccuracy: number | null;
  cadenceScore: number | null;
  assessedCueCount: number;
  totalCueCount: number;
};

const ANCHOR_TOLERANCE_SECONDS = 0.12;

function profileFor(
  profiles: ProductTimingProfiles | undefined,
  cue: MusicSyncCue,
): ProductTimingProfile | undefined {
  return profiles?.get(cue.productId)?.[cue.emphasis ?? 'normal'];
}

function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Diagnostic comparison only. It is never a hard generation threshold. */
export function evaluateMusicSync({
  cues,
  slots,
  analysis = null,
  timingProfiles,
}: {
  cues: readonly MusicSyncCue[];
  slots: readonly CueSlot[];
  analysis?: AnalyserResult | null;
  timingProfiles?: ProductTimingProfiles;
}): MusicSyncQuality {
  const anchors: number[] = [];
  const cadences: number[] = [];
  const slotsByIndex = new Map(slots.map((slot) => [slot.index, slot]));
  for (const cue of cues) {
    const slot = slotsByIndex.get(cue.slotIndex);
    const profile = profileFor(timingProfiles, cue);
    if (!slot || !profile || profile.completeness !== 'complete') continue;
    const multishot = profile.resolvedShotCount > 1 || (profile.shotCount ?? 1) > 1;
    const actualAnchor = multishot
      ? cue.timeSeconds
      : cue.timeSeconds != null && profile.firstImpactOffsetSeconds != null
        ? cue.timeSeconds + profile.firstImpactOffsetSeconds
        : null;
    if (actualAnchor == null || !Number.isFinite(actualAnchor)) continue;
    anchors.push(
      Math.max(0, Math.min(1, 1 - Math.abs(actualAnchor - slot.time) / ANCHOR_TOLERANCE_SECONDS)),
    );
    if ((profile.intervals?.regularityScore ?? 0) >= 0.65) {
      const cadence = cadenceCompatibility(profile, localBeatIntervalSeconds(analysis, slot.time));
      if (cadence != null) cadences.push(cadence);
    }
  }
  const anchorAccuracy = average(anchors);
  const cadenceScore = average(cadences);
  const components: Array<readonly [number, number]> = [
    ...(anchorAccuracy == null ? [] : [[anchorAccuracy, 0.7] as const]),
    ...(cadenceScore == null ? [] : [[cadenceScore, 0.3] as const]),
  ];
  const weight = components.reduce((sum, [, value]) => sum + value, 0);
  const score = weight
    ? Math.round(
        (components.reduce((sum, [value, weightValue]) => sum + value * weightValue, 0) / weight) *
          100,
      )
    : null;
  return {
    score,
    anchorAccuracy,
    cadenceScore,
    assessedCueCount: anchors.length,
    totalCueCount: cues.length,
  };
}
