/** Analytic ground source controls, keeping GPU descriptors separate from reference callbacks. */
import type { Design } from '../schema/index';
import type { Vec3 } from './colour';
import type { SprayTrajectory } from './spray-source';
// Prototype lateral spacing and phase separation, metres and radians respectively.
const SPINNER_SPACING_M = 3;
const TOURBILLON_SPACING_M = 14;
const COMET_SPIN_PHASE_RAD = 1.7;
/** Copies wheel controls in metres/radians and rad/s; centre is a world metre position. */
export function wheelTrajectory(
  wheel: Extract<Design, { kind: 'wheel' }>['ground']['wheel'],
  centre: Vec3,
  driverIndex: number,
): SprayTrajectory {
  return {
    kind: 'wheel',
    centre,
    radius: wheel.radius_m,
    speed: wheel.spin_hz * Math.PI * 2,
    phase: (driverIndex / wheel.drivers) * Math.PI * 2,
  };
}
/** Copies spinner controls and random phase in radians; centre is a world metre position. */
export function spinnerTrajectory(
  spinner: Extract<Design, { kind: 'spinner' }>['ground']['spinner'],
  centre: Vec3,
  index: number,
  phase: number,
): SprayTrajectory {
  return {
    kind: 'spinner',
    centre: [
      centre[0] + (index - (spinner.count - 1) / 2) * SPINNER_SPACING_M,
      centre[1],
      centre[2],
    ],
    wander: spinner.wander_m,
    speed: spinner.spin_rad_s,
    phase,
  };
}
/** Copies tourbillon climb controls in metres/seconds/rad/s; centre includes muzzle height. */
export function tourbillonTrajectory(
  tourbillon: Extract<Design, { kind: 'tourbillon' }>['ground']['tourbillon'],
  centre: Vec3,
  index: number,
): SprayTrajectory {
  return {
    kind: 'tourbillon',
    centre,
    height: tourbillon.height_m,
    duration: tourbillon.time_s,
    offset: (index - (tourbillon.count - 1) / 2) * TOURBILLON_SPACING_M,
    speed: tourbillon.spin_rad_s,
    radius: tourbillon.radius_m,
    phase: index,
  };
}
/** Copies selected comet climb geometry; angles are radians, height/centre metres and time seconds. */
export function cometTrajectory(
  comets: Extract<Design, { kind: 'comet' | 'candle' }>['ground']['comets'],
  centre: Vec3,
  selection: { height: number; angle: number; yaw: number; sourceIndex: number },
): SprayTrajectory {
  return {
    kind: 'comet',
    centre,
    height: selection.height,
    duration: comets.time_s,
    angle: selection.angle,
    yaw: selection.yaw,
    speed: comets.spin_rad_s,
    radius: comets.spin_rad_s !== 0 ? comets.spin_radius_m : 0,
    phase: selection.sourceIndex * COMET_SPIN_PHASE_RAD,
  };
}
