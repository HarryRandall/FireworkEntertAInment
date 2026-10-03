/** Source-clock fountain simulation, retaining prototype tuning and stream identities. */
import type { Design } from '../../schema/index';
import { rgb } from '../colour';

import { type ParticleWriter } from '../particles';
import { sourceSpray } from '../spray-source';

import type { GroundRuntime } from './ground';
// Prototype deterministic seed partition: fountain emitter seed step (dimensionless seed offset).
const FOUNTAIN_EMITTER_SEED_STEP = 17;
// Prototype deterministic seed partition: fountain seed scale (dimensionless seed multiplier).
const FOUNTAIN_SEED_SCALE = 53;
const FOUNTAIN_GLOW_COLOUR = '#ffcf8a';

/** Appends deterministic fountain particles at runtime.time seconds from firing; mutates writer. */
export function fillFountain(
  writer: ParticleWriter,
  design: Extract<Design, { kind: 'fountain' }>,
  seed: number,
  runtime: GroundRuntime,
): void {
  const { time, placement } = runtime;
  const [positionX, positionZ] = placement.position ?? [0, 0];

  const fountain = design.ground.fountain;
  for (let emitterIndex = 0; emitterIndex < fountain.emitters; emitterIndex++) {
    const emitterX = positionX + (emitterIndex - (fountain.emitters - 1) / 2) * fountain.spacing_m;
    sourceSpray(
      writer,
      () => [emitterX, fountain.height_m, positionZ],
      0,
      fountain.duration_s,
      time,
      {
        count: Math.round((fountain.rate_per_s * fountain.life_s) / Math.sqrt(fountain.emitters)),
        life: fountain.life_s,
        spread: fountain.speed_m_s,
        speedDist: 'gerb',
        streak: fountain.streak,
        gravity: fountain.gravity_m_s2,
        drag: fountain.drag_per_s,
        size: fountain.size,
        flicker: fountain.flicker,
        glitter: fountain.glitter,
        fork: fountain.fork,
        colour: rgb(fountain.colour),
        seed: seed * FOUNTAIN_SEED_SCALE + emitterIndex * FOUNTAIN_EMITTER_SEED_STEP,
        dir: fountain.direction,
        cone: fountain.cone,
        inherit: 0,
      },
      () => ({ kind: 'fixed', origin: [emitterX, fountain.height_m, positionZ] }),
    );
  }
  if (time < fountain.duration_s && fountain.emitters === 1)
    writer.glow(
      [positionX, fountain.glow_height_m ?? fountain.height_m, positionZ],
      rgb(FOUNTAIN_GLOW_COLOUR),
      fountain.glow,
      fountain.glow_alpha,
    );
}
