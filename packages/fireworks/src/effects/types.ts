import type { FireworkDesign, FireworkStarLayer } from '../design.ts';
import type { Lights } from '../Lights.ts';
import type { ParticlePool } from '../ParticlePool.ts';
import type { RandomSource } from '../random.ts';
import type { SoundHandler } from '../SoundHandler.ts';

export type Pos = { x: number; y: number; z: number };

export type LiftPathPoint = Pos & { progress: number; age: number };

export type FireOptions = {
  rng: RandomSource;
  smokeRng?: RandomSource;
  liftRng?: RandomSource;
  audible: boolean;
  panDegrees?: number;
  tiltDegrees?: number;
};

export type LaunchShell = FireworkDesign['launch']['shell'];

export type ShellTrail = LaunchShell['trail'];

export type LiftParticles = FireworkDesign['launch']['liftParticles'];

export type BurstTrail = FireworkStarLayer['burstTrail'];

export type ShellEffectBudget = {
  trailParticlesRemaining: number;
  crackleFragmentsRemaining: number;
  crackleSoundsRemaining: number;
};

export type EffectContext = {
  pp: ParticlePool;
  sh: SoundHandler;
  lights: Lights;
  audible: boolean;
};
