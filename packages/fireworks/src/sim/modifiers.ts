import type { Layer } from '../schema/index';
import { mix, WHITE, type Vec3 } from './colour';
import type { StarDirection } from './directions';
import { unit } from './directions';
import { starPos } from './motion';
import { ParticleWriter } from './particles';
import { hash } from './random';

/** Composition order: twist, additive motion, ghost colour, burn fade, brightness
 * modifiers in stored order, parent termination, then independent child events.
 * Terminating effects use the earliest trigger; child events still run independently.
 * Glitter is a spray control (2.4), whistle is a sound control (2.8).
 */
export function parentEnd(layer: Layer, life: number): number {
  return Math.min(
    life,
    ...layer.modifiers.map((m) =>
      m.kind === 'crossette' ||
      m.kind === 'split' ||
      (m.kind === 'crackle' && m.spread !== 'continuous')
        ? m.at * life
        : Infinity,
    ),
  );
}

export function crackle(
  writer: ParticleWriter,
  origin: Vec3,
  at: number,
  now: number,
  count: number,
  key: number,
  seed: number,
  reach: number,
): void {
  for (let c = 0; c < count; c++) {
    const tp = at + 0.05 + 0.55 * Math.pow(hash(key * 31 + c, seed, 23), 1.2),
      age = now - tp;
    if (age < 0 || age > 0.06) continue;
    const a = hash(key, c + seed * 37, 21) * Math.PI * 2,
      y = hash(key, c + seed * 37, 22) * 2 - 1;
    const r = Math.sqrt(1 - y * y),
      dist = reach * Math.sqrt(hash(key, c + seed * 37, 24));
    const p: Vec3 = [
      origin[0] + Math.cos(a) * r * dist,
      origin[1] + y * dist - 1.5 * (tp - at),
      origin[2] + Math.sin(a) * r * dist,
    ];
    const k = 1 - age / 0.06,
      colour: Vec3 = [1, 0.85, 0.55];
    writer.spark(p, colour, 0.65, 2.2 * k * k);
    if (age < 0.025) writer.glow(p, colour, 0.9, 0.35 * (1 - age / 0.025));
  }
}

// Child paths stay independent of sprays, so 2.4 can attach tails to the same motion.
export function crossette(
  writer: ParticleWriter,
  origin: Vec3,
  velocity: Vec3,
  age: number,
  life: number,
  count: number,
  reach: number,
  gravity: number,
  colour: Vec3,
  size: number,
): void {
  if (age < 0 || age > life) return;
  const length = Math.hypot(...velocity) || 1;
  const fx = velocity[0] / length,
    fy = velocity[1] / length,
    fz = velocity[2] / length;
  const ax = Math.abs(fy) < 0.9 ? 0 : 1,
    ay = Math.abs(fy) < 0.9 ? 1 : 0;
  let px = ay * fz,
    py = -ax * fz,
    pz = ax * fy - ay * fx;
  const l = Math.hypot(px, py, pz) || 1;
  px /= l;
  py /= l;
  pz /= l;
  const bx = fy * pz - fz * py,
    by = fz * px - fx * pz,
    bz = fx * py - fy * px;
  if (age < 0.05) writer.glow(origin, WHITE, 2.5, 0.5 * (1 - age / 0.05));
  const progress = age / life,
    alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
  for (let c = 0; c < count; c++) {
    const a = (c / count) * Math.PI * 2 + 0.6,
      ca = Math.cos(a),
      sa = Math.sin(a),
      e = 1 - Math.exp(-3 * age);
    writer.head(
      [
        origin[0] + (px * ca + bx * sa + fx * 0.25) * reach * e,
        origin[1] + (py * ca + by * sa + fy * 0.25) * reach * e - (gravity / 3) * (age - e / 3),
        origin[2] + (pz * ca + bz * sa + fz * 0.25) * reach * e,
      ],
      colour,
      size,
      alpha,
      0.5,
    );
  }
}

export function fillModifierEvents(
  writer: ParticleWriter,
  layer: Layer,
  q: StarDirection,
  index: number,
  seed: number,
  age: number,
  life: number,
  centre: Vec3,
  appearance: { base: Vec3; colour: Vec3; alpha: number },
): void {
  const base = appearance.base;
  for (const m of layer.modifiers) {
    const at = m.at * life;
    if ((m.kind === 'crossette' || m.kind === 'split') && age >= at) {
      const origin = starPos(layer, q, at, centre),
        next = starPos(layer, q, at + 0.02, centre);
      crossette(
        writer,
        origin,
        [next[0] - origin[0], next[1] - origin[1], next[2] - origin[2]],
        age - at,
        Math.min(0.9, life * 0.4),
        m.count,
        layer.radius_m * 0.3,
        layer.gravity_m_s2,
        base,
        1.7 * layer.head.size * (1 - 0.65 * m.at * m.at),
      );
    } else if (m.kind === 'crackle' && age >= at) {
      if (m.spread === 'continuous') {
        for (let k = 0; k < 40; k++) {
          const tp = at + k * 0.18 + 0.12 * hash(index * 53 + k, seed, 26);
          if (tp > life || tp > age) break;
          if (age - tp > 0.6) continue;
          crackle(writer, starPos(layer, q, tp, centre), tp, age, 3, index * 977 + k, seed, 1.2);
        }
      } else if (age < at + 0.7) {
        crackle(writer, starPos(layer, q, at, centre), at, age, m.count * 2, index, seed, 4.5);
        if (layer.head.visible && age < at + 0.45)
          writer.head(
            starPos(layer, q, age, centre),
            appearance.colour,
            1.2 * layer.head.size,
            0.4 * (1 - (age - at) / 0.45) * appearance.alpha,
            0,
          );
      }
    } else if (m.kind === 'pop' && age >= life && age < life + 0.6) {
      const pt = age - life,
        origin = starPos(layer, q, life, centre);
      if (pt < 0.05) writer.glow(origin, WHITE, 2, 0.55 * (1 - pt / 0.05));
      const e = (1 - Math.exp(-6 * pt)) * 3.5 * m.amount,
        k = Math.pow(1 - pt / 0.6, 1.5),
        colour = mix(WHITE, base, Math.min(1, pt * 5));
      for (let c = 0; c < m.count; c++) {
        const u = unit(index * 64 + c, seed + 41);
        writer.spark(
          [origin[0] + u[0] * e, origin[1] + u[1] * e - 1.2 * pt * pt, origin[2] + u[2] * e],
          colour,
          0.75,
          1.5 * k,
        );
      }
    }
  }
}

/** Spray integration hook. Glitter has no independent head particle in the
 * prototype; it changes the tail's delayed flash envelope in PR 2.4. */
export function trailControls(layer: Layer): { glitter: number; glitter_delay_s: number } {
  let glitter = layer.trail.glitter;
  let glitter_delay_s = layer.trail.glitter_delay_s;
  for (const m of layer.modifiers)
    if (m.kind === 'glitter') {
      glitter = Math.max(0, Math.min(1, glitter + m.amount));
      glitter_delay_s = m.at * layer.life_s;
    }
  return { glitter, glitter_delay_s };
}
