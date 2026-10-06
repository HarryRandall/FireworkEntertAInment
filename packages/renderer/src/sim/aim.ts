/** Tube aiming shared by mine stars and climbing ground sources. */
import type { ShotPlacement } from './launch';
import type { StarDirection } from './directions';
// Degrees per mathematical half turn, angular SI conversion.
const HALF_TURN_DEG = 180;

/** Converts optional horizontal and forward tube lean from degrees to radians. */
export function placementAimRadians(placement: ShotPlacement): readonly [number, number] {
  return [
    ((placement.pan_deg ?? 0) * Math.PI) / HALF_TURN_DEG,
    ((placement.tilt_deg ?? 0) * Math.PI) / HALF_TURN_DEG,
  ];
}

/** Rotates a mine's cone direction towards its tube aim, preserving deterministic random samples. */
export function aimMineDirection(
  direction: StarDirection,
  placement: ShotPlacement,
): StarDirection {
  const [pan, tilt] = placementAimRadians(placement);
  const x = direction.x * Math.cos(pan) + direction.y * Math.sin(pan);
  const vertical = direction.y * Math.cos(pan) - direction.x * Math.sin(pan);
  return {
    ...direction,
    x,
    y: vertical * Math.cos(tilt) - direction.z * Math.sin(tilt),
    z: direction.z * Math.cos(tilt) + vertical * Math.sin(tilt),
  };
}
