import type { CueEmphasis } from '../cue-generation/schemas';
import type { FireworkSpecification } from '../show-domain';
import { compileFireworkDesign, scaleDesignForCaliber, scaleDesignForEmphasis } from './design';
import { estimateFireworkDesignTiming } from './timing';

export type ProductTimingProfileChild = {
  firework: FireworkSpecification;
  timeOffsetSeconds: number;
  panDegrees?: number | null;
};

export type ProductTimingShot = {
  productId: string;
  launchOffsetSeconds: number;
  impactOffsetSeconds: number;
  endOffsetSeconds: number;
};

export type ProductTimingIntervals = {
  count: number;
  minSeconds: number;
  maxSeconds: number;
  meanSeconds: number;
  medianSeconds: number;
  regularityScore: number | null;
};

export type ProductTimingProfile = {
  productId: string;
  shotCount: number | null;
  resolvedShotCount: number;
  source: 'renderer_estimate';
  completeness: 'complete' | 'partial' | 'unknown';
  shots: ProductTimingShot[];
  firstImpactOffsetSeconds: number | null;
  lastImpactOffsetSeconds: number | null;
  totalDurationSeconds: number | null;
  intervals: ProductTimingIntervals | null;
};

type TimingProfileInput = {
  product: FireworkSpecification;
  emphasis: CueEmphasis;
  /** Complete resolved catalogue list, including one-shot sequences; never spec.shots. */
  children?: readonly ProductTimingProfileChild[];
};

function designFor(product: FireworkSpecification, emphasis: CueEmphasis) {
  const compiled =
    product.renderDesign ?? compileFireworkDesign({ legacySpec: product.rawSpec ?? product.spec });
  return scaleDesignForEmphasis(scaleDesignForCaliber(compiled, product.caliber), emphasis);
}

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function intervalSummary(impacts: number[]): ProductTimingIntervals | null {
  if (impacts.length < 2) return null;
  const intervals = impacts.slice(1).map((impact, index) => impact - impacts[index]);
  const minSeconds = Math.min(...intervals);
  const maxSeconds = Math.max(...intervals);
  const meanSeconds = intervals.reduce((sum, value) => sum + value / intervals.length, 0);
  const sorted = [...intervals].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianSeconds =
    sorted.length % 2 === 0 ? sorted[middle - 1] / 2 + sorted[middle] / 2 : sorted[middle];
  // Range relative to mean measures interval uniformity, not musical suitability.
  // One interval or a single simultaneous salvo cannot establish periodicity.
  const regularityScore =
    intervals.length < 2 || meanSeconds === 0
      ? null
      : Math.max(0, Math.min(1, 1 - (maxSeconds - minSeconds) / meanSeconds));
  return {
    count: intervals.length,
    minSeconds,
    maxSeconds,
    meanSeconds,
    medianSeconds,
    regularityScore,
  };
}

/**
 * Build a fact-only renderer timing estimate from a direct product or resolved
 * multishot children. Child offsets remain the persisted launch offsets; no
 * cadence is inferred when the parent has no resolved child rows.
 * All offsets use product ignition as zero. Impact means primary effect start,
 * not the first visible lift spark. End includes renderer trails and smoke.
 * Direct products retain the planner's default zero-pan convention. Resolved
 * children use their own pan and calibre with the parent cue's emphasis.
 * With no declared count, a supplied child list is assumed exhaustive.
 */
export function buildProductTimingProfile({
  product,
  emphasis,
  children,
}: TimingProfileInput): ProductTimingProfile {
  const hasResolvedChildren = children !== undefined;
  const configuredShotCount = product.shotCount;
  const validConfiguredShotCount =
    configuredShotCount == null ||
    (Number.isSafeInteger(configuredShotCount) && configuredShotCount >= 1);
  const expectedShotCount = validConfiguredShotCount
    ? (configuredShotCount ?? (hasResolvedChildren ? children.length : 1))
    : null;
  const isMultishot = hasResolvedChildren || (expectedShotCount ?? 0) > 1;

  if (!validConfiguredShotCount || (isMultishot && children == null)) {
    return {
      productId: product.id,
      shotCount: expectedShotCount,
      resolvedShotCount: 0,
      source: 'renderer_estimate',
      completeness: 'unknown',
      shots: [],
      firstImpactOffsetSeconds: null,
      lastImpactOffsetSeconds: null,
      totalDurationSeconds: null,
      intervals: null,
    };
  }

  const inputs = isMultishot
    ? (children ?? [])
    : [{ firework: product, timeOffsetSeconds: 0, panDegrees: 0 }];
  const shots: ProductTimingShot[] = [];
  for (const child of inputs) {
    if (!finite(child.timeOffsetSeconds) || child.timeOffsetSeconds < 0) continue;
    const childProduct = child.firework;
    const timing = estimateFireworkDesignTiming(
      designFor(childProduct, emphasis),
      finite(child.panDegrees) ? child.panDegrees : 0,
    );
    const impactOffsetSeconds = child.timeOffsetSeconds + timing.liftTimeSeconds;
    const endOffsetSeconds = child.timeOffsetSeconds + timing.endSeconds;
    if (
      !finite(timing.liftTimeSeconds) ||
      !finite(timing.endSeconds) ||
      timing.liftTimeSeconds < 0 ||
      timing.endSeconds < timing.liftTimeSeconds ||
      !finite(impactOffsetSeconds) ||
      !finite(endOffsetSeconds) ||
      impactOffsetSeconds < 0 ||
      endOffsetSeconds < 0
    ) {
      continue;
    }
    shots.push({
      productId: childProduct.id,
      launchOffsetSeconds: child.timeOffsetSeconds,
      impactOffsetSeconds,
      endOffsetSeconds,
    });
  }

  shots.sort((a, b) => a.impactOffsetSeconds - b.impactOffsetSeconds);
  const impacts = shots.map((shot) => shot.impactOffsetSeconds);
  const lastEnd = shots.length > 0 ? Math.max(...shots.map((shot) => shot.endOffsetSeconds)) : null;
  const completeness =
    shots.length === 0
      ? 'unknown'
      : shots.length === expectedShotCount && shots.length === inputs.length
        ? 'complete'
        : 'partial';
  const completeFacts = completeness === 'complete';
  return {
    productId: product.id,
    shotCount: expectedShotCount,
    resolvedShotCount: shots.length,
    source: 'renderer_estimate',
    completeness,
    shots,
    firstImpactOffsetSeconds: completeFacts ? (impacts[0] ?? null) : null,
    lastImpactOffsetSeconds: completeFacts ? (impacts.at(-1) ?? null) : null,
    totalDurationSeconds: completeFacts ? lastEnd : null,
    intervals: completeFacts ? intervalSummary(impacts) : null,
  };
}
