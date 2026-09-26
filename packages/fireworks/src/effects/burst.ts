import * as THREE from 'three';
import type { Particle } from '../Particle.ts';
import type { FireworkDesign } from '../design.ts';
import type { RandomSource } from '../random.ts';
import {
  effectCometFinish,
  effectSpawnFishSwarm,
  effectSpawnWaterfall,
  effectSpawnWhirl,
} from './secondary.ts';
import { effectSpawnStarLayer } from './stars.ts';
import type { EffectContext, ShellEffectBudget } from './types.ts';

export function effectDetonate(
  ctx: EffectContext,
  particle: Particle,
  _dt: number,
  _time: number,
  design: FireworkDesign,
  color: THREE.Color,
  seed: 1 | 2 | 3,
  rng: RandomSource,
  audible: boolean,
  budget: ShellEffectBudget,
): void {
  const boom = design.sound.boom;
  if (audible) {
    if (boom !== 'none') {
      if (boom === 'heavy' || (boom === 'auto' && design.size > 200)) {
        ctx.sh.playRandomHeavyBoom(1.0, rng);
      } else {
        ctx.sh.playRandomLightBoom(1.0, rng);
      }
    }
  }

  ctx.lights.setHemi(design.size / 100, color.r, color.g, color.b);
  if (design.geometry === 'single_tail') {
    effectCometFinish(ctx, particle, design, color, rng, audible, budget);
    return;
  }
  if (design.geometry === 'fish') {
    effectSpawnFishSwarm(ctx, particle, design, color, rng, audible, budget);
    return;
  }
  if (design.geometry === 'waterfall') {
    effectSpawnWaterfall(ctx, particle, design, color, rng, audible, budget);
    return;
  }
  if (design.geometry === 'whirl') {
    effectSpawnWhirl(ctx, particle, design, color, rng, audible, budget);
    return;
  }

  effectSpawnStarLayer(ctx, 'outer', particle, design, color, seed, rng, audible, budget);
  effectSpawnStarLayer(ctx, 'core', particle, design, color, seed, rng, audible, budget);
}
