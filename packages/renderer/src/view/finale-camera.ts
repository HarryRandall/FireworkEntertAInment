/**
 * Finale 3D's front (audience) camera, so a show can be compared 1-1 with its exported
 * script. Measured from Finale's viewport with two positions 70 m apart at its documented
 * 60 degree vertical field of view.
 */
import type { Framing } from '../sim/framing';

/** Finale 3D's vertical field of view, degrees. */
export const FINALE_FOV_DEG = 60;
// Camera height above the launch line, metres.
const FINALE_CAMERA_HEIGHT_M = 12.3;
// Camera distance in front of the launch line, towards the audience, metres.
const FINALE_CAMERA_DISTANCE_M = 118.2;
// Height where the 14.7 degree upward view ray crosses the launch line (z = 0), metres.
const FINALE_TARGET_HEIGHT_M = 43.3;

/** Camera position and orbit target in world metres for Finale's front view. */
export function finaleFrontFraming(): Framing {
  return {
    position: [0, FINALE_CAMERA_HEIGHT_M, FINALE_CAMERA_DISTANCE_M],
    target: [0, FINALE_TARGET_HEIGHT_M, 0],
  };
}
