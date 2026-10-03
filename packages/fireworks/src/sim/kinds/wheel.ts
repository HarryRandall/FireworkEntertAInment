/** Source-clock wheel simulation, retaining prototype tuning and stream identities. */
import type { Design } from '../../schema/index';
import { rgb, WHITE, type Vec3 } from '../colour';

import { type ParticleWriter } from '../particles';
import { sourceSpray } from '../spray-source';
import { wheelTrajectory } from '../ground-sources';

import type { GroundRuntime } from './ground';
// Prototype visual tuning: wheel glow alpha (opacity).
const WHEEL_GLOW_ALPHA = 0.12;
// Prototype visual tuning: wheel glow size (renderer size).
const WHEEL_GLOW_SIZE = 1.6;
// Prototype visual tuning: wheel cluster (sparks per slot).
const WHEEL_CLUSTER = 4;
// Prototype deterministic seed partition: wheel seed scale (dimensionless seed multiplier).
const WHEEL_SEED_SCALE = 43;
// Prototype visual tuning: wheel flicker (opacity variation).
const WHEEL_FLICKER = 0.3;
// Prototype visual tuning: wheel drag per s (1/s).
const WHEEL_DRAG_PER_S = 1.8;
// Prototype visual tuning: wheel gravity m s2 (m/s²).
const WHEEL_GRAVITY_M_S2 = 7;
// Prototype visual tuning: wheel spray life s (seconds).
const WHEEL_SPRAY_LIFE_S = 1.1;
// Prototype visual tuning: wheel tail s (seconds).
const WHEEL_TAIL_S = 1.2;
// Prototype visual tuning: wheel spread m s (m/s).
const WHEEL_SPREAD_M_S = 0.5;
// Prototype visual tuning: wheel spray size (renderer size).
const WHEEL_SPRAY_SIZE = 0.5;
// Prototype acceleration ramp duration, in seconds.
const WHEEL_SPIN_RAMP_S = 1;
// Prototype visual tuning: driver head size, in renderer pixels.
const WHEEL_HEAD_SIZE_PX = 0.9;

// Integrates the prototype's linear acceleration before constant angular speed.
function wheelPhase(time: number, spinSpeedRadS: number): number {
  return time < WHEEL_SPIN_RAMP_S
    ? 0.5 * spinSpeedRadS * time * time
    : spinSpeedRadS * (time - WHEEL_SPIN_RAMP_S / 2);
}

/** Appends deterministic wheel particles at runtime.time seconds from firing; mutates writer. */
export function fillWheel(
  writer: ParticleWriter,
  design: Extract<Design, { kind: 'wheel' }>,
  seed: number,
  runtime: GroundRuntime,
): void {
  const { time, placement } = runtime;
  const [positionX, positionZ] = placement.position ?? [0, 0];

  const wheel = design.ground.wheel;
  if (time > wheel.duration_s + WHEEL_TAIL_S) return;
  const spinSpeedRadS = wheel.spin_hz * Math.PI * 2;
  for (let driverIndex = 0; driverIndex < wheel.drivers; driverIndex++) {
    const path = (sourceTime: number): Vec3 => {
      const spinPhaseRad = wheelPhase(sourceTime, spinSpeedRadS);
      const phaseRad = spinPhaseRad + (driverIndex / wheel.drivers) * Math.PI * 2;
      return [
        positionX + Math.cos(phaseRad) * wheel.radius_m,
        wheel.height_m + Math.sin(phaseRad) * wheel.radius_m,
        positionZ,
      ];
    };
    sourceSpray(
      writer,
      path,
      0,
      wheel.duration_s,
      time,
      {
        count: wheel.sparks,
        life: WHEEL_SPRAY_LIFE_S,
        spread: WHEEL_SPREAD_M_S,
        gravity: WHEEL_GRAVITY_M_S2,
        drag: WHEEL_DRAG_PER_S,
        size: WHEEL_SPRAY_SIZE,
        flicker: WHEEL_FLICKER,
        glitter: wheel.glitter,
        colour: rgb(wheel.colour),
        seed: seed * WHEEL_SEED_SCALE + driverIndex,
        inherit: 1,
        cluster: WHEEL_CLUSTER,
      },
      () => wheelTrajectory(wheel, [positionX, wheel.height_m, positionZ], driverIndex),
    );
    if (time < wheel.duration_s) writer.head(path(time), WHITE, WHEEL_HEAD_SIZE_PX, 1);
  }
  if (time < wheel.duration_s)
    writer.glow(
      [positionX, wheel.height_m, positionZ],
      rgb('#ffe2b0'),
      WHEEL_GLOW_SIZE,
      WHEEL_GLOW_ALPHA,
    );
}
