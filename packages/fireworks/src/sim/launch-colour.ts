/** Launch-tail palette selection shared by climb heads and their source sprays. */
import { mix, rgb, type Vec3 } from './colour';
import type { LaunchStyle } from './launch-styles';

// Prototype warm-to-star tail blend, dimensionless linear RGB interpolation weight.
const STAR_TAIL_MIX = 0.3;
/** Returns linear RGB for a launch style and its first star palette, without mutating either. */
export function launchTailColour(style: LaunchStyle, star: Vec3): Vec3 {
  if (style.colour !== undefined && style.colour.length > 0) return rgb(style.colour);
  if (style.star === true) return mix(rgb('#ffc070'), star, STAR_TAIL_MIX);
  return rgb('#ffe2a8');
}
