/** Deterministic variations keep locked snapshots and vary resolved stored values. */
import { designSchema, resolveDesign, type Design } from '@showcrafter/fireworks';

// Six candidates match the Studio prototype strip.
const VARIATION_COUNT = 6;
// Dimensionless factors from studio.html vary(): counts 0.7..1.4, radii 0.8..1.2, trails 0.6..1.4.
const COUNT_BASE = 0.7;
const COUNT_RANGE = 0.7;
const RADIUS_BASE = 0.8;
const RADIUS_RANGE = 0.4;
const TRAIL_BASE = 0.6;
const TRAIL_RANGE = 0.8;
const MAX_COUNT = 10000; // v1 star and trail count bound.
const MAX_RADIUS_M = 500; // v1 star radius bound, metres.
const SEED_MAX = 0xffffffff; // v1 unsigned 32-bit seed bound.
const RANDOM_MULTIPLIER = 1664525; // Numerical Recipes unsigned 32-bit LCG constants.
const RANDOM_INCREMENT = 1013904223;
const RANDOM_DOMAIN = 4294967296;
/** Generates a valid resolved copy from a non-negative integer roll seed; never mutates the source. */
export function varyDesign(document: Design, seed: number): Design {
  const draft = resolveDesign(document);
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, RANDOM_MULTIPLIER) + RANDOM_INCREMENT) >>> 0;
    return state / RANDOM_DOMAIN;
  };
  draft.seed = state;
  for (const burst of draft.breaks) {
    for (const layer of burst.layers) {
      layer.count = Math.min(
        MAX_COUNT,
        Math.round(layer.count * (COUNT_BASE + random() * COUNT_RANGE)),
      );
      layer.radius_m = Math.min(
        MAX_RADIUS_M,
        layer.radius_m * (RADIUS_BASE + random() * RADIUS_RANGE),
      );
      layer.trail.sparks = Math.min(
        MAX_COUNT,
        Math.round(layer.trail.sparks * (TRAIL_BASE + random() * TRAIL_RANGE)),
      );
    }
  }
  return designSchema.parse(draft);
}
/** Rerolls unlocked slots from the current document, retaining locked designs by identity. */
export function rollVariations(
  document: Design,
  previous: readonly Design[],
  locked: ReadonlySet<number>,
  seed: number,
): Design[] {
  return Array.from({ length: VARIATION_COUNT }, (_, index) => {
    const retained = previous.at(index);
    return locked.has(index) && retained
      ? retained
      : varyDesign(document, (seed + index) % SEED_MAX);
  });
}
