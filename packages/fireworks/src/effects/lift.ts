import type { Particle } from '../Particle.ts';
import {
  headShapeValue,
  TRAIL_SHAPE_CIRCLE,
  TRAIL_SHAPE_SQUARE,
  TRAIL_SHAPE_TRIANGLE,
} from '../Particle.ts';
import type { RandomSource } from '../random.ts';
import {
  LIFT_LOOP_MIN_SPAN,
  LIFT_SWIRL_FULL_AGE,
  LIFT_SWIRL_START_AGE,
  SHELL_TRAIL_CLEAR_AGE_END,
  SHELL_TRAIL_CLEAR_AGE_START,
  SHELL_TRAIL_SPREAD_SCALE,
} from './constants.ts';
import { clamp, smoothstep } from './math.ts';
import type { LaunchShell, LiftParticles, LiftPathPoint, Pos, ShellTrail } from './types.ts';

export function estimateShellRiseHeight(initialVelocityY: number, shellLife: number): number {
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

export function launchShellShapeValue(shell: LaunchShell): number {
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

export function applyLiftSwirlToShell(
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

export function liftLoopSpan(liftParticles: LiftParticles): { start: number; end: number } {
  const loopLength = clamp(liftParticles.motion.swirlLoopLength / 100, LIFT_LOOP_MIN_SPAN, 1);
  const start = LIFT_SWIRL_START_AGE;
  return {
    start,
    end: clamp(start + loopLength, start + LIFT_LOOP_MIN_SPAN, 1),
  };
}

export function liftLoopProgress(liftParticles: LiftParticles, age: number): number {
  const { start, end } = liftLoopSpan(liftParticles);
  return smoothstep(start, end, age);
}

export function liftSwirlPhase(liftParticles: LiftParticles, age: number, time: number): number {
  const rate = clamp(liftParticles.motion.swirlRate, 0, 16);
  const loopCount = clamp(liftParticles.motion.swirlLoopCount, 0, 6);
  const pathPhase = loopCount > 0 ? liftLoopProgress(liftParticles, age) * loopCount : 0;
  return (time * rate + pathPhase) * Math.PI * 2;
}

export function liftSwirlOffset(
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

export function usesGuidedLiftPath(liftParticles: LiftParticles): boolean {
  return (
    clamp(liftParticles.motion.swirlStrength, 0, 4) > 0 ||
    clamp(liftParticles.motion.swirlRadius, 0, 180) > 0 ||
    clamp(liftParticles.motion.swirlLoopCount, 0, 6) > 0 ||
    clamp(liftParticles.motion.swirlLoopHeight, 0, 180) > 0
  );
}

export function liftPathAge(y: number, liftOriginY: number, liftStopY: number): number {
  return liftStopY > liftOriginY
    ? clamp((y - liftOriginY) / Math.max(1, liftStopY - liftOriginY), 0, 1)
    : 1;
}

export function liftGuidedPosition(
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

export function liftPathPoint(
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

export function shellTrailSpreadAngle(shellTrail: ShellTrail, age: number): number {
  const tailProgress = Math.pow(clamp(1 - age, 0, 1), shellTrail.curve);
  const clearance = smoothstep(SHELL_TRAIL_CLEAR_AGE_START, SHELL_TRAIL_CLEAR_AGE_END, age);
  return (
    (shellTrail.frontAngle + (shellTrail.tailAngle - shellTrail.frontAngle) * tailProgress) *
    clearance
  );
}

export function shellTrailTubeRadius(
  shellTrail: ShellTrail,
  age: number,
  liftRiseHeight: number,
): number {
  const maxRadius = clamp(shellTrail.tubeDiameter, 0, 90) / 2;
  const angle = clamp(shellTrailSpreadAngle(shellTrail, age), 0, 60);
  if (maxRadius <= 0 || angle <= 0 || liftRiseHeight <= 0) return 0;
  const radius = Math.tan((angle * Math.PI) / 180) * liftRiseHeight * SHELL_TRAIL_SPREAD_SCALE;
  return clamp(radius, 0, maxRadius);
}

export function liftParticleBalancedAge(liftParticles: LiftParticles, headAge: number): number {
  const bias = clamp((liftParticles.frontClump - 0.5) * 2, -1, 1);
  const age = clamp(headAge, 0, 1);
  if (Math.abs(bias) <= 0.001) return age;
  const curve = clamp(liftParticles.spacing.curve, 0.2, 4);
  const exponent = bias > 0 ? 1 + bias * curve : 1 / (1 + Math.abs(bias) * curve);
  return clamp(Math.pow(age, exponent), 0, 1);
}

export function liftParticleDensityScale(liftParticles: LiftParticles, headAge: number): number {
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

export function flatLiftScatterOffset(
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
