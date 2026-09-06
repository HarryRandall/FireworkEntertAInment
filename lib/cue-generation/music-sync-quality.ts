import type { CueSlot } from '../beat-grid.server';
import type { AnalyserResult } from '../show-analysis.types';
import type { ProductTimingProfile } from '../fireworks/timing-profile';
import type { ProductTimingProfiles } from './music-product-matching';
import type { CueEmphasis } from './schemas';

import { cadenceCompatibility, localBeatIntervalSeconds } from './music-product-matching';

/** The generated cue fields needed to assess musical timing. */
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

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function profileFor(
  profiles: ProductTimingProfiles | undefined,
  cue: MusicSyncCue,
): ProductTimingProfile | undefined {
  const emphasis = cue.emphasis ?? 'normal';
  return profiles?.get(cue.productId)?.[emphasis];
}

/**
 * Compare generated cue timing with its assigned musical slot.
 *
 * This is a deterministic, provisional comparison metric rather than a hard
 * generation gate. Anchor tolerance is a 0.12 second heuristic and has not
 * been calibrated against measured fireworks. A direct product's visible
 * impact is its launch time plus the profile's first impact offset. A
 * multishot product is assessed at its sequence start, matching the existing
 * scheduling contract; internal shots are never treated as separate anchors.
 */
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
    if (!Number.isInteger(cue.slotIndex) || cue.slotIndex < 0) continue;
    const slot = slotsByIndex.get(cue.slotIndex);
    if (!slot || !finite(slot.time)) continue;
    const profile = profileFor(timingProfiles, cue);
    if (!profile || profile.completeness !== 'complete') continue;

    const resolvedCount = profile.resolvedShotCount;
    const declaredCount = profile.shotCount;
    const multishot = resolvedCount > 1 || (declaredCount != null && declaredCount > 1);
    let actualAnchor: number | null = null;
    if (multishot) {
      // Multishot scheduling promises the parent sequence start. Prefer the
      // persisted launch time. A claimed anchor alone is not timing evidence.
      if (finite(cue.timeSeconds) && cue.timeSeconds >= 0) actualAnchor = cue.timeSeconds;
    } else if (
      finite(cue.timeSeconds) &&
      cue.timeSeconds >= 0 &&
      finite(profile.firstImpactOffsetSeconds) &&
      profile.firstImpactOffsetSeconds >= 0
    ) {
      actualAnchor = cue.timeSeconds + profile.firstImpactOffsetSeconds;
    }
    if (actualAnchor != null && finite(actualAnchor)) {
      anchors.push(clamp(1 - Math.abs(actualAnchor - slot.time) / ANCHOR_TOLERANCE_SECONDS));
    } else {
      continue;
    }

    const beatInterval = localBeatIntervalSeconds(analysis, slot.time);
    // Phase 2 calls regularity below 0.65 irregular. Those products are phrase
    // layers, so do not grade their child intervals as rhythmic precision.
    const cadence =
      (profile.intervals?.regularityScore ?? 0) >= 0.65
        ? cadenceCompatibility(profile, beatInterval)
        : null;
    if (cadence != null && finite(cadence)) cadences.push(clamp(cadence));
  }

  const average = (values: readonly number[]): number | null =>
    values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  const anchorAccuracy = average(anchors);
  const cadenceScore = average(cadences);
  const components = [
    anchorAccuracy == null ? null : { value: anchorAccuracy, weight: 0.7 },
    cadenceScore == null ? null : { value: cadenceScore, weight: 0.3 },
  ].filter((component): component is { value: number; weight: number } => component != null);
  const weightedTotal = components.reduce(
    (sum, component) => sum + component.value * component.weight,
    0,
  );
  const weightTotal = components.reduce((sum, component) => sum + component.weight, 0);
  const score = weightTotal === 0 ? null : Math.round(clamp(weightedTotal / weightTotal) * 100);

  return {
    score,
    anchorAccuracy,
    cadenceScore,
    assessedCueCount: anchors.length,
    totalCueCount: cues.length,
  };
}
