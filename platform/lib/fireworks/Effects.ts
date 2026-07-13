/**
 * Per-shell visual + audio effect implementations.
 *
 * Each `fire*()` method takes a {@link FireworkDesign} and a launch position,
 * spawns the right particle pattern via the shared {@link ParticlePool}, and
 * triggers the matching {@link SoundHandler} sample. New shell types should
 * be added here so the engine doesn't grow a giant switch statement.
 */
import * as THREE from 'three';
import {
  HIDDEN_PARTICLE_SHAPE,
  TRAIL_SHAPE_CIRCLE,
  TRAIL_SHAPE_SQUARE,
  TRAIL_SHAPE_TRIANGLE,
  headShapeValue,
  type Particle,
} from '@/lib/fireworks/Particle';
import type { ParticlePool } from '@/lib/fireworks/ParticlePool';
import type { SoundHandler } from '@/lib/fireworks/SoundHandler';
import type { Lights } from '@/lib/fireworks/Lights';
import {
  BURST_TRAIL_PARTICLES_PER_STAR_MAX,
  DEFAULT_LAUNCH_SMOKE_COLOR,
  type BurstTrailShape,
  type FireworkDesign,
  type FireworkStarLayer,
  type StarLayerKey,
} from '@/lib/fireworks/design';
import { createSeededRng, mixSeed, type RandomSource } from '@/lib/fireworks/random';

type Pos = { x: number; y: number; z: number };
type LiftPathPoint = Pos & { progress: number; age: number };
type FireOptions = {
  rng: RandomSource;
  smokeRng?: RandomSource;
  liftRng?: RandomSource;
  audible: boolean;
  panDegrees?: number;
  tiltDegrees?: number;
};
type LaunchShell = FireworkDesign['launch']['shell'];
type ShellTrail = LaunchShell['trail'];
type LiftParticles = FireworkDesign['launch']['liftParticles'];
type BurstTrail = FireworkStarLayer['burstTrail'];

const PATTERN_SEED: Record<FireworkDesign['pattern'], 1 | 2 | 3> = {
  fibonacci: 1,
  wave: 2,
  strobe: 3,
};

const STAR_DRAG = 2.15;
const TRAIL_DRAG = 2.55;
const MIN_STAR_GRAVITY = -1.85;
const MAX_STAR_GRAVITY = 0.28;
const TRAIL_GRAVITY = -0.03;
const SHELL_TRAIL_DENSITY = 0.68;
const BROCADE_MAX_HEAD_GRAVITY = 0;
const LIFT_SPARK_COLOR = new THREE.Color(1, 0.76, 0.38);
const HOT_SPARK_COLOR = new THREE.Color(1, 0.92, 0.72);
const BROCADE_TRAIL_PEACH = new THREE.Color(1, 0.84, 0.6);
/** Brocade crown burst: hard cap on streak heads per shell. */
const BROCADE_MAX_STREAKS = 100;
const BROCADE_MAX_TRAIL_EMISSIONS_PER_STEP = 32;
const STAR_LIFE_RANDOMNESS_REFERENCE_SECONDS = 0.6;
const SHELL_TRAIL_SPREAD_SCALE = 0.035;
const SHELL_TRAIL_CLEAR_AGE_START = 0.06;
const SHELL_TRAIL_CLEAR_AGE_END = 0.24;
const LIFT_SWIRL_START_AGE = 0.16;
const LIFT_SWIRL_FULL_AGE = 0.36;
const LIFT_LOOP_MIN_SPAN = 0.05;
const BURST_TRAIL_MAX_SPREAD_ANGLE = 80;
const BURST_TRAIL_SPREAD_SCALE = 0.055;
const BURST_TRAIL_MAX_SPREAD = 180;
/** Hot/cool ends of the named streak-trail palettes. */
const GOLD_TRAIL_HOT = new THREE.Color(1, 0.9, 0.62);
const GOLD_TRAIL_COOL = new THREE.Color(1, 0.45, 0.15);
const SILVER_TRAIL_HOT = new THREE.Color(0.94, 0.97, 1);
const SILVER_TRAIL_COOL = new THREE.Color(0.5, 0.58, 0.72);
const EMBER_TRAIL_HOT = new THREE.Color(1, 0.62, 0.26);
const EMBER_TRAIL_COOL = new THREE.Color(0.62, 0.24, 0.08);

function rangeRand(range: [number, number], rng: RandomSource): number {
  const [a, b] = range;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return min + rng.next() * (max - min);
}

function clampStarGravity(gravity: number): number {
  return Math.min(MAX_STAR_GRAVITY, Math.max(gravity, MIN_STAR_GRAVITY));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function estimateShellRiseHeight(initialVelocityY: number, shellLife: number): number {
  const dragK = 0.5 * 0.47 * 1.22 * (Math.PI / 10000);
  const shellMass = 0.5;
  const step = 1 / 60;
  let velocityY = initialVelocityY;
  let height = 0;
  let elapsed = 0;

  while (velocityY > 0 && elapsed < shellLife) {
    const dragAccelerationY = (-dragK * velocityY * Math.abs(velocityY)) / shellMass;
    velocityY = velocityY + dragAccelerationY * step - 9.82 * step;
    height += Math.max(0, velocityY) * step * 100;
    elapsed += step;
  }

  return Math.max(1, height);
}

function randomColor(rng: RandomSource): { r: number; g: number; b: number } {
  // HSV with high saturation gives vivid hues; the prior per-channel jitter
  // averaged toward washed-out pastels that didn't read as a colour.
  const h = rng.next() * 6;
  const i = Math.floor(h);
  const f = h - i;
  const v = 1;
  const s = 0.85;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0:
      return { r: v, g: t, b: p };
    case 1:
      return { r: q, g: v, b: p };
    case 2:
      return { r: p, g: v, b: t };
    case 3:
      return { r: p, g: q, b: v };
    case 4:
      return { r: t, g: p, b: v };
    default:
      return { r: v, g: p, b: q };
  }
}

function resolveColor(
  color: FireworkDesign['color'],
  rng: RandomSource,
): { r: number; g: number; b: number } {
  return color === 'random' ? randomColor(rng) : color;
}

function resolveOptionalColor(
  color: FireworkDesign['secondaryColor'],
  rng: RandomSource,
): THREE.Color | null {
  if (!color) return null;
  const rgb = resolveColor(color, rng);
  return new THREE.Color(rgb.r, rgb.g, rgb.b);
}

function resolveLaunchColor(
  color: FireworkDesign['launch']['liftParticles']['colour'],
  fallback: THREE.Color,
  rng: RandomSource,
): THREE.Color {
  if (!color) return fallback.clone();
  const rgb = resolveColor(color, rng);
  return new THREE.Color(rgb.r, rgb.g, rgb.b);
}

function launchShellShapeValue(shell: LaunchShell): number {
  switch (shell.shape) {
    case 'orb':
      return headShapeValue(shell.glowStrength, 0);
    case 'square':
      return TRAIL_SHAPE_SQUARE;
    case 'triangle':
      return TRAIL_SHAPE_TRIANGLE;
    case 'circle':
    default:
      return TRAIL_SHAPE_CIRCLE;
  }
}

function mixColor(
  from: THREE.Color,
  to: THREE.Color,
  amount: number,
): { r: number; g: number; b: number } {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

function applyColorMix(from: THREE.Color, to: THREE.Color, amount: number): THREE.Color {
  const mixed = mixColor(from, to, clamp(amount, 0, 1));
  return new THREE.Color(mixed.r, mixed.g, mixed.b);
}

function starOpeningProgress(
  elapsedSeconds: number,
  lifeReferenceSeconds: number,
  percent: number,
): number {
  const duration = Math.max(0.01, lifeReferenceSeconds * clamp(percent / 100, 0.01, 1));
  const linear = clamp(elapsedSeconds / duration, 0, 1);
  return linear * linear * (3 - 2 * linear);
}

function starOpeningColor(
  head: FireworkStarLayer['head'],
  target: THREE.Color,
  elapsedSeconds: number,
  lifeReferenceSeconds: number,
): THREE.Color {
  const opening = head.opening.colour;
  if (!opening.enabled) return target;
  const openingColor = new THREE.Color(opening.color.r, opening.color.g, opening.color.b);
  return applyColorMix(
    openingColor,
    target,
    starOpeningProgress(elapsedSeconds, lifeReferenceSeconds, opening.fadePercent),
  );
}

function starOpeningSize(
  head: FireworkStarLayer['head'],
  fullSize: number,
  elapsedSeconds: number,
  lifeReferenceSeconds: number,
): number {
  const opening = head.opening.size;
  if (!opening.enabled) return fullSize;
  const start = clamp(opening.startPercent / 100, 0.01, 1);
  const progress = starOpeningProgress(elapsedSeconds, lifeReferenceSeconds, opening.growPercent);
  return fullSize * (start + (1 - start) * progress);
}

function starClosingProgress(
  remainingSeconds: number,
  lifeReferenceSeconds: number,
  percent: number,
): number {
  const duration = Math.max(0.01, lifeReferenceSeconds * clamp(percent / 100, 0.01, 1));
  const linear = 1 - clamp(remainingSeconds / duration, 0, 1);
  return linear * linear * (3 - 2 * linear);
}

function starClosingColor(
  head: FireworkStarLayer['head'],
  target: THREE.Color,
  remainingSeconds: number,
  lifeReferenceSeconds: number,
): THREE.Color {
  const closing = head.closing.colour;
  if (!closing.enabled) return target;
  const closingColor = new THREE.Color(closing.color.r, closing.color.g, closing.color.b);
  return applyColorMix(
    target,
    closingColor,
    starClosingProgress(remainingSeconds, lifeReferenceSeconds, closing.fadePercent),
  );
}

function starClosingSize(
  head: FireworkStarLayer['head'],
  fullSize: number,
  remainingSeconds: number,
  lifeReferenceSeconds: number,
): number {
  const closing = head.closing.size;
  if (!closing.enabled) return fullSize;
  const end = clamp(closing.endPercent / 100, 0, 1);
  const progress = starClosingProgress(
    remainingSeconds,
    lifeReferenceSeconds,
    closing.shrinkPercent,
  );
  return fullSize * (1 + (end - 1) * progress);
}

function starClosingOpacity(
  head: FireworkStarLayer['head'],
  remainingSeconds: number,
  lifeReferenceSeconds: number,
): number {
  const closing = head.closing.size;
  if (!closing.enabled) return 1;
  const end = clamp(closing.endPercent / 100, 0, 1);
  if (end >= 0.995) return 1;
  const progress = starClosingProgress(
    remainingSeconds,
    lifeReferenceSeconds,
    closing.shrinkPercent,
  );
  const sizeScale = 1 + (end - 1) * progress;
  return Math.pow(clamp(sizeScale, 0, 1), 0.72);
}

function isBrocadeCrown(design: FireworkDesign): boolean {
  return design.geometry === 'crown' && design.trailProfile === 'glitter';
}

/** Whether this design renders its lift and stars with the streak machinery. */
function usesStreakTrails(design: FireworkDesign): boolean {
  const outer = design.stars.outer;
  return outer.enabled && outer.burstTrail.enabled && outer.burstTrail.particlesPerStar > 0;
}

function applyLiftSwirlToShell(
  particle: Particle,
  dt: number,
  time: number,
  liftParticles: LiftParticles,
  liftAge: number,
): void {
  const strength = clamp(liftParticles.motion.swirlStrength, 0, 4);
  if (strength <= 0) return;

  const launchClearance = smoothstep(LIFT_SWIRL_START_AGE, LIFT_SWIRL_FULL_AGE, liftAge);
  if (launchClearance <= 0) return;

  const phase = liftSwirlPhase(liftParticles, liftAge, time);
  const loopCount = clamp(liftParticles.motion.swirlLoopCount, 0, 6);
  const force = strength * (loopCount > 0 ? 0.38 : 0.55) * launchClearance;
  particle.vx += Math.cos(phase) * force * dt;
}

function liftLoopSpan(liftParticles: LiftParticles): { start: number; end: number } {
  const loopLength = clamp(liftParticles.motion.swirlLoopLength / 100, LIFT_LOOP_MIN_SPAN, 1);
  const start = LIFT_SWIRL_START_AGE;
  return {
    start,
    end: clamp(start + loopLength, start + LIFT_LOOP_MIN_SPAN, 1),
  };
}

function liftLoopProgress(liftParticles: LiftParticles, age: number): number {
  const { start, end } = liftLoopSpan(liftParticles);
  return smoothstep(start, end, age);
}

function liftSwirlPhase(liftParticles: LiftParticles, age: number, time: number): number {
  const rate = clamp(liftParticles.motion.swirlRate, 0, 16);
  const loopCount = clamp(liftParticles.motion.swirlLoopCount, 0, 6);
  const pathPhase = loopCount > 0 ? liftLoopProgress(liftParticles, age) * loopCount : 0;
  return (time * rate + pathPhase) * Math.PI * 2;
}

function liftSwirlOffset(
  liftParticles: LiftParticles,
  age: number,
  time: number,
): { x: number; y: number; z: number } {
  const strength = clamp(liftParticles.motion.swirlStrength, 0, 4);
  const radius = clamp(liftParticles.motion.swirlRadius, 0, 180);
  const loopHeight = clamp(liftParticles.motion.swirlLoopHeight, 0, 180);
  if (strength <= 0 && radius <= 0 && loopHeight <= 0) return { x: 0, y: 0, z: 0 };

  const loopProgress = liftLoopProgress(liftParticles, age);
  const phase = liftSwirlPhase(liftParticles, age, time);
  const launchClearance = smoothstep(LIFT_SWIRL_START_AGE, LIFT_SWIRL_FULL_AGE, age);
  const loopAge = clamp(Math.max(age, loopProgress), 0, 1);
  const visibleRadius = (radius * (0.22 + loopAge * 0.78) + strength * 8) * launchClearance;
  const visibleLoopHeight = loopHeight * (0.22 + loopAge * 0.78) * launchClearance;
  const loopRadius =
    loopHeight > 0 ? Math.max(visibleRadius, visibleLoopHeight * 0.55) : visibleRadius;
  const loopCount = clamp(liftParticles.motion.swirlLoopCount, 0, 6);
  if (loopCount > 0) {
    return {
      x: Math.sin(phase) * loopRadius,
      y: (1 - Math.cos(phase)) * visibleLoopHeight * 0.5,
      z: 0,
    };
  }

  return {
    x: Math.cos(phase) * loopRadius,
    y: Math.sin(phase) * visibleLoopHeight,
    z: 0,
  };
}

function usesGuidedLiftPath(liftParticles: LiftParticles): boolean {
  return (
    clamp(liftParticles.motion.swirlStrength, 0, 4) > 0 ||
    clamp(liftParticles.motion.swirlRadius, 0, 180) > 0 ||
    clamp(liftParticles.motion.swirlLoopCount, 0, 6) > 0 ||
    clamp(liftParticles.motion.swirlLoopHeight, 0, 180) > 0
  );
}

function liftPathAge(y: number, liftOriginY: number, liftStopY: number): number {
  return liftStopY > liftOriginY
    ? clamp((y - liftOriginY) / Math.max(1, liftStopY - liftOriginY), 0, 1)
    : 1;
}

function liftGuidedPosition(
  base: Pos,
  liftParticles: LiftParticles,
  time: number,
  liftOriginY: number,
  liftStopY: number,
): LiftPathPoint {
  const age = liftPathAge(base.y, liftOriginY, liftStopY);
  const swirl = liftSwirlOffset(liftParticles, age, time);
  return {
    x: base.x + swirl.x,
    y: Math.max(liftOriginY, base.y + swirl.y),
    z: base.z + swirl.z,
    progress: 1,
    age,
  };
}

function liftPathPoint(
  from: Pos | null,
  to: Pos,
  sampleIndex: number,
  sampleCount: number,
  liftParticles: LiftParticles,
  liftRng: RandomSource,
  time: number,
  dt: number,
  liftOriginY: number,
  liftStopY: number,
): LiftPathPoint {
  const jitter = clamp(liftParticles.spacing.jitterPercent / 100, 0, 1);
  const progress = from
    ? clamp((sampleIndex + 0.5 + (liftRng.next() - 0.5) * jitter) / sampleCount, 0, 1)
    : 1;
  const base = from
    ? {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        z: from.z + (to.z - from.z) * progress,
      }
    : to;
  const sampleTime = from ? time - (1 - progress) * dt : time;
  return {
    ...liftGuidedPosition(base, liftParticles, sampleTime, liftOriginY, liftStopY),
    progress,
  };
}

/**
 * Hot/cool colour pair for a star's streak trail, resolved from the design's
 * named colour mode. `star` keeps the star's own colour and dims it; `gold`,
 * `silver`, and `ember` are the classic metallic comet-tail chemistries;
 * `starFade` starts on the star's colour and cools into ember.
 */
function streakTrailPalette(
  trail: BurstTrail,
  starColor: THREE.Color,
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
    default:
      return { hot: GOLD_TRAIL_HOT.clone(), cool: GOLD_TRAIL_COOL.clone() };
  }
}

function burstTrailParticlesPerStar(trail: BurstTrail): number {
  if (!trail.enabled) return 0;
  const requested = Math.max(0, Math.round(trail.particlesPerStar));
  if (requested <= 0) return 0;
  return Math.min(requested, BURST_TRAIL_PARTICLES_PER_STAR_MAX);
}

function sampleBurstTrailStop(trail: BurstTrail, positionPercent: number) {
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

function burstTrailEndpointRadius(angle: number, referenceDistance: number): number {
  const degrees = clamp(angle, 0, BURST_TRAIL_MAX_SPREAD_ANGLE);
  if (degrees <= 0 || referenceDistance <= 0) return 0;
  return Math.tan((degrees * Math.PI) / 180) * referenceDistance * BURST_TRAIL_SPREAD_SCALE;
}

function burstTrailSpreadRadius(
  trail: BurstTrail,
  positionPercent: number,
  distanceBehindHead: number,
  visibleTrailLength: number,
): number {
  const width = trail.width;
  const t = Math.pow(clamp(positionPercent / 100, 0, 1), width.curve);
  const frontDistance = Math.max(0, visibleTrailLength - distanceBehindHead);
  const tailRadius = burstTrailEndpointRadius(width.tail, distanceBehindHead) * (1 - t);
  const frontRadius = burstTrailEndpointRadius(width.front, frontDistance) * t;
  const radius = tailRadius + frontRadius;
  return clamp(radius, 0, BURST_TRAIL_MAX_SPREAD);
}

function shellTrailSpreadAngle(shellTrail: ShellTrail, age: number): number {
  const tailProgress = Math.pow(clamp(1 - age, 0, 1), shellTrail.curve);
  const clearance = smoothstep(SHELL_TRAIL_CLEAR_AGE_START, SHELL_TRAIL_CLEAR_AGE_END, age);
  return (
    (shellTrail.frontAngle + (shellTrail.tailAngle - shellTrail.frontAngle) * tailProgress) *
    clearance
  );
}

function shellTrailTubeRadius(shellTrail: ShellTrail, age: number, liftRiseHeight: number): number {
  const maxRadius = clamp(shellTrail.tubeDiameter, 0, 90) / 2;
  const angle = clamp(shellTrailSpreadAngle(shellTrail, age), 0, 60);
  if (maxRadius <= 0 || angle <= 0 || liftRiseHeight <= 0) return 0;
  const radius = Math.tan((angle * Math.PI) / 180) * liftRiseHeight * SHELL_TRAIL_SPREAD_SCALE;
  return clamp(radius, 0, maxRadius);
}

function burstTrailBalancedAge(trail: BurstTrail, headAge: number): number {
  const bias = clamp((trail.frontClump - 0.5) * 2, -1, 1);
  const age = clamp(headAge, 0, 1);
  if (Math.abs(bias) <= 0.001) return age;
  const curve = clamp(trail.spacing.curve, 0.2, 4);
  const exponent = bias > 0 ? 1 + bias * curve : 1 / (1 + Math.abs(bias) * curve);
  return clamp(Math.pow(age, exponent), 0, 1);
}

function liftParticleBalancedAge(liftParticles: LiftParticles, headAge: number): number {
  const bias = clamp((liftParticles.frontClump - 0.5) * 2, -1, 1);
  const age = clamp(headAge, 0, 1);
  if (Math.abs(bias) <= 0.001) return age;
  const curve = clamp(liftParticles.spacing.curve, 0.2, 4);
  const exponent = bias > 0 ? 1 + bias * curve : 1 / (1 + Math.abs(bias) * curve);
  return clamp(Math.pow(age, exponent), 0, 1);
}

function liftParticleDensityScale(liftParticles: LiftParticles, headAge: number): number {
  const balanced = liftParticleBalancedAge(liftParticles, headAge);
  const centred = balanced - 0.5;
  const baseDensity = 1 + centred * 1.2;
  const clusterStrength = clamp(liftParticles.spacing.clusterStrength / 100, 0, 1);
  if (clusterStrength <= 0) return clamp(baseDensity, 0.35, 1.85);

  const loopCount = clamp(liftParticles.motion.swirlLoopCount, 0, 6);
  const clusterLoops = Math.max(
    1.15,
    loopCount || clamp(liftParticles.motion.swirlRate, 0, 16) * 0.45,
  );
  const pocket = Math.pow(
    (Math.sin(headAge * clusterLoops * Math.PI * 2) + 1) * 0.5,
    1.15 + (1 - clusterStrength) * 2.35,
  );
  const clusterDensity = 0.32 + pocket * 2.7;
  return clamp(baseDensity * (1 + (clusterDensity - 1) * clusterStrength), 0.2, 3.4);
}

function burstTrailSegmentProgress(
  emitted: number,
  emissionCount: number,
  jitterPercent: number,
  rng: RandomSource,
): number {
  const jitter = clamp(jitterPercent / 100, 0, 1);
  const slotOffset = 0.5 + (rng.next() - 0.5) * jitter;
  return clamp((emitted + slotOffset) / Math.max(1, emissionCount), 0, 1);
}

function burstTrailParticleSizeAt(age: number, headSize: number, tailSize: number): number {
  const t = clamp(age, 0, 1);
  return Math.max(0.01, headSize + (tailSize - headSize) * t);
}

function burstTrailOpeningProgress(age: number, percent: number): number {
  const duration = clamp(percent / 100, 0.01, 1);
  return clamp(age / duration, 0, 1);
}

function burstTrailClosingProgress(
  elapsedSeconds: number,
  lifeReferenceSeconds: number,
  percent: number,
): number {
  const duration = Math.max(
    0.01,
    Math.max(0.01, lifeReferenceSeconds) * clamp(percent / 100, 0.01, 1),
  );
  return clamp(elapsedSeconds / duration, 0, 1);
}

function burstTrailOpeningRevealProgress(pathAge: number, trail: BurstTrail): number {
  return burstTrailOpeningProgress(pathAge, trail.opening.visibility.revealPercent);
}

function burstTrailPathSizeScaleAt(pathAge: number, trail: BurstTrail): number {
  const start = clamp(trail.opening.size.startPercent / 100, 0.01, 1);
  const progress = burstTrailOpeningRevealProgress(pathAge, trail);
  return start + (1 - start) * progress;
}

function burstTrailLifecycleSizeAt(
  pathAge: number,
  closingElapsedSeconds: number,
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
      closingElapsedSeconds,
      closingLifeReferenceSeconds,
      closing.shrinkPercent,
    );
    scale *= 1 + (end - 1) * progress;
  }

  return Math.max(0.01, baseSize * scale);
}

function burstTrailOpeningBrightnessAt(pathAge: number, trail: BurstTrail): number {
  const start = clamp(trail.opening.visibility.brightnessPercent / 100, 0, 3);
  const progress = burstTrailOpeningRevealProgress(pathAge, trail);
  return start + (1 - start) * progress;
}

function burstTrailOpeningParticleVisibility(pathAge: number, trail: BurstTrail): number {
  const start = clamp(trail.opening.visibility.particlesPercent / 100, 0, 1);
  const progress = burstTrailOpeningRevealProgress(pathAge, trail);
  return start + (1 - start) * progress;
}

function burstTrailWideTailAlpha(trail: BurstTrail, positionPercent: number): number {
  const fade = trail.closing.spreadFade;
  if (!fade.enabled) return 1;

  const startAngle = clamp(fade.startAngle, 0, BURST_TRAIL_MAX_SPREAD_ANGLE);
  const tailAngle = clamp(trail.width.tail, 0, BURST_TRAIL_MAX_SPREAD_ANGLE);
  if (tailAngle <= startAngle) return 1;

  const angleRange = Math.max(1, BURST_TRAIL_MAX_SPREAD_ANGLE - startAngle);
  const angleFade = clamp((tailAngle - startAngle) / angleRange, 0, 1);
  const tailAmount = Math.pow(1 - clamp(positionPercent / 100, 0, 1), 0.75);
  const endAlpha = clamp(fade.endOpacityPercent / 100, 0, 1);
  return clamp(1 - angleFade * tailAmount * (1 - endAlpha), endAlpha, 1);
}

function mixTrailColor(
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

function burstTrailParticleColorAt(
  age: number,
  pathAge: number,
  hot: THREE.Color,
  cool: THREE.Color,
  brightness: number,
  fadeSoftness: number,
  flickerMix: number,
  trail?: BurstTrail,
  closingElapsedSeconds = 0,
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
        closingElapsedSeconds,
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

function burstTrailHeadGapOffset(
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

function burstTrailScatterVector(
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

function scaleTrailScatter(
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

function burstTrailScatterOffset(
  headVx: number,
  headVy: number,
  headVz: number,
  radius: number,
  rng: RandomSource,
): { x: number; y: number; z: number } {
  return scaleTrailScatter(burstTrailScatterVector(headVx, headVy, headVz, rng), radius);
}

function flatLiftScatterOffset(
  radius: number,
  rng: RandomSource,
): { x: number; y: number; z: number } {
  if (radius <= 0) return { x: 0, y: 0, z: 0 };
  const theta = rng.next() * Math.PI * 2;
  const distance = Math.sqrt(rng.next()) * radius;
  return {
    x: Math.cos(theta) * distance,
    y: Math.sin(theta) * distance,
    z: 0,
  };
}

function chooseBurstTrailShape(
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

function burstTrailShapeValue(shape: BurstTrailShape): number {
  switch (shape) {
    case 'circle':
      return TRAIL_SHAPE_CIRCLE;
    case 'triangle':
      return TRAIL_SHAPE_TRIANGLE;
    default:
      return TRAIL_SHAPE_SQUARE;
  }
}

function fibonacciDirection(index: number, count: number): THREE.Vector3 {
  const offset = 2 / count;
  const inc = Math.PI * (3.0 - Math.sqrt(5.0));
  const y = index * offset - 1 + offset / 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = ((index + 1.0) % count) * inc;
  return new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
}

function starPatternPosition(
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
  const direction = fibonacciDirection(index, count);
  const value = axis === 'horizontal' ? direction.x : direction.y;
  return clamp(value * 0.5 + 0.5, 0, 1);
}

export class Effects {
  private audible = false;

  constructor(
    private pp: ParticlePool,
    private sh: SoundHandler,
    private lights: Lights,
  ) {}

  setAudible(audible: boolean): void {
    this.audible = audible;
  }

  fire(design: FireworkDesign, position: Pos, options: FireOptions): void {
    const rng = options.rng;
    const smokeRng = options.smokeRng ?? createSeededRng(mixSeed('launch-smoke-fallback'));
    const liftRng = options.liftRng ?? createSeededRng(mixSeed('lift-particles-fallback'));
    const seed = PATTERN_SEED[design.pattern];
    const color = new THREE.Color(0, 0, 0);
    const rgb = resolveColor(design.color, rng);
    color.setRGB(rgb.r, rgb.g, rgb.b);
    const lift = mixColor(color, LIFT_SPARK_COLOR, 0.72);
    const liftColor = new THREE.Color(lift.r, lift.g, lift.b);
    const shell = design.launch.shell;
    const shellColor = resolveLaunchColor(shell.colour, liftColor, rng).multiplyScalar(
      shell.brightness,
    );

    const size = design.size;
    if (design.geometry === 'upward_fan') {
      this.fireMine(design, position, color, rng, options.audible, smokeRng);
      return;
    }
    if (design.geometry === 'roman_candle') {
      this.fireRomanCandle(design, position, color, rng, options.audible, smokeRng);
      return;
    }
    if (design.geometry === 'fountain') {
      this.fireFountain(design, position, color, rng, options.audible, smokeRng);
      return;
    }

    if (options.audible && design.sound.launch) this.sh.playRandomMortar(1.0, rng);
    this.lights.newLight({ x: position.x, y: 30, z: position.z }, new THREE.Color(0.7, 0.3, 0), 10);
    this.spawnMortarSmoke(position, design, smokeRng);

    const liftVelocity = design.liftVelocity ?? 11 + Math.min(size / 40, 6);
    const panRadians = ((options.panDegrees ?? 0) * Math.PI) / 180;
    const tiltRadians = ((options.tiltDegrees ?? 0) * Math.PI) / 180;
    const lateralVelocity = Math.sin(panRadians) * Math.max(1.2, liftVelocity * 0.62);
    const forwardVelocity = Math.sin(tiltRadians) * Math.max(1.0, liftVelocity * 0.42);
    const verticalVelocity = liftVelocity * Math.max(0.82, Math.cos(panRadians) * 0.96);
    const liftRiseHeight = estimateShellRiseHeight(verticalVelocity, design.shellLife);

    // Star count can be tiny, but the ascending carrier still needs enough
    // size budget to survive its decay until apex and trigger detonation.
    const shellSize = Math.max(size, 110) * shell.sizeScale;
    // The carrier dies when its size reaches zero (see Particle.update). A small
    // shell.sizeScale (e.g. the 0.25 used by style-default previews) shrinks the
    // carrier enough that a high random decay can exhaust it before apex, so
    // `detonate` never fires and the whole burst silently fails to appear. Cap
    // the decay so the carrier always outlives its estimated time to apex,
    // regardless of scale. Full-size shells keep their original decay because
    // their larger size budget already survives comfortably.
    const apexSeconds = Math.max(0.1, verticalVelocity / 9.82);
    const survivalDecay = shellSize / (apexSeconds * 1.6 + 0.5);
    const shellDecay = Math.min(10 + rng.next() * 20, survivalDecay);
    const guidedShellVisible = shell.visible && usesGuidedLiftPath(design.launch.liftParticles);
    let liftPreviousPosition: Pos | null = null;
    this.pp.new({
      x: position.x,
      y: position.y,
      z: position.z,
      size: shellSize,
      mass: 0.5,
      vy: verticalVelocity,
      vx: lateralVelocity,
      vz: forwardVelocity,
      h: 0.9,
      s: 0.5,
      l: 0.5,
      shape:
        shell.visible && !guidedShellVisible ? launchShellShapeValue(shell) : HIDDEN_PARTICLE_SHAPE,
      r: shellColor.r,
      g: shellColor.g,
      b: shellColor.b,
      life: design.shellLife,
      decay: shellDecay,
      effect: (p, dt, t) => {
        const previousPosition = liftPreviousPosition;
        this.shellEffect(
          p,
          dt,
          t,
          seed,
          liftColor,
          design,
          rng,
          liftRng,
          smokeRng,
          position.y,
          liftRiseHeight,
          shellColor,
          shellSize,
          previousPosition,
        );
        liftPreviousPosition = { x: p.x, y: p.y, z: p.z };
      },
      condition: (p) => p.vy <= 0,
      action: (p, dt, t) => {
        if (guidedShellVisible) {
          const liftStopY =
            position.y + liftRiseHeight * clamp(design.launch.liftParticles.height / 100, 0, 1);
          const guided = liftGuidedPosition(
            p,
            design.launch.liftParticles,
            t,
            position.y,
            liftStopY,
          );
          p.x = guided.x;
          p.y = guided.y;
          p.z = guided.z;
        }
        this.detonate(p, dt, t, design, color, seed, rng, this.audible);
      },
    });
  }

  private fireMine(
    design: FireworkDesign,
    position: Pos,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
    smokeRng: RandomSource = createSeededRng(mixSeed('mine-smoke-fallback')),
  ): void {
    if (audible && design.sound.launch) this.sh.playRandomMortar(0.7, rng);
    this.lights.newLight({ x: position.x, y: 35, z: position.z }, color, 12);
    this.spawnMortarSmoke(position, design, smokeRng, 0.65);
    const shape = design.geometryTuning.upwardFan;
    const count = Math.max(shape.minCount, Math.round(design.size * (shape.countPercent / 100)));
    const spreadAngle = (shape.spreadAngleDegrees * Math.PI) / 180;
    const speed = rangeRand(design.burst.speed, rng);
    const grav = clampStarGravity(rangeRand(design.burst.gravity, rng));
    const layer = design.stars.outer;
    for (let i = 0; i < count; i++) {
      const spread = (rng.next() - 0.5) * spreadAngle;
      const fan = shape.fanBase + rng.next() * shape.fanVariation;
      const starColor = this.starColor(design, layer, 'outer', color, i, count, rng);
      this.spawnEffectStar({
        design,
        layer,
        rng,
        audible,
        x: position.x + (rng.next() - 0.5) * shape.spawnScatter,
        y: position.y + shape.riseBase + rng.next() * shape.riseVariation,
        z: position.z + (rng.next() - 0.5) * shape.spawnScatter,
        vx: Math.sin(spread) * speed * fan,
        vy: speed * (shape.riseSpeed + rng.next() * shape.riseSpeedVariation),
        vz: (rng.next() - 0.5) * speed * shape.depthScale,
        color: starColor,
        life: rangeRand(design.burst.life, rng) * (shape.lifePercent / 100),
        gravity: grav,
        drag: STAR_DRAG * (shape.dragPercent / 100),
        headSizeScale: shape.headSizePercent / 100,
        trailLifeScale: shape.trailLifePercent / 100,
        trailStarCount: count,
      });
    }
  }

  /**
   * Roman candle: a ground tube that ejects a sequence of large ascending stars
   * over several seconds. Implemented as a hidden ground emitter whose per-frame
   * effect callback releases one star on a staggered interval, so the candle
   * reads as discrete shots rather than a single burst.
   */
  private fireRomanCandle(
    design: FireworkDesign,
    position: Pos,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
    smokeRng: RandomSource,
  ): void {
    if (audible && design.sound.launch) this.sh.playRandomMortar(0.45, rng);
    this.spawnMortarSmoke(position, design, smokeRng, 0.4);
    const layer = design.stars.outer;
    const shape = design.geometryTuning.romanCandle;
    const shotCount = Math.max(
      shape.minShots,
      Math.round(design.size * (shape.shotsPercent / 100)),
    );
    const duration = Math.max(
      shape.durationMinSeconds,
      Math.min(shape.durationMaxSeconds, design.shellLife * (shape.durationPercent / 100)),
    );
    const interval = duration / shotCount;
    const speed = rangeRand(design.burst.speed, rng);
    const grav = clampStarGravity(rangeRand(design.burst.gravity, rng));
    let elapsed = 0;
    let emitted = 0;
    this.lights.newLight({ x: position.x, y: 60, z: position.z }, color, 9);

    this.pp.new({
      x: position.x,
      y: position.y + 18,
      z: position.z,
      size: 40,
      mass: 0.5,
      vy: 0,
      gravity: 0,
      drag: 0,
      shape: HIDDEN_PARTICLE_SHAPE,
      life: duration + 1,
      decay: 0.1,
      effect: (p, dt) => {
        elapsed += dt;
        while (emitted < shotCount && elapsed >= emitted * interval + interval * 0.5) {
          emitted += 1;
          const spread = (rng.next() - 0.5) * shape.spread;
          const azimuth = (rng.next() - 0.5) * shape.azimuth;
          const starSpeed = speed * (shape.speedBase + rng.next() * shape.speedVariation);
          const starColor = this.starColor(design, layer, 'outer', color, emitted, shotCount, rng);
          if (audible && rng.next() < 0.55) this.sh.playRandomCrackle(0.05, rng);
          this.spawnEffectStar({
            design,
            layer,
            rng,
            audible,
            x: p.x + (rng.next() - 0.5) * shape.muzzleScatter,
            y: p.y,
            z: p.z + (rng.next() - 0.5) * shape.muzzleScatter,
            vx: Math.sin(spread) * starSpeed * shape.lateralScale,
            vy: starSpeed * (shape.riseBase + rng.next() * shape.riseVariation),
            vz: Math.sin(azimuth) * starSpeed * shape.depthScale,
            color: starColor,
            life: rangeRand(design.burst.life, rng) * (shape.lifePercent / 100),
            gravity: grav,
            drag: STAR_DRAG * (shape.dragPercent / 100),
            headSizeScale: shape.headSizePercent / 100,
            trailLifeScale: shape.trailLifePercent / 100,
            trailStarCount: shotCount,
          });
        }
      },
    });
  }

  /**
   * Fountain: a steady ground glitter spray. A hidden ground emitter releases
   * many small sparks per frame into a narrow upward cone; high drag and gravity
   * pull them back into the classic fountain arc. No mortar burst, no boom.
   */
  private fireFountain(
    design: FireworkDesign,
    position: Pos,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
    smokeRng: RandomSource,
  ): void {
    this.spawnMortarSmoke(position, design, smokeRng, 0.25);
    const layer = design.stars.outer;
    const shape = design.geometryTuning.fountain;
    const duration = Math.max(
      shape.durationMinSeconds,
      Math.min(shape.durationMaxSeconds, design.shellLife * (shape.durationPercent / 100)),
    );
    const speed = rangeRand(design.burst.speed, rng);
    const grav = clampStarGravity(rangeRand(design.burst.gravity, rng));
    const coneAngle = (shape.coneAngleDegrees * Math.PI) / 180;
    const ratePerSecond = Math.max(shape.minRatePerSecond, design.size * (shape.ratePercent / 100));
    let carry = 0;
    this.lights.newLight({ x: position.x, y: 70, z: position.z }, color, 11);
    if (audible && design.sound.launch) this.sh.playRandomCrackle(0.12, rng);

    this.pp.new({
      x: position.x,
      y: position.y + 14,
      z: position.z,
      size: 30,
      mass: 0.5,
      vy: 0,
      gravity: 0,
      drag: 0,
      shape: HIDDEN_PARTICLE_SHAPE,
      life: duration + 0.5,
      decay: 0.1,
      effect: (p, dt) => {
        carry += ratePerSecond * dt;
        const toEmit = Math.floor(carry);
        carry -= toEmit;
        for (let i = 0; i < toEmit; i++) {
          const cone = (rng.next() - 0.5) * coneAngle;
          const azimuth = rng.next() * Math.PI * 2;
          const starSpeed = speed * (shape.speedBase + rng.next() * shape.speedVariation);
          const lateral = Math.sin(cone) * starSpeed;
          const starColor = this.starColor(design, layer, 'outer', color, i, 16, rng);
          this.spawnEffectStar({
            design,
            layer,
            rng,
            audible: false,
            x: p.x + (rng.next() - 0.5) * shape.spawnScatter,
            y: p.y,
            z: p.z + (rng.next() - 0.5) * shape.spawnScatter,
            vx: Math.cos(azimuth) * lateral * shape.lateralScale,
            vy: Math.cos(cone) * starSpeed,
            vz: Math.sin(azimuth) * lateral * shape.lateralScale,
            color: starColor,
            life: rangeRand(design.burst.life, rng) * (shape.lifePercent / 100),
            gravity: grav,
            drag: STAR_DRAG * (shape.dragPercent / 100),
            headSizeScale: shape.headSizePercent / 100,
            trailLifeScale: shape.trailLifePercent / 100,
            trailStarCount: 16,
          });
        }
      },
    });
  }

  private spawnMortarSmoke(
    pos: Pos,
    design: FireworkDesign,
    rng: RandomSource,
    amountMultiplier = 1,
  ): void {
    const smoke = design.launch.smoke;
    const count = smoke.enabled ? Math.max(0, Math.round(smoke.particles * amountMultiplier)) : 0;
    if (count <= 0) return;
    const color = DEFAULT_LAUNCH_SMOKE_COLOR;
    const size = smoke.size;
    const lifeSeconds = smoke.lifeSeconds;
    const spread = smoke.spread;
    const drift = smoke.drift;
    const riseVelocity = smoke.height <= 0 ? 0 : smoke.height / Math.max(1, lifeSeconds * 180);
    for (let i = 0; i < count; i++) {
      const angle = rng.next() * Math.PI * 2;
      const radius = Math.sqrt(rng.next()) * spread;
      const particleSize = size * (0.48 + rng.next() * 0.92);
      const life = lifeSeconds * (0.45 + rng.next() * 0.8);
      this.pp.new({
        x: pos.x + Math.cos(angle) * radius,
        y: pos.y + 22 + rng.next() * 12,
        z: pos.z + Math.sin(angle) * radius,
        vx: (rng.next() - 0.5) * drift,
        vy: riseVelocity + rng.next() * 0.14,
        vz: (rng.next() - 0.5) * drift,
        mass: 0.006,
        gravity: 0.02 + drift * 0.025,
        drag: 0.9 + drift * 0.35,
        size: particleSize,
        h: 0.5,
        s: 0.5,
        l: 0.5,
        r: color.r * (0.82 + rng.next() * 0.28),
        g: color.g * (0.82 + rng.next() * 0.28),
        b: color.b * (0.82 + rng.next() * 0.28),
        life,
        decay: particleSize / Math.max(0.2, life) / (0.9 + rng.next() * 0.65),
        effect: (p, _dt, time) => {
          p.vz += Math.sin(time * (0.6 + rng.next() * 0.8)) * drift * 0.004;
          p.vx += Math.sin(time * (0.6 + rng.next() * 0.8)) * drift * 0.004;
        },
      });
    }
  }

  private spawnGuidedLaunchShell(
    point: Pos,
    design: FireworkDesign,
    shellColor: THREE.Color,
    shellSize: number,
    dt: number,
  ): void {
    const shell = design.launch.shell;
    const life = Math.max(0.032, dt * 1.8);
    const size = clamp(shellSize * 0.28, 8, 34);
    this.pp.new({
      x: point.x,
      y: point.y,
      z: point.z,
      mass: 0.5,
      gravity: 0,
      drag: 0,
      size,
      shape: launchShellShapeValue(shell),
      r: shellColor.r,
      g: shellColor.g,
      b: shellColor.b,
      h: 0.9,
      s: 0.5,
      l: 0.5,
      life,
      decay: size / life,
    });
  }

  private shellEffect(
    particle: Particle,
    dt: number,
    time: number,
    seed: 1 | 2 | 3,
    color: THREE.Color,
    design: FireworkDesign,
    rng: RandomSource,
    liftRng: RandomSource,
    smokeRng: RandomSource,
    liftOriginY: number,
    liftRiseHeight: number,
    shellColor: THREE.Color,
    shellSize: number,
    previousPosition: Pos | null = null,
  ): void {
    let max = 1;
    let vx = 0;
    let vz = 0;
    const liftParticles = design.launch.liftParticles;
    const shellTrail = design.launch.shell.trail;
    switch (seed) {
      case 1:
        max = 8 + rng.next() * 28;
        break;
      case 2:
        // Tiny lateral wobble — was a strong spiral. Don't translate the
        // shell; just let the trail particles (below) inherit a small drift.
        particle.vx += (rng.next() - 0.5) * 0.05;
        particle.vz += (rng.next() - 0.5) * 0.05;
        max = 6 + rng.next() * 22;
        break;
      case 3:
        particle.size = (rng.next() > 0.5 ? 150 : 10) * design.launch.shell.sizeScale;
        max = 5 + rng.next() * 14;
        vx = 2 - rng.next() * 4;
        vz = 2 - rng.next() * 4;
        break;
    }
    const streakLift = isBrocadeCrown(design) || usesStreakTrails(design);
    const liftTrailMultiplier = streakLift
      ? design.geometry === 'single_tail'
        ? 1.6
        : 1.0
      : design.geometry === 'single_tail' || design.trailProfile === 'thick_tail'
        ? 2.25
        : design.geometry === 'radial_arms'
          ? 1.45
          : design.trailProfile === 'none'
            ? 0.45
            : 1;
    const smoke = design.launch.smoke;
    const baseCount = Math.max(1, Math.floor(max * SHELL_TRAIL_DENSITY * liftTrailMultiplier));
    const liftHeightPercent = clamp(liftParticles.height / 100, 0, 1);
    const liftStopY = liftOriginY + liftRiseHeight * liftHeightPercent;
    const liftAge = liftPathAge(particle.y, liftOriginY, liftStopY);
    const guidedShellPoint =
      design.launch.shell.visible && usesGuidedLiftPath(liftParticles)
        ? liftGuidedPosition(particle, liftParticles, time, liftOriginY, liftStopY)
        : null;
    if (guidedShellPoint) {
      this.spawnGuidedLaunchShell(guidedShellPoint, design, shellColor, shellSize, dt);
    }
    applyLiftSwirlToShell(particle, dt, time, liftParticles, liftAge);
    const liftDensity = liftParticleDensityScale(liftParticles, liftAge);
    const liftDensityJitter =
      1 + (liftRng.next() * 2 - 1) * (liftParticles.spacing.jitterPercent / 100) * 0.25;
    const liftCount =
      liftParticles.enabled && liftStopY > liftOriginY && particle.y <= liftStopY
        ? Math.max(
            0,
            Math.round(baseCount * (liftParticles.amount / 100) * liftDensity * liftDensityJitter),
          )
        : 0;
    const smokeCount =
      smoke.enabled && !streakLift && particle.y <= smoke.height
        ? Math.max(0, Math.round(baseCount * (smoke.particles / 100)))
        : 0;
    if (liftCount <= 0 && smokeCount <= 0) return;
    // Non-brocade streak designs tint the rising tail from their own trail
    // palette so silver shells rise silver and gold shells rise gold.
    const liftPalette = !isBrocadeCrown(design)
      ? streakTrailPalette(design.stars.outer.burstTrail, color)
      : { hot: BROCADE_TRAIL_PEACH, cool: BROCADE_TRAIL_PEACH };

    const liftSampleCount =
      liftCount > 0 && previousPosition
        ? Math.max(1, Math.min(liftCount, liftParticles.spacing.pathSamples))
        : 1;
    const liftParticlesPerSample = Math.max(1, Math.ceil(liftCount / liftSampleCount));
    let liftEmitted = 0;

    for (let sampleIndex = 0; sampleIndex < liftSampleCount; sampleIndex++) {
      const pathPoint = liftPathPoint(
        previousPosition,
        particle,
        sampleIndex,
        liftSampleCount,
        liftParticles,
        liftRng,
        time,
        dt,
        liftOriginY,
        liftStopY,
      );
      const liftTubeRadius = shellTrailTubeRadius(shellTrail, pathPoint.age, liftRiseHeight);

      for (let i = 0; i < liftParticlesPerSample && liftEmitted < liftCount; i++, liftEmitted++) {
        // Only crowns keep the legacy calibrated lift look. Other effects use
        // their saved launch-particle settings even when their burst has a
        // streak trail, so the Launch Trail editor remains authoritative.
        const brocadeLift = isBrocadeCrown(design);
        const lockToShellPath = liftTubeRadius <= 0;
        const liftStreakSize = brocadeLift ? clamp(design.trail.streakSize, 0.4, 4) : 1;
        const liftStreakLife = brocadeLift ? clamp(design.trail.streakLife, 0.2, 4) : 1;
        const liftVelocityScatter = brocadeLift
          ? clamp(liftTubeRadius * 0.01, 0, 0.16)
          : clamp(liftTubeRadius * 0.04, 0, 1.2);
        const hotTrail =
          design.geometry === 'single_tail' ||
          design.trailProfile === 'thick_tail' ||
          design.trailProfile === 'glitter';
        const launchSparkColor = resolveLaunchColor(liftParticles.colour, color, liftRng);
        const sparkColor = brocadeLift
          ? applyColorMix(color, liftPalette.hot, 0.66 + liftRng.next() * 0.24)
          : hotTrail
            ? applyColorMix(launchSparkColor, HOT_SPARK_COLOR, 0.45)
            : launchSparkColor;
        const sizeVariation =
          1 + (liftRng.next() * 2 - 1) * (liftParticles.particleSize.variationPercent / 100);
        const sparkBaseSize = brocadeLift
          ? (8 + liftRng.next() * 14) * design.trail.thickness * liftStreakSize
          : liftParticles.particleSize.base * Math.max(0.08, sizeVariation);
        const sparkHeadSize = brocadeLift
          ? sparkBaseSize
          : sparkBaseSize * liftParticles.particleSize.headScale;
        const sparkTailSize = brocadeLift
          ? sparkBaseSize * 0.35
          : sparkBaseSize * liftParticles.particleSize.tailScale;
        const lifeVariation =
          1 + (liftRng.next() * 2 - 1) * (liftParticles.lifetime.variationPercent / 100);
        const flicker = !brocadeLift && liftRng.next() < liftParticles.flicker.chance;
        const flickerMix = flicker ? clamp(liftParticles.flicker.strength / 3, 0, 1) : 0;
        const sparkLife = brocadeLift
          ? (0.14 + liftRng.next() * 0.24) * liftStreakLife
          : (liftParticles.lifetime.baseSeconds + liftParticles.lifetime.afterglowSeconds) *
            Math.max(0.05, lifeVariation) *
            design.trail.length *
            (flicker ? liftParticles.flicker.lifetimeMultiplier : 1);
        const coolSparkColor = brocadeLift
          ? liftPalette.cool
          : new THREE.Color(sparkColor.r * 0.46, sparkColor.g * 0.38, sparkColor.b * 0.28);
        const sparkTone = burstTrailParticleColorAt(
          0,
          0,
          sparkColor,
          coolSparkColor,
          liftParticles.intensity.brightness,
          liftParticles.intensity.fadeSoftness,
          flickerMix,
        );
        const spin = clamp(liftParticles.motion.spin, 0, 8);
        const shape = brocadeLift
          ? TRAIL_SHAPE_SQUARE
          : burstTrailShapeValue(chooseBurstTrailShape(liftParticles.shapeWeights, liftRng));
        const scatter = brocadeLift
          ? burstTrailScatterOffset(particle.vx, particle.vy, particle.vz, liftTubeRadius, liftRng)
          : flatLiftScatterOffset(liftTubeRadius, liftRng);
        this.pp.new({
          x: pathPoint.x + scatter.x,
          y: pathPoint.y + scatter.y,
          z: pathPoint.z + scatter.z,
          mass: 0.002,
          gravity: lockToShellPath
            ? 0
            : brocadeLift
              ? TRAIL_GRAVITY * 0.3
              : liftParticles.motion.gravity,
          drag: lockToShellPath ? 0 : brocadeLift ? TRAIL_DRAG * 1.05 : liftParticles.motion.drag,
          size: sparkHeadSize,
          shape,
          rotation: spin > 0 ? liftRng.next() * Math.PI * 2 : 0,
          spin: spin > 0 ? (liftRng.next() - 0.5) * spin * 2 : 0,
          vx: lockToShellPath
            ? 0
            : brocadeLift
              ? particle.vx * 0.015 + (liftRng.next() - 0.5) * liftVelocityScatter
              : particle.vx * liftParticles.motion.inheritedVelocity +
                liftParticles.motion.driftX +
                vx +
                (liftRng.next() - 0.5) * (liftVelocityScatter + liftParticles.motion.turbulence),
          vy: lockToShellPath
            ? 0
            : brocadeLift
              ? -0.04 + liftRng.next() * 0.08
              : particle.vy * liftParticles.motion.inheritedVelocity +
                liftParticles.motion.driftY -
                0.15 +
                liftRng.next() * 0.3,
          vz: lockToShellPath
            ? 0
            : brocadeLift
              ? particle.vz * 0.015 + (liftRng.next() - 0.5) * liftVelocityScatter
              : particle.vz * liftParticles.motion.inheritedVelocity +
                liftParticles.motion.driftZ +
                vz +
                (liftRng.next() - 0.5) * (liftVelocityScatter + liftParticles.motion.turbulence),
          r: sparkTone.r,
          g: sparkTone.g,
          b: sparkTone.b,
          h: 1.0,
          s: 0.5,
          l: 0.0,
          life: sparkLife,
          decay: brocadeLift ? 34 + liftRng.next() * 30 : 0,
          effect: brocadeLift
            ? undefined
            : (p) => {
                const particleAge = p.maxLife > 0 ? 1 - clamp(p.life / p.maxLife, 0, 1) : 1;
                const nextTone = burstTrailParticleColorAt(
                  particleAge,
                  particleAge,
                  sparkColor,
                  coolSparkColor,
                  liftParticles.intensity.brightness,
                  liftParticles.intensity.fadeSoftness,
                  flickerMix,
                );
                p.color.setRGB(nextTone.r, nextTone.g, nextTone.b);
                p.size = burstTrailParticleSizeAt(particleAge, sparkHeadSize, sparkTailSize);
              },
        });
      }
    }

    const smokeColor = DEFAULT_LAUNCH_SMOKE_COLOR;
    for (let i = 0; i < smokeCount; i++) {
      const smokeSpread = smoke.spread * (particle.y < smoke.height * 0.62 ? 1 : 0.55);
      const smokeSize = smoke.size * (0.55 + smokeRng.next() * 0.85);
      const smokeLife = smoke.lifeSeconds * (0.45 + smokeRng.next() * 0.75);
      this.pp.new({
        x: particle.x + (smokeRng.next() - 0.5) * smokeSpread,
        y: particle.y + (smokeRng.next() - 0.5) * 14,
        z: particle.z + (smokeRng.next() - 0.5) * smokeSpread,
        mass: 0.006,
        gravity: 0.02 + smoke.drift * 0.035 + smokeRng.next() * 0.08,
        drag: 1.35 + smoke.drift * 0.35,
        size: smokeSize,
        vx: vx + (smokeRng.next() - 0.5) * smoke.drift,
        vy: smoke.height / Math.max(1, smoke.lifeSeconds * 260) + smokeRng.next() * 0.14,
        vz: vz + (smokeRng.next() - 0.5) * smoke.drift,
        r: smokeColor.r * (0.82 + smokeRng.next() * 0.28),
        g: smokeColor.g * (0.82 + smokeRng.next() * 0.28),
        b: smokeColor.b * (0.82 + smokeRng.next() * 0.28),
        h: 1.0,
        s: 0.5,
        l: 0.0,
        life: smokeLife,
        decay: smokeSize / Math.max(0.2, smokeLife) / (0.9 + smokeRng.next() * 0.65),
        effect: (p, _dt, time) => {
          p.vz += Math.sin(time * (0.6 + smokeRng.next() * 0.8)) * smoke.drift * 0.004;
          p.vx += Math.sin(time * (0.6 + smokeRng.next() * 0.8)) * smoke.drift * 0.004;
        },
      });
    }
  }

  private detonate(
    particle: Particle,
    _dt: number,
    _time: number,
    design: FireworkDesign,
    color: THREE.Color,
    seed: 1 | 2 | 3,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const boom = design.sound.boom;
    if (audible) {
      if (boom !== 'none') {
        if (boom === 'heavy' || (boom === 'auto' && design.size > 200)) {
          this.sh.playRandomHeavyBoom(1.0, rng);
        } else {
          this.sh.playRandomLightBoom(1.0, rng);
        }
      }
    }

    if (isBrocadeCrown(design)) {
      this.spawnBrocadeBurst(particle, design, rng);
      return;
    }
    this.lights.setHemi(design.size / 100, color.r, color.g, color.b);
    if (design.geometry === 'single_tail') {
      this.cometFinish(particle, design, color, rng, audible);
      return;
    }
    if (design.geometry === 'fish') {
      this.spawnFishSwarm(particle, design, color, rng, audible);
      return;
    }
    if (design.geometry === 'waterfall') {
      this.spawnWaterfall(particle, design, color, rng, audible);
      return;
    }
    if (design.geometry === 'whirl') {
      this.spawnWhirl(particle, design, color, rng, audible);
      return;
    }

    this.spawnStarLayer('outer', particle, design, color, seed, rng, audible);
    this.spawnStarLayer('core', particle, design, color, seed, rng, audible);
  }

  private spawnStarLayer(
    layerKey: StarLayerKey,
    particle: Particle,
    design: FireworkDesign,
    color: THREE.Color,
    seed: 1 | 2 | 3,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const layer = design.stars[layerKey];
    if (!layer.enabled) return;
    const grav = clampStarGravity(rangeRand(layer.burst.gravity, rng));
    const speed = rangeRand(layer.burst.speed, rng);
    const lifeRange = layer.burst.life;
    const count = this.burstParticleCount(design, layer);
    const styleIndex = layerKey === 'core' ? 1 : 0;
    const openingLifeReference = this.starOpeningLifeReference(design, layer);
    const lifeRandomness = this.starLifeRandomness(layer);
    // Stars fly with reduced drag (like brocade) so calibrated burst speeds
    // carry them into a proper sphere instead of stalling early. Rings break
    // in a randomly tilted plane so the halo reads as a 3D hoop.
    const ringTilt =
      design.geometry === 'ring'
        ? (rng.next() - 0.5) * design.geometryTuning.ring.tiltVariation
        : 0;
    const ringSpin = design.geometry === 'ring' ? rng.next() * Math.PI : 0;
    const ringAxisX = new THREE.Vector3(1, 0, 0);
    const ringAxisY = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const velocity = this.burstVelocity(design, i, count, speed, seed, rng);
      if (design.geometry === 'ring') {
        velocity.applyAxisAngle(ringAxisX, ringTilt).applyAxisAngle(ringAxisY, ringSpin);
      }
      const starColor = this.starColor(design, layer, layerKey, color, i, count, rng);
      const life = this.starLife(design, rangeRand(lifeRange, rng), rng, lifeRandomness);
      this.spawnEffectStar({
        design,
        layer,
        styleIndex,
        rng,
        audible,
        x: particle.x,
        y: particle.y,
        z: particle.z,
        vx: velocity.x,
        vy: velocity.y,
        vz: velocity.z,
        color: starColor,
        life,
        gravity: this.starGravity(design, grav, rng),
        drag: this.starDrag(design) * 0.6,
        openingLifeReference,
        trailStarCount: count,
        split: layerKey === 'outer' && design.split.enabled,
      });
    }
  }

  private burstParticleCount(design: FireworkDesign, layer: FireworkStarLayer): number {
    const tuning = design.geometryTuning;
    let countPercent: number;
    switch (design.geometry) {
      case 'radial_arms':
        countPercent = tuning.radialArms.countPercent;
        break;
      case 'falling_tail':
        countPercent = tuning.fallingTail.countPercent;
        break;
      case 'pearls':
        countPercent = tuning.pearls.countPercent;
        break;
      case 'ring':
        countPercent = tuning.ring.countPercent;
        break;
      case 'bowtie':
        countPercent = tuning.bowtie.countPercent;
        break;
      case 'fragment_cloud':
        countPercent = tuning.fragmentCloud.countPercent;
        break;
      default:
        countPercent = 100;
    }
    return Math.max(1, Math.round(layer.count * (countPercent / 100)));
  }

  private burstVelocity(
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
      default: {
        const warble = seed === 2 ? 0.78 + rng.next() * 0.5 : 1;
        return direction.multiplyScalar(speed * warble);
      }
    }
  }

  private starColourPatternColor(
    design: FireworkDesign,
    layer: FireworkStarLayer,
    fallback: THREE.Color,
    index: number,
    count: number,
    rng: RandomSource,
  ): THREE.Color | null {
    const pattern = layer.colourPattern;
    const colours = pattern.colours
      .map((stop) => ({
        color: resolveOptionalColor(stop.color, rng),
        weight: clamp(stop.weight, 0, 100),
      }))
      .filter((stop): stop is { color: THREE.Color; weight: number } => Boolean(stop.color));
    if (colours.length === 0) return null;
    if (pattern.mode === 'solid' || colours.length === 1) return colours[0].color.clone();

    const weightedColourAt = (position: number): THREE.Color => {
      const totalWeight = colours.reduce((sum, stop) => sum + stop.weight, 0);
      if (totalWeight <= 0) return fallback.clone();
      let cursor = clamp(position, 0, 0.999999) * totalWeight;
      for (const stop of colours) {
        cursor -= stop.weight;
        if (cursor <= 0) return stop.color.clone();
      }
      return colours[colours.length - 1].color.clone();
    };

    if (pattern.mode === 'bands') {
      return weightedColourAt(starPatternPosition(design, pattern.axis, index, count));
    }

    if (pattern.mode === 'stripes') {
      return weightedColourAt(starPatternPosition(design, pattern.axis, index, count));
    }

    const totalWeight = colours.reduce((sum, stop) => sum + stop.weight, 0);
    if (totalWeight <= 0) return fallback.clone();
    let cursor = rng.next() * totalWeight;
    for (const stop of colours) {
      cursor -= stop.weight;
      if (cursor <= 0) return stop.color.clone();
    }
    return colours[colours.length - 1].color.clone();
  }

  private starColor(
    design: FireworkDesign,
    layer: FireworkStarLayer,
    layerKey: StarLayerKey,
    color: THREE.Color,
    index: number,
    count: number,
    rng: RandomSource,
  ): THREE.Color {
    const layerColor = resolveOptionalColor(layer.color, rng);
    if (layerKey === 'core') {
      return (
        layerColor ??
        resolveOptionalColor(design.secondaryColor, rng) ??
        applyColorMix(color, HOT_SPARK_COLOR, 0.55)
      );
    }
    const baseColor = layerColor ?? color;
    const patternedColor = this.starColourPatternColor(design, layer, baseColor, index, count, rng);
    if (patternedColor) return patternedColor;
    const secondary = resolveOptionalColor(design.secondaryColor, rng);
    if (!secondary) return baseColor;
    if (design.trailProfile === 'blink' || design.pattern === 'strobe') {
      return rng.next() > 0.62 ? secondary : baseColor;
    }
    if (design.geometry === 'pearls') return index % 2 === 0 ? baseColor : secondary;
    // `secondaryColorRatio` is the fraction of stars that take the accent
    // colour. Defaults to 0.22 so existing shows render identically.
    const accentRatio = clamp(design.secondaryColorRatio ?? 0.22, 0, 1);
    return rng.next() > 1 - accentRatio ? secondary : baseColor;
  }

  private starLife(
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
          (tuning.weeping.lifePercent / 100 + this.starLifeJitter(rng, randomness) * 0.35)
        );
      case 'falling_tail':
        return (
          baseLife *
          (tuning.fallingTail.lifePercent / 100 + this.starLifeJitter(rng, randomness) * 0.35)
        );
      case 'waterfall':
        return (
          baseLife *
          (tuning.waterfall.lifePercent / 100 + this.starLifeJitter(rng, randomness) * 0.35)
        );
      case 'pearls':
        return baseLife * (tuning.pearls.lifePercent / 100);
      case 'ring':
        return baseLife * (tuning.ring.lifePercent / 100);
      default:
        return baseLife;
    }
  }

  private starLifeJitter(rng: RandomSource, randomness: number): number {
    const amount = clamp(randomness, 0, 1);
    if (amount <= 0) return 0.5;
    return 0.5 + (rng.next() - 0.5) * amount;
  }

  private starLifeRandomness(layer: FireworkStarLayer): number {
    const [a, b] = layer.burst.life;
    const halfWidth = Math.abs(a - b) / 2;
    return clamp(halfWidth / STAR_LIFE_RANDOMNESS_REFERENCE_SECONDS, 0, 1);
  }

  private starOpeningLifeReference(design: FireworkDesign, layer: FireworkStarLayer): number {
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

  private starGravity(design: FireworkDesign, gravity: number, rng: RandomSource): number {
    const tuning = design.geometryTuning;
    switch (design.geometry) {
      case 'weeping':
        return clamp(gravity * (tuning.weeping.gravityPercent / 100), MIN_STAR_GRAVITY, -0.08);
      case 'falling_tail':
      case 'waterfall':
        return clamp(gravity * (tuning.fallingTail.gravityPercent / 100), MIN_STAR_GRAVITY, -0.05);
      case 'pearls':
        return clamp(gravity * (tuning.pearls.gravityPercent / 100), MIN_STAR_GRAVITY, -0.18);
      default:
        return gravity + (rng.next() - 0.5) * 0.035;
    }
  }

  private starDrag(design: FireworkDesign): number {
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

  /**
   * Generalised star spawner shared by every non-brocade effect.
   *
   * Each enabled star layer owns its visible heads and optional trail particles.
   * There is no visible point-spark fallback.
   */
  private spawnEffectStar(o: {
    design: FireworkDesign;
    layer?: FireworkStarLayer;
    styleIndex?: number;
    rng: RandomSource;
    audible: boolean;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    color: THREE.Color;
    life: number;
    gravity: number;
    drag: number;
    /** Scales the head size budget for split fragments and comet finishes. */
    headSizeScale?: number;
    /** Scales streak-square life (split fragments, comet finishes). */
    trailLifeScale?: number;
    /** Shared layer life used so opening colour and size animate uniformly. */
    openingLifeReference?: number;
    /** Number of sibling star paths sharing the hidden burst-trail safety cap. */
    trailStarCount?: number;
    /** Attach the crossette split condition to this star. */
    split?: boolean;
    /** Force the trail off regardless of the design. */
    noTrail?: boolean;
    /** Extra per-frame behaviour (fish wiggle, whirl spiral). */
    extraEffect?: (p: Particle, dt: number, t: number) => void;
  }): void {
    const design = o.design;
    const layer = o.layer ?? design.stars.outer;
    const rng = o.rng;
    const color = o.color;
    if (!layer.enabled) return;
    const trailBudget = o.noTrail ? 0 : burstTrailParticlesPerStar(layer.burstTrail);
    const trailsVisible = trailBudget > 0;

    const glow = clamp(layer.head.glowStrength, 0, 3);
    const headShape = headShapeValue(glow, o.styleIndex ?? 0);
    const particleShape = layer.head.visible === false ? HIDDEN_PARTICLE_SHAPE : headShape;
    const sizeBudget = Math.max(40, layer.head.size * (o.headSizeScale ?? 1));
    const wantsSplit = o.split === true;
    const splitDelay = o.life * design.split.delayRatio;
    const palette = streakTrailPalette(layer.burstTrail, color);
    const trailLifeScale = o.trailLifeScale ?? 1;
    const secondary = resolveOptionalColor(design.secondaryColor, rng);
    const pathEstimate =
      Math.sqrt(o.vx * o.vx + o.vy * o.vy + o.vz * o.vz) * Math.max(0.1, o.life) * 100;
    const trailStep = trailsVisible ? clamp(pathEstimate / Math.max(1, trailBudget), 1, 42) : 42;
    const openingLifeReference = Math.max(
      0.1,
      o.openingLifeReference ?? this.starOpeningLifeReference(design, layer),
    );
    const initialOpeningColor = starOpeningColor(layer.head, color, 0, openingLifeReference);
    const initialColor = starClosingColor(layer.head, initialOpeningColor, o.life, o.life);
    const initialOpeningSize = starOpeningSize(layer.head, sizeBudget, 0, openingLifeReference);
    const initialClosingSize = starClosingSize(layer.head, sizeBudget, o.life, o.life);
    const initialSize = Math.min(initialOpeningSize, initialClosingSize);
    const initialAlpha = starClosingOpacity(layer.head, o.life, o.life);

    // Streak emission state, captured per star: deterministic distance credit
    // spaces particles along the path, while bias weights decide where along
    // that path more of the budget lands.
    let lastX = o.x;
    let lastY = o.y;
    let lastZ = o.z;
    let trailParticles = 0;
    let trailDistanceCredit = trailsVisible ? rng.next() * trailStep : 0;
    const emitStreak = trailsVisible
      ? (p: Particle, dt: number) => {
          if (trailParticles >= trailBudget) return;
          const startX = lastX;
          const startY = lastY;
          const startZ = lastZ;
          const dx = p.x - lastX;
          const dy = p.y - lastY;
          const dz = p.z - lastZ;
          const segment = Math.sqrt(dx * dx + dy * dy + dz * dz);
          lastX = p.x;
          lastY = p.y;
          lastZ = p.z;
          if (segment <= 0.0001) return;
          const headAge = p.maxLife > 0 ? 1 - clamp(p.life / p.maxLife, 0, 1) : 1;
          trailDistanceCredit += segment;
          const emissionCount = Math.min(
            BROCADE_MAX_TRAIL_EMISSIONS_PER_STEP,
            Math.max(0, Math.floor(trailDistanceCredit / trailStep)),
          );
          if (emissionCount <= 0) return;
          trailDistanceCredit -= emissionCount * trailStep;
          for (let emitted = 0; emitted < emissionCount; emitted++) {
            const progress = burstTrailSegmentProgress(
              emitted,
              emissionCount,
              layer.burstTrail.spacing.jitterPercent,
              rng,
            );
            const sampleX = startX + dx * progress;
            const sampleY = startY + dy * progress;
            const sampleZ = startZ + dz * progress;
            const maxLife = Math.max(0.001, p.maxLife);
            const sampleAge = burstTrailBalancedAge(
              layer.burstTrail,
              Math.max(0, headAge - ((1 - progress) * dt) / maxLife),
            );
            const spreadPositionPercent = progress * 100;
            const initialDistanceBehindHead = segment * (1 - progress);
            trailParticles += this.emitBurstTrailParticle(
              sampleX,
              sampleY,
              sampleZ,
              sampleAge,
              spreadPositionPercent,
              initialDistanceBehindHead,
              (1 - progress) * dt,
              maxLife,
              Math.max(0, p.life),
              p.vx,
              p.vy,
              p.vz,
              layer.burstTrail,
              palette.hot,
              palette.cool,
              trailLifeScale,
              trailStep,
              trailBudget - trailParticles,
              rng,
            );
            if (trailParticles >= trailBudget) return;
          }
        }
      : null;

    this.pp.new({
      x: o.x,
      y: o.y,
      z: o.z,
      size: initialSize,
      alpha: initialAlpha,
      mass: 0.0005,
      shape: particleShape,
      gravity: o.gravity,
      drag: o.drag,
      vx: o.vx,
      vy: o.vy,
      vz: o.vz,
      r: initialColor.r,
      g: initialColor.g,
      b: initialColor.b,
      h: rng.next(),
      s: rng.next(),
      l: rng.next(),
      life: o.life,
      // Stars hold their size for their whole life and glow out via the
      // renderer's burn-out fade.
      decay: 3 + rng.next() * 3,
      condition: wantsSplit ? (p) => p.maxLife - p.life >= splitDelay : undefined,
      action: wantsSplit
        ? (p, dt, t) => this.splitCrossette(p, dt, t, design, color, rng, o.audible)
        : undefined,
      effect: (p, dt, t) => {
        o.extraEffect?.(p, dt, t);
        const died = this.starBehaviour(
          p,
          dt,
          t,
          layer,
          color,
          secondary,
          design,
          rng,
          o.audible,
          sizeBudget,
          openingLifeReference,
        );
        if (died) return;
        emitStreak?.(p, dt);
      },
    });
  }

  /**
   * Shared per-frame star behaviour: secondary colour shift with age, strobe
   * blink, and crackle pops. Returns true when the star crackled and died.
   */
  private starBehaviour(
    particle: Particle,
    dt: number,
    time: number,
    layer: FireworkStarLayer,
    color: THREE.Color,
    secondary: THREE.Color | null,
    design: FireworkDesign,
    rng: RandomSource,
    audible: boolean,
    sizeBudget: number,
    openingLifeReference: number,
  ): boolean {
    const ageRatio = particle.maxLife > 0 ? 1 - clamp(particle.life / particle.maxLife, 0, 1) : 0;
    const elapsedSeconds = particle.maxLife > 0 ? Math.max(0, particle.maxLife - particle.life) : 0;
    const closingLifeReference = Math.max(0.1, particle.maxLife);
    let targetColor = color;
    if (
      secondary &&
      !layer.head.closing.colour.enabled &&
      particle.maxLife > 0 &&
      design.trailProfile !== 'blink' &&
      ageRatio > 0.42
    ) {
      targetColor = applyColorMix(color, secondary, (ageRatio - 0.42) / 0.45);
    }

    if (
      layer.head.opening.colour.enabled ||
      layer.head.closing.colour.enabled ||
      targetColor !== color
    ) {
      const openingColor = starOpeningColor(
        layer.head,
        targetColor,
        elapsedSeconds,
        openingLifeReference,
      );
      const visibleColor = starClosingColor(
        layer.head,
        openingColor,
        particle.life,
        closingLifeReference,
      );
      particle.color.setRGB(visibleColor.r, visibleColor.g, visibleColor.b);
    }

    const openingSize = starOpeningSize(
      layer.head,
      sizeBudget,
      elapsedSeconds,
      openingLifeReference,
    );
    const closingSize = starClosingSize(
      layer.head,
      sizeBudget,
      particle.life,
      closingLifeReference,
    );
    const dynamicSize = Math.min(openingSize, closingSize);
    if (layer.head.opening.size.enabled || layer.head.closing.size.enabled) {
      particle.size = dynamicSize;
    }
    particle.alpha = starClosingOpacity(layer.head, particle.life, closingLifeReference);

    if (design.strobe.enabled) {
      // Golden-ratio hash of the star index gives a stable, evenly spread
      // subset when only a percentage of stars should strobe.
      const amount = clamp(design.strobe.amountPercent / 100, 0, 1);
      const affected = amount >= 1 || (particle.i * 0.6180339887) % 1 < amount;
      if (affected) {
        const phase = (time * design.strobe.frequencyHz + particle.i * design.strobe.desync) % 1;
        const lit = phase < design.strobe.dutyCycle;
        const litSize =
          layer.head.opening.size.enabled || layer.head.closing.size.enabled
            ? dynamicSize
            : sizeBudget;
        particle.size = lit
          ? Math.max(particle.size, litSize)
          : litSize * (design.strobe.dimPercent / 100);
      }
    }

    if (design.crackle.enabled && particle.life < 1.0 && rng.next() < design.crackle.probability) {
      this.crackleEffect(particle, dt, time, design, color, rng, audible);
      particle.reset();
      return true;
    }
    return false;
  }

  /**
   * Shared unified burst-trail emitter. It samples the editable trail endpoints
   * from old tail-end (0%) to fresh head-end (100%). The per-star budget is
   * spent by travelled distance; head/tail balance changes placement, not count.
   */
  private emitBurstTrailParticle(
    x: number,
    y: number,
    z: number,
    headAge: number,
    spreadPositionPercent: number,
    initialDistanceBehindHead: number,
    ageOffset: number,
    headLifeReference: number,
    headRemainingLife: number,
    headVx: number,
    headVy: number,
    headVz: number,
    trail: BurstTrail,
    hot: THREE.Color,
    cool: THREE.Color,
    trailLifeScale: number,
    averageGap: number,
    maxRemaining: number,
    rng: RandomSource,
  ): number {
    if (maxRemaining <= 0) return 0;
    const pathAge = clamp(headAge, 0, 1);
    const pathPosition = pathAge * 100;
    const stop = sampleBurstTrailStop(trail, pathPosition);
    if (!stop || stop.density <= 0) return 0;
    const lifeScale = trailLifeScale;
    const motion = trail.motion;
    const shape = chooseBurstTrailShape(stop.shapeWeights, rng);
    const flicker = rng.next() < trail.flicker.chance;
    const flickerMix = flicker ? clamp(trail.flicker.strength / 3, 0, 1) : 0;
    const sizeVariation = 1 + (rng.next() * 2 - 1) * (trail.particleSize.variationPercent / 100);
    const pixelBase =
      (11 + rng.next() * 9) *
      trail.particleSize.base *
      Math.max(0.08, sizeVariation) *
      (flicker ? 1.18 : 1);
    const headSize = pixelBase * trail.particleSize.headScale;
    const tailSize = pixelBase * trail.particleSize.tailScale;
    const lifeVariation = trail.lifetime.variationPercent / 100;
    const lifeJitter = 1 + (rng.next() * 2 - 1) * lifeVariation;
    const lifeMultiplier = clamp(trail.lifetime.percent, 0, 2);
    const life =
      Math.max(0, headRemainingLife) *
      lifeMultiplier *
      Math.max(0.05, lifeJitter) *
      lifeScale *
      (flicker ? trail.flicker.lifetimeMultiplier : 1);
    if (life <= 0.015) return 0;
    const agedLife = life - ageOffset;
    if (agedLife <= 0.015) return 0;
    const age = clamp(ageOffset / life, 0, 1);
    const closingLifeReference = Math.max(0.01, headLifeReference);
    const closingElapsedSeconds = Math.max(0, ageOffset);
    const initialSpreadPosition = clamp(spreadPositionPercent, 0, 100);
    const initialFadePosition = pathPosition;
    const inherited = motion.inheritedVelocity;
    const turbulence = motion.turbulence;
    const headSpeed = Math.sqrt(headVx * headVx + headVy * headVy + headVz * headVz);
    const relativeHeadSpeed = headSpeed * clamp(1 - inherited, 0, 1);
    const visibleTrailLength = Math.max(initialDistanceBehindHead, life * relativeHeadSpeed * 100);
    const spreadVector = burstTrailScatterVector(headVx, headVy, headVz, rng);
    const initialSpread = scaleTrailScatter(
      spreadVector,
      burstTrailSpreadRadius(
        trail,
        initialSpreadPosition,
        initialDistanceBehindHead,
        visibleTrailLength,
      ),
    );
    let currentSpreadX = initialSpread.x;
    let currentSpreadY = initialSpread.y;
    let currentSpreadZ = initialSpread.z;
    const visibleFraction = burstTrailOpeningParticleVisibility(pathAge, trail);
    if (visibleFraction < 1 && rng.next() > visibleFraction) return 0;
    const agedSize = burstTrailParticleSizeAt(age, headSize, tailSize);
    const visibleSize = burstTrailLifecycleSizeAt(
      pathAge,
      closingElapsedSeconds,
      closingLifeReference,
      agedSize,
      trail,
    );
    const tone = burstTrailParticleColorAt(
      age,
      pathAge,
      hot,
      cool,
      trail.intensity.brightness,
      trail.intensity.fadeSoftness,
      flickerMix,
      trail,
      closingElapsedSeconds,
      closingLifeReference,
    );
    const headGap = burstTrailHeadGapOffset(
      headVx,
      headVy,
      headVz,
      averageGap,
      trail.placement.headGapPercent,
    );
    const spreadBirthAge = age;
    const spin = clamp(motion.spin, 0, 8);
    const initialAlpha = burstTrailWideTailAlpha(trail, initialFadePosition);
    const particle = this.pp.new({
      x: x + headGap.x + currentSpreadX,
      y: y + headGap.y + currentSpreadY,
      z: z + headGap.z + currentSpreadZ,
      mass: 0.002,
      gravity: motion.gravity,
      drag: motion.drag,
      size: visibleSize,
      shape: burstTrailShapeValue(shape),
      alpha: initialAlpha,
      fadeIn: false,
      rotation: spin > 0 ? rng.next() * Math.PI * 2 : 0,
      spin: spin > 0 ? (rng.next() - 0.5) * spin * 2 : 0,
      vx: headVx * inherited + motion.driftX + (rng.next() - 0.5) * turbulence,
      vy: headVy * inherited + motion.driftY + (rng.next() - 0.5) * turbulence,
      vz: headVz * inherited + motion.driftZ + (rng.next() - 0.5) * turbulence,
      r: tone.r,
      g: tone.g,
      b: tone.b,
      h: 1.0,
      s: 0.5,
      l: 0.0,
      life: agedLife,
      decay: 0,
      effect: (p) => {
        const particleAge = p.maxLife > 0 ? 1 - clamp(p.life / p.maxLife, 0, 1) : 1;
        const spreadProgress = clamp(
          (particleAge - spreadBirthAge) / Math.max(0.001, 1 - spreadBirthAge),
          0,
          1,
        );
        const spreadPosition = initialSpreadPosition * (1 - spreadProgress);
        const fadePosition = initialFadePosition * (1 - spreadProgress);
        p.alpha = burstTrailWideTailAlpha(trail, fadePosition);
        const elapsedSinceBirth = Math.max(0, particleAge - spreadBirthAge) * life;
        const distanceBehindHead =
          initialDistanceBehindHead + elapsedSinceBirth * relativeHeadSpeed * 100;
        const nextSpread = scaleTrailScatter(
          spreadVector,
          burstTrailSpreadRadius(trail, spreadPosition, distanceBehindHead, visibleTrailLength),
        );
        p.x += nextSpread.x - currentSpreadX;
        p.y += nextSpread.y - currentSpreadY;
        p.z += nextSpread.z - currentSpreadZ;
        currentSpreadX = nextSpread.x;
        currentSpreadY = nextSpread.y;
        currentSpreadZ = nextSpread.z;
        const nextTone = burstTrailParticleColorAt(
          particleAge,
          pathAge,
          hot,
          cool,
          trail.intensity.brightness,
          trail.intensity.fadeSoftness,
          flickerMix,
          trail,
          Math.max(0, particleAge * life),
          closingLifeReference,
        );
        p.color.setRGB(nextTone.r, nextTone.g, nextTone.b);
        p.size = burstTrailParticleSizeAt(particleAge, headSize, tailSize);
        p.size = burstTrailLifecycleSizeAt(
          pathAge,
          Math.max(0, particleAge * life),
          closingLifeReference,
          p.size,
          trail,
        );
      },
    });
    particle.maxLife = life;
    return 1;
  }

  /**
   * Brocade crown burst: up to {@link BROCADE_MAX_STREAKS} stars with green or
   * red circular heads. Each head lays down square trail particles along its
   * own trajectory via distance-based emission (see the per-star effect
   * closure), so the trail reads as one clean streak rather than a
   * probabilistic spray. All tuning (streak count, trail spacing, head
   * size/glow, colours) comes from `design.brocade` so the admin effects page
   * can calibrate it live.
   */
  private spawnBrocadeBurst(particle: Particle, design: FireworkDesign, rng: RandomSource): void {
    const brocade = design.brocade;

    const originX = particle.x;
    const originY = particle.y;
    const originZ = particle.z;
    const count = clamp(Math.round(brocade.streakCount ?? design.size), 1, BROCADE_MAX_STREAKS);
    const burstSpeed = rangeRand(design.burst.speed, rng);
    const brocadeTrail = design.burstTrail;
    const trailBudget = burstTrailParticlesPerStar(brocadeTrail);
    const trailsEnabled = trailBudget > 0;
    const headsEnabled = brocade.headsEnabled;
    const maxEmissionsPerStep = BROCADE_MAX_TRAIL_EMISSIONS_PER_STEP;
    const glow = clamp(brocade.glowStrength, 0, 3);
    const headShape = headShapeValue(glow, 0);
    const headGreen = new THREE.Color(
      brocade.headColors.green.r,
      brocade.headColors.green.g,
      brocade.headColors.green.b,
    );
    const headRed = new THREE.Color(
      brocade.headColors.red.r,
      brocade.headColors.red.g,
      brocade.headColors.red.b,
    );

    // Scene light bleed: the burst tints the ground with the aggregate head
    // colour. The lead head sustains the tint each frame so it decays only as
    // the heads themselves fade.
    const hemiTint = applyColorMix(headRed, headGreen, clamp(brocade.greenRatio, 0, 1));
    // Sub-linear glow response: at maximum glow the scene light should lift,
    // not wash the whole frame out.
    const hemiGlow = Math.sqrt(glow);
    // The hemisphere tint is the heads' glow bleeding onto the ground, so it
    // only runs while the heads are actually rendered.
    if (headsEnabled) this.lights.setHemi(1 + hemiGlow * 0.7, 1, 0.45, 0.16);
    const sustainHemi = (p: Particle) => {
      const lifeRatio = p.maxLife > 0 ? clamp(p.life / p.maxLife, 0, 1) : 0;
      const intensity = 0.5 + 0.8 * hemiGlow * lifeRatio;
      this.lights.setHemi(intensity, hemiTint.r, hemiTint.g, hemiTint.b);
    };

    for (let i = 0; i < count; i++) {
      // Fibonacci-sphere distribution: evenly spaced directions for any star
      // count, so more stars always means a fuller sphere with no clumping.
      // A small seeded jitter stops it reading as a perfect lattice.
      const direction = fibonacciDirection(i, count);
      const jx = direction.x + (rng.next() - 0.5) * 0.14;
      const jy = direction.y + (rng.next() - 0.5) * 0.14;
      const jz = direction.z + (rng.next() - 0.5) * 0.14;
      const norm = Math.sqrt(jx * jx + jy * jy + jz * jz) || 1;
      // Very tight speed band keeps the expanding shell spherical as burst
      // size scales up; angular jitter already provides the organic variation.
      const speed = burstSpeed * (0.985 + rng.next() * 0.03);
      const headColor = rng.next() < brocade.greenRatio ? headGreen : headRed;
      const headGravity = clamp(
        rangeRand(design.burst.gravity, rng),
        MIN_STAR_GRAVITY,
        BROCADE_MAX_HEAD_GRAVITY,
      );
      // Lower drag + faster burst speed roughly doubles the travel distance,
      // so the burst reads as a proper sphere from far away too.
      const headDrag = STAR_DRAG * 0.42;
      const headLife = rangeRand(design.burst.life, rng);
      const vx = (jx / norm) * speed;
      const vy = (jy / norm) * speed;
      const vz = (jz / norm) * speed;
      const pathEstimate = Math.sqrt(vx * vx + vy * vy + vz * vz) * Math.max(0.1, headLife) * 100;
      const trailStep = trailsEnabled ? clamp(pathEstimate / Math.max(1, trailBudget), 1, 42) : 42;

      // Trail emission state, captured per star: particles are spaced by
      // travelled distance with deterministic jitter, not clumped per frame.
      let lastX = originX;
      let lastY = originY;
      let lastZ = originZ;
      let trailParticles = 0;
      let trailDistanceCredit = trailsEnabled ? rng.next() * trailStep : 0;

      const emitTrail = trailsEnabled
        ? (p: Particle, dt: number) => {
            if (trailParticles >= trailBudget) return;
            const startX = lastX;
            const startY = lastY;
            const startZ = lastZ;
            const dx = p.x - lastX;
            const dy = p.y - lastY;
            const dz = p.z - lastZ;
            const segment = Math.sqrt(dx * dx + dy * dy + dz * dz);
            lastX = p.x;
            lastY = p.y;
            lastZ = p.z;
            if (segment <= 0.0001) return;
            const headAge = p.maxLife > 0 ? 1 - clamp(p.life / p.maxLife, 0, 1) : 1;
            trailDistanceCredit += segment;
            const emissionCount = Math.min(
              maxEmissionsPerStep,
              Math.max(0, Math.floor(trailDistanceCredit / trailStep)),
            );
            if (emissionCount <= 0) return;
            trailDistanceCredit -= emissionCount * trailStep;
            for (let emitted = 0; emitted < emissionCount; emitted++) {
              const progress = burstTrailSegmentProgress(
                emitted,
                emissionCount,
                brocadeTrail.spacing.jitterPercent,
                rng,
              );
              const sampleX = startX + dx * progress;
              const sampleY = startY + dy * progress;
              const sampleZ = startZ + dz * progress;
              // No squares right at the burst centre: the real heads own
              // that moment, and the hot trail material should read as being
              // shot outward instead of stacking into a white blob.
              const ox = sampleX - originX;
              const oy = sampleY - originY;
              const oz = sampleZ - originZ;
              if (ox * ox + oy * oy + oz * oz > 50 * 50) {
                const maxLife = Math.max(0.001, p.maxLife);
                const sampleAge = burstTrailBalancedAge(
                  brocadeTrail,
                  Math.max(0, headAge - ((1 - progress) * dt) / maxLife),
                );
                const spreadPositionPercent = progress * 100;
                const initialDistanceBehindHead = segment * (1 - progress);
                trailParticles += this.emitBurstTrailParticle(
                  sampleX,
                  sampleY,
                  sampleZ,
                  sampleAge,
                  spreadPositionPercent,
                  initialDistanceBehindHead,
                  (1 - progress) * dt,
                  maxLife,
                  Math.max(0, p.life),
                  p.vx,
                  p.vy,
                  p.vz,
                  brocadeTrail,
                  new THREE.Color(
                    brocade.palette.hot.r,
                    brocade.palette.hot.g,
                    brocade.palette.hot.b,
                  ),
                  new THREE.Color(
                    brocade.palette.ember.r,
                    brocade.palette.ember.g,
                    brocade.palette.ember.b,
                  ),
                  1,
                  trailStep,
                  trailBudget - trailParticles,
                  rng,
                );
              }
              if (trailParticles >= trailBudget) return;
            }
          }
        : null;
      // The lead head owns the sustained hemisphere tint; one writer per
      // burst avoids per-frame fighting between heads.
      const lead = headsEnabled && i === 0;

      // Single head particle. shape >= 2 renders core + glow in one sprite (a
      // separate glow companion drifted apart because quadratic drag depends
      // on mass), and the small mass selects the large glow size class.
      // With heads disabled the particle still flies and emits its trail,
      // but shape -1 tells the renderer to skip drawing it. Size must stay
      // positive: particles die the moment their size decays to zero.
      this.pp.new({
        x: originX,
        y: originY,
        z: originZ,
        size: brocade.headSize,
        mass: 0.0005,
        shape: headsEnabled ? headShape : HIDDEN_PARTICLE_SHAPE,
        gravity: headGravity,
        drag: headDrag,
        vx,
        vy,
        vz,
        r: headColor.r,
        g: headColor.g,
        b: headColor.b,
        h: rng.next(),
        s: rng.next(),
        l: rng.next(),
        life: headLife,
        // Heads hold their size for their whole life; the burn-out fade is
        // handled by the renderer so they glow out instead of shrinking away.
        decay: 3 + rng.next() * 3,
        effect:
          lead || emitTrail
            ? (p, dt) => {
                if (lead) sustainHemi(p);
                emitTrail?.(p, dt);
              }
            : undefined,
      });
    }
  }

  private splitCrossette(
    particle: Particle,
    _dt: number,
    _time: number,
    design: FireworkDesign,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
  ): void {
    if (audible && rng.next() < 0.18) this.sh.playRandomCrackle(0.08, rng);
    const fragments = design.split.fragments;
    const baseAngle = rng.next() * Math.PI;
    for (let i = 0; i < fragments; i++) {
      const angle = baseAngle + (i / fragments) * Math.PI * 2;
      const upward = (i % 2 === 0 ? 0.28 : -0.08) + (rng.next() - 0.5) * 0.18;
      this.spawnEffectStar({
        design,
        rng,
        audible,
        x: particle.x,
        y: particle.y,
        z: particle.z,
        vx: particle.vx * 0.22 + Math.cos(angle) * design.split.speed,
        vy: particle.vy * 0.1 + upward * design.split.speed,
        vz: particle.vz * 0.22 + Math.sin(angle) * design.split.speed,
        color,
        life: design.split.lifeBaseSeconds + rng.next() * design.split.lifeVariationSeconds,
        gravity: clampStarGravity(rangeRand(design.burst.gravity, rng) * 0.82),
        drag: STAR_DRAG * 0.92 * 0.7,
        headSizeScale: design.split.headSizePercent / 100,
        trailLifeScale: design.split.trailLifePercent / 100,
        trailStarCount: fragments,
      });
    }
  }

  private cometFinish(
    particle: Particle,
    design: FireworkDesign,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
  ): void {
    // Comets are single ascending tailed stars. The detonation should read as
    // one bright head continuing along the trail, not a radial ring of blobs.
    const shape = design.geometryTuning.singleTail;
    const inherit = shape.inheritPercent / 100;
    const speed = rangeRand(design.burst.speed, rng);
    const drift = speed * (shape.driftPercent / 100);
    this.spawnEffectStar({
      design,
      rng,
      audible,
      x: particle.x,
      y: particle.y,
      z: particle.z,
      vx: particle.vx * inherit + rangeRand([-drift, drift], rng),
      vy: Math.max(speed * shape.riseFactor, particle.vy * 0.55 + speed * shape.pushFactor),
      vz: particle.vz * inherit + rangeRand([-drift, drift], rng),
      color,
      life: rangeRand(design.burst.life, rng) * (shape.lifePercent / 100),
      gravity: clampStarGravity(rangeRand(design.burst.gravity, rng)),
      drag: STAR_DRAG,
      headSizeScale: shape.headSizePercent / 100,
      trailLifeScale: shape.trailLifePercent / 100,
      trailStarCount: 1,
    });
  }

  private spawnFishSwarm(
    particle: Particle,
    design: FireworkDesign,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const shape = design.geometryTuning.fish;
    const count = Math.max(1, Math.round(design.size * (shape.countPercent / 100)));
    for (let i = 0; i < count; i++) {
      const direction = fibonacciDirection(i, count).multiplyScalar(
        rangeRand(design.burst.speed, rng),
      );
      const phase = rng.next() * Math.PI * 2;
      this.spawnEffectStar({
        design,
        rng,
        audible,
        x: particle.x,
        y: particle.y,
        z: particle.z,
        vx: direction.x,
        vy: direction.y * shape.verticalScale,
        vz: direction.z,
        color,
        life: shape.lifeBaseSeconds + rng.next() * shape.lifeVariationSeconds,
        gravity: clampStarGravity(
          rangeRand(design.burst.gravity, rng) * (shape.gravityPercent / 100),
        ),
        drag: STAR_DRAG * (shape.dragPercent / 100),
        headSizeScale: shape.headSizePercent / 100,
        trailLifeScale: shape.trailLifePercent / 100,
        trailStarCount: count,
        // Darting fish wiggle: small per-frame swimming forces.
        extraEffect: (p, dt, t) => {
          p.vx += Math.cos(t * shape.wiggleRate + phase) * dt * shape.wiggleStrength;
          p.vz += Math.sin(t * shape.wiggleRateCross + phase) * dt * shape.wiggleStrength;
        },
      });
    }
  }

  private spawnWaterfall(
    particle: Particle,
    design: FireworkDesign,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const shape = design.geometryTuning.waterfall;
    const count = Math.max(1, Math.round(design.size * (shape.countPercent / 100)));
    for (let i = 0; i < count; i++) {
      const curtain = (i / count - 0.5) * design.size * shape.curtainWidth;
      this.spawnEffectStar({
        design,
        rng,
        audible,
        x: particle.x + curtain + (rng.next() - 0.5) * shape.scatterX,
        y: particle.y - rng.next() * shape.dropStart,
        z: particle.z + (rng.next() - 0.5) * shape.scatterZ,
        vx: (rng.next() - 0.5) * shape.sideDrift,
        vy: -shape.fallSpeed - rng.next() * shape.fallSpeedVariation,
        vz: (rng.next() - 0.5) * shape.depthDrift,
        color,
        life: rangeRand(design.burst.life, rng) * (shape.lifePercent / 100),
        gravity: shape.gravityBase - rng.next() * shape.gravityVariation,
        drag: STAR_DRAG * (shape.dragPercent / 100),
        headSizeScale: shape.headSizePercent / 100,
        trailStarCount: count,
      });
    }
  }

  private spawnWhirl(
    particle: Particle,
    design: FireworkDesign,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const shape = design.geometryTuning.whirl;
    const count = Math.max(shape.minCount, Math.round(design.size * (shape.countPercent / 100)));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const phase = rng.next() * Math.PI * 2;
      this.spawnEffectStar({
        design,
        rng,
        audible,
        x: particle.x,
        y: particle.y,
        z: particle.z,
        vx: Math.cos(angle) * rangeRand(design.burst.speed, rng),
        vy: (rng.next() + shape.verticalBias) * rangeRand(design.burst.speed, rng),
        vz: Math.sin(angle) * rangeRand(design.burst.speed, rng),
        color,
        life: shape.lifeBaseSeconds + rng.next() * shape.lifeVariationSeconds,
        gravity: clampStarGravity(
          rangeRand(design.burst.gravity, rng) * (shape.gravityPercent / 100),
        ),
        drag: STAR_DRAG * (shape.dragPercent / 100),
        headSizeScale: shape.headSizePercent / 100,
        trailLifeScale: shape.trailLifePercent / 100,
        trailStarCount: count,
        // Spinning shower: spiral forces give the whirl its corkscrew arms.
        extraEffect: (p, dt, t) => {
          p.vx += Math.cos(t * shape.spinRate + phase) * dt * shape.spinStrength;
          p.vz += Math.sin(t * shape.spinRate + phase) * dt * shape.spinStrength;
        },
      });
    }
  }

  private crackleEffect(
    particle: Particle,
    _dt: number,
    _time: number,
    design: FireworkDesign,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
  ): void {
    if (audible && rng.next() < 0.2) {
      switch (design.crackle.sound) {
        case 'lightBoom':
          this.sh.playRandomLightBoom(0.1, rng);
          break;
        case 'heavyBoom':
          this.sh.playRandomHeavyBoom(0.1, rng);
          break;
        default:
          this.sh.playRandomCrackle(0.1, rng);
      }
    }
    const colored = design.crackle.sound === 'heavyBoom';
    const r = colored ? Math.min(1, color.r * 2) : Math.max(color.r, 0.75);
    const g = colored ? Math.min(1, color.g * 2) : Math.max(color.g, 0.68);
    const b = colored ? color.b : Math.max(color.b, 0.45);
    const count = 8 + Math.floor(rng.next() * 80);
    for (let i = 0; i < count; i++) {
      this.pp.new({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        size: rng.next() * 45,
        mass: 0.02,
        gravity: -0.2,
        r,
        g,
        b,
        h: rng.next(),
        s: rng.next(),
        l: rng.next(),
        vy: 1 - rng.next() * 2,
        vx: 1 - rng.next() * 2,
        vz: 1 - rng.next() * 2,
        life: 0.1 + rng.next() * 1.2,
        decay: rng.next() * 50,
      });
    }
  }
}
