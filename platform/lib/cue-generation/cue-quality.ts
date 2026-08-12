import type { CueSlot } from '@/lib/beat-grid.server';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { PlannedCue } from './fast-planner';
import type { ExactProductQuantities } from './product-availability';

export type CuePlanQuality = {
  hardViolations: {
    unknownProductIds: string[];
    outOfBoundsCueCount: number;
    inventoryExcess: Array<{ productId: string; used: number; available: number }>;
  };
  signals: {
    cueCount: number;
    cueDensityPerMinute: number;
    maximumImpactGapSeconds: number;
    productRepeatRatio: number;
    peakCoverageRatio: number;
    sectionCoverageRatio: number;
    simultaneousMomentCount: number;
    finaleCueCount: number;
    longestSameTubeStreak: number;
  };
};

export function evaluateCuePlan(params: {
  cues: PlannedCue[];
  slots: CueSlot[];
  products: FireworkSpecification[];
  songDuration: number;
  exactProductQuantities?: ExactProductQuantities;
}): CuePlanQuality {
  const { cues, slots, products, songDuration, exactProductQuantities } = params;
  const productIds = new Set(products.map((product) => product.id));
  const usage = new Map<string, number>();
  for (const cue of cues) usage.set(cue.productId, (usage.get(cue.productId) ?? 0) + 1);

  const unknownProductIds = [...usage.keys()].filter((id) => !productIds.has(id)).sort();
  const outOfBoundsCueCount = cues.filter(
    (cue) =>
      !Number.isFinite(cue.timeSeconds) ||
      !Number.isFinite(cue.impactTimeSeconds) ||
      cue.timeSeconds < 0 ||
      cue.impactTimeSeconds < 0 ||
      cue.impactTimeSeconds > songDuration + 0.01,
  ).length;
  const inventoryExcess = exactProductQuantities
    ? [...usage.entries()]
        .filter(
          ([productId, used]) =>
            productIds.has(productId) &&
            used > Math.max(0, exactProductQuantities.get(productId) ?? 0),
        )
        .map(([productId, used]) => ({
          productId,
          used,
          available: Math.max(0, exactProductQuantities.get(productId) ?? 0),
        }))
        .sort((left, right) => left.productId.localeCompare(right.productId))
    : [];

  const ordered = [...cues].sort(
    (left, right) => left.impactTimeSeconds - right.impactTimeSeconds || left.tube - right.tube,
  );
  const impactTimes = [...new Set(ordered.map((cue) => Number(cue.impactTimeSeconds.toFixed(3))))];
  const gapPoints = [0, ...impactTimes, songDuration];
  let maximumImpactGapSeconds = 0;
  for (let index = 1; index < gapPoints.length; index += 1) {
    maximumImpactGapSeconds = Math.max(
      maximumImpactGapSeconds,
      gapPoints[index] - gapPoints[index - 1],
    );
  }

  const acceptedSlots = new Set(cues.map((cue) => cue.slotIndex));
  const peakSlots = slots.filter((slot) => slot.nearClimax || slot.emphasis === 'peak');
  const representedSections = new Set(
    slots.filter((slot) => acceptedSlots.has(slot.index)).map((slot) => slot.sectionLabel),
  );
  const allSections = new Set(slots.map((slot) => slot.sectionLabel));
  const simultaneousMomentCount = impactTimes.filter(
    (time) => ordered.filter((cue) => Math.abs(cue.impactTimeSeconds - time) <= 0.001).length > 1,
  ).length;
  const finaleCueCount = slots.filter(
    (slot) => slot.finale && acceptedSlots.has(slot.index),
  ).length;

  let longestSameTubeStreak = 0;
  let currentTube: number | null = null;
  let currentStreak = 0;
  for (const cue of ordered) {
    currentStreak = cue.tube === currentTube ? currentStreak + 1 : 1;
    currentTube = cue.tube;
    longestSameTubeStreak = Math.max(longestSameTubeStreak, currentStreak);
  }

  return {
    hardViolations: { unknownProductIds, outOfBoundsCueCount, inventoryExcess },
    signals: {
      cueCount: cues.length,
      cueDensityPerMinute: roundMetric(songDuration > 0 ? cues.length / (songDuration / 60) : 0),
      maximumImpactGapSeconds: roundMetric(maximumImpactGapSeconds),
      productRepeatRatio: roundMetric(cues.length ? 1 - usage.size / cues.length : 0),
      peakCoverageRatio: roundMetric(
        peakSlots.length
          ? peakSlots.filter((slot) => acceptedSlots.has(slot.index)).length / peakSlots.length
          : 1,
      ),
      sectionCoverageRatio: roundMetric(
        allSections.size ? representedSections.size / allSections.size : 1,
      ),
      simultaneousMomentCount,
      finaleCueCount,
      longestSameTubeStreak,
    },
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
