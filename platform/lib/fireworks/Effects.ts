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
  type Particle,
} from '@/lib/fireworks/Particle';
import type { ParticlePool } from '@/lib/fireworks/ParticlePool';
import type { SoundHandler } from '@/lib/fireworks/SoundHandler';
import type { Lights } from '@/lib/fireworks/Lights';
import {
  BURST_TRAIL_PARTICLES_PER_STAR_MAX,
  type BurstTrailShape,
  type FireworkDesign,
} from '@/lib/fireworks/design';
import type { RandomSource } from '@/lib/fireworks/random';

type Pos = { x: number; y: number; z: number };
type FireOptions = {
  rng: RandomSource;
  audible: boolean;
  panDegrees?: number;
  tiltDegrees?: number;
};

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
/** Hot/cool ends of the named streak-trail palettes. */
const GOLD_TRAIL_HOT = new THREE.Color(1, 0.9, 0.62);
const GOLD_TRAIL_COOL = new THREE.Color(1, 0.45, 0.15);
const SILVER_TRAIL_HOT = new THREE.Color(0.94, 0.97, 1);
const SILVER_TRAIL_COOL = new THREE.Color(0.5, 0.58, 0.72);
const EMBER_TRAIL_HOT = new THREE.Color(1, 0.62, 0.26);
const EMBER_TRAIL_COOL = new THREE.Color(0.62, 0.24, 0.08);
/**
 * Head orbs encode their glow strength into the `shape` attribute so the
 * fragment shader can scale the halo per particle: shape = 2 + glow * this.
 * Anything >= 1.5 still reads as a head sprite throughout the renderer.
 */
const BROCADE_GLOW_SHAPE_SCALE = 0.25;

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

function isBrocadeCrown(design: FireworkDesign): boolean {
  return design.geometry === 'crown' && design.trailProfile === 'glitter';
}

/** Whether this design renders its lift and stars with the streak machinery. */
function usesStreakTrails(design: FireworkDesign): boolean {
  return design.stars.heads.enabled && design.stars.trail.mode === 'streak';
}

/**
 * Hot/cool colour pair for a star's streak trail, resolved from the design's
 * named colour mode. `star` keeps the star's own colour and dims it; `gold`,
 * `silver`, and `ember` are the classic metallic comet-tail chemistries;
 * `starFade` starts on the star's colour and cools into ember.
 */
function streakTrailPalette(
  design: FireworkDesign,
  starColor: THREE.Color,
): { hot: THREE.Color; cool: THREE.Color } {
  switch (design.burstTrail.colourMode) {
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
      return { hot: starColor.clone(), cool: EMBER_TRAIL_COOL.clone() };
    default:
      return { hot: GOLD_TRAIL_HOT.clone(), cool: GOLD_TRAIL_COOL.clone() };
  }
}

function burstTrailParticlesPerStar(design: FireworkDesign): number {
  if (!design.burstTrail.enabled) return 0;
  const requested = Math.max(0, Math.round(design.burstTrail.particlesPerStar));
  if (requested <= 0) return 0;
  return Math.min(requested, BURST_TRAIL_PARTICLES_PER_STAR_MAX);
}

function sampleBurstTrailStop(design: FireworkDesign, positionPercent: number) {
  const stops = design.burstTrail.stops;
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

function burstTrailWidth(design: FireworkDesign, positionPercent: number): number {
  const width = design.burstTrail.width;
  const t = Math.pow(clamp(positionPercent / 100, 0, 1), width.curve);
  return width.front + (width.tail - width.front) * t;
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

export class Effects {
  constructor(
    private pp: ParticlePool,
    private sh: SoundHandler,
    private lights: Lights,
  ) {}

  fire(design: FireworkDesign, position: Pos, options: FireOptions): void {
    const rng = options.rng;
    const seed = PATTERN_SEED[design.pattern];
    const color = new THREE.Color(0, 0, 0);
    const rgb = resolveColor(design.color, rng);
    color.setRGB(rgb.r, rgb.g, rgb.b);
    const lift = mixColor(color, LIFT_SPARK_COLOR, 0.72);
    const liftColor = new THREE.Color(lift.r, lift.g, lift.b);

    const size = design.size;
    if (design.geometry === 'upward_fan') {
      this.fireMine(design, position, color, rng, options.audible);
      return;
    }

    if (options.audible && design.mortar.sound) this.sh.playRandomMortar(1.0, rng);
    this.lights.newLight({ x: position.x, y: 30, z: position.z }, new THREE.Color(0.7, 0.3, 0), 10);
    this.spawnMortarSmoke(position, design.mortar.smokeParticles, rng);

    const liftVelocity = design.liftVelocity ?? 11 + Math.min(size / 40, 6);
    const panRadians = ((options.panDegrees ?? 0) * Math.PI) / 180;
    const tiltRadians = ((options.tiltDegrees ?? 0) * Math.PI) / 180;
    const lateralVelocity = Math.sin(panRadians) * Math.max(1.2, liftVelocity * 0.62);
    const forwardVelocity = Math.sin(tiltRadians) * Math.max(1.0, liftVelocity * 0.42);

    // Star count can be tiny, but the ascending carrier still needs enough
    // size budget to survive its decay until apex and trigger detonation.
    const shellSize = Math.max(size, 110);
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
      effect: (p, dt, t) => this.shellEffect(p, dt, t, seed, liftColor, design, rng),
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
  ): void {
    if (audible && design.mortar.sound) this.sh.playRandomMortar(0.7, rng);
    this.lights.newLight({ x: position.x, y: 35, z: position.z }, color, 12);
    this.spawnMortarSmoke(position, Math.round(design.mortar.smokeParticles * 0.65), rng);
    const count = Math.max(36, Math.round(design.size * 0.9));
    const speed = rangeRand(design.burst.speed, rng);
    const grav = clampStarGravity(rangeRand(design.burst.gravity, rng));
    for (let i = 0; i < count; i++) {
      const spread = (rng.next() - 0.5) * Math.PI * 0.92;
      const fan = 0.45 + rng.next() * 0.8;
      const starColor = this.starColor(design, color, i, rng);
      this.spawnEffectStar({
        design,
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

  private spawnMortarSmoke(pos: Pos, count: number, rng: RandomSource): void {
    for (let i = 0; i < count; i++) {
      this.pp.new({
        x: pos.x + 10 - rng.next() * 20,
        y: pos.y + 30 + rng.next() * 5,
        z: pos.z + 10 - rng.next() * 20,
        mass: 0.006,
        gravity: rng.next(),
        size: 20 + rng.next() * 100,
        h: 0.5,
        s: 0.5,
        l: 0.5,
        r: 0.15 + rng.next() * 0.05,
        g: 0.15 + rng.next() * 0.05,
        b: 0.16 + rng.next() * 0.05,
        life: rng.next() * 5,
        decay: 20 + rng.next() * 20,
        effect: (p, _dt, time) => {
          p.vz += Math.sin(time * rng.next()) / 50;
          p.vx += Math.sin(time * rng.next()) / 50;
        },
      });
    }
  }

  private shellEffect(
    particle: Particle,
    _dt: number,
    time: number,
    seed: 1 | 2 | 3,
    color: THREE.Color,
    design: FireworkDesign,
    rng: RandomSource,
  ): void {
    let max = 1;
    let vx = 0;
    let vz = 0;
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
    const count = Math.max(1, Math.floor(max * SHELL_TRAIL_DENSITY * liftTrailMultiplier));
    // Non-brocade streak designs tint the rising tail from their own trail
    // palette so silver shells rise silver and gold shells rise gold.
    const liftPalette = !isBrocadeCrown(design)
      ? streakTrailPalette(design, color)
      : { hot: BROCADE_TRAIL_PEACH, cool: BROCADE_TRAIL_PEACH };
    const liftJitter = isBrocadeCrown(design)
      ? 2.2
      : clamp(design.stars.trail.tubeRadius * 0.8, 1.2, 6);
    for (let i = 0; i < count; i++) {
      const brocadeLift = streakLift;
      const liftStreakSize = brocadeLift ? clamp(design.trail.streakSize, 0.4, 4) : 1;
      const liftStreakLife = brocadeLift ? clamp(design.trail.streakLife, 0.2, 4) : 1;
      const spread = 0.32 + rng.next() * 0.72;
      const liftSpread = brocadeLift ? 0.035 + rng.next() * 0.08 : spread;
      const smokeTrail =
        !brocadeLift && (particle.y < 220 || (particle.y < 360 && rng.next() < 0.82));
      const smokeSpread = particle.y < 220 ? 28 : 16;
      const hotTrail =
        !smokeTrail &&
        (design.geometry === 'single_tail' ||
          design.trailProfile === 'thick_tail' ||
          design.trailProfile === 'glitter');
      const sparkColor = brocadeLift
        ? applyColorMix(color, liftPalette.hot, 0.66 + rng.next() * 0.24)
        : hotTrail
          ? applyColorMix(color, HOT_SPARK_COLOR, 0.45)
          : color;
      this.pp.new({
        x:
          particle.x +
          (rng.next() - 0.5) * (brocadeLift ? liftJitter : smokeTrail ? smokeSpread : 6),
        y:
          particle.y + (rng.next() - 0.5) * (brocadeLift ? liftJitter * 1.27 : smokeTrail ? 14 : 6),
        z:
          particle.z +
          (rng.next() - 0.5) * (brocadeLift ? liftJitter : smokeTrail ? smokeSpread : 6),
        mass: smokeTrail ? 0.006 : 0.002,
        gravity: smokeTrail ? 0.04 + rng.next() * 0.1 : brocadeLift ? TRAIL_GRAVITY * 0.3 : -0.09,
        drag: smokeTrail ? 1.75 : brocadeLift ? TRAIL_DRAG * 1.05 : TRAIL_DRAG,
        size: smokeTrail
          ? 46 + rng.next() * 74
          : (brocadeLift ? 8 + rng.next() * 14 : 14 + rng.next() * 34) *
            design.trail.thickness *
            liftStreakSize,
        shape: brocadeLift && !smokeTrail ? 1 : 0,
        vx: brocadeLift
          ? particle.vx * 0.015 + (rng.next() - 0.5) * liftSpread
          : vx + (rng.next() - 0.5) * spread,
        vy: smokeTrail
          ? 0.04 + rng.next() * 0.18
          : brocadeLift
            ? -0.04 + rng.next() * 0.08
            : -0.15 + rng.next() * 0.3,
        vz: brocadeLift
          ? particle.vz * 0.015 + (rng.next() - 0.5) * liftSpread
          : vz + (rng.next() - 0.5) * spread,
        r: smokeTrail ? 0.12 + rng.next() * 0.05 : sparkColor.r,
        g: smokeTrail ? 0.12 + rng.next() * 0.05 : sparkColor.g,
        b: smokeTrail ? 0.13 + rng.next() * 0.05 : sparkColor.b,
        h: 1.0,
        s: 0.5,
        l: 0.0,
        life: smokeTrail
          ? 1.0 + rng.next() * 2.3
          : (brocadeLift ? (0.14 + rng.next() * 0.24) * liftStreakLife : 0.18 + rng.next() * 0.72) *
            design.trail.length,
        decay: smokeTrail
          ? 12 + rng.next() * 18
          : brocadeLift
            ? 34 + rng.next() * 30
            : 38 + rng.next() * 34,
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
      if (boom === 'heavy' || (boom === 'auto' && design.size > 200)) {
        this.sh.playRandomHeavyBoom(1.0, rng);
      } else {
        this.sh.playRandomLightBoom(1.0, rng);
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

    const grav = clampStarGravity(rangeRand(design.burst.gravity, rng));
    const speed = rangeRand(design.burst.speed, rng);
    const lifeRange = design.burst.life;
    const count = this.burstParticleCount(design);
    // Stars fly with reduced drag (like brocade) so the calibrated burst
    // speeds carry them into a proper sphere instead of stalling early.
    // Rings break in a randomly tilted plane so the halo reads as a 3D hoop
    // hanging in the sky rather than a flat screen-space circle.
    const ringTilt = design.geometry === 'ring' ? (rng.next() - 0.5) * 1.1 : 0;
    const ringSpin = design.geometry === 'ring' ? rng.next() * Math.PI : 0;
    const ringAxisX = new THREE.Vector3(1, 0, 0);
    const ringAxisY = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const velocity = this.burstVelocity(design, i, count, speed, seed, rng);
      if (design.geometry === 'ring') {
        velocity.applyAxisAngle(ringAxisX, ringTilt).applyAxisAngle(ringAxisY, ringSpin);
      }
      const starColor = this.starColor(design, color, i, rng);
      const life = this.starLife(design, rangeRand(lifeRange, rng), rng);
      this.spawnEffectStar({
        design,
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
        split: design.split.enabled || design.geometry === 'split_cross',
      });
    }

    if (design.pistil.enabled || design.geometry === 'pistil') {
      this.spawnPistil(particle, design, color, seed, rng, audible);
    }
  }

  private burstParticleCount(design: FireworkDesign): number {
    let count: number;
    switch (design.geometry) {
      case 'radial_arms':
        count = Math.max(44, Math.round(design.size * 0.46));
        break;
      case 'falling_tail':
        count = Math.max(52, Math.round(design.size * 0.62));
        break;
      case 'pearls':
        count = Math.max(18, Math.round(design.size * 0.18));
        break;
      case 'ring':
        count = Math.max(72, Math.round(design.size * 0.72));
        break;
      case 'fragment_cloud':
        count = Math.max(90, Math.round(design.size * 0.9));
        break;
      default:
        count = design.size;
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

  private starColor(
    design: FireworkDesign,
    color: THREE.Color,
    index: number,
    rng: RandomSource,
  ): THREE.Color {
    const secondary = resolveOptionalColor(design.secondaryColor, rng);
    if (!secondary) return color;
    if (design.geometry === 'pistil') return index % 4 === 0 ? secondary : color;
    if (design.trailProfile === 'blink' || design.pattern === 'strobe') {
      return rng.next() > 0.62 ? secondary : color;
    }
    if (design.geometry === 'pearls') return index % 2 === 0 ? color : secondary;
    // `secondaryColorRatio` is the fraction of stars that take the accent
    // colour. Defaults to 0.22 so existing shows render identically.
    const accentRatio = clamp(design.secondaryColorRatio ?? 0.22, 0, 1);
    return rng.next() > 1 - accentRatio ? secondary : color;
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
   * The Stars switch controls visible star heads. When heads are hidden but
   * trails are enabled, an invisible carrier still flies the same path and
   * emits trail particles. There is no visible point-spark fallback.
   */
  private spawnEffectStar(o: {
    design: FireworkDesign;
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
    /** Scales the head size budget (pistil cores, split fragments). */
    headSizeScale?: number;
    /** Scales streak-square life (split fragments, comet finishes). */
    trailLifeScale?: number;
    /** Number of sibling star paths sharing the hidden burst-trail safety cap. */
    trailStarCount?: number;
    /** Attach the crossette split condition to this star. */
    split?: boolean;
    /** Force the trail off regardless of the design (pistil cores). */
    noTrail?: boolean;
    /** Extra per-frame behaviour (fish wiggle, whirl spiral). */
    extraEffect?: (p: Particle, dt: number, t: number) => void;
  }): void {
    const design = o.design;
    const rng = o.rng;
    const stars = design.stars;
    const color = o.color;
    const headsVisible = stars.heads.enabled;
    const trailBudget = o.noTrail ? 0 : burstTrailParticlesPerStar(design);
    const trailsVisible = trailBudget > 0;
    if (!headsVisible && !trailsVisible) return;

    const glow = clamp(stars.heads.glowStrength, 0, 3);
    const headShape = 2 + glow * BROCADE_GLOW_SHAPE_SCALE;
    const particleShape = headsVisible ? headShape : HIDDEN_PARTICLE_SHAPE;
    const sizeBudget = Math.max(40, stars.heads.size * (o.headSizeScale ?? 1));
    const wantsSplit = o.split === true;
    const splitDelay = o.life * design.split.delayRatio;
    const palette = streakTrailPalette(design, color);
    const trailLifeScale = o.trailLifeScale ?? 1;
    const secondary = resolveOptionalColor(design.secondaryColor, rng);
    const pathEstimate =
      Math.sqrt(o.vx * o.vx + o.vy * o.vy + o.vz * o.vz) * Math.max(0.1, o.life) * 100;
    const trailStep = trailsVisible ? clamp(pathEstimate / Math.max(1, trailBudget), 1, 42) : 42;

    // Streak emission state, captured per star: squares spawn every
    // `trailStep` of arc length travelled, exactly like brocade streaks.
    let lastX = o.x;
    let lastY = o.y;
    let lastZ = o.z;
    let trailParticles = 0;
    const emitStreak = trailsVisible
      ? (p: Particle, dt: number) => {
          if (trailParticles >= trailBudget) return;
          const dx = p.x - lastX;
          const dy = p.y - lastY;
          const dz = p.z - lastZ;
          const segment = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (segment < trailStep) return;
          const emissionCount = Math.max(1, Math.round(segment / trailStep));
          const stepX = dx / emissionCount;
          const stepY = dy / emissionCount;
          const stepZ = dz / emissionCount;
          const headAge = p.maxLife > 0 ? 1 - clamp(p.life / p.maxLife, 0, 1) : 1;
          let emitted = 0;
          while (emitted < emissionCount) {
            const progress = (emitted + 1) / emissionCount;
            lastX += stepX;
            lastY += stepY;
            lastZ += stepZ;
            const sampleAge = Math.max(0, headAge - ((1 - progress) * dt) / p.maxLife);
            const sampleRemaining = p.life + (1 - progress) * dt;
            trailParticles += this.emitBurstTrailCluster(
              lastX,
              lastY,
              lastZ,
              sampleAge,
              sampleRemaining,
              (1 - progress) * dt,
              p.vx,
              p.vy,
              p.vz,
              design,
              palette.hot,
              palette.cool,
              trailLifeScale,
              trailBudget - trailParticles,
              rng,
            );
            if (trailParticles >= trailBudget) return;
            emitted++;
          }
        }
      : null;

    this.pp.new({
      x: o.x,
      y: o.y,
      z: o.z,
      size: sizeBudget,
      mass: 0.0005,
      shape: particleShape,
      gravity: o.gravity,
      drag: o.drag,
      vx: o.vx,
      vy: o.vy,
      vz: o.vz,
      r: color.r,
      g: color.g,
      b: color.b,
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
    color: THREE.Color,
    secondary: THREE.Color | null,
    design: FireworkDesign,
    rng: RandomSource,
    audible: boolean,
    sizeBudget: number,
  ): boolean {
    const ageRatio = particle.maxLife > 0 ? 1 - clamp(particle.life / particle.maxLife, 0, 1) : 0;
    if (secondary && particle.maxLife > 0 && design.trailProfile !== 'blink' && ageRatio > 0.42) {
      const shifted = applyColorMix(color, secondary, (ageRatio - 0.42) / 0.45);
      particle.color.setRGB(shifted.r, shifted.g, shifted.b);
    }

    if (design.strobe.enabled) {
      const phase = (time * design.strobe.frequencyHz + particle.i * 0.037) % 1;
      const lit = phase < design.strobe.dutyCycle;
      particle.size = lit ? Math.max(particle.size, sizeBudget) : sizeBudget * 0.045;
    }

    if (design.crackle.enabled && particle.life < 1.0 && rng.next() < design.crackle.probability) {
      this.crackleEffect(particle, dt, time, design, color, rng, audible);
      particle.reset();
      return true;
    }
    return false;
  }

  /**
   * Shared unified burst-trail emitter. It samples the editable trail stops
   * from fresh head-end (0%) to old tail-end (100%), then spends the per-star
   * particle budget uniformly across every star path.
   */
  private emitBurstTrailCluster(
    x: number,
    y: number,
    z: number,
    headAge: number,
    headRemaining: number,
    ageOffset: number,
    headVx: number,
    headVy: number,
    headVz: number,
    design: FireworkDesign,
    hot: THREE.Color,
    cool: THREE.Color,
    trailLifeScale: number,
    maxRemaining: number,
    rng: RandomSource,
  ): number {
    if (maxRemaining <= 0) return 0;
    const trail = design.burstTrail;
    const position = (1 - clamp(headAge, 0, 1)) * 100;
    const stop = sampleBurstTrailStop(design, position);
    if (!stop || stop.density <= 0) return 0;
    const clusterCount = Math.max(0, Math.min(4, Math.round(stop.density + rng.next())));
    const width = burstTrailWidth(design, position);
    const warmth = clamp(headAge * 2.0, 0, 1);
    const lifeScale = trailLifeScale;
    const variation = stop.sizeVariation / 100;
    const motion = trail.motion;
    let emitted = 0;
    for (let i = 0; i < clusterCount && emitted < maxRemaining; i++) {
      const shape = chooseBurstTrailShape(stop.shapeWeights, rng);
      const flicker = rng.next() < trail.flicker.chance;
      const toneMix = clamp(warmth + (rng.next() - 0.5) * 0.2, 0, 1);
      const baseR = hot.r + (cool.r - hot.r) * toneMix;
      const baseG = hot.g + (cool.g - hot.g) * toneMix;
      const baseB = hot.b + (cool.b - hot.b) * toneMix;
      const flickerMix = flicker ? clamp(trail.flicker.strength / 3, 0, 1) : 0;
      const toneR = (baseR + (HOT_SPARK_COLOR.r - baseR) * flickerMix) * trail.intensity.brightness;
      const toneG = (baseG + (HOT_SPARK_COLOR.g - baseG) * flickerMix) * trail.intensity.brightness;
      const toneB = (baseB + (HOT_SPARK_COLOR.b - baseB) * flickerMix) * trail.intensity.brightness;
      const sizeVariation = 1 + (rng.next() * 2 - 1) * variation;
      const size =
        (11 + rng.next() * 9) * stop.size * Math.max(0.08, sizeVariation) * (flicker ? 1.18 : 1);
      const lifeCeiling = headRemaining + trail.lifetime.afterglowSeconds;
      if (lifeCeiling <= 0.015) continue;
      const lifeVariation = trail.lifetime.variationPercent / 100;
      const lifeJitter = 1 + (rng.next() * 2 - 1) * lifeVariation;
      const life = Math.min(
        trail.lifetime.baseSeconds *
          Math.max(0.05, lifeJitter) *
          lifeScale *
          (flicker ? trail.flicker.lifetimeMultiplier : 1),
        lifeCeiling,
      );
      const decay = (size * clamp(0.35 + trail.intensity.fadeSoftness * 0.16, 0.12, 0.92)) / life;
      const agedLife = life - ageOffset;
      if (agedLife <= 0.015) continue;
      const agedSize = Math.max(0.01, size - decay * ageOffset);
      const age = clamp(ageOffset / life, 0, 1);
      const chill = flicker ? clamp(age * 2.8, 0, 1) : 0;
      const inherited = motion.inheritedVelocity;
      const turbulence = motion.turbulence;
      const particle = this.pp.new({
        x: x + (rng.next() - 0.5) * width * 2,
        y: y + (rng.next() - 0.5) * width * 2,
        z: z + (rng.next() - 0.5) * width * 2,
        mass: 0.002,
        gravity: motion.gravity,
        drag: motion.drag,
        size: agedSize,
        shape: burstTrailShapeValue(shape),
        rotation: rng.next() * Math.PI * 2,
        spin: (rng.next() - 0.5) * motion.spin * 2,
        vx: headVx * inherited + motion.driftX + (rng.next() - 0.5) * turbulence,
        vy: headVy * inherited + motion.driftY + (rng.next() - 0.5) * turbulence,
        vz: headVz * inherited + motion.driftZ + (rng.next() - 0.5) * turbulence,
        r: toneR + (cool.r - toneR) * chill,
        g: toneG + (cool.g - toneG) * chill,
        b: toneB + (cool.b - toneB) * chill,
        h: 1.0,
        s: 0.5,
        l: 0.0,
        life: agedLife,
        decay,
      });
      particle.maxLife = life;
      emitted++;
    }
    return emitted;
  }

  private spawnPistil(
    particle: Particle,
    design: FireworkDesign,
    outerColor: THREE.Color,
    seed: 1 | 2 | 3,
    rng: RandomSource,
    audible: boolean,
  ): void {
    const pistilColor =
      resolveOptionalColor(design.pistil.color ?? design.secondaryColor, rng) ??
      applyColorMix(outerColor, HOT_SPARK_COLOR, 0.55);
    const count = Math.max(24, Math.round(design.size * design.pistil.sizeRatio));
    const speed = rangeRand(design.burst.speed, rng) * design.pistil.speedRatio;
    const life = [design.burst.life[0] * 0.62, design.burst.life[1] * 0.82] as [number, number];
    for (let i = 0; i < count; i++) {
      const direction = fibonacciDirection(i, count).multiplyScalar(speed);
      this.spawnEffectStar({
        design,
        rng,
        audible,
        x: particle.x,
        y: particle.y,
        z: particle.z,
        vx: direction.x,
        vy: direction.y,
        vz: direction.z,
        color: pistilColor,
        life: rangeRand(life, rng),
        gravity: clampStarGravity(rangeRand(design.burst.gravity, rng) * 0.9),
        drag: STAR_DRAG * 1.16 * 0.72,
        headSizeScale: 0.62,
        trailStarCount: count,
        // The pistil core reads as a clean contrasting heart; trails belong
        // to the outer petals only.
        noTrail: true,
      });
    }
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
    const trailBudget = burstTrailParticlesPerStar(design);
    const trailsEnabled = trailBudget > 0;
    const headsEnabled = brocade.headsEnabled;
    const maxEmissionsPerStep = BROCADE_MAX_TRAIL_EMISSIONS_PER_STEP;
    const glow = clamp(brocade.glowStrength, 0, 3);
    const headShape = 2 + glow * BROCADE_GLOW_SHAPE_SCALE;
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

      // Trail emission state, captured per star: squares spawn every
      // `trailStep` of arc length travelled, not per frame.
      let lastX = originX;
      let lastY = originY;
      let lastZ = originZ;
      let trailParticles = 0;

      const emitTrail = trailsEnabled
        ? (p: Particle, dt: number) => {
            if (trailParticles >= trailBudget) return;
            const dx = p.x - lastX;
            const dy = p.y - lastY;
            const dz = p.z - lastZ;
            const segment = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (segment < trailStep) return;
            const emissionCount = Math.min(
              maxEmissionsPerStep,
              Math.max(1, Math.round(segment / trailStep)),
            );
            const stepX = dx / emissionCount;
            const stepY = dy / emissionCount;
            const stepZ = dz / emissionCount;
            const headAge = p.maxLife > 0 ? 1 - clamp(p.life / p.maxLife, 0, 1) : 1;
            let emitted = 0;
            while (emitted < emissionCount) {
              const progress = (emitted + 1) / emissionCount;
              lastX += stepX;
              lastY += stepY;
              lastZ += stepZ;
              // No squares right at the burst centre: the real heads own
              // that moment, and the hot trail material should read as being
              // shot outward instead of stacking into a white blob.
              const ox = lastX - originX;
              const oy = lastY - originY;
              const oz = lastZ - originZ;
              if (ox * ox + oy * oy + oz * oz > 50 * 50) {
                const sampleAge = Math.max(0, headAge - ((1 - progress) * dt) / p.maxLife);
                const sampleRemaining = p.life + (1 - progress) * dt;
                trailParticles += this.emitBurstTrailCluster(
                  lastX,
                  lastY,
                  lastZ,
                  sampleAge,
                  sampleRemaining,
                  (1 - progress) * dt,
                  p.vx,
                  p.vy,
                  p.vz,
                  design,
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
                  trailBudget - trailParticles,
                  rng,
                );
              }
              if (trailParticles >= trailBudget) return;
              emitted++;
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
