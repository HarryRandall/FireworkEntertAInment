/** Source-clock tourbillon simulation, retaining prototype tuning and stream identities. */
import type { Design } from '../../schema/index';
import { rgb, type Vec3 } from '../colour';
import { MUZZLE_M } from '../launch';

import { type ParticleWriter } from '../particles';
import { spray } from '../spray';

import type { GroundRuntime } from './ground';
// Prototype visual tuning: sideways paths reach their full offset once a particle is 6 m clear.
const CLEARANCE_HEIGHT_M = 6;
// Prototype visual tuning: tourbillon head size (renderer size).
const TOURBILLON_HEAD_SIZE = 1.6;
// Prototype visual tuning: tourbillon spacing m (metres).
const TOURBILLON_SPACING_M = 14;
// Prototype deterministic seed partition: tourbillon seed scale (dimensionless seed multiplier).
const TOURBILLON_SEED_SCALE = 91;
// Prototype visual tuning: tourbillon flicker (opacity variation).
const TOURBILLON_FLICKER = 0.6;
// Prototype visual tuning: tourbillon drag per s (1/s).
const TOURBILLON_DRAG_PER_S = 2.2;
// Prototype visual tuning: tourbillon gravity m s2 (m/s²).
const TOURBILLON_GRAVITY_M_S2 = 5;
// Prototype visual tuning: tourbillon spread m s (m/s).
const TOURBILLON_SPREAD_M_S = 3.2;
// Prototype visual tuning: tourbillon spray life s (seconds).
const TOURBILLON_SPRAY_LIFE_S = 0.9;
// Prototype visual tuning: tourbillon spray tail s (seconds).
const TOURBILLON_SPRAY_TAIL_S = 1;
// Prototype visual tuning: tourbillon spray size (renderer size).
const TOURBILLON_SPRAY_SIZE = 1;
// Prototype timing: delay between tourbillons, in seconds.
const TOURBILLON_STAGGER_S = 0.35;
// Prototype head fade after the climb, in seconds.
const TOURBILLON_TAIL_S = 0.2;
const clear = (height: number) => Math.max(0, Math.min(1, height / CLEARANCE_HEIGHT_M));

/** Appends deterministic tourbillon particles at runtime.time seconds from firing; mutates writer. */
export function fillTourbillon(
  writer: ParticleWriter,
  design: Extract<Design, { kind: 'tourbillon' }>,
  seed: number,
  runtime: GroundRuntime,
): void {
  const { time, placement } = runtime;
  const [positionX, positionZ] = placement.position ?? [0, 0];
  const muzzle = placement.muzzle_m ?? MUZZLE_M;

  const tourbillon = design.ground.tourbillon;
  for (let sourceIndex = 0; sourceIndex < tourbillon.count; sourceIndex++) {
    const age = time - sourceIndex * TOURBILLON_STAGGER_S;
    if (age < 0 || age > tourbillon.time_s + TOURBILLON_SPRAY_TAIL_S) continue;
    const path = (sourceTime: number): Vec3 => {
      const climbProgress = Math.min(1, sourceTime / tourbillon.time_s);
      const heightM = muzzle + (tourbillon.height_m - muzzle) * (1 - (1 - climbProgress) ** 2);
      const phaseRad = sourceTime * tourbillon.spin_rad_s + sourceIndex;
      const clearance = clear(heightM - muzzle);
      return [
        positionX +
          (sourceIndex - (tourbillon.count - 1) / 2) * TOURBILLON_SPACING_M * climbProgress +
          Math.cos(phaseRad) * tourbillon.radius_m * clearance,
        heightM,
        positionZ + Math.sin(phaseRad) * tourbillon.radius_m * clearance,
      ];
    };
    spray(writer, path, 0, tourbillon.time_s, age, {
      count: tourbillon.sparks,
      life: TOURBILLON_SPRAY_LIFE_S,
      spread: TOURBILLON_SPREAD_M_S,
      gravity: TOURBILLON_GRAVITY_M_S2,
      drag: TOURBILLON_DRAG_PER_S,
      size: TOURBILLON_SPRAY_SIZE,
      flicker: TOURBILLON_FLICKER,
      colour: rgb('#ffe2a8'),
      seed: seed * TOURBILLON_SEED_SCALE + sourceIndex,
    });
    const climbProgress = Math.min(1, age / tourbillon.time_s);
    const heightM = muzzle + (tourbillon.height_m - muzzle) * (1 - (1 - climbProgress) ** 2);
    const phaseRad = age * tourbillon.spin_rad_s + sourceIndex;
    const clearance = clear(heightM - muzzle);
    if (age < tourbillon.time_s + TOURBILLON_TAIL_S)
      writer.head(
        [
          positionX +
            (sourceIndex - (tourbillon.count - 1) / 2) * TOURBILLON_SPACING_M * climbProgress +
            Math.cos(phaseRad) * tourbillon.radius_m * clearance,
          heightM,
          positionZ + Math.sin(phaseRad) * tourbillon.radius_m * clearance,
        ],
        rgb('#fff0c8'),
        TOURBILLON_HEAD_SIZE,
        age > tourbillon.time_s ? 1 - (age - tourbillon.time_s) / TOURBILLON_TAIL_S : 1,
      );
  }
}
