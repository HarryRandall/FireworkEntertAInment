import * as THREE from 'three';
import type { FireworkDesign } from '../design.ts';
import type { Particle } from '../Particle.ts';
import { HIDDEN_PARTICLE_SHAPE } from '../Particle.ts';
import type { RandomSource } from '../random.ts';
import { createSeededRng, mixSeed } from '../random.ts';
import { effectDetonate } from './burst.ts';
import { mixColor, resolveColor, resolveEffectColours, resolveLaunchColor } from './colours.ts';
import { LIFT_SPARK_COLOR, PATTERN_SEED, SHELL_TRAIL_DENSITY } from './constants.ts';
import { effectFireFountain, effectFireMine, effectFireRomanCandle } from './ground.ts';
import {
  applyLiftSwirlToShell,
  estimateShellRiseHeight,
  flatLiftScatterOffset,
  launchShellShapeValue,
  liftGuidedPosition,
  liftParticleDensityScale,
  liftPathAge,
  liftPathPoint,
  shellTrailTubeRadius,
  usesGuidedLiftPath,
} from './lift.ts';
import { clamp, createShellEffectBudget, variationFactor } from './math.ts';
import {
  burstTrailParticleColorAt,
  burstTrailParticleSizeAt,
  burstTrailShapeValue,
  chooseBurstTrailShape,
} from './trail-shape.ts';
import type { EffectContext, FireOptions, Pos } from './types.ts';
export function effectFire(
  ctx: EffectContext,
  authoredDesign: FireworkDesign,
  position: Pos,
  options: FireOptions,
): void {
  const design = resolveEffectColours(authoredDesign);
  const rng = options.rng;
  const budget = createShellEffectBudget();
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
    effectFireMine(ctx, design, position, color, rng, options.audible, smokeRng, budget);
    return;
  }
  if (design.geometry === 'roman_candle') {
    effectFireRomanCandle(ctx, design, position, color, rng, options.audible, smokeRng, budget);
    return;
  }
  if (design.geometry === 'fountain') {
    effectFireFountain(ctx, design, position, color, rng, options.audible, smokeRng, budget);
    return;
  }
  if (options.audible && design.sound.launch) ctx.sh.playRandomMortar(1.0, rng);
  ctx.lights.newLight({ x: position.x, y: 30, z: position.z }, new THREE.Color(0.7, 0.3, 0), 10);
  effectSpawnMortarSmoke(ctx, position, design, smokeRng);
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
  ctx.pp.new({
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
      effectShellEffect(
        ctx,
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
        const guided = liftGuidedPosition(p, design.launch.liftParticles, t, position.y, liftStopY);
        p.x = guided.x;
        p.y = guided.y;
        p.z = guided.z;
      }
      effectDetonate(ctx, p, dt, t, design, color, seed, rng, ctx.audible, budget);
    },
  });
}
export function effectSpawnMortarSmoke(
  ctx: EffectContext,
  pos: Pos,
  design: FireworkDesign,
  rng: RandomSource,
  amountMultiplier = 1,
): void {
  const smoke = design.launch.smoke;
  const count = smoke.enabled ? Math.max(0, Math.round(smoke.particles * amountMultiplier)) : 0;
  if (count <= 0) return;
  const color = smoke.colour;
  const size = smoke.size;
  const lifeSeconds = smoke.lifeSeconds;
  const spread = smoke.spread;
  const drift = smoke.drift;
  const riseVelocity = smoke.height <= 0 ? 0 : smoke.height / Math.max(1, lifeSeconds * 180);
  for (let i = 0; i < count; i++) {
    const angle = rng.next() * Math.PI * 2;
    const radius = Math.sqrt(rng.next()) * spread;
    const particleSize = size * variationFactor(rng, smoke.sizeVariationPercent);
    const life = lifeSeconds * variationFactor(rng, smoke.lifeVariationPercent);
    const colourGain = 0.82 + rng.next() * 0.28;
    const curlRateX = 0.6 + rng.next() * 0.8;
    const curlRateZ = 0.6 + rng.next() * 0.8;
    const curlPhaseX = rng.next() * Math.PI * 2;
    const curlPhaseZ = rng.next() * Math.PI * 2;
    ctx.pp.new({
      x: pos.x + Math.cos(angle) * radius,
      y: pos.y + 22 + rng.next() * 12,
      z: pos.z + Math.sin(angle) * radius,
      vx: smoke.windX + (rng.next() - 0.5) * drift,
      vy: riseVelocity + rng.next() * 0.14,
      vz: smoke.windZ + (rng.next() - 0.5) * drift,
      mass: 0.006,
      gravity: 0.02 + drift * 0.025,
      drag: 0.9 + drift * 0.35,
      size: particleSize,
      alpha: smoke.opacity,
      h: 0.5,
      s: 0.5,
      l: 0.5,
      r: color.r * colourGain,
      g: color.g * colourGain,
      b: color.b * colourGain,
      life,
      decay: 0,
      effect: (p, dt, time) => {
        p.size = Math.max(0.01, p.size + smoke.expansionPerSecond * dt);
        p.vx += smoke.windX * dt;
        p.vz += smoke.windZ * dt;
        p.vx += Math.sin(time * curlRateX + curlPhaseX) * smoke.turbulence * dt;
        p.vz += Math.cos(time * curlRateZ + curlPhaseZ) * smoke.turbulence * dt;
      },
    });
  }
}
export function effectSpawnGuidedLaunchShell(
  ctx: EffectContext,
  point: Pos,
  design: FireworkDesign,
  shellColor: THREE.Color,
  shellSize: number,
  dt: number,
): void {
  const shell = design.launch.shell;
  const life = Math.max(0.032, dt * 1.8);
  const size = clamp(shellSize * 0.28, 8, 34);
  ctx.pp.new({
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
export function effectShellEffect(
  ctx: EffectContext,
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
  const liftTrailMultiplier = 1;
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
    effectSpawnGuidedLaunchShell(ctx, guidedShellPoint, design, shellColor, shellSize, dt);
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
    smoke.enabled && particle.y <= liftOriginY + smoke.height
      ? Math.max(0, Math.round(baseCount * (smoke.particles / 100)))
      : 0;
  if (liftCount <= 0 && smokeCount <= 0) return;
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
      const lockToShellPath = liftTubeRadius <= 0;
      const liftVelocityScatter = clamp(liftTubeRadius * 0.04, 0, 1.2);
      const launchSparkColor = resolveLaunchColor(liftParticles.colour, color, liftRng);
      const sparkColor = launchSparkColor;
      const sizeVariation =
        1 + (liftRng.next() * 2 - 1) * (liftParticles.particleSize.variationPercent / 100);
      const sparkBaseSize = liftParticles.particleSize.base * Math.max(0.08, sizeVariation);
      const sparkHeadSize = sparkBaseSize * liftParticles.particleSize.headScale;
      const sparkTailSize = sparkBaseSize * liftParticles.particleSize.tailScale;
      const lifeVariation =
        1 + (liftRng.next() * 2 - 1) * (liftParticles.lifetime.variationPercent / 100);
      const flicker = liftRng.next() < liftParticles.flicker.chance;
      const flickerMix = flicker ? clamp(liftParticles.flicker.strength / 3, 0, 1) : 0;
      const sparkLife =
        (liftParticles.lifetime.baseSeconds + liftParticles.lifetime.afterglowSeconds) *
        Math.max(0.05, lifeVariation) *
        (flicker ? liftParticles.flicker.lifetimeMultiplier : 1);
      const coolSparkColor = new THREE.Color(
        sparkColor.r * 0.46,
        sparkColor.g * 0.38,
        sparkColor.b * 0.28,
      );
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
      const shape = burstTrailShapeValue(
        chooseBurstTrailShape(liftParticles.shapeWeights, liftRng),
      );
      const scatter = flatLiftScatterOffset(liftTubeRadius, liftRng);
      ctx.pp.new({
        x: pathPoint.x + scatter.x,
        y: pathPoint.y + scatter.y,
        z: pathPoint.z + scatter.z,
        mass: 0.002,
        gravity: lockToShellPath ? 0 : liftParticles.motion.gravity,
        drag: lockToShellPath ? 0 : liftParticles.motion.drag,
        size: sparkHeadSize,
        shape,
        rotation: spin > 0 ? liftRng.next() * Math.PI * 2 : 0,
        spin: spin > 0 ? (liftRng.next() - 0.5) * spin * 2 : 0,
        vx: lockToShellPath
          ? 0
          : particle.vx * liftParticles.motion.inheritedVelocity +
            liftParticles.motion.driftX +
            vx +
            (liftRng.next() - 0.5) * (liftVelocityScatter + liftParticles.motion.turbulence),
        vy: lockToShellPath
          ? 0
          : particle.vy * liftParticles.motion.inheritedVelocity +
            liftParticles.motion.driftY -
            0.15 +
            liftRng.next() * 0.3,
        vz: lockToShellPath
          ? 0
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
        decay: 0,
        effect: (p) => {
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
  const smokeColor = smoke.colour;
  for (let i = 0; i < smokeCount; i++) {
    const smokeSpread = smoke.spread * (particle.y < liftOriginY + smoke.height * 0.62 ? 1 : 0.55);
    const smokeSize = smoke.size * variationFactor(smokeRng, smoke.sizeVariationPercent);
    const smokeLife = smoke.lifeSeconds * variationFactor(smokeRng, smoke.lifeVariationPercent);
    const colourGain = 0.82 + smokeRng.next() * 0.28;
    const curlRateX = 0.6 + smokeRng.next() * 0.8;
    const curlRateZ = 0.6 + smokeRng.next() * 0.8;
    const curlPhaseX = smokeRng.next() * Math.PI * 2;
    const curlPhaseZ = smokeRng.next() * Math.PI * 2;
    ctx.pp.new({
      x: particle.x + (smokeRng.next() - 0.5) * smokeSpread,
      y: particle.y + (smokeRng.next() - 0.5) * 14,
      z: particle.z + (smokeRng.next() - 0.5) * smokeSpread,
      mass: 0.006,
      gravity: 0.02 + smoke.drift * 0.035 + smokeRng.next() * 0.08,
      drag: 1.35 + smoke.drift * 0.35,
      size: smokeSize,
      alpha: smoke.opacity,
      vx: vx + smoke.windX + (smokeRng.next() - 0.5) * smoke.drift,
      vy: smoke.height / Math.max(1, smoke.lifeSeconds * 260) + smokeRng.next() * 0.14,
      vz: vz + smoke.windZ + (smokeRng.next() - 0.5) * smoke.drift,
      r: smokeColor.r * colourGain,
      g: smokeColor.g * colourGain,
      b: smokeColor.b * colourGain,
      h: 1.0,
      s: 0.5,
      l: 0.0,
      life: smokeLife,
      decay: 0,
      effect: (p, dt, time) => {
        p.size = Math.max(0.01, p.size + smoke.expansionPerSecond * dt);
        p.vx += smoke.windX * dt;
        p.vz += smoke.windZ * dt;
        p.vx += Math.sin(time * curlRateX + curlPhaseX) * smoke.turbulence * dt;
        p.vz += Math.cos(time * curlRateZ + curlPhaseZ) * smoke.turbulence * dt;
      },
    });
  }
}
