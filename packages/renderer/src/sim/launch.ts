/** Closed-form launch path from a tube muzzle to its authored apex. */
import type { Launch } from '../schema/index';
import type { Vec3 } from './colour';
import { LAUNCH_STYLES, type LaunchStyle } from './launch-styles';
// Prototype launch calibration: height above muzzle for full sideways motion, metres.
const CLEARANCE_M = 6;
// Prototype launch calibration: half turn for angle conversion, degrees.
const HALF_TURN_DEG = 180;
// Prototype launch calibration: ordinary climb sway speed, radians per second.
const CLIMB_SWAY_RAD_S = 3;
// Prototype launch calibration: ordinary climb sway amplitude, metres.
const CLIMB_SWAY_M = 0.25;
// Prototype launch calibration: whistle x vibration, radians per second.
const JITTER_X_RAD_S = 251;
// Prototype launch calibration: whistle z vibration, radians per second.
const JITTER_Z_RAD_S = 197;
// Prototype launch calibration: rocket x wobble, radians per second.
const WOBBLE_X_RAD_S = 19;
// Prototype launch calibration: rocket z wobble, radians per second.
const WOBBLE_Z_RAD_S = 15;
// Prototype launch calibration: rocket z amplitude ratio, dimensionless.
const WOBBLE_Z_SCALE = 0.6;
// Prototype launch calibration: fallback spiral radius, metres.
const DEFAULT_SPIRAL_RADIUS_M = 0.9;
// Prototype launch calibration: fallback spiral speed, radians per second.
const DEFAULT_SPIRAL_RAD_S = 26;

export interface ShotPlacement {
  /** Horizontal [x, z] firing position in metres; defaults to the world origin. */
  position?: readonly [number, number];
  /** Muzzle height in metres; defaults to the calibrated tube height. */
  muzzle_m?: number;
}
/** Default tube muzzle height in metres, from the prototype scene calibration. */
export const MUZZLE_M = 1.8;
const clear = (heightM: number) => Math.max(0, Math.min(1, heightM / CLEARANCE_M));
/** Computes a launch head's world position in metres at a firing-relative time in seconds. */
export function launchPos(
  launch: Launch,
  seed: number,
  time: number,
  placement: ShotPlacement = {},
): Vec3 {
  const [positionX, positionZ] = placement.position ?? [0, 0];
  const muzzle = placement.muzzle_m ?? MUZZLE_M;
  const climbProgress = Math.min(1, Math.max(0, time / launch.time_s));
  const heightM =
    muzzle + (launch.height_m - muzzle) * (1 - (1 - climbProgress) * (1 - climbProgress));
  const lean = Math.tan((launch.tilt_deg * Math.PI) / HALF_TURN_DEG);
  const clearance = clear(heightM - muzzle);
  let worldX =
    positionX +
    lean * heightM +
    Math.sin(time * CLIMB_SWAY_RAD_S + seed) * CLIMB_SWAY_M * clearance;
  let worldZ = positionZ;
  const style = LAUNCH_STYLES[launch.tail];
  if (style.jitter !== undefined && style.jitter !== 0) {
    worldX += Math.sin(time * JITTER_X_RAD_S + seed) * style.jitter * clearance;
    worldZ += Math.cos(time * JITTER_Z_RAD_S + seed) * style.jitter * clearance;
  }
  if (style.wobble !== undefined && style.wobble !== 0) {
    worldX += Math.sin(time * WOBBLE_X_RAD_S + seed) * style.wobble * clearance;
    worldZ += Math.cos(time * WOBBLE_Z_RAD_S + seed) * style.wobble * WOBBLE_Z_SCALE * clearance;
  }
  if (style.spiral === true) {
    const spiralRadiusM = spiralRadius(style, time, launch.time_s) * clearance;
    const rate = style.spiralRate ?? DEFAULT_SPIRAL_RAD_S;
    worldX += Math.cos(time * rate + seed) * spiralRadiusM;
    worldZ += Math.sin(time * rate + seed) * spiralRadiusM;
  }
  return [worldX, heightM, worldZ];
}

function spiralRadius(style: LaunchStyle, time: number, climbTime: number): number {
  const decay = style.spiralKeep === true ? 1 : 1 - Math.min(1, time / climbTime);
  return (style.spiralR ?? DEFAULT_SPIRAL_RADIUS_M) * decay;
}
