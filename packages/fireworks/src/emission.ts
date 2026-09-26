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
  return Math.max(
    shape.durationMinSeconds,
    Math.min(shape.durationMaxSeconds, (design.shellLife * shape.durationPercent) / 100),
  );
}

export function fountainEmissionRate(design: FireworkDesign, key: StarLayerKey): number {
  const layer = design.stars[key];
  if (!layer.enabled) return 0;
  const shape = design.geometryTuning.fountain;
  return Math.max(
    key === 'outer' ? shape.minRatePerSecond : 0,
    (layer.count * shape.ratePercent) / 100,
  );
}

/** Number of parent star paths, including geometry scaling and ground emitters. */
export function starEmissionCount(design: FireworkDesign, key: StarLayerKey): number {
  const layer = design.stars[key];
  if (!layer.enabled) return 0;
  const t = design.geometryTuning;
  let percent = 100;
  let minimum = 1;
  switch (design.geometry) {
    case 'single_tail':
      return 1;
    case 'fountain':
      return Math.ceil(fountainEmissionRate(design, key) * groundEmissionDuration(design));
    case 'roman_candle':
      percent = t.romanCandle.shotsPercent;
      minimum = t.romanCandle.minShots;
      break;
    case 'upward_fan':
      percent = t.upwardFan.countPercent;
      minimum = t.upwardFan.minCount;
      break;
    case 'whirl':
      percent = t.whirl.countPercent;
      minimum = t.whirl.minCount;
      break;
    case 'fish':
      percent = t.fish.countPercent;
      break;
    case 'waterfall':
      percent = t.waterfall.countPercent;
      break;
    case 'radial_arms':
      percent = t.radialArms.countPercent;
      break;
    case 'falling_tail':
      percent = t.fallingTail.countPercent;
      break;
    case 'pearls':
      percent = t.pearls.countPercent;
      break;
    case 'ring':
      percent = t.ring.countPercent;
      break;
    case 'bowtie':
      percent = t.bowtie.countPercent;
      break;
    case 'fragment_cloud':
      percent = t.fragmentCloud.countPercent;
      break;
    case 'heart':
      percent = t.heart.countPercent;
      break;
    case 'five_point_star':
      percent = t.fivePointStar.countPercent;
      break;
  }
  return Math.max(key === 'outer' ? minimum : 1, Math.round((layer.count * percent) / 100));
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
