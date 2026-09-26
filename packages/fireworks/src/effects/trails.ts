import * as THREE from 'three';
import type { RandomSource } from '../random.ts';
import { clamp } from './math.ts';
import {
  burstTrailHeadGapOffset,
  burstTrailLifecycleSizeAt,
  burstTrailOpeningParticleVisibility,
  burstTrailParticleColorAt,
  burstTrailParticleSizeAt,
  burstTrailScatterVector,
  burstTrailShapeValue,
  burstTrailSpreadRadius,
  burstTrailWideTailAlpha,
  chooseBurstTrailShape,
  sampleBurstTrailStop,
  scaleTrailScatter,
} from './trail-shape.ts';
import type { BurstTrail, EffectContext } from './types.ts';

/**
 * Shared unified burst-trail emitter. It samples the editable trail endpoints
 * from fresh head-end (0%) to oldest tail-end (100%). The per-star budget is
 * spent by travelled distance; head/tail balance changes placement, not count.
 */
export function effectEmitBurstTrailParticle(
  ctx: EffectContext,
  x: number,
  y: number,
  z: number,
  headAge: number,
  spreadPositionPercent: number,
  initialDistanceBehindHead: number,
  ageOffset: number,
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
  const pathPosition = (1 - pathAge) * 100;
  const stop = sampleBurstTrailStop(trail, pathPosition);
  if (!stop || stop.density <= 0) return 0;
  const lifeScale = trailLifeScale;
  const motion = trail.motion;
  const shape = chooseBurstTrailShape(stop.shapeWeights, rng);
  const flicker = rng.next() < trail.flicker.chance;
  const flickerMix = flicker ? clamp(trail.flicker.strength / 3, 0, 1) : 0;
  const globalSizeVariation =
    1 + (rng.next() * 2 - 1) * (trail.particleSize.variationPercent / 100);
  const stopSizeVariation = 1 + (rng.next() * 2 - 1) * (stop.sizeVariation / 100);
  const pixelBase =
    (11 + rng.next() * 9) *
    trail.particleSize.base *
    stop.size *
    Math.max(0.08, globalSizeVariation) *
    Math.max(0.08, stopSizeVariation) *
    (flicker ? 1.18 : 1);
  const headSize = pixelBase * trail.particleSize.headScale;
  const tailSize = pixelBase * trail.particleSize.tailScale;
  const lifeVariation = trail.lifetime.variationPercent / 100;
  const lifeJitter = 1 + (rng.next() * 2 - 1) * lifeVariation;
  const lifeBeforeVariation =
    trail.lifetime.mode === 'fixed'
      ? trail.lifetime.baseSeconds + trail.lifetime.afterglowSeconds
      : Math.max(0, headRemainingLife) * clamp(trail.lifetime.percent, 0, 2) +
        trail.lifetime.afterglowSeconds;
  const life =
    lifeBeforeVariation *
    Math.max(0.05, lifeJitter) *
    lifeScale *
    (flicker ? trail.flicker.lifetimeMultiplier : 1);
  if (life <= 0.015) return 0;
  const agedLife = life - ageOffset;
  if (agedLife <= 0.015) return 0;
  const age = clamp(ageOffset / life, 0, 1);
  const closingLifeReference = Math.max(0.01, life);
  const closingRemainingSeconds = Math.max(0, agedLife);
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
    closingRemainingSeconds,
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
    closingRemainingSeconds,
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
  const particle = ctx.pp.new({
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
      const spreadPosition = initialSpreadPosition + (100 - initialSpreadPosition) * spreadProgress;
      const fadePosition = initialFadePosition + (100 - initialFadePosition) * spreadProgress;
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
        Math.max(0, p.life),
        closingLifeReference,
      );
      p.color.setRGB(nextTone.r, nextTone.g, nextTone.b);
      p.size = burstTrailParticleSizeAt(particleAge, headSize, tailSize);
      p.size = burstTrailLifecycleSizeAt(
        pathAge,
        Math.max(0, p.life),
        closingLifeReference,
        p.size,
        trail,
      );
    },
  });
  particle.maxLife = life;
  return 1;
}
