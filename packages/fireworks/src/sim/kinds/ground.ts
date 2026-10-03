import type { Design } from '../../schema/index';
import { colourAt, rgb, WHITE, type Vec3 } from '../colour';
import { MUZZLE_M, type ShotPlacement } from '../launch';
import { crackle, crossette } from '../modifiers';
import { ParticleWriter } from '../particles';
import { hash } from '../random';

type GroundDesign = Extract<Design, { launch: null }>;
const clear = (height: number) => Math.max(0, Math.min(1, height / 6));

/** Source paths use the emitter's own clock. PR 2.4 can attach sprays without
 * changing head motion or introducing accumulated state. */
export function fillGround(
  writer: ParticleWriter,
  design: GroundDesign,
  seed: number,
  time: number,
  placement: ShotPlacement,
): void {
  const [px, pz] = placement.position ?? [0, 0],
    muzzle = placement.muzzle_m ?? MUZZLE_M;
  if (design.kind === 'comet' || design.kind === 'candle') {
    const c = design.ground.comets,
      n = c.pattern === 'straight' ? 1 : c.count;
    for (let i = 0; i < n; i++) {
      let angle = 0,
        yaw = 0,
        start = 0;
      const spread = (c.spread_deg * Math.PI) / 180;
      if (c.pattern === 'fan' && n > 1) {
        angle = -spread / 2 + (spread * i) / (n - 1);
        start = Math.abs(i - (n - 1) / 2) * 0.08;
      } else if (c.pattern === 'random' || c.pattern === 'sequence') {
        angle = (hash(i, seed, 21) - 0.5) * spread;
        yaw = (hash(i, seed, 23) - 0.5) * spread * (c.pattern === 'sequence' ? 0.5 : 1);
        start = c.pattern === 'sequence' ? i * c.gap_s : hash(i, seed, 22) * 0.6;
      } else if (c.pattern === 'sweep') {
        const row = Math.floor(i / 5),
          j = i % 5;
        angle = -spread / 2 + (spread * (row % 2 ? 4 - j : j)) / 4;
        start = i * c.gap_s;
      }
      const age = time - start;
      if (age < 0 || age > c.time_s + 1.4) continue;
      const height = c.height_m * (c.pattern === 'sequence' ? 0.85 + 0.3 * hash(i, seed, 24) : 1);
      const path = (t: number): Vec3 => {
        const u = Math.min(1, Math.max(0, t / c.time_s)),
          dist = height * (1 - (1 - u) ** 2);
        const spin = c.spin_rad_s ? c.spin_radius_m : 0,
          a = t * c.spin_rad_s + i * 1.7,
          r = spin * clear(dist);
        return [
          px + Math.sin(angle) * dist + Math.cos(a) * r,
          muzzle + Math.cos(angle) * Math.cos(yaw) * dist,
          pz + Math.sin(yaw) * dist + Math.sin(a) * r,
        ];
      };
      const head = colourAt(c.colour, age / c.time_s, i, hash(i, seed, 3));
      if (age < c.time_s + 0.3)
        writer.head(
          path(age),
          head,
          1.9 * c.size,
          c.pop || c.split ? 1 : age > c.time_s ? 1 - (age - c.time_s) / 0.3 : 1,
          c.halo,
        );
      if (c.pop && age >= c.time_s && age < c.time_s + 0.7) {
        const origin = path(c.time_s);
        if (age - c.time_s < 0.05)
          writer.glow(origin, WHITE, 3, 0.5 * (1 - (age - c.time_s) / 0.05));
        crackle(writer, origin, c.time_s, age, 30, i + 7, seed, 5);
      }
      if (c.split && age >= c.time_s) {
        const origin = path(c.time_s),
          before = path(c.time_s - 0.02);
        crossette(
          writer,
          origin,
          [origin[0] - before[0], origin[1] - before[1], origin[2] - before[2]],
          age - c.time_s,
          c.split.life_s,
          c.split.count,
          c.split.distance_m,
          6,
          colourAt(c.colour, 0, i, hash(i, seed, 3)),
          1.6 * c.size,
        );
      }
    }
  } else if (design.kind === 'wheel') {
    const w = design.ground.wheel;
    if (time >= w.duration_s) return;
    const speed = w.spin_hz * Math.PI * 2,
      spin = time < 1 ? 0.5 * speed * time * time : speed * (time - 0.5);
    for (let j = 0; j < w.drivers; j++) {
      const a = spin + (j / w.drivers) * Math.PI * 2;
      writer.head(
        [px + Math.cos(a) * w.radius_m, w.height_m + Math.sin(a) * w.radius_m, pz],
        WHITE,
        0.9,
        1,
      );
    }
    writer.glow([px, w.height_m, pz], rgb('#ffe2b0'), 1.6, 0.12);
  } else if (design.kind === 'spinner') {
    const s = design.ground.spinner;
    for (let i = 0; i < s.count; i++) {
      const age = time - i * 0.4;
      if (age < 0 || age >= s.duration_s) continue;
      const phase = hash(i, seed, 3) * 6.28,
        w = s.wander_m,
        a = age * s.spin_rad_s;
      writer.head(
        [
          px +
            (i - (s.count - 1) / 2) * 3 +
            Math.sin(age * 0.9 + phase) * w +
            Math.sin(age * 2.3 + phase * 2) * w * 0.3 +
            Math.cos(a) * 0.6,
          0.25 + Math.abs(Math.sin(age * 5 + phase)) * 0.35,
          pz + Math.cos(age * 0.7 + phase) * w * 0.8 + Math.sin(a) * 0.6,
        ],
        rgb(s.colours[i % s.colours.length] ?? '#ffffff'),
        0.8,
        1,
      );
    }
  } else if (design.kind === 'fountain') {
    const f = design.ground.fountain;
    // A fountain has no star heads. Its muzzle glow remains while sprays arrive in 2.4.
    if (time < f.duration_s && f.emitters === 1)
      writer.glow([px, f.height_m, pz], rgb('#ffcf8a'), f.glow, f.glow_alpha);
  } else if (design.kind === 'tourbillon') {
    const t = design.ground.tourbillon;
    for (let i = 0; i < t.count; i++) {
      const age = time - i * 0.35;
      if (age < 0 || age >= t.time_s + 0.2) continue;
      const u = Math.min(1, age / t.time_s),
        y = muzzle + (t.height_m - muzzle) * (1 - (1 - u) ** 2),
        a = age * t.spin_rad_s + i,
        c = clear(y - muzzle);
      writer.head(
        [
          px + (i - (t.count - 1) / 2) * 14 * u + Math.cos(a) * t.radius_m * c,
          y,
          pz + Math.sin(a) * t.radius_m * c,
        ],
        rgb('#fff0c8'),
        1.6,
        age > t.time_s ? 1 - (age - t.time_s) / 0.2 : 1,
      );
    }
  }
}
