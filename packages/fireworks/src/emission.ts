import { isGroundGeometry } from './behaviours.ts';
import type { FireworkDesign, StarLayerKey } from './design.ts';
import { BURST_TRAIL_PARTICLES_PER_STAR_MAX } from './model/fields.ts';

/** Safety limits apply to every emitter and are also shown by the editor. */
export const TRAIL_PARTICLE_BUDGET = 24_000;
export const TRAIL_EMISSIONS_PER_STEP = 32;

export function groundEmissionDuration(design: FireworkDesign): number {
  const shape =
    design.geometry === 'fountain'
      ? design.geometryTuning.fountain
      : design.geometryTuning.romanCandle;
  return shape.durationSeconds;
}

export function fountainEmissionRate(design: FireworkDesign, key: StarLayerKey): number {
  const layer = design.stars[key];
  if (!layer.enabled) return 0;
  return layer.emissionRate;
}

/** Number of parent star paths, including timed ground emitters. */
export function starEmissionCount(design: FireworkDesign, key: StarLayerKey): number {
  const layer = design.stars[key];
  if (!layer.enabled) return 0;
  if (design.geometry === 'single_tail') return 1;
  if (design.geometry === 'fountain')
    return Math.floor(fountainEmissionRate(design, key) * groundEmissionDuration(design) + 1e-9);
  return layer.count;
}

export function trailParticleLimit(design: FireworkDesign): { paths: number; perStar: number } {
  let paths = 0;
  for (const key of ['outer', 'core'] as const) {
    const layer = design.stars[key];
    if (!layer.enabled || !layer.burstTrail.enabled) continue;
    const parents = starEmissionCount(design, key);
    const children =
      key === 'outer' && design.split.enabled && !isGroundGeometry(design.geometry)
        ? parents * design.split.fragments
        : 0;
    paths += parents + children;
  }
  return {
    paths,
    perStar: Math.min(
      BURST_TRAIL_PARTICLES_PER_STAR_MAX,
      Math.floor(TRAIL_PARTICLE_BUDGET / Math.max(1, paths)),
    ),
  };
}

export function trailParticlesPerStar(design: FireworkDesign, key: StarLayerKey): number {
  const layer = design.stars[key];
  return layer.enabled && layer.burstTrail.enabled
    ? Math.min(
        Math.max(0, Math.round(layer.burstTrail.particlesPerStar)),
        trailParticleLimit(design).perStar,
      )
    : 0;
}
