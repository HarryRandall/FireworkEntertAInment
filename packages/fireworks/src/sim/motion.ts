import type { Layer } from '../schema/index';
import type { StarDirection } from './directions';
import type { Vec3 } from './colour';
// Closed form, evaluated from age alone. Twist precedes additive movement modifiers.
export function starPos(layer: Layer, direction: StarDirection, age: number, centre: Vec3): Vec3 {
  const k = layer.drag_per_s,
    sf = 1 - layer.speed_var + layer.speed_var * direction.h;
  const e = 1 - Math.exp(-k * age),
    dist = layer.radius_m * sf * e;
  const fall = (layer.gravity_m_s2 / k) * (age - e / k);
  let dx = direction.x,
    dy = direction.y,
    dz = direction.z;
  for (const m of layer.modifiers)
    if (m.kind === 'twist') {
      const a = m.angular_speed_rad_s * age,
        c = Math.cos(a),
        s = Math.sin(a);
      if (layer.pattern === 'spiral') {
        const x = dx;
        dx = x * c - dy * s;
        dy = x * s + dy * c;
      } else {
        const x = dx;
        dx = x * c + dz * s;
        dz = -x * s + dz * c;
      }
    }
  const out: Vec3 = [centre[0] + dx * dist, centre[1] + dy * dist - fall, centre[2] + dz * dist];
  for (const m of layer.modifiers) {
    if (m.kind === 'fish') {
      const w = Math.sin(age * m.rate_rad_s + direction.ph) * 1.4 * m.amount * Math.min(1, age * 3);
      const l = Math.hypot(direction.x, direction.y) || 1;
      out[0] += (-direction.y / l) * w;
      out[1] += (direction.x / l) * w + Math.cos(age * m.rate_rad_s * 0.7 + direction.ph) * 0.6;
    } else if (m.kind === 'bees') {
      const t = age * 7 + direction.ph,
        a = Math.min(1, age * 2) * 2.2;
      out[0] += (Math.sin(t * 1.3) + Math.sin(t * 2.9) * 0.5) * a;
      out[1] += (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.3) * 0.5) * a;
      out[2] += (Math.sin(t * 1.1 + 2) + Math.sin(t * 2.3) * 0.5) * a;
    } else if (m.kind === 'flutter') {
      const a = Math.min(1, age * 0.8) * 0.12 * layer.radius_m * m.amount;
      out[0] += Math.sin(age * 4.4 + direction.ph) * a;
      out[2] += Math.cos(age * 3.7 + direction.ph) * a;
    }
  }
  return out;
}
