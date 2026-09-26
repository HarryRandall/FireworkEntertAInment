import * as THREE from 'three';
import type { BurstTrailShape, FireworkStarLayer } from '../design.ts';
import { TRAIL_SHAPE_CIRCLE, TRAIL_SHAPE_SQUARE, TRAIL_SHAPE_TRIANGLE } from '../Particle.ts';
import type { RandomSource } from '../random.ts';
import { applyColorMix, randomColor } from './colours.ts';
import {
  BURST_TRAIL_MAX_SPREAD,
  BURST_TRAIL_MAX_SPREAD_ANGLE,
  BURST_TRAIL_SPREAD_SCALE,
  EMBER_TRAIL_COOL,
  EMBER_TRAIL_HOT,
  GOLD_TRAIL_COOL,
  GOLD_TRAIL_HOT,
  HOT_SPARK_COLOR,
  SILVER_TRAIL_COOL,
  SILVER_TRAIL_HOT,
} from './constants.ts';
import { clamp } from './math.ts';
import type { BurstTrail } from './types.ts';

/**
 * Hot/cool colour pair for a star's streak trail, resolved from the design's
 * named colour mode. `star` keeps the star's own colour and dims it; `gold`,
 * `silver`, and `ember` are the classic metallic comet-tail chemistries;
 * `starFade` starts on the star's colour and cools into ember.
 */
export function streakTrailPalette(
  trail: BurstTrail,
  starColor: THREE.Color,
  goldPalette?: { hot: THREE.Color; cool: THREE.Color },
): { hot: THREE.Color; cool: THREE.Color } {
  switch (trail.colourMode) {
    case 'star':
      return {
        hot: starColor.clone(),
        cool: new THREE.Color(starColor.r * 0.5, starColor.g * 0.5, starColor.b * 0.5),
      };
    case 'silver':
      return { hot: SILVER_TRAIL_HOT.clone(), cool: SILVER_TRAIL_COOL.clone() };
    case 'ember':
      return { hot: EMBER_TRAIL_HOT.clone(), cool: EMBER_TRAIL_COOL.clone() };
    case 'starFade':
      return {
        hot: applyColorMix(starColor, HOT_SPARK_COLOR, 0.82),
        cool: EMBER_TRAIL_COOL.clone(),
      };
    case 'gold':
    default:
      if (goldPalette) {
        return { hot: goldPalette.hot.clone(), cool: goldPalette.cool.clone() };
      }
      return { hot: GOLD_TRAIL_HOT.clone(), cool: GOLD_TRAIL_COOL.clone() };
  }
}

export function flairTrailColor(
  layer: FireworkStarLayer,
  starColor: THREE.Color,
  rng: RandomSource,
): THREE.Color {
  if (layer.burst.flairColorMode === 'random') {
    const colour = randomColor(rng);
    return new THREE.Color(colour.r, colour.g, colour.b);
  }
  if (layer.burst.flairColorMode === 'mixed' && rng.next() > 0.55) {
    const colour = randomColor(rng);
    return new THREE.Color(colour.r, colour.g, colour.b);
  }
  return starColor;
}

export function sampleBurstTrailStop(trail: BurstTrail, positionPercent: number) {
  const stops = trail.stops;
  if (stops.length === 0) return null;
  const position = clamp(positionPercent, 0, 100);
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (stop.position <= position) lower = stop;
    if (stop.position >= position) {
      upper = stop;
      break;
    }
  }
  const span = Math.max(0.0001, upper.position - lower.position);
  const t = lower === upper ? 0 : clamp((position - lower.position) / span, 0, 1);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    position,
    density: lerp(lower.density, upper.density),
    size: lerp(lower.size, upper.size),
    sizeVariation: lerp(lower.sizeVariation, upper.sizeVariation),
    shapeWeights: {
      circle: lerp(lower.shapeWeights.circle, upper.shapeWeights.circle),
      square: lerp(lower.shapeWeights.square, upper.shapeWeights.square),
      triangle: lerp(lower.shapeWeights.triangle, upper.shapeWeights.triangle),
    },
  };
}

export function burstTrailEndpointRadius(angle: number, referenceDistance: number): number {
  const degrees = clamp(angle, 0, BURST_TRAIL_MAX_SPREAD_ANGLE);
  if (degrees <= 0 || referenceDistance <= 0) return 0;
  return Math.tan((degrees * Math.PI) / 180) * referenceDistance * BURST_TRAIL_SPREAD_SCALE;
}

export function burstTrailSpreadRadius(
  trail: BurstTrail,
  positionPercent: number,
  distanceBehindHead: number,
  visibleTrailLength: number,
): number {
  const width = trail.width;
  const tailProgress = Math.pow(clamp(positionPercent / 100, 0, 1), width.curve);
  const frontDistance = Math.max(0, visibleTrailLength - distanceBehindHead);
  const tailRadius = burstTrailEndpointRadius(width.tail, distanceBehindHead) * tailProgress;
  const frontRadius = burstTrailEndpointRadius(width.front, frontDistance) * (1 - tailProgress);
  const radius = tailRadius + frontRadius;
  return clamp(radius, 0, BURST_TRAIL_MAX_SPREAD);
}

export function burstTrailBalancedAge(trail: BurstTrail, headAge: number): number {
  const bias = clamp((trail.frontClump - 0.5) * 2, -1, 1);
  const age = clamp(headAge, 0, 1);
  if (Math.abs(bias) <= 0.001) return age;
  const curve = clamp(trail.spacing.curve, 0.2, 4);
  // Larger ages sit nearer the live star head. A positive editor bias must
  // therefore advance the sampling age, while a negative bias holds it back
  // towards the oldest tail.
  const exponent = bias > 0 ? 1 / (1 + bias * curve) : 1 + Math.abs(bias) * curve;
  return clamp(Math.pow(age, exponent), 0, 1);
}

export function burstTrailDensityAt(trail: BurstTrail, headAge: number): number {
  const stop = sampleBurstTrailStop(trail, (1 - burstTrailBalancedAge(trail, headAge)) * 100);
  return stop ? clamp(stop.density, 0, 4) : 1;
}

export function burstTrailSegmentProgress(
  emitted: number,
  emissionCount: number,
  jitterPercent: number,
  rng: RandomSource,
): number {
  const jitter = clamp(jitterPercent / 100, 0, 1);
  const slotOffset = 0.5 + (rng.next() - 0.5) * jitter;
  return clamp((emitted + slotOffset) / Math.max(1, emissionCount), 0, 1);
}

export function burstTrailParticleSizeAt(age: number, headSize: number, tailSize: number): number {
  const t = clamp(age, 0, 1);
  return Math.max(0.01, headSize + (tailSize - headSize) * t);
}

export function burstTrailOpeningProgress(age: number, percent: number): number {
  const duration = clamp(percent / 100, 0.01, 1);
  return clamp(age / duration, 0, 1);
}

export function burstTrailClosingProgress(
  remainingSeconds: number,
  lifeReferenceSeconds: number,
  percent: number,
): number {
  const duration = Math.max(
    0.01,
    Math.max(0.01, lifeReferenceSeconds) * clamp(percent / 100, 0.01, 1),
  );
  const linear = 1 - clamp(remainingSeconds / duration, 0, 1);
  return linear * linear * (3 - 2 * linear);
}

export function burstTrailOpeningRevealProgress(pathAge: number, trail: BurstTrail): number {
  return burstTrailOpeningProgress(pathAge, trail.opening.visibility.revealPercent);
}

export function burstTrailPathSizeScaleAt(pathAge: number, trail: BurstTrail): number {
  const start = clamp(trail.opening.size.startPercent / 100, 0.01, 1);
  const progress = burstTrailOpeningRevealProgress(pathAge, trail);
  return start + (1 - start) * progress;
}

export function burstTrailLifecycleSizeAt(
  pathAge: number,
  closingRemainingSeconds: number,
  closingLifeReferenceSeconds: number,
  baseSize: number,
  trail: BurstTrail,
): number {
  let scale = 1;
  scale *= burstTrailPathSizeScaleAt(pathAge, trail);

  const closing = trail.closing.size;
  if (closing.enabled) {
    const end = clamp(closing.endPercent / 100, 0, 1);
    const progress = burstTrailClosingProgress(
      closingRemainingSeconds,
      closingLifeReferenceSeconds,
      closing.shrinkPercent,
    );
    scale *= 1 + (end - 1) * progress;
  }

  return Math.max(0.01, baseSize * scale);
}

export function burstTrailOpeningBrightnessAt(pathAge: number, trail: BurstTrail): number {
  const start = clamp(trail.opening.visibility.brightnessPercent / 100, 0, 3);
  const progress = burstTrailOpeningRevealProgress(pathAge, trail);
  return start + (1 - start) * progress;
}

export function burstTrailOpeningParticleVisibility(pathAge: number, trail: BurstTrail): number {
  const start = clamp(trail.opening.visibility.particlesPercent / 100, 0, 1);
  const progress = burstTrailOpeningRevealProgress(pathAge, trail);
  return start + (1 - start) * progress;
}

export function burstTrailWideTailAlpha(trail: BurstTrail, positionPercent: number): number {
  const fade = trail.closing.spreadFade;
  if (!fade.enabled) return 1;

  const startAngle = clamp(fade.startAngle, 0, BURST_TRAIL_MAX_SPREAD_ANGLE);
  const tailAngle = clamp(trail.width.tail, 0, BURST_TRAIL_MAX_SPREAD_ANGLE);
  if (tailAngle <= startAngle) return 1;

  const angleRange = Math.max(1, BURST_TRAIL_MAX_SPREAD_ANGLE - startAngle);
  const angleFade = clamp((tailAngle - startAngle) / angleRange, 0, 1);
  const tailAmount = Math.pow(clamp(positionPercent / 100, 0, 1), 0.75);
  const endAlpha = clamp(fade.endOpacityPercent / 100, 0, 1);
  return clamp(1 - angleFade * tailAmount * (1 - endAlpha), endAlpha, 1);
}

export function mixTrailColor(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  amount: number,
): { r: number; g: number; b: number } {
  const t = clamp(amount, 0, 1);
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

export function burstTrailParticleColorAt(
  age: number,
  pathAge: number,
  hot: THREE.Color,
  cool: THREE.Color,
  brightness: number,
  fadeSoftness: number,
  flickerMix: number,
  trail?: BurstTrail,
  closingRemainingSeconds = 1,
  closingLifeReferenceSeconds = 1,
): { r: number; g: number; b: number } {
  const toneMix = Math.pow(clamp(age, 0, 1), clamp(fadeSoftness, 0.2, 4));
  const baseR = hot.r + (cool.r - hot.r) * toneMix;
  const baseG = hot.g + (cool.g - hot.g) * toneMix;
  const baseB = hot.b + (cool.b - hot.b) * toneMix;
  const sparkle = flickerMix * (1 - toneMix);
  let tone = {
    r: (baseR + (HOT_SPARK_COLOR.r - baseR) * sparkle) * brightness,
    g: (baseG + (HOT_SPARK_COLOR.g - baseG) * sparkle) * brightness,
    b: (baseB + (HOT_SPARK_COLOR.b - baseB) * sparkle) * brightness,
  };
  if (!trail) return tone;

  const closing = trail.closing.colour;
  if (closing.enabled) {
    tone = mixTrailColor(
      tone,
      {
        r: closing.color.r * brightness,
        g: closing.color.g * brightness,
        b: closing.color.b * brightness,
      },
      burstTrailClosingProgress(
        closingRemainingSeconds,
        closingLifeReferenceSeconds,
        closing.fadePercent,
      ),
    );
  }

  const openingBrightness = burstTrailOpeningBrightnessAt(pathAge, trail);
  tone = {
    r: tone.r * openingBrightness,
    g: tone.g * openingBrightness,
    b: tone.b * openingBrightness,
  };

  return tone;
}

export function burstTrailHeadGapOffset(
  headVx: number,
  headVy: number,
  headVz: number,
  averageGap: number,
  headGapPercent: number,
): { x: number; y: number; z: number } {
  const gap = Math.max(0, averageGap) * clamp(headGapPercent / 100, 0, 3);
  if (gap <= 0) return { x: 0, y: 0, z: 0 };
  const speed = Math.sqrt(headVx * headVx + headVy * headVy + headVz * headVz);
  if (speed <= 0.0001) return { x: 0, y: 0, z: 0 };
  return {
    x: -(headVx / speed) * gap,
    y: -(headVy / speed) * gap,
    z: -(headVz / speed) * gap,
  };
}

export function burstTrailScatterVector(
  headVx: number,
  headVy: number,
  headVz: number,
  rng: RandomSource,
): { x: number; y: number; z: number } {
  const speed = Math.sqrt(headVx * headVx + headVy * headVy + headVz * headVz);
  const dx = speed > 0.0001 ? headVx / speed : 0;
  const dy = speed > 0.0001 ? headVy / speed : 1;
  const dz = speed > 0.0001 ? headVz / speed : 0;
  const upX = Math.abs(dy) > 0.92 ? 1 : 0;
  const upY = Math.abs(dy) > 0.92 ? 0 : 1;
  const upZ = 0;
  let rightX = dy * upZ - dz * upY;
  let rightY = dz * upX - dx * upZ;
  let rightZ = dx * upY - dy * upX;
  const rightLength = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ) || 1;
  rightX /= rightLength;
  rightY /= rightLength;
  rightZ /= rightLength;

  const outX = rightY * dz - rightZ * dy;
  const outY = rightZ * dx - rightX * dz;
  const outZ = rightX * dy - rightY * dx;
  const theta = rng.next() * Math.PI * 2;
  const distance = Math.sqrt(rng.next());
  const cos = Math.cos(theta) * distance;
  const sin = Math.sin(theta) * distance;
  return {
    x: rightX * cos + outX * sin,
    y: rightY * cos + outY * sin,
    z: rightZ * cos + outZ * sin,
  };
}

export function scaleTrailScatter(
  vector: { x: number; y: number; z: number },
  radius: number,
): { x: number; y: number; z: number } {
  if (radius <= 0) return { x: 0, y: 0, z: 0 };
  return {
    x: vector.x * radius,
    y: vector.y * radius,
    z: vector.z * radius,
  };
}

export function burstTrailScatterOffset(
  headVx: number,
  headVy: number,
  headVz: number,
  radius: number,
  rng: RandomSource,
): { x: number; y: number; z: number } {
  return scaleTrailScatter(burstTrailScatterVector(headVx, headVy, headVz, rng), radius);
}

export function chooseBurstTrailShape(
  weights: { circle: number; square: number; triangle: number },
  rng: RandomSource,
): BurstTrailShape {
  const circle = Math.max(0, weights.circle);
  const square = Math.max(0, weights.square);
  const triangle = Math.max(0, weights.triangle);
  const total = circle + square + triangle;
  if (total <= 0) return 'square';
  const roll = rng.next() * total;
  if (roll < circle) return 'circle';
  if (roll < circle + square) return 'square';
  return 'triangle';
}

export function burstTrailShapeValue(shape: BurstTrailShape): number {
  switch (shape) {
    case 'circle':
      return TRAIL_SHAPE_CIRCLE;
    case 'triangle':
      return TRAIL_SHAPE_TRIANGLE;
    default:
      return TRAIL_SHAPE_SQUARE;
  }
}
