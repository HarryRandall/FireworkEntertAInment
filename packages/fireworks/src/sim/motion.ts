import type { Layer } from '../schema/index';
import type { StarDirection } from './directions';
import type { Vec3 } from './colour';
// Closed form, evaluated from age alone. Modifier motion arrives in PR 2.3.
export function starPos(layer: Layer, direction: StarDirection, age: number, centre: Vec3): Vec3 {
  const k = layer.drag_per_s,
    sf = 1 - layer.speed_var + layer.speed_var * direction.h;
  const e = 1 - Math.exp(-k * age),
    dist = layer.radius_m * sf * e;
  const fall = (layer.gravity_m_s2 / k) * (age - e / k);
  return [
    centre[0] + direction.x * dist,
    centre[1] + direction.y * dist - fall,
    centre[2] + direction.z * dist,
  ];
}
