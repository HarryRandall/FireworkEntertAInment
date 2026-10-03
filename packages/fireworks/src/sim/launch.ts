/** Closed-form launch path from a tube muzzle to its authored apex. */
import type { Launch } from '../schema/index';
import type { Vec3 } from './colour';
import { LAUNCH_STYLES } from './launch-styles';
export interface ShotPlacement {
  /** Horizontal [x, z] firing position in metres; defaults to the world origin. */
  position?: readonly [number, number];
  /** Muzzle height in metres; defaults to the calibrated tube height. */
  muzzle_m?: number;
}
/** Default tube muzzle height in metres, from the prototype scene calibration. */
export const MUZZLE_M = 1.8;
const clear = (h: number) => Math.max(0, Math.min(1, h / 6));
/** Computes a launch head's world position in metres at a firing-relative time in seconds. */
export function launchPos(
  launch: Launch,
  seed: number,
  time: number,
  placement: ShotPlacement = {},
): Vec3 {
  const [px, pz] = placement.position ?? [0, 0];
  const muzzle = placement.muzzle_m ?? MUZZLE_M;
  const u = Math.min(1, Math.max(0, time / launch.time_s));
  const y = muzzle + (launch.height_m - muzzle) * (1 - (1 - u) * (1 - u));
  const lean = Math.tan((launch.tilt_deg * Math.PI) / 180),
    c = clear(y - muzzle);
  let x = px + lean * y + Math.sin(time * 3 + seed) * 0.25 * c,
    z = pz;
  const st = LAUNCH_STYLES[launch.tail];
  if (st.jitter) {
    x += Math.sin(time * 251 + seed) * st.jitter * c;
    z += Math.cos(time * 197 + seed) * st.jitter * c;
  }
  if (st.wobble) {
    x += Math.sin(time * 19 + seed) * st.wobble * c;
    z += Math.cos(time * 15 + seed) * st.wobble * 0.6 * c;
  }
  if (st.spiral) {
    const sr =
      (st.spiralR ?? 0.9) * (st.spiralKeep ? 1 : 1 - Math.min(1, time / launch.time_s)) * c;
    x += Math.cos(time * (st.spiralRate ?? 26) + seed) * sr;
    z += Math.sin(time * (st.spiralRate ?? 26) + seed) * sr;
  }
  return [x, y, z];
}
