// Convert headline impact targets into database-compatible ignition cues, keeping cakes as whole units.
import type { PlannerInput, PlannerProduct } from './input.ts';
import type { PlanCue, PlanMood } from './types.ts';
import { GENERATED_LAUNCH_INTERVAL_SECONDS } from '../timing/launch-spacing.ts';
import { scheduleImpactWithLift } from '../timing/impact-clock.ts';
import { MS_PER_SECOND } from './config.ts';
import { displayAdvance } from './pacing.ts';

// Snap within two seconds of an ideal impact; structural accents can win within half a second of a beat.
const SNAP_WINDOW_MS = 2000;
const STRUCTURAL_PREFERENCE_MS = 500;
const MIN_LAUNCH_SPACING_MS = GENERATED_LAUNCH_INTERVAL_SECONDS * MS_PER_SECOND;
/** Prepared audio event in milliseconds, with the producer beat index when available. */
export type Anchor = { time: number; beat: number | null; structural: boolean };

/** Builds ignition cues and the true visible end, all in milliseconds from show/audio origin; does not mutate products. */
export function scheduleProducts(
  products: PlannerProduct[],
  mood: PlanMood,
  anchors: Anchor[],
): {
  cues: PlanCue[];
  duration_ms: number;
} {
  const cues: PlanCue[] = [];
  let idealLaunch = 0;
  let end = 0;
  for (const product of products) {
    const minimum = cues.length === 0 ? 0 : (cues.at(-1)?.t_ms ?? 0) + MIN_LAUNCH_SPACING_MS;
    const target = Math.max(idealLaunch, minimum) + product.impact_delay_ms;
    const anchor = nearestAnchor(anchors, target, minimum + product.impact_delay_ms);
    const impact = anchor?.time ?? target;
    const timing = scheduleImpactWithLift(
      impact / MS_PER_SECOND,
      product.impact_delay_ms / MS_PER_SECOND,
    );
    if (timing === null) {
      throw new Error('Eligible impact produced an invalid launch clock');
    }
    const launch = Math.round(timing.launchTimeSeconds * MS_PER_SECOND);
    cues.push({
      t_ms: launch,
      product_id: product.product_id,
      position: 0,
      angle_deg: 0,
      beat: anchor?.beat ?? null,
    });
    end = Math.max(end, launch + product.duration_ms);
    idealLaunch = launch + Math.max(MIN_LAUNCH_SPACING_MS, displayAdvance(product, mood));
  }
  return { cues, duration_ms: end };
}

/** Prepares sorted millisecond anchors once per solve trajectory; does not alter the producer analysis. */
export function musicAnchors(input: PlannerInput): Anchor[] {
  const music = input.music;
  if (music === null) {
    return [];
  }
  const downbeats = new Set(music.downbeat_times);
  const beats = music.beat_times.map((time, beat) => ({
    time: Math.round(time * MS_PER_SECOND),
    beat,
    structural: downbeats.has(time),
  }));
  const sections = music.sections.map((section) => ({
    time: Math.round(section.start * MS_PER_SECOND),
    beat: null,
    structural: true,
  }));
  return [...beats, ...sections]
    .filter((anchor) => anchor.time <= music.duration_seconds * MS_PER_SECOND)
    .sort((a, b) =>
      a.time !== b.time ? a.time - b.time : Number(b.structural) - Number(a.structural),
    );
}

function nearestAnchor(anchors: Anchor[], target: number, minimum: number): Anchor | undefined {
  // Binary lower bound limits scanning even when a producer supplies hundreds of thousands of beats.
  let low = 0;
  let high = anchors.length;
  const start = Math.max(minimum, target - SNAP_WINDOW_MS);
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((anchors[middle]?.time ?? Infinity) < start) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  let best: Anchor | undefined;
  let bestDistance = Infinity;
  for (let index = low; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    if (anchor === undefined || anchor.time > target + SNAP_WINDOW_MS) {
      break;
    }
    const distance =
      Math.abs(anchor.time - target) - (anchor.structural ? STRUCTURAL_PREFERENCE_MS : 0);
    if (distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}
