import type { Lights } from './Lights.ts';
import type { ParticlePool } from './ParticlePool.ts';
import type { SoundHandler } from './SoundHandler.ts';
import type { FireworkDesign } from './design.ts';
import { effectFire } from './effects/launch.ts';
import type { EffectContext, FireOptions, Pos } from './effects/types.ts';

/** Dispatches a shell into the renderer's independent simulation modules. */
export class Effects {
  private context: EffectContext;
  constructor(pp: ParticlePool, sh: SoundHandler, lights: Lights) {
    this.context = { pp, sh, lights, audible: false };
  }
  setAudible(audible: boolean): void {
    this.context.audible = audible;
  }
  fire(design: FireworkDesign, position: Pos, options: FireOptions): void {
    effectFire(this.context, design, position, options);
  }
}
