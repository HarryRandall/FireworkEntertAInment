import * as THREE from 'three';
import type { FireworkDesign, StarLayerKey } from '../design.ts';
import { fountainEmissionRate, groundEmissionDuration, starEmissionCount } from '../emission.ts';
import { HIDDEN_PARTICLE_SHAPE } from '../Particle.ts';
import type { RandomSource } from '../random.ts';
import { createSeededRng, mixSeed } from '../random.ts';
import { effectStarColor } from './colours.ts';
import { STAR_DRAG } from './constants.ts';
import { effectSpawnMortarSmoke } from './launch.ts';
import { clampStarGravity, createShellEffectBudget, rangeRand } from './math.ts';
import { effectSpawnEffectStar } from './stars.ts';
import type { EffectContext, Pos, ShellEffectBudget } from './types.ts';

export function effectFireMine(
  ctx: EffectContext,
  design: FireworkDesign,
  position: Pos,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  smokeRng: RandomSource = createSeededRng(mixSeed('mine-smoke-fallback')),
  budget: ShellEffectBudget = createShellEffectBudget(),
): void {
  if (audible && design.sound.launch) ctx.sh.playRandomMortar(0.7, rng);
  ctx.lights.newLight({ x: position.x, y: 35, z: position.z }, color, 12);
  effectSpawnMortarSmoke(ctx, position, design, smokeRng, 0.65);
  const shape = design.geometryTuning.upwardFan;
  const spreadAngle = (shape.spreadAngleDegrees * Math.PI) / 180;
  for (const layerKey of ['outer', 'core'] as const) {
    const layer = design.stars[layerKey];
    if (!layer.enabled) continue;
    const count = starEmissionCount(design, layerKey);
    for (let i = 0; i < count; i++) {
      const spread = (rng.next() - 0.5) * spreadAngle;
      const fan = shape.fanBase + rng.next() * shape.fanVariation;
      const speed = rangeRand(layer.burst.speed, rng);
      const starColor = effectStarColor(ctx, design, layer, layerKey, color, i, count, rng);
      effectSpawnEffectStar(ctx, {
        design,
        layer,
        styleIndex: layerKey === 'core' ? 1 : 0,
        budget,
        rng,
        audible,
        x: position.x + (rng.next() - 0.5) * shape.spawnScatter,
        y: position.y + shape.riseBase + rng.next() * shape.riseVariation,
        z: position.z + (rng.next() - 0.5) * shape.spawnScatter,
        vx: Math.sin(spread) * speed * fan,
        vy: speed * (shape.riseSpeed + rng.next() * shape.riseSpeedVariation),
        vz: (rng.next() - 0.5) * speed * shape.depthScale,
        color: starColor,
        life: rangeRand(layer.burst.life, rng) * (shape.lifePercent / 100),
        gravity: clampStarGravity(rangeRand(layer.burst.gravity, rng)),
        drag: STAR_DRAG * (shape.dragPercent / 100),
        headSizeScale: shape.headSizePercent / 100,
        trailLifeScale: shape.trailLifePercent / 100,
      });
    }
  }
}

/**
 * Roman candle: a ground tube that ejects a sequence of large ascending stars
 * over several seconds. Implemented as a hidden ground emitter whose per-frame
 * effect callback releases one star on a staggered interval, so the candle
 * reads as discrete shots rather than a single burst.
 */
export function effectFireRomanCandle(
  ctx: EffectContext,
  design: FireworkDesign,
  position: Pos,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  smokeRng: RandomSource,
  budget: ShellEffectBudget,
): void {
  if (audible && design.sound.launch) ctx.sh.playRandomMortar(0.45, rng);
  effectSpawnMortarSmoke(ctx, position, design, smokeRng, 0.4);
  const shape = design.geometryTuning.romanCandle;
  const shotCounts = {
    outer: design.stars.outer.enabled ? starEmissionCount(design, 'outer') : 0,
    core: design.stars.core.enabled ? starEmissionCount(design, 'core') : 0,
  };
  const trailStarCount = shotCounts.outer + shotCounts.core;
  if (trailStarCount <= 0) return;
  const duration = groundEmissionDuration(design);
  let elapsed = 0;
  const emitted = { outer: 0, core: 0 };
  const soundLayer: StarLayerKey = shotCounts.outer > 0 ? 'outer' : 'core';
  ctx.lights.newLight({ x: position.x, y: 60, z: position.z }, color, 9);

  ctx.pp.new({
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
      for (const layerKey of ['outer', 'core'] as const) {
        const layer = design.stars[layerKey];
        if (!layer.enabled) continue;
        const shotCount = shotCounts[layerKey];
        const interval = duration / Math.max(1, shotCount);
        while (
          emitted[layerKey] < shotCount &&
          elapsed >= emitted[layerKey] * interval + interval * 0.5
        ) {
          const shotIndex = emitted[layerKey];
          emitted[layerKey] += 1;
          const spread = (rng.next() - 0.5) * shape.spread;
          const azimuth = (rng.next() - 0.5) * shape.azimuth;
          if (
            layerKey === soundLayer &&
            audible &&
            budget.crackleSoundsRemaining > 0 &&
            rng.next() < 0.55
          ) {
            budget.crackleSoundsRemaining -= 1;
            ctx.sh.playRandomCrackle(0.05, rng);
          }
          const starSpeed =
            rangeRand(layer.burst.speed, rng) *
            (shape.speedBase + rng.next() * shape.speedVariation);
          const starColor = effectStarColor(
            ctx,
            design,
            layer,
            layerKey,
            color,
            shotIndex,
            shotCount,
            rng,
          );
          effectSpawnEffectStar(ctx, {
            design,
            layer,
            styleIndex: layerKey === 'core' ? 1 : 0,
            budget,
            rng,
            audible,
            x: p.x + (rng.next() - 0.5) * shape.muzzleScatter,
            y: p.y,
            z: p.z + (rng.next() - 0.5) * shape.muzzleScatter,
            vx: Math.sin(spread) * starSpeed * shape.lateralScale,
            vy: starSpeed * (shape.riseBase + rng.next() * shape.riseVariation),
            vz: Math.sin(azimuth) * starSpeed * shape.depthScale,
            color: starColor,
            life: rangeRand(layer.burst.life, rng) * (shape.lifePercent / 100),
            gravity: clampStarGravity(rangeRand(layer.burst.gravity, rng)),
            drag: STAR_DRAG * (shape.dragPercent / 100),
            headSizeScale: shape.headSizePercent / 100,
            trailLifeScale: shape.trailLifePercent / 100,
          });
        }
      }
    },
  });
}

/**
 * Fountain: a steady ground glitter spray. A hidden ground emitter releases
 * many small sparks per frame into a narrow upward cone; high drag and gravity
 * pull them back into the classic fountain arc. No mortar burst, no boom.
 */
export function effectFireFountain(
  ctx: EffectContext,
  design: FireworkDesign,
  position: Pos,
  color: THREE.Color,
  rng: RandomSource,
  audible: boolean,
  smokeRng: RandomSource,
  budget: ShellEffectBudget,
): void {
  effectSpawnMortarSmoke(ctx, position, design, smokeRng, 0.25);
  const shape = design.geometryTuning.fountain;
  const duration = groundEmissionDuration(design);
  const coneAngle = (shape.coneAngleDegrees * Math.PI) / 180;
  const ratesPerSecond = {
    outer: fountainEmissionRate(design, 'outer'),
    core: fountainEmissionRate(design, 'core'),
  };
  const trailStarCount = Math.max(
    1,
    starEmissionCount(design, 'outer') + starEmissionCount(design, 'core'),
  );
  let elapsed = 0;
  const emitted = { outer: 0, core: 0 };
  ctx.lights.newLight({ x: position.x, y: 70, z: position.z }, color, 11);
  if (audible && design.sound.launch && budget.crackleSoundsRemaining > 0) {
    budget.crackleSoundsRemaining -= 1;
    ctx.sh.playRandomCrackle(0.12, rng);
  }

  ctx.pp.new({
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
      elapsed = Math.min(duration, elapsed + dt);
      for (const layerKey of ['outer', 'core'] as const) {
        const layer = design.stars[layerKey];
        if (!layer.enabled) continue;
        const target = Math.floor(ratesPerSecond[layerKey] * elapsed + 1e-9);
        const toEmit = target - emitted[layerKey];
        for (let i = 0; i < toEmit; i++) {
          const starIndex = emitted[layerKey];
          emitted[layerKey] += 1;
          const cone = (rng.next() - 0.5) * coneAngle;
          const azimuth = rng.next() * Math.PI * 2;
          const starSpeed =
            rangeRand(layer.burst.speed, rng) *
            (shape.speedBase + rng.next() * shape.speedVariation);
          const lateral = Math.sin(cone) * starSpeed;
          const starColor = effectStarColor(
            ctx,
            design,
            layer,
            layerKey,
            color,
            starIndex,
            trailStarCount,
            rng,
          );
          effectSpawnEffectStar(ctx, {
            design,
            layer,
            styleIndex: layerKey === 'core' ? 1 : 0,
            budget,
            rng,
            audible: false,
            x: p.x + (rng.next() - 0.5) * shape.spawnScatter,
            y: p.y,
            z: p.z + (rng.next() - 0.5) * shape.spawnScatter,
            vx: Math.cos(azimuth) * lateral * shape.lateralScale,
            vy: Math.cos(cone) * starSpeed,
            vz: Math.sin(azimuth) * lateral * shape.lateralScale,
            color: starColor,
            life: rangeRand(layer.burst.life, rng) * (shape.lifePercent / 100),
            gravity: clampStarGravity(rangeRand(layer.burst.gravity, rng)),
            drag: STAR_DRAG * (shape.dragPercent / 100),
            headSizeScale: shape.headSizePercent / 100,
            trailLifeScale: shape.trailLifePercent / 100,
          });
        }
      }
    },
  });
}
