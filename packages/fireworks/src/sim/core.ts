import type { Core, Layer } from '../schema/index';
import { mix, rgb, WHITE, type Vec3 } from './colour';
import { directions, unit } from './directions';
import { ParticleWriter } from './particles';
import { hash } from './random';

export function fillCore(
  writer: ParticleWriter,
  core: Core,
  layer: Layer,
  seed: number,
  li: number,
  age: number,
  centre: Vec3,
): void {
  if (!core.enabled || !layer.flash) return;
  const R = layer.radius_m;
  if (core.flash_on && age < 0.15) {
    const env = age < 0.02 ? age / 0.02 : Math.exp(-(age - 0.02) / 0.035);
    writer.glow(
      centre,
      rgb('#ffe2b8'),
      Math.min(R * 0.6, 14) * Math.min(1.5, core.flash) * (0.6 + 0.4 * Math.min(1, age / 0.04)),
      0.2 * env * Math.min(2.2, core.flash),
    );
    if (age < 0.08) {
      const w = Math.sin(Math.pow(age / 0.08, 0.65) * Math.PI);
      writer.glow(centre, WHITE, R * 0.1 * core.flash * (0.4 + 0.6 * w), 0.9 * w);
    }
  }
  if (core.flash_on && age < 0.8) {
    const n = Math.round(260 * Math.min(1.6, core.flash)),
      gold = rgb('#ffe2a8');
    for (let j = 0; j < n; j++) {
      const life = 0.25 + 0.2 * hash(j, seed + li, 91);
      if (age > life) continue;
      const q = unit(j * 3 + li, seed * 5 + 17);
      const reach = R * (0.15 + 0.3 * hash(j, seed + li, 92));
      const e = reach * (1 - Math.exp(-7 * age)),
        u = age / life;
      writer.spark(
        [centre[0] + q[0] * e, centre[1] + q[1] * e - 0.6 * age * age, centre[2] + q[2] * e],
        mix(WHITE, gold, Math.min(1, u * 3)),
        0.28,
        1.1 * Math.pow(1 - u, 1.5),
      );
    }
  }
  const CORE_LIFE = 0.45;
  if (core.ring && age < CORE_LIFE) {
    const dirs = directions(core.count, 'sphere', seed + 7 + li);
    const Rc = R * core.radius * 0.6,
      e = 1 - Math.exp(-5 * age),
      u = age / CORE_LIFE,
      al = Math.pow(1 - u, 2);
    const colour = mix(WHITE, rgb(core.colour), Math.min(1, u * 3));
    for (const q of dirs) {
      const dist = Rc * Math.sqrt(q.h) * e;
      writer.spark(
        [centre[0] + q.x * dist, centre[1] + q.y * dist, centre[2] + q.z * dist],
        colour,
        0.35,
        al * 1.3,
      );
    }
  }
}
