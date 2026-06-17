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
const BROCADE_MAX_STREAKS = 64;
const BROCADE_MAX_TRAIL_EMISSIONS_PER_STEP = 32;
const BURST_TRAIL_SPREAD_SCALE = 0.035;
const BURST_TRAIL_MAX_SPREAD = 90;
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

function starOpeningProgress(ageRatio: number, percent: number): number {
  const duration = clamp(percent / 100, 0.01, 1);
  const linear = clamp(ageRatio / duration, 0, 1);
  return linear * linear * (3 - 2 * linear);
}

function starOpeningColor(
  head: FireworkStarLayer['head'],
  target: THREE.Color,
  ageRatio: number,
): THREE.Color {
  const opening = head.opening.colour;
  if (!opening.enabled) return target;
  const openingColor = new THREE.Color(opening.color.r, opening.color.g, opening.color.b);
  return applyColorMix(openingColor, target, starOpeningProgress(ageRatio, opening.fadePercent));
}

function starOpeningSize(
  head: FireworkStarLayer['head'],
  fullSize: number,
  ageRatio: number,
): number {
  const opening = head.opening.size;
  if (!opening.enabled) return fullSize;
  const start = clamp(opening.startPercent / 100, 0.01, 1);
  const progress = starOpeningProgress(ageRatio, opening.growPercent);
  return fullSize * (start + (1 - start) * progress);
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
): void {
  const strength = clamp(liftParticles.motion.swirlStrength, 0, 4);
  if (strength <= 0) return;

  const rate = clamp(liftParticles.motion.swirlRate, 0, 16);
  const phase = time * rate * Math.PI * 2;
  const force = strength * 0.55;
  particle.vx += Math.cos(phase) * force * dt;
  particle.vz += Math.sin(phase) * force * dt;
}

function liftSwirlOffset(
  liftParticles: LiftParticles,
  age: number,
  time: number,
  progress: number,
): { x: number; z: number } {
  const strength = clamp(liftParticles.motion.swirlStrength, 0, 4);
  const radius = clamp(liftParticles.motion.swirlRadius, 0, 90);
  if (strength <= 0 && radius <= 0) return { x: 0, z: 0 };

  const rate = clamp(liftParticles.motion.swirlRate, 0, 16);
  const phase = time * rate * Math.PI * 2 + progress * Math.PI * 2 + age * rate * Math.PI;
  const visibleRadius = radius * (0.22 + age * 0.78) + strength * 8;
  return {
    x: Math.cos(phase) * visibleRadius,
    z: Math.sin(phase) * visibleRadius,
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
  const age =
    liftParticles.height > 0 ? clamp(base.y / Math.max(1, liftParticles.height), 0, 1) : 1;
  const swirl = liftSwirlOffset(liftParticles, age, time, progress);
  return {
    x: base.x + swirl.x,
    y: base.y,
    z: base.z + swirl.z,
    progress,
    age,
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

function burstTrailSpreadAngle(trail: BurstTrail, positionPercent: number): number {
  const width = trail.width;
  const t = Math.pow(clamp(positionPercent / 100, 0, 1), width.curve);
  return width.front + (width.tail - width.front) * t;
}

function burstTrailSpreadRadius(
  trail: BurstTrail,
  positionPercent: number,
  pathEstimate: number,
): number {
  const angle = clamp(burstTrailSpreadAngle(trail, positionPercent), 0, 60);
  if (angle <= 0 || pathEstimate <= 0) return 0;
  const radius = Math.tan((angle * Math.PI) / 180) * pathEstimate * BURST_TRAIL_SPREAD_SCALE;
  return clamp(radius, 0, BURST_TRAIL_MAX_SPREAD);
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
  return clamp(1 + centred * 1.2, 0.35, 1.85);
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

function burstTrailParticleColorAt(
  age: number,
  hot: THREE.Color,
  cool: THREE.Color,
  brightness: number,
  fadeSoftness: number,
  flickerMix: number,
): { r: number; g: number; b: number } {
  const toneMix = Math.pow(clamp(age, 0, 1), clamp(fadeSoftness, 0.2, 4));
  const baseR = hot.r + (cool.r - hot.r) * toneMix;
  const baseG = hot.g + (cool.g - hot.g) * toneMix;
  const baseB = hot.b + (cool.b - hot.b) * toneMix;
  const sparkle = flickerMix * (1 - toneMix);
  return {
    r: (baseR + (HOT_SPARK_COLOR.r - baseR) * sparkle) * brightness,
    g: (baseG + (HOT_SPARK_COLOR.g - baseG) * sparkle) * brightness,
    b: (baseB + (HOT_SPARK_COLOR.b - baseB) * sparkle) * brightness,
  };
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

function burstTrailScatterOffset(
  headVx: number,
  headVy: number,
  headVz: number,
  radius: number,
  rng: RandomSource,
): { x: number; y: number; z: number } {
  if (radius <= 0) return { x: 0, y: 0, z: 0 };

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
  const distance = Math.sqrt(rng.next()) * radius;
  const cos = Math.cos(theta) * distance;
  const sin = Math.sin(theta) * distance;
  return {
    x: rightX * cos + outX * sin,
    y: rightY * cos + outY * sin,
    z: rightZ * cos + outZ * sin,
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
  constructor(
    private pp: ParticlePool,
    private sh: SoundHandler,
    private lights: Lights,
  ) {}

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

    const size = design.size;
    if (design.geometry === 'upward_fan') {
      this.fireMine(design, position, color, rng, options.audible, smokeRng);
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

    // Star count can be tiny, but the ascending carrier still needs enough
    // size budget to survive its decay until apex and trigger detonation.
    const shellSize = Math.max(size, 110);
    let liftPreviousPosition: Pos | null = null;
    this.pp.new({
      x: position.x,
      y: position.y,
      z: position.z,
      size: shellSize,
      mass: 0.5,
      vy: liftVelocity * Math.max(0.82, Math.cos(panRadians) * 0.96),
      vx: lateralVelocity,
      vz: forwardVelocity,
      h: 0.9,
      s: 0.5,
      l: 0.5,
      r: liftColor.r,
      g: liftColor.g,
      b: liftColor.b,
      life: design.shellLife,
      decay: 10 + rng.next() * 20,
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
          previousPosition,
        );
        liftPreviousPosition = { x: p.x, y: p.y, z: p.z };
      },
      condition: (p) => p.vy <= 0,
      action: (p, dt, t) => this.detonate(p, dt, t, design, color, seed, rng, options.audible),
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
    const count = Math.max(36, Math.round(design.size * 0.9));
    const speed = rangeRand(design.burst.speed, rng);
    const grav = clampStarGravity(rangeRand(design.burst.gravity, rng));
    const layer = design.stars.outer;
    for (let i = 0; i < count; i++) {
      const spread = (rng.next() - 0.5) * Math.PI * 0.92;
      const fan = 0.45 + rng.next() * 0.8;
      const starColor = this.starColor(design, layer, 'outer', color, i, count, rng);
      this.spawnEffectStar({
        design,
        layer,
        rng,
        audible,
        x: position.x + (rng.next() - 0.5) * 34,
        y: position.y + 24 + rng.next() * 22,
        z: position.z + (rng.next() - 0.5) * 34,
        vx: Math.sin(spread) * speed * fan,
        vy: speed * (1.2 + rng.next() * 0.85),
        vz: (rng.next() - 0.5) * speed * 0.45,
        color: starColor,
        life: rangeRand(design.burst.life, rng) * 0.72,
        gravity: grav,
        drag: STAR_DRAG * 0.72 * 0.8,
        headSizeScale: 0.75,
        trailLifeScale: 0.6,
        trailStarCount: count,
      });
    }
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
    previousPosition: Pos | null = null,
  ): void {
    let max = 1;
    let vx = 0;
    let vz = 0;
    const liftParticles = design.launch.liftParticles;
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
        particle.size = rng.next() > 0.5 ? 150 : 10;
        max = 5 + rng.next() * 14;
        vx = 2 - rng.next() * 4;
        vz = 2 - rng.next() * 4;
        break;
    }
    applyLiftSwirlToShell(particle, dt, time, liftParticles);
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
    const liftAge =
      liftParticles.height > 0 ? clamp(particle.y / Math.max(1, liftParticles.height), 0, 1) : 1;
    const liftDensity = liftParticleDensityScale(liftParticles, liftAge);
    const liftDensityJitter =
      1 + (liftRng.next() * 2 - 1) * (liftParticles.spacing.jitterPercent / 100) * 0.25;
    const liftCount =
      liftParticles.enabled && particle.y <= liftParticles.height
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
    const liftJitter = isBrocadeCrown(design)
      ? 2.2
      : clamp(design.stars.outer.burstTrail.width.front * 0.8, 1.2, 6);

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
      );

      for (let i = 0; i < liftParticlesPerSample && liftEmitted < liftCount; i++, liftEmitted++) {
        const brocadeLift = streakLift;
        const liftStreakSize = brocadeLift ? clamp(design.trail.streakSize, 0.4, 4) : 1;
        const liftStreakLife = brocadeLift ? clamp(design.trail.streakLife, 0.2, 4) : 1;
        const spread = liftParticles.spread / 100 + liftRng.next() * (liftParticles.spread / 55);
        const liftSpread = brocadeLift ? 0.035 + liftRng.next() * 0.08 : spread;
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
        const positionJitter = brocadeLift ? liftJitter : clamp(liftParticles.spread * 0.08, 1, 12);
        this.pp.new({
          x: pathPoint.x + (liftRng.next() - 0.5) * positionJitter,
          y:
            pathPoint.y +
            (liftRng.next() - 0.5) * (brocadeLift ? liftJitter * 1.27 : positionJitter * 0.8),
          z: pathPoint.z + (liftRng.next() - 0.5) * positionJitter,
          mass: 0.002,
          gravity: brocadeLift ? TRAIL_GRAVITY * 0.3 : liftParticles.motion.gravity,
          drag: brocadeLift ? TRAIL_DRAG * 1.05 : liftParticles.motion.drag,
          size: sparkHeadSize,
          shape,
          rotation: spin > 0 ? liftRng.next() * Math.PI * 2 : 0,
          spin: spin > 0 ? (liftRng.next() - 0.5) * spin * 2 : 0,
          vx: brocadeLift
            ? particle.vx * 0.015 + (liftRng.next() - 0.5) * liftSpread
            : particle.vx * liftParticles.motion.inheritedVelocity +
              liftParticles.motion.driftX +
              vx +
              (liftRng.next() - 0.5) * (liftSpread + liftParticles.motion.turbulence),
          vy: brocadeLift
            ? -0.04 + liftRng.next() * 0.08
            : particle.vy * liftParticles.motion.inheritedVelocity +
              liftParticles.motion.driftY -
              0.15 +
              liftRng.next() * 0.3,
          vz: brocadeLift
            ? particle.vz * 0.015 + (liftRng.next() - 0.5) * liftSpread
            : particle.vz * liftParticles.motion.inheritedVelocity +
              liftParticles.motion.driftZ +
              vz +
              (liftRng.next() - 0.5) * (liftSpread + liftParticles.motion.turbulence),
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
    // Stars fly with reduced drag (like brocade) so calibrated burst speeds
    // carry them into a proper sphere instead of stalling early. Rings break
    // in a randomly tilted plane so the halo reads as a 3D hoop.
    const ringTilt = design.geometry === 'ring' ? (rng.next() - 0.5) * 1.1 : 0;
    const ringSpin = design.geometry === 'ring' ? rng.next() * Math.PI : 0;
    const ringAxisX = new THREE.Vector3(1, 0, 0);
    const ringAxisY = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const velocity = this.burstVelocity(design, i, count, speed, seed, rng);
      if (design.geometry === 'ring') {
        velocity.applyAxisAngle(ringAxisX, ringTilt).applyAxisAngle(ringAxisY, ringSpin);
      }
      const starColor = this.starColor(design, layer, layerKey, color, i, count, rng);
      const life = this.starLife(design, rangeRand(lifeRange, rng), rng);
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
        trailStarCount: count,
        split: layerKey === 'outer' && design.split.enabled,
      });
    }
  }

  private burstParticleCount(design: FireworkDesign, layer: FireworkStarLayer): number {
    let count: number;
    switch (design.geometry) {
      case 'radial_arms':
        count = Math.max(44, Math.round(layer.count * 0.46));
        break;
      case 'falling_tail':
        count = Math.max(52, Math.round(layer.count * 0.62));
        break;
      case 'pearls':
        count = Math.max(18, Math.round(layer.count * 0.18));
        break;
      case 'ring':
        count = Math.max(72, Math.round(layer.count * 0.72));
        break;
      case 'fragment_cloud':
        count = Math.max(90, Math.round(layer.count * 0.9));
        break;
      default:
        count = layer.count;
    }
    return count;
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
    switch (design.geometry) {
      case 'ring': {
        const angle = (index / count) * Math.PI * 2;
        const wobble = (rng.next() - 0.5) * 0.18;
        return new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed * 0.96,
          wobble * speed,
        );
      }
      case 'crown':
      case 'weeping': {
        const lateral = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1;
        const lift =
          design.geometry === 'weeping' ? 0.35 + rng.next() * 0.45 : 0.55 + rng.next() * 0.62;
        return new THREE.Vector3(
          (direction.x / lateral) * speed * (0.65 + rng.next() * 0.35),
          speed * lift,
          (direction.z / lateral) * speed * (0.65 + rng.next() * 0.35),
        );
      }
      case 'radial_arms': {
        const arms = 7;
        const arm = index % arms;
        const angle = (arm / arms) * Math.PI * 2 + (rng.next() - 0.5) * 0.1;
        const length = 0.74 + Math.floor(index / arms) / Math.max(1, count / arms);
        return new THREE.Vector3(
          Math.cos(angle) * speed * length,
          speed * (0.22 + rng.next() * 0.44),
          Math.sin(angle) * speed * length,
        );
      }
      case 'falling_tail': {
        const lateral = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1;
        return new THREE.Vector3(
          (direction.x / lateral) * speed * (0.28 + rng.next() * 0.5),
          -speed * (0.05 + rng.next() * 0.42),
          (direction.z / lateral) * speed * (0.28 + rng.next() * 0.5),
        );
      }
      case 'pearls': {
        const angle = (index / count) * Math.PI * 2;
        return new THREE.Vector3(
          Math.cos(angle) * speed * (0.45 + rng.next() * 0.28),
          speed * (0.5 + rng.next() * 0.35),
          Math.sin(angle) * speed * (0.45 + rng.next() * 0.28),
        );
      }
      case 'fragment_cloud': {
        return direction.multiplyScalar(speed * (0.72 + rng.next() * 0.78));
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

  private starLife(design: FireworkDesign, baseLife: number, rng: RandomSource): number {
    switch (design.geometry) {
      case 'weeping':
      case 'falling_tail':
      case 'waterfall':
        return baseLife * (1.25 + rng.next() * 0.35);
      case 'pearls':
        return baseLife * 0.62;
      case 'ring':
        return baseLife * 0.82;
      default:
        return baseLife;
    }
  }

  private starGravity(design: FireworkDesign, gravity: number, rng: RandomSource): number {
    switch (design.geometry) {
      case 'weeping':
        return clamp(gravity * 0.52, MIN_STAR_GRAVITY, -0.08);
      case 'falling_tail':
      case 'waterfall':
        return clamp(gravity * 0.45, MIN_STAR_GRAVITY, -0.05);
      case 'pearls':
        return clamp(gravity * 1.15, MIN_STAR_GRAVITY, -0.18);
      default:
        return gravity + (rng.next() - 0.5) * 0.035;
    }
  }

  private starDrag(design: FireworkDesign): number {
    switch (design.geometry) {
      case 'crown':
        return STAR_DRAG;
      case 'weeping':
      case 'falling_tail':
        return STAR_DRAG * 0.58;
      case 'radial_arms':
        return STAR_DRAG * 0.82;
      case 'pearls':
        return STAR_DRAG * 1.35;
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
    const particleShape = layer.enabled ? headShape : HIDDEN_PARTICLE_SHAPE;
    const sizeBudget = Math.max(40, layer.head.size * (o.headSizeScale ?? 1));
    const wantsSplit = o.split === true;
    const splitDelay = o.life * design.split.delayRatio;
    const palette = streakTrailPalette(layer.burstTrail, color);
    const trailLifeScale = o.trailLifeScale ?? 1;
    const secondary = resolveOptionalColor(design.secondaryColor, rng);
    const pathEstimate =
      Math.sqrt(o.vx * o.vx + o.vy * o.vy + o.vz * o.vz) * Math.max(0.1, o.life) * 100;
    const trailStep = trailsVisible ? clamp(pathEstimate / Math.max(1, trailBudget), 1, 42) : 42;
    const initialColor = starOpeningColor(layer.head, color, 0);
    const initialSize = starOpeningSize(layer.head, sizeBudget, 0);

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
            trailParticles += this.emitBurstTrailParticle(
              sampleX,
              sampleY,
              sampleZ,
              sampleAge,
              (1 - progress) * dt,
              maxLife,
              p.vx,
              p.vy,
              p.vz,
              layer.burstTrail,
              palette.hot,
              palette.cool,
              trailLifeScale,
              pathEstimate,
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
  ): boolean {
    const ageRatio = particle.maxLife > 0 ? 1 - clamp(particle.life / particle.maxLife, 0, 1) : 0;
    let targetColor = color;
    if (secondary && particle.maxLife > 0 && design.trailProfile !== 'blink' && ageRatio > 0.42) {
      targetColor = applyColorMix(color, secondary, (ageRatio - 0.42) / 0.45);
    }

    if (layer.head.opening.colour.enabled || targetColor !== color) {
      const visibleColor = starOpeningColor(layer.head, targetColor, ageRatio);
      particle.color.setRGB(visibleColor.r, visibleColor.g, visibleColor.b);
    }

    const dynamicSize = starOpeningSize(layer.head, sizeBudget, ageRatio);
    if (layer.head.opening.size.enabled) {
      particle.size = dynamicSize;
    }

    if (design.strobe.enabled) {
      const phase = (time * design.strobe.frequencyHz + particle.i * 0.037) % 1;
      const lit = phase < design.strobe.dutyCycle;
      const litSize = layer.head.opening.size.enabled ? dynamicSize : sizeBudget;
      particle.size = lit ? Math.max(particle.size, litSize) : litSize * 0.045;
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
   * from fresh head-end (0%) to old tail-end (100%). The per-star budget is
   * spent by travelled distance; head/tail balance changes placement, not count.
   */
  private emitBurstTrailParticle(
    x: number,
    y: number,
    z: number,
    headAge: number,
    ageOffset: number,
    headMaxLife: number,
    headVx: number,
    headVy: number,
    headVz: number,
    trail: BurstTrail,
    hot: THREE.Color,
    cool: THREE.Color,
    trailLifeScale: number,
    pathEstimate: number,
    averageGap: number,
    maxRemaining: number,
    rng: RandomSource,
  ): number {
    if (maxRemaining <= 0) return 0;
    const position = clamp(headAge, 0, 1) * 100;
    const stop = sampleBurstTrailStop(trail, position);
    if (!stop || stop.density <= 0) return 0;
    const spread = burstTrailSpreadRadius(trail, position, pathEstimate);
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
    const lifePercent = clamp(trail.lifetime.percent / 100, 0.01, 1);
    const life =
      (headMaxLife * lifePercent + trail.lifetime.afterglowSeconds) *
      Math.max(0.05, lifeJitter) *
      lifeScale *
      (flicker ? trail.flicker.lifetimeMultiplier : 1);
    if (life <= 0.015) return 0;
    const agedLife = life - ageOffset;
    if (agedLife <= 0.015) return 0;
    const age = clamp(ageOffset / life, 0, 1);
    const agedSize = burstTrailParticleSizeAt(age, headSize, tailSize);
    const tone = burstTrailParticleColorAt(
      age,
      hot,
      cool,
      trail.intensity.brightness,
      trail.intensity.fadeSoftness,
      flickerMix,
    );
    const inherited = motion.inheritedVelocity;
    const turbulence = motion.turbulence;
    const scatter = burstTrailScatterOffset(headVx, headVy, headVz, spread, rng);
    const headGap = burstTrailHeadGapOffset(
      headVx,
      headVy,
      headVz,
      averageGap,
      trail.placement.headGapPercent,
    );
    const spin = clamp(motion.spin, 0, 8);
    const particle = this.pp.new({
      x: x + headGap.x + scatter.x,
      y: y + headGap.y + scatter.y,
      z: z + headGap.z + scatter.z,
      mass: 0.002,
      gravity: motion.gravity,
      drag: motion.drag,
      size: agedSize,
      shape: burstTrailShapeValue(shape),
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
        const nextTone = burstTrailParticleColorAt(
          particleAge,
          hot,
          cool,
          trail.intensity.brightness,
          trail.intensity.fadeSoftness,
          flickerMix,
        );
        p.color.setRGB(nextTone.r, nextTone.g, nextTone.b);
        p.size = burstTrailParticleSizeAt(particleAge, headSize, tailSize);
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
    const count = clamp(Math.round(brocade.streakCount ?? design.size), 8, BROCADE_MAX_STREAKS);
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
                trailParticles += this.emitBurstTrailParticle(
                  sampleX,
                  sampleY,
                  sampleZ,
                  sampleAge,
                  (1 - progress) * dt,
                  maxLife,
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
                  pathEstimate,
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
        life: 0.65 + rng.next() * 1.6,
        gravity: clampStarGravity(rangeRand(design.burst.gravity, rng) * 0.82),
        drag: STAR_DRAG * 0.92 * 0.7,
        headSizeScale: 0.5,
        trailLifeScale: 0.6,
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
    const count = Math.max(8, Math.round(design.size * 0.18));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = rangeRand(design.burst.speed, rng) * 0.55;
      this.spawnEffectStar({
        design,
        rng,
        audible,
        x: particle.x,
        y: particle.y,
        z: particle.z,
        vx: Math.cos(angle) * speed * 0.45,
        vy: speed * (0.1 + rng.next() * 0.28),
        vz: Math.sin(angle) * speed * 0.45,
        color,
        life: rangeRand(design.burst.life, rng) * 0.55,
        gravity: clampStarGravity(rangeRand(design.burst.gravity, rng) * 0.75),
        drag: STAR_DRAG * 1.25 * 0.75,
        headSizeScale: 0.4,
        trailLifeScale: 0.5,
        trailStarCount: count,
      });
    }
  }

  private spawnFishSwarm(
    particle: Particle,
    design: FireworkDesign,
    color: THREE.Color,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const count = Math.max(80, Math.round(design.size * 0.72));
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
        vy: direction.y * 0.25,
        vz: direction.z,
        color,
        life: 0.8 + rng.next() * 1.8,
        gravity: clampStarGravity(rangeRand(design.burst.gravity, rng) * 0.55),
        drag: STAR_DRAG * 0.55,
        headSizeScale: 0.65,
        trailLifeScale: 0.6,
        trailStarCount: count,
        // Darting fish wiggle: small per-frame swimming forces.
        extraEffect: (p, dt, t) => {
          p.vx += Math.cos(t * 14 + phase) * dt * 1.8;
          p.vz += Math.sin(t * 17 + phase) * dt * 1.8;
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
    const count = Math.max(90, Math.round(design.size * 0.78));
    for (let i = 0; i < count; i++) {
      const curtain = (i / count - 0.5) * design.size * 2.2;
      this.spawnEffectStar({
        design,
        rng,
        audible,
        x: particle.x + curtain + (rng.next() - 0.5) * 28,
        y: particle.y - rng.next() * 58,
        z: particle.z + (rng.next() - 0.5) * 24,
        vx: (rng.next() - 0.5) * 0.28,
        vy: -1.0 - rng.next() * 1.45,
        vz: (rng.next() - 0.5) * 0.2,
        color,
        life: rangeRand(design.burst.life, rng) * 1.35,
        gravity: -0.32 - rng.next() * 0.34,
        drag: STAR_DRAG * 0.28,
        headSizeScale: 0.75,
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
    const count = Math.max(32, Math.round(design.size * 0.28));
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
        vy: (rng.next() - 0.15) * rangeRand(design.burst.speed, rng),
        vz: Math.sin(angle) * rangeRand(design.burst.speed, rng),
        color,
        life: 1 + rng.next() * 2,
        gravity: clampStarGravity(rangeRand(design.burst.gravity, rng) * 0.7),
        drag: STAR_DRAG * 0.62,
        headSizeScale: 0.8,
        trailLifeScale: 0.7,
        trailStarCount: count,
        // Spinning shower: spiral forces give the whirl its corkscrew arms.
        extraEffect: (p, dt, t) => {
          p.vx += Math.cos(t * 18 + phase) * dt * 2.4;
          p.vz += Math.sin(t * 18 + phase) * dt * 2.4;
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
