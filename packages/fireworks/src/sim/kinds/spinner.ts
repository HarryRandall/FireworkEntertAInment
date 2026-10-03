/** Source-clock spinner simulation, retaining prototype tuning and stream identities. */
import type { Design } from '../../schema/index';
import { rgb, type Vec3 } from '../colour';

import { type ParticleWriter } from '../particles';
import { sourceSpray } from '../spray-source';
import { spinnerTrajectory } from '../ground-sources';

import { hash } from '../random';

import type { GroundRuntime } from './ground';
// Prototype visual tuning: spinner z wander scale (wander fraction).
const SPINNER_Z_WANDER_SCALE = 0.8;
// Prototype visual tuning: spinner cluster (sparks per slot).
const SPINNER_CLUSTER = 4;
// Prototype visual tuning: spinner height m (metres).
const SPINNER_HEIGHT_M = 0.25;
// Prototype deterministic seed partition: spinner seed scale (dimensionless seed multiplier).
const SPINNER_SEED_SCALE = 61;
// Prototype visual tuning: spinner flicker (opacity variation).
const SPINNER_FLICKER = 0.4;
// Prototype visual tuning: spinner x harmonic scale (wander fraction).
const SPINNER_X_HARMONIC_SCALE = 0.3;
// Prototype visual tuning: spinner drag per s (1/s).
const SPINNER_DRAG_PER_S = 2.2;
// Prototype visual tuning: spinner gravity m s2 (m/s²).
const SPINNER_GRAVITY_M_S2 = 9;
// Prototype visual tuning: spinner spread m s (m/s).
const SPINNER_SPREAD_M_S = 2.4;
// Prototype visual tuning: spinner orbit m (metres).
const SPINNER_ORBIT_M = 0.6;
// Prototype visual tuning: spinner z rate rad s (rad/s).
const SPINNER_Z_RATE_RAD_S = 0.7;
// Prototype visual tuning: spinner bounce m (metres).
const SPINNER_BOUNCE_M = 0.35;
// Prototype visual tuning: spinner bounce rad s (rad/s).
const SPINNER_BOUNCE_RAD_S = 5;
// Prototype visual tuning: spinner x harmonic rad s (rad/s).
const SPINNER_X_HARMONIC_RAD_S = 2.3;
// Prototype visual tuning: spinner x rate rad s (rad/s).
const SPINNER_X_RATE_RAD_S = 0.9;
// Prototype visual tuning: spinner spacing m (metres).
const SPINNER_SPACING_M = 3;
// Prototype visual tuning: spinner spray life s (seconds).
const SPINNER_SPRAY_LIFE_S = 0.6;
// Prototype visual tuning: spinner spray size (renderer size).
const SPINNER_SPRAY_SIZE = 0.3;
// Prototype visual tuning: spinner inherit (velocity fraction).
const SPINNER_INHERIT = 0.25;
// Prototype visual tuning: spinner head size (renderer size).
const SPINNER_HEAD_SIZE = 0.8;
// Prototype visual tuning: spinner spray tail s (seconds).
const SPINNER_SPRAY_TAIL_S = 1;
// Prototype timing: delay between spinners, in seconds.
const SPINNER_STAGGER_S = 0.4;
// Prototype rounded full turn, in radians; retain rounding for hash parity.
const SPINNER_PHASE_TAU_RAD = 6.28;
// Prototype hash stream selecting each spinner's phase, dimensionless.
const SPINNER_PHASE_STREAM = 3;

/** Appends deterministic spinner particles at runtime.time seconds from firing; mutates writer. */
export function fillSpinner(
  writer: ParticleWriter,
  design: Extract<Design, { kind: 'spinner' }>,
  seed: number,
  runtime: GroundRuntime,
): void {
  const { time, placement } = runtime;
  const [positionX, positionZ] = placement.position ?? [0, 0];

  const spinner = design.ground.spinner;
  for (let spinnerIndex = 0; spinnerIndex < spinner.count; spinnerIndex++) {
    const age = time - spinnerIndex * SPINNER_STAGGER_S;
    if (age < 0 || age > spinner.duration_s + SPINNER_SPRAY_TAIL_S) continue;
    const phase = hash(spinnerIndex, seed, SPINNER_PHASE_STREAM) * SPINNER_PHASE_TAU_RAD;
    const wanderM = spinner.wander_m;
    const path = (sourceTime: number): Vec3 => {
      const phaseRad = sourceTime * spinner.spin_rad_s;
      return [
        positionX +
          (spinnerIndex - (spinner.count - 1) / 2) * SPINNER_SPACING_M +
          Math.sin(sourceTime * SPINNER_X_RATE_RAD_S + phase) * wanderM +
          Math.sin(sourceTime * SPINNER_X_HARMONIC_RAD_S + phase * 2) *
            wanderM *
            SPINNER_X_HARMONIC_SCALE +
          Math.cos(phaseRad) * SPINNER_ORBIT_M,
        SPINNER_HEIGHT_M +
          Math.abs(Math.sin(sourceTime * SPINNER_BOUNCE_RAD_S + phase)) * SPINNER_BOUNCE_M,
        positionZ +
          Math.cos(sourceTime * SPINNER_Z_RATE_RAD_S + phase) * wanderM * SPINNER_Z_WANDER_SCALE +
          Math.sin(phaseRad) * SPINNER_ORBIT_M,
      ];
    };
    const colour = rgb(spinner.colours[spinnerIndex % spinner.colours.length] ?? '#ffffff');
    sourceSpray(
      writer,
      path,
      0,
      spinner.duration_s,
      age,
      {
        count: spinner.sparks,
        life: SPINNER_SPRAY_LIFE_S,
        spread: SPINNER_SPREAD_M_S,
        gravity: SPINNER_GRAVITY_M_S2,
        drag: SPINNER_DRAG_PER_S,
        size: SPINNER_SPRAY_SIZE,
        flicker: SPINNER_FLICKER,
        colour,
        seed: seed * SPINNER_SEED_SCALE + spinnerIndex,
        inherit: SPINNER_INHERIT,
        cluster: SPINNER_CLUSTER,
      },
      () =>
        spinnerTrajectory(spinner, [positionX, SPINNER_HEIGHT_M, positionZ], spinnerIndex, phase),
    );
    if (age < spinner.duration_s) writer.head(path(age), colour, SPINNER_HEAD_SIZE, 1);
  }
}
