import type { FireworkDesign, FireworkStarLayer } from '../design.ts';
import { STAR_AIR_RESISTANCE_PERCENT_MAX, STAR_TERMINAL_VELOCITY_MAX } from '../design.ts';
import { TRAIL_PARTICLE_BUDGET } from '../emission.ts';
import type { RandomSource } from '../random.ts';
import {
  CRACKLE_TOTAL_FRAGMENT_BUDGET,
  CRACKLE_TOTAL_SOUND_BUDGET,
  MAX_STAR_GRAVITY,
  MIN_STAR_GRAVITY,
} from './constants.ts';
import type { ShellEffectBudget } from './types.ts';

export function rangeRand(range: [number, number], rng: RandomSource): number {
  const [a, b] = range;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return min + rng.next() * (max - min);
}

export function clampStarGravity(gravity: number): number {
  return Math.min(MAX_STAR_GRAVITY, Math.max(gravity, MIN_STAR_GRAVITY));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function variationFactor(rng: RandomSource, percent: number, minimum = 0.05): number {
  return Math.max(minimum, 1 + (rng.next() * 2 - 1) * (clamp(percent, 0, 100) / 100));
}

export function layerAirResistance(drag: number, layer: FireworkStarLayer): number {
  const scale = clamp(layer.burst.airResistancePercent, 0, STAR_AIR_RESISTANCE_PERCENT_MAX);
  return drag * (scale / 100);
}

export function layerVerticalVelocity(velocityY: number, layer: FireworkStarLayer): number {
  const terminalVelocity = clamp(layer.burst.terminalVelocity, 0, STAR_TERMINAL_VELOCITY_MAX);
  return Math.max(velocityY, -terminalVelocity);
}

export function createShellEffectBudget(): ShellEffectBudget {
  return {
    trailParticlesRemaining: TRAIL_PARTICLE_BUDGET,
    crackleFragmentsRemaining: CRACKLE_TOTAL_FRAGMENT_BUDGET,
    crackleSoundsRemaining: CRACKLE_TOTAL_SOUND_BUDGET,
  };
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Whether this design renders its lift and stars with the streak machinery. */
export function usesStreakTrails(design: FireworkDesign): boolean {
  const outer = design.stars.outer;
  return outer.enabled && outer.burstTrail.enabled && outer.burstTrail.particlesPerStar > 0;
}
