import * as THREE from 'three';
import type { FireworkDesign, FireworkStarLayer, StarLayerKey } from '../design.ts';
import { starEmissionCount, TRAIL_EMISSIONS_PER_STEP, trailParticlesPerStar } from '../emission.ts';
import type { Particle } from '../Particle.ts';
import { headShapeValue, HIDDEN_PARTICLE_SHAPE } from '../Particle.ts';
import type { RandomSource } from '../random.ts';
import {
  applyColorMix,
  effectStarColor,
  resolveOptionalColor,
  starClosingColor,
  starClosingOpacity,
  starClosingSize,
  starOpeningColor,
  starOpeningSize,
} from './colours.ts';
import {
  effectBurstVelocity,
  effectStarDrag,
  effectStarGravity,
  effectStarLife,
  effectStarLifeRandomness,
  effectStarOpeningLifeReference,
} from './geometry.ts';
import {
  clamp,
  clampStarGravity,
  layerAirResistance,
  layerVerticalVelocity,
  rangeRand,
} from './math.ts';
import { effectCrackleEffect, effectSplitCrossette } from './secondary.ts';
import {
  burstTrailBalancedAge,
  burstTrailDensityAt,
  burstTrailSegmentProgress,
  flairTrailColor,
  streakTrailPalette,
} from './trail-shape.ts';
import { effectEmitBurstTrailParticle } from './trails.ts';
import type { EffectContext, ShellEffectBudget } from './types.ts';

export function effectSpawnStarLayer(
  ctx: EffectContext,
  layerKey: StarLayerKey,
  particle: Particle,
  design: FireworkDesign,
  color: THREE.Color,
  seed: 1 | 2 | 3,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
): void {
  const layer = design.stars[layerKey];
  if (!layer.enabled) return;
  const lifeRange = layer.burst.life;
  const count = starEmissionCount(design, layerKey);
  const styleIndex = layerKey === 'core' ? 1 : 0;
  const openingLifeReference = effectStarOpeningLifeReference(ctx, design, layer);
  const lifeRandomness = effectStarLifeRandomness(ctx, layer);
  // Stars fly with reduced drag (like brocade) so calibrated burst speeds
  // carry them into a proper sphere instead of stalling early. Rings break
  // in a randomly tilted plane so the halo reads as a 3D hoop.
  const ringTilt =
    design.geometry === 'ring' ? (rng.next() - 0.5) * design.geometryTuning.ring.tiltVariation : 0;
  const ringSpin = design.geometry === 'ring' ? rng.next() * Math.PI : 0;
  const planarShape =
    design.geometry === 'heart'
      ? design.geometryTuning.heart
      : design.geometry === 'five_point_star'
        ? design.geometryTuning.fivePointStar
        : null;
  const planarTiltX = planarShape ? (rng.next() - 0.5) * planarShape.tiltVariation : 0;
  const planarTiltY = planarShape ? (rng.next() - 0.5) * planarShape.tiltVariation : 0;
  const ringAxisX = new THREE.Vector3(1, 0, 0);
  const ringAxisY = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < count; i++) {
    const speed = rangeRand(layer.burst.speed, rng);
    const grav = clampStarGravity(rangeRand(layer.burst.gravity, rng));
    const velocity = effectBurstVelocity(ctx, design, i, count, speed, seed, rng);
    if (design.geometry === 'ring') {
      velocity.applyAxisAngle(ringAxisX, ringTilt).applyAxisAngle(ringAxisY, ringSpin);
    } else if (planarShape) {
      velocity.applyAxisAngle(ringAxisX, planarTiltX).applyAxisAngle(ringAxisY, planarTiltY);
    }
    const starColor = effectStarColor(ctx, design, layer, layerKey, color, i, count, rng);
    const life = effectStarLife(ctx, design, rangeRand(lifeRange, rng), rng, lifeRandomness);
    effectSpawnEffectStar(ctx, {
      design,
      layer,
      styleIndex,
      budget,
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
      gravity: effectStarGravity(ctx, design, grav, rng),
      drag: effectStarDrag(ctx, design) * 0.6,
      openingLifeReference,

      split: layerKey === 'outer' && design.split.enabled,
    });
  }
}

/**
 * Generalised star spawner shared by every star layer.
 *
 * Each enabled star layer owns its visible heads and optional trail particles.
 * There is no visible point-spark fallback.
 */
export function effectSpawnEffectStar(
  ctx: EffectContext,
  o: {
    design: FireworkDesign;
    layer?: FireworkStarLayer;
    styleIndex?: number;
    budget: ShellEffectBudget;
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
    /** Attach the crossette split condition to this star. */
    split?: boolean;
    /** Force the trail off regardless of the design. */
    noTrail?: boolean;
    /** Extra per-frame behaviour (fish wiggle, whirl spiral). */
    extraEffect?: (p: Particle, dt: number, t: number) => void;
  },
): void {
  const design = o.design;
  const layer = o.layer ?? design.stars.outer;
  const rng = o.rng;
  const color = o.color;
  const budget = o.budget;
  if (!layer.enabled) return;
  const trailBudget = o.noTrail
    ? 0
    : trailParticlesPerStar(design, layer === design.stars.core ? 'core' : 'outer');
  const trailsVisible = trailBudget > 0;

  const glow = clamp(layer.head.glowStrength, 0, 3);
  const headShape = headShapeValue(glow, o.styleIndex ?? 0);
  const particleShape = layer.head.visible === false ? HIDDEN_PARTICLE_SHAPE : headShape;
  const sizeBudget = Math.max(0.01, layer.head.size * (o.headSizeScale ?? 1));
  const wantsSplit = o.split === true;
  const splitDelay = o.life * design.split.delayRatio;
  const trailSourceColor =
    layer.burstTrail.colourMode === 'star' || layer.burstTrail.colourMode === 'starFade'
      ? flairTrailColor(layer, color, rng)
      : color;
  const palette = streakTrailPalette(layer.burstTrail, trailSourceColor);
  const trailLifeScale = o.trailLifeScale ?? 1;
  const secondary = resolveOptionalColor(design.secondaryColor, rng);
  const pathEstimate =
    Math.sqrt(o.vx * o.vx + o.vy * o.vy + o.vz * o.vz) * Math.max(0.1, o.life) * 100;
  const trailStep = trailsVisible ? Math.max(0.0001, pathEstimate / trailBudget) : 42;
  const openingLifeReference = Math.max(
    0.1,
    o.openingLifeReference ?? effectStarOpeningLifeReference(ctx, design, layer),
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
        if (trailParticles >= trailBudget || budget.trailParticlesRemaining <= 0) return;
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
        const density = burstTrailDensityAt(layer.burstTrail, headAge);
        if (density <= 0.001) {
          trailDistanceCredit = Math.min(trailDistanceCredit, trailStep);
          return;
        }
        const densityStep = trailStep / density;
        trailDistanceCredit += segment;
        const emissionCount = Math.min(
          TRAIL_EMISSIONS_PER_STEP,
          Math.max(0, Math.floor(trailDistanceCredit / densityStep)),
        );
        if (emissionCount <= 0) return;
        trailDistanceCredit -= emissionCount * densityStep;
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
          const spreadPositionPercent = (1 - progress) * 100;
          const initialDistanceBehindHead = segment * (1 - progress);
          const emittedCount = effectEmitBurstTrailParticle(
            ctx,
            sampleX,
            sampleY,
            sampleZ,
            sampleAge,
            spreadPositionPercent,
            initialDistanceBehindHead,
            (1 - progress) * dt,
            Math.max(0, p.life),
            p.vx,
            p.vy,
            p.vz,
            layer.burstTrail,
            palette.hot,
            palette.cool,
            trailLifeScale,
            trailStep,
            Math.min(trailBudget - trailParticles, budget.trailParticlesRemaining),
            rng,
          );
          trailParticles += emittedCount;
          budget.trailParticlesRemaining -= emittedCount;
          if (trailParticles >= trailBudget || budget.trailParticlesRemaining <= 0) return;
        }
      }
    : null;

  ctx.pp.new({
    x: o.x,
    y: o.y,
    z: o.z,
    size: initialSize,
    alpha: initialAlpha,
    mass: 0.0005,
    shape: particleShape,
    gravity: o.gravity,
    drag: layerAirResistance(o.drag, layer),
    airResistance: layer.burst.airResistancePercent / 100,
    terminalVelocity: layer.burst.terminalVelocity,
    vx: o.vx,
    vy: layerVerticalVelocity(o.vy, layer),
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
    decay: 0,
    condition: wantsSplit ? (p) => p.maxLife - p.life >= splitDelay : undefined,
    action: wantsSplit
      ? (p, dt, t) => effectSplitCrossette(ctx, p, dt, t, design, color, rng, o.audible, budget)
      : undefined,
    effect: (p, dt, t) => {
      o.extraEffect?.(p, dt, t);
      const died = effectStarBehaviour(
        ctx,
        p,
        dt,
        t,
        layer,
        color,
        secondary,
        design,
        rng,
        o.audible,
        budget,
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
export function effectStarBehaviour(
  ctx: EffectContext,
  particle: Particle,
  dt: number,
  time: number,
  layer: FireworkStarLayer,
  color: THREE.Color,
  secondary: THREE.Color | null,
  design: FireworkDesign,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
  sizeBudget: number,
  openingLifeReference: number,
): boolean {
  const ageRatio = particle.maxLife > 0 ? 1 - clamp(particle.life / particle.maxLife, 0, 1) : 0;
  const elapsedSeconds = particle.maxLife > 0 ? Math.max(0, particle.maxLife - particle.life) : 0;
  const closingLifeReference = Math.max(0.1, particle.maxLife);
  let targetColor = color;
  if (secondary && !layer.head.closing.colour.enabled && particle.maxLife > 0 && ageRatio > 0.42) {
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

  const openingSize = starOpeningSize(layer.head, sizeBudget, elapsedSeconds, openingLifeReference);
  const closingSize = starClosingSize(layer.head, sizeBudget, particle.life, closingLifeReference);
  const dynamicSize = Math.min(openingSize, closingSize);
  particle.size = dynamicSize;
  particle.alpha = starClosingOpacity(layer.head, particle.life, closingLifeReference);

  if (design.strobe.enabled) {
    // Stable selection keeps the same stars affected while editing the blink rhythm.
    const amount = clamp(design.strobe.amountPercent / 100, 0, 1);
    const affected = amount >= 1 || (particle.i * 0.6180339887) % 1 < amount;
    if (affected) {
      const phase = (time * design.strobe.frequencyHz + particle.i * design.strobe.desync) % 1;
      const lit = phase < design.strobe.dutyCycle;
      // Darkness is visibility, not death: size zero would recycle the particle.
      particle.size = dynamicSize;
      if (!lit) {
        if (design.strobe.dimPercent === 0) particle.alpha = 0;
        else particle.size *= design.strobe.dimPercent / 100;
      }
    }
  }

  const crackleChance =
    1 - Math.pow(1 - clamp(design.crackle.probability, 0, 1), Math.max(0, dt) * 60);
  if (
    design.crackle.enabled &&
    budget.crackleFragmentsRemaining > 0 &&
    particle.life < design.crackle.triggerWindowSeconds &&
    rng.next() < crackleChance
  ) {
    effectCrackleEffect(ctx, particle, dt, time, design, color, rng, audible, budget);
    particle.reset();
    return true;
  }
  return false;
}
