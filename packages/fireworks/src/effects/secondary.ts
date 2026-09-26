import * as THREE from 'three';
import type { Particle } from '../Particle.ts';
import type { FireworkDesign } from '../design.ts';
import { starEmissionCount } from '../emission.ts';
import type { RandomSource } from '../random.ts';
import { effectStarColor } from './colours.ts';
import { GOLD_TRAIL_HOT, SILVER_TRAIL_HOT, STAR_DRAG } from './constants.ts';
import { fibonacciDirection } from './geometry.ts';
import { clampStarGravity, rangeRand, variationFactor } from './math.ts';
import { effectSpawnEffectStar } from './stars.ts';
import type { EffectContext, ShellEffectBudget } from './types.ts';

export function effectSplitCrossette(
  ctx: EffectContext,
  particle: Particle,
  _dt: number,
  _time: number,
  design: FireworkDesign,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
): void {
  if (audible && budget.crackleSoundsRemaining > 0 && rng.next() < 0.18) {
    budget.crackleSoundsRemaining -= 1;
    ctx.sh.playRandomCrackle(0.08, rng);
  }
  const fragments = design.split.fragments;
  const baseAngle = rng.next() * Math.PI;
  for (let i = 0; i < fragments; i++) {
    const angle = baseAngle + (i / fragments) * Math.PI * 2;
    const upward = (i % 2 === 0 ? 0.28 : -0.08) + (rng.next() - 0.5) * 0.18;
    effectSpawnEffectStar(ctx, {
      design,
      budget,
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
      gravity: particle.gravity,
      drag: STAR_DRAG * 0.92 * 0.7,
      headSizeScale: design.split.headSizePercent / 100,
      trailLifeScale: design.split.trailLifePercent / 100,
    });
  }
}

export function effectCometFinish(
  ctx: EffectContext,
  particle: Particle,
  design: FireworkDesign,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
): void {
  // Comets are single ascending tailed stars. The detonation should read as
  // one bright head continuing along the trail, not a radial ring of blobs.
  const shape = design.geometryTuning.singleTail;
  const inherit = shape.inheritPercent / 100;
  for (const layerKey of ['outer', 'core'] as const) {
    const layer = design.stars[layerKey];
    if (!layer.enabled) continue;
    const speed = rangeRand(layer.burst.speed, rng);
    const drift = speed * (shape.driftPercent / 100);
    effectSpawnEffectStar(ctx, {
      design,
      layer,
      styleIndex: layerKey === 'core' ? 1 : 0,
      budget,
      rng,
      audible,
      x: particle.x,
      y: particle.y,
      z: particle.z,
      vx: particle.vx * inherit + rangeRand([-drift, drift], rng),
      vy: Math.max(speed * shape.riseFactor, particle.vy * 0.55 + speed * shape.pushFactor),
      vz: particle.vz * inherit + rangeRand([-drift, drift], rng),
      color: effectStarColor(ctx, design, layer, layerKey, color, 0, 1, rng),
      life: rangeRand(layer.burst.life, rng) * (shape.lifePercent / 100),
      gravity: clampStarGravity(rangeRand(layer.burst.gravity, rng)),
      drag: STAR_DRAG,
      headSizeScale: shape.headSizePercent / 100,
      trailLifeScale: shape.trailLifePercent / 100,

      split: layerKey === 'outer' && design.split.enabled,
    });
  }
}

export function effectSpawnFishSwarm(
  ctx: EffectContext,
  particle: Particle,
  design: FireworkDesign,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
): void {
  const shape = design.geometryTuning.fish;
  for (const layerKey of ['outer', 'core'] as const) {
    const layer = design.stars[layerKey];
    if (!layer.enabled) continue;
    const count = starEmissionCount(design, layerKey);
    for (let i = 0; i < count; i++) {
      const direction = fibonacciDirection(i, count).multiplyScalar(
        rangeRand(layer.burst.speed, rng),
      );
      const phase = rng.next() * Math.PI * 2;
      const shapedLife = shape.lifeBaseSeconds + rng.next() * shape.lifeVariationSeconds;
      const layerLife = rangeRand(layer.burst.life, rng);
      effectSpawnEffectStar(ctx, {
        design,
        layer,
        styleIndex: layerKey === 'core' ? 1 : 0,
        budget,
        rng,
        audible,
        x: particle.x,
        y: particle.y,
        z: particle.z,
        vx: direction.x,
        vy: direction.y * shape.verticalScale,
        vz: direction.z,
        color: effectStarColor(ctx, design, layer, layerKey, color, i, count, rng),
        life: (shapedLife + layerLife) * 0.5,
        gravity: rangeRand(layer.burst.gravity, rng) * (shape.gravityPercent / 100),
        drag: STAR_DRAG * (shape.dragPercent / 100),
        headSizeScale: shape.headSizePercent / 100,
        trailLifeScale: shape.trailLifePercent / 100,

        split: layerKey === 'outer' && design.split.enabled,
        extraEffect: (p, dt, t) => {
          p.vx += Math.cos(t * shape.wiggleRate + phase) * dt * shape.wiggleStrength;
          p.vz += Math.sin(t * shape.wiggleRateCross + phase) * dt * shape.wiggleStrength;
        },
      });
    }
  }
}

export function effectSpawnWaterfall(
  ctx: EffectContext,
  particle: Particle,
  design: FireworkDesign,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
): void {
  const shape = design.geometryTuning.waterfall;
  for (const layerKey of ['outer', 'core'] as const) {
    const layer = design.stars[layerKey];
    if (!layer.enabled) continue;
    const count = starEmissionCount(design, layerKey);
    for (let i = 0; i < count; i++) {
      const curtain = count > 1 ? (i / (count - 1) - 0.5) * shape.width : 0;
      effectSpawnEffectStar(ctx, {
        design,
        layer,
        styleIndex: layerKey === 'core' ? 1 : 0,
        budget,
        rng,
        audible,
        x: particle.x + curtain + (rng.next() - 0.5) * shape.scatterX,
        y: particle.y - rng.next() * shape.dropStart,
        z: particle.z + (rng.next() - 0.5) * shape.scatterZ,
        vx: (rng.next() - 0.5) * shape.sideDrift,
        vy: -shape.fallSpeed - rng.next() * shape.fallSpeedVariation,
        vz: (rng.next() - 0.5) * shape.depthDrift,
        color: effectStarColor(ctx, design, layer, layerKey, color, i, count, rng),
        life: rangeRand(layer.burst.life, rng) * (shape.lifePercent / 100),
        gravity: shape.gravityBase - rng.next() * shape.gravityVariation,
        drag: STAR_DRAG * (shape.dragPercent / 100),
        headSizeScale: shape.headSizePercent / 100,

        split: layerKey === 'outer' && design.split.enabled,
      });
    }
  }
}

export function effectSpawnWhirl(
  ctx: EffectContext,
  particle: Particle,
  design: FireworkDesign,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
): void {
  const shape = design.geometryTuning.whirl;
  for (const layerKey of ['outer', 'core'] as const) {
    const layer = design.stars[layerKey];
    if (!layer.enabled) continue;
    const count = starEmissionCount(design, layerKey);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const phase = rng.next() * Math.PI * 2;
      const shapedLife = shape.lifeBaseSeconds + rng.next() * shape.lifeVariationSeconds;
      const layerLife = rangeRand(layer.burst.life, rng);
      const speed = rangeRand(layer.burst.speed, rng);
      effectSpawnEffectStar(ctx, {
        design,
        layer,
        styleIndex: layerKey === 'core' ? 1 : 0,
        budget,
        rng,
        audible,
        x: particle.x,
        y: particle.y,
        z: particle.z,
        vx: Math.cos(angle) * speed,
        vy: (rng.next() + shape.verticalBias) * speed,
        vz: Math.sin(angle) * speed,
        color: effectStarColor(ctx, design, layer, layerKey, color, i, count, rng),
        life: (shapedLife + layerLife) * 0.5,
        gravity: rangeRand(layer.burst.gravity, rng) * (shape.gravityPercent / 100),
        drag: STAR_DRAG * (shape.dragPercent / 100),
        headSizeScale: shape.headSizePercent / 100,
        trailLifeScale: shape.trailLifePercent / 100,

        split: layerKey === 'outer' && design.split.enabled,
        extraEffect: (p, dt, t) => {
          p.vx += Math.cos(t * shape.spinRate + phase) * dt * shape.spinStrength;
          p.vz += Math.sin(t * shape.spinRate + phase) * dt * shape.spinStrength;
        },
      });
    }
  }
}

export function effectCrackleEffect(
  ctx: EffectContext,
  particle: Particle,
  _dt: number,
  _time: number,
  design: FireworkDesign,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
): void {
  const crackle = design.crackle;
  if (audible && budget.crackleSoundsRemaining > 0 && rng.next() < crackle.soundChance) {
    budget.crackleSoundsRemaining -= 1;
    switch (design.crackle.sound) {
      case 'lightBoom':
        ctx.sh.playRandomLightBoom(crackle.soundVolume, rng);
        break;
      case 'heavyBoom':
        ctx.sh.playRandomHeavyBoom(crackle.soundVolume, rng);
        break;
      default:
        ctx.sh.playRandomCrackle(crackle.soundVolume, rng);
    }
  }
  const fragmentColour =
    crackle.colourMode === 'gold'
      ? GOLD_TRAIL_HOT
      : crackle.colourMode === 'star'
        ? color
        : SILVER_TRAIL_HOT;
  const requestedCount = Math.max(
    1,
    Math.round(crackle.fragmentCount * variationFactor(rng, crackle.fragmentCountVariationPercent)),
  );
  const count = Math.min(requestedCount, budget.crackleFragmentsRemaining);
  budget.crackleFragmentsRemaining -= count;
  for (let i = 0; i < count; i++) {
    const direction = fibonacciDirection(i, count);
    const speed =
      crackle.fragmentSpeed * variationFactor(rng, crackle.fragmentSpeedVariationPercent);
    const size = crackle.fragmentSize * variationFactor(rng, crackle.fragmentSizeVariationPercent);
    const life =
      crackle.fragmentLifeSeconds * variationFactor(rng, crackle.fragmentLifeVariationPercent);
    ctx.pp.new({
      x: particle.x,
      y: particle.y,
      z: particle.z,
      size,
      mass: 0.02,
      gravity: crackle.fragmentGravity,
      r: fragmentColour.r,
      g: fragmentColour.g,
      b: fragmentColour.b,
      h: rng.next(),
      s: rng.next(),
      l: rng.next(),
      vx: particle.vx * 0.12 + direction.x * speed,
      vy: particle.vy * 0.12 + direction.y * speed,
      vz: particle.vz * 0.12 + direction.z * speed,
      life,
      decay: size / Math.max(0.05, life) / 2.5,
    });
  }
}
