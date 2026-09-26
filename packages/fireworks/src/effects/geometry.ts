import * as THREE from 'three';
import type { FireworkDesign, FireworkStarLayer } from '../design.ts';
import type { RandomSource } from '../random.ts';
import { STAR_DRAG, STAR_LIFE_RANDOMNESS_REFERENCE_SECONDS } from './constants.ts';
import { clamp } from './math.ts';
import type { EffectContext } from './types.ts';

export function fibonacciDirection(index: number, count: number): THREE.Vector3 {
  const offset = 2 / count;
  const inc = Math.PI * (3.0 - Math.sqrt(5.0));
  const y = index * offset - 1 + offset / 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = ((index + 1.0) % count) * inc;
  return new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
}

export function heartOutlinePoint(
  progress: number,
  rotationDegrees: number,
): { x: number; y: number } {
  const angle = clamp(progress, 0, 1) * Math.PI * 2;
  const sin = Math.sin(angle);
  const x = (16 * sin * sin * sin) / 17;
  const y =
    (13 * Math.cos(angle) -
      5 * Math.cos(2 * angle) -
      2 * Math.cos(3 * angle) -
      Math.cos(4 * angle)) /
    17;
  const rotation = (rotationDegrees * Math.PI) / 180;
  return {
    x: x * Math.cos(rotation) - y * Math.sin(rotation),
    y: x * Math.sin(rotation) + y * Math.cos(rotation),
  };
}

export function starOutlinePoint(
  progress: number,
  points: number,
  innerRadius: number,
  rotationDegrees: number,
): { x: number; y: number } {
  const pointCount = Math.max(3, Math.round(points));
  const vertexCount = pointCount * 2;
  const cursor = clamp(progress, 0, 0.999999) * vertexCount;
  const vertex = Math.floor(cursor);
  const mix = cursor - vertex;
  const vertexAt = (index: number) => {
    const angle =
      ((index % vertexCount) / vertexCount) * Math.PI * 2 + (rotationDegrees * Math.PI) / 180;
    const radius = index % 2 === 0 ? 1 : clamp(innerRadius, 0.08, 0.95);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  };
  const from = vertexAt(vertex);
  const to = vertexAt(vertex + 1);
  return {
    x: from.x + (to.x - from.x) * mix,
    y: from.y + (to.y - from.y) * mix,
  };
}

export function starPatternPosition(
  design: FireworkDesign,
  axis: 'vertical' | 'horizontal',
  index: number,
  count: number,
): number {
  if (count <= 1) return 0.5;
  if (design.geometry === 'ring' || design.geometry === 'pearls') {
    const angle = (index / count) * Math.PI * 2;
    const value = axis === 'horizontal' ? Math.cos(angle) : Math.sin(angle);
    return clamp(value * 0.5 + 0.5, 0, 1);
  }
  if (design.geometry === 'heart') {
    const shape = design.geometryTuning.heart;
    const point = heartOutlinePoint(index / count, shape.rotationDegrees);
    return clamp((axis === 'horizontal' ? point.x : point.y) * 0.5 + 0.5, 0, 1);
  }
  if (design.geometry === 'five_point_star') {
    const shape = design.geometryTuning.fivePointStar;
    const point = starOutlinePoint(
      index / count,
      shape.points,
      shape.innerRadius,
      shape.rotationDegrees,
    );
    return clamp((axis === 'horizontal' ? point.x : point.y) * 0.5 + 0.5, 0, 1);
  }
  const direction = fibonacciDirection(index, count);
  const value = axis === 'horizontal' ? direction.x : direction.y;
  return clamp(value * 0.5 + 0.5, 0, 1);
}

export function effectBurstVelocity(
  ctx: EffectContext,
  design: FireworkDesign,
  index: number,
  count: number,
  speed: number,
  seed: 1 | 2 | 3,
  rng: RandomSource,
): THREE.Vector3 {
  const direction = fibonacciDirection(index, count);
  const tuning = design.geometryTuning;
  switch (design.geometry) {
    case 'ring': {
      const ring = tuning.ring;
      const angle = (index / count) * Math.PI * 2;
      const wobble = (rng.next() - 0.5) * ring.wobble;
      return new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * ring.verticalSquash,
        wobble * speed,
      );
    }
    case 'crown':
    case 'weeping': {
      const shape = design.geometry === 'weeping' ? tuning.weeping : tuning.crown;
      const lateral = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1;
      const lift = shape.lift + rng.next() * shape.liftVariation;
      return new THREE.Vector3(
        (direction.x / lateral) * speed * (shape.spread + rng.next() * shape.spreadVariation),
        speed * lift,
        (direction.z / lateral) * speed * (shape.spread + rng.next() * shape.spreadVariation),
      );
    }
    case 'radial_arms': {
      const shape = tuning.radialArms;
      const arms = Math.max(1, Math.round(shape.arms));
      const arm = index % arms;
      const angle = (arm / arms) * Math.PI * 2 + (rng.next() - 0.5) * shape.angleJitter;
      const length = shape.armLength + Math.floor(index / arms) / Math.max(1, count / arms);
      return new THREE.Vector3(
        Math.cos(angle) * speed * length,
        speed * (shape.lift + rng.next() * shape.liftVariation),
        Math.sin(angle) * speed * length,
      );
    }
    case 'falling_tail': {
      const shape = tuning.fallingTail;
      const lateral = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1;
      return new THREE.Vector3(
        (direction.x / lateral) * speed * (shape.spread + rng.next() * shape.spreadVariation),
        -speed * (shape.sink + rng.next() * shape.sinkVariation),
        (direction.z / lateral) * speed * (shape.spread + rng.next() * shape.spreadVariation),
      );
    }
    case 'pearls': {
      const shape = tuning.pearls;
      const angle = (index / count) * Math.PI * 2;
      return new THREE.Vector3(
        Math.cos(angle) * speed * (shape.spread + rng.next() * shape.spreadVariation),
        speed * (shape.lift + rng.next() * shape.liftVariation),
        Math.sin(angle) * speed * (shape.spread + rng.next() * shape.spreadVariation),
      );
    }
    case 'fragment_cloud': {
      const shape = tuning.fragmentCloud;
      return direction.multiplyScalar(
        speed * (shape.speedBase + rng.next() * shape.speedVariation),
      );
    }
    case 'heart': {
      const shape = tuning.heart;
      const point = heartOutlinePoint(index / count, shape.rotationDegrees);
      const jitter = 1 + (rng.next() * 2 - 1) * shape.outlineJitter;
      return new THREE.Vector3(
        point.x * shape.scaleX * speed * jitter,
        point.y * shape.scaleY * speed * jitter,
        (rng.next() - 0.5) * speed * shape.depthScale,
      );
    }
    case 'five_point_star': {
      const shape = tuning.fivePointStar;
      const point = starOutlinePoint(
        index / count,
        shape.points,
        shape.innerRadius,
        shape.rotationDegrees,
      );
      const jitter = 1 + (rng.next() * 2 - 1) * shape.outlineJitter;
      return new THREE.Vector3(
        point.x * shape.scaleX * speed * jitter,
        point.y * shape.scaleY * speed * jitter,
        (rng.next() - 0.5) * speed * shape.depthScale,
      );
    }
    case 'bowtie': {
      // Two opposed lobes fired in a flat plane: stars split into a +X lobe
      // and a -X lobe, each fanned with a narrow vertical spread so the pair
      // reads as a bow-tie / cross shape rather than a full sphere.
      const shape = tuning.bowtie;
      const half = Math.floor(count / 2);
      const lobe = index < half ? 1 : -1;
      const withinLobe = lobe === 1 ? index : index - half;
      const lobeCount = lobe === 1 ? half : count - half;
      const t = lobeCount > 1 ? withinLobe / (lobeCount - 1) : 0.5;
      const fan = (t - 0.5) * ((shape.fanAngleDegrees * Math.PI) / 180);
      const length = shape.lengthBase + rng.next() * shape.lengthVariation;
      return new THREE.Vector3(
        lobe * Math.cos(fan) * speed * length,
        Math.sin(fan) * speed * shape.verticalScale,
        (rng.next() - 0.5) * speed * shape.depthScale,
      );
    }
    case 'split_cross': {
      // The primary break remains a visible cross when the secondary split
      // is disabled. Stars are distributed along four orthogonal arms in a
      // front-facing plane, with only enough depth jitter to avoid a flat
      // card silhouette.
      const arm = index % 4;
      const armIndex = Math.floor(index / 4);
      const armCount = Math.max(1, Math.ceil(count / 4));
      const armLength = 0.68 + (armIndex / armCount) * 0.42;
      const angle = arm * (Math.PI / 2);
      return new THREE.Vector3(
        Math.cos(angle) * speed * armLength,
        Math.sin(angle) * speed * armLength,
        (rng.next() - 0.5) * speed * 0.16,
      );
    }
    default: {
      const warble = seed === 2 ? 0.78 + rng.next() * 0.5 : 1;
      return direction.multiplyScalar(speed * warble);
    }
  }
}

export function effectStarLife(
  ctx: EffectContext,
  design: FireworkDesign,
  baseLife: number,
  rng: RandomSource,
  randomness: number,
): number {
  const tuning = design.geometryTuning;
  switch (design.geometry) {
    case 'weeping':
      return (
        baseLife *
        (tuning.weeping.lifePercent / 100 + effectStarLifeJitter(ctx, rng, randomness) * 0.35)
      );
    case 'falling_tail':
      return (
        baseLife *
        (tuning.fallingTail.lifePercent / 100 + effectStarLifeJitter(ctx, rng, randomness) * 0.35)
      );
    case 'waterfall':
      return (
        baseLife *
        (tuning.waterfall.lifePercent / 100 + effectStarLifeJitter(ctx, rng, randomness) * 0.35)
      );
    case 'pearls':
      return baseLife * (tuning.pearls.lifePercent / 100);
    case 'ring':
      return baseLife * (tuning.ring.lifePercent / 100);
    default:
      return baseLife;
  }
}

export function effectStarLifeJitter(
  ctx: EffectContext,
  rng: RandomSource,
  randomness: number,
): number {
  const amount = clamp(randomness, 0, 1);
  if (amount <= 0) return 0.5;
  return 0.5 + (rng.next() - 0.5) * amount;
}

export function effectStarLifeRandomness(ctx: EffectContext, layer: FireworkStarLayer): number {
  const [a, b] = layer.burst.life;
  const halfWidth = Math.abs(a - b) / 2;
  return clamp(halfWidth / STAR_LIFE_RANDOMNESS_REFERENCE_SECONDS, 0, 1);
}

export function effectStarOpeningLifeReference(
  ctx: EffectContext,
  design: FireworkDesign,
  layer: FireworkStarLayer,
): number {
  const baseLife = Math.max(0.1, Math.max(layer.burst.life[0], layer.burst.life[1]));
  const tuning = design.geometryTuning;
  // The hang family's opening reference has always run 1.28x its life
  // multiplier (1.6 vs 1.25); keep that ratio as the life tuning moves.
  const HANG_OPENING_BOOST = 1.28;
  switch (design.geometry) {
    case 'weeping':
      return baseLife * (tuning.weeping.lifePercent / 100) * HANG_OPENING_BOOST;
    case 'falling_tail':
      return baseLife * (tuning.fallingTail.lifePercent / 100) * HANG_OPENING_BOOST;
    case 'waterfall':
      return baseLife * (tuning.waterfall.lifePercent / 100) * HANG_OPENING_BOOST;
    case 'pearls':
      return baseLife * (tuning.pearls.lifePercent / 100);
    case 'ring':
      return baseLife * (tuning.ring.lifePercent / 100);
    default:
      return baseLife;
  }
}

/** Shape multipliers are explicit settings; variation comes only from the layer range. */
export function effectStarGravity(design: FireworkDesign, gravity: number): number {
  const tuning = design.geometryTuning;
  switch (design.geometry) {
    case 'weeping':
      return gravity * (tuning.weeping.gravityPercent / 100);
    case 'falling_tail':
      return gravity * (tuning.fallingTail.gravityPercent / 100);
    case 'pearls':
      return gravity * (tuning.pearls.gravityPercent / 100);
    default:
      return gravity;
  }
}

export function effectStarDrag(ctx: EffectContext, design: FireworkDesign): number {
  const tuning = design.geometryTuning;
  switch (design.geometry) {
    case 'weeping':
      return STAR_DRAG * (tuning.weeping.dragPercent / 100);
    case 'falling_tail':
      return STAR_DRAG * (tuning.fallingTail.dragPercent / 100);
    case 'radial_arms':
      return STAR_DRAG * (tuning.radialArms.dragPercent / 100);
    case 'pearls':
      return STAR_DRAG * (tuning.pearls.dragPercent / 100);
    default:
      return STAR_DRAG;
  }
}
