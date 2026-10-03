/** Closed-form simulation of comet, wheel, spinner, fountain and tourbillon effects. */
import type { Design } from '../../schema/index';
import { colourAt, rgb, WHITE, type Vec3 } from '../colour';
import { MUZZLE_M, type ShotPlacement } from '../launch';
import { crackle, crossette } from '../modifiers';
import { ParticleWriter } from '../particles';
import { hash } from '../random';

type GroundDesign = Extract<Design, { launch: null }>;
// Prototype visual tuning: sideways paths reach their full offset once a particle is 6 m clear.
const CLEARANCE_HEIGHT_M = 6;
// Prototype visual tuning: staggered fan comets start 0.08 s farther from the centre.
const FAN_STAGGER_S = 0.08;
const RANDOM_START_WINDOW_S = 0.6;
const SWEEP_ROW_SIZE = 5;
const COMET_HEAD_TAIL_S = 0.3;
const COMET_POP_DURATION_S = 0.7;
const COMET_POP_FLASH_S = 0.05;
const COMET_SPIN_PHASE_RAD = 1.7;
const WHEEL_SPIN_RAMP_S = 1;
const WHEEL_HEAD_SIZE_PX = 0.9;
const SPINNER_STAGGER_S = 0.4;
const SPINNER_PHASE_TAU_RAD = 6.28;
const TOUBILLON_STAGGER_S = 0.35;
const TOUBILLON_TAIL_S = 0.2;
const FOUNTAIN_GLOW_COLOUR = '#ffcf8a';
// Prototype random streams independently sample comet spread, yaw, start, height and colour.
const COMET_ANGLE_STREAM = 21;
const COMET_YAW_STREAM = 23;
const COMET_START_STREAM = 22;
const COMET_HEIGHT_STREAM = 24;
const COMET_COLOUR_STREAM = 3;
const SPINNER_PHASE_STREAM = 3;
const clear = (height: number) => Math.max(0, Math.min(1, height / CLEARANCE_HEIGHT_M));

/**
 * Fills the current frame with closed-form ground-effect heads and glows.
 * @param writer Particle output collector.
 * @param design Ground-effect design with no launch.
 * @param seed Random seed, dimensionless.
 * @param time Seconds from effect firing.
 * @param placement Horizontal metres and muzzle height in metres.
 * @returns Nothing; particles are appended to `writer`.
 */
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
        start = Math.abs(i - (n - 1) / 2) * FAN_STAGGER_S;
      } else if (c.pattern === 'random' || c.pattern === 'sequence') {
        angle = (hash(i, seed, COMET_ANGLE_STREAM) - 0.5) * spread;
        yaw =
          (hash(i, seed, COMET_YAW_STREAM) - 0.5) * spread * (c.pattern === 'sequence' ? 0.5 : 1);
        start =
          c.pattern === 'sequence'
            ? i * c.gap_s
            : hash(i, seed, COMET_START_STREAM) * RANDOM_START_WINDOW_S;
      } else if (c.pattern === 'sweep') {
        const row = Math.floor(i / SWEEP_ROW_SIZE),
          j = i % SWEEP_ROW_SIZE;
        angle =
          -spread / 2 + (spread * (row % 2 ? SWEEP_ROW_SIZE - 1 - j : j)) / (SWEEP_ROW_SIZE - 1);
        start = i * c.gap_s;
      }
      const age = time - start;
      if (age < 0 || age > c.time_s + 1.4) continue;
      const height =
        c.height_m *
        (c.pattern === 'sequence' ? 0.85 + 0.3 * hash(i, seed, COMET_HEIGHT_STREAM) : 1);
      const path = (t: number): Vec3 => {
        const u = Math.min(1, Math.max(0, t / c.time_s)),
          dist = height * (1 - (1 - u) ** 2);
        const spin = c.spin_rad_s ? c.spin_radius_m : 0,
          a = t * c.spin_rad_s + i * COMET_SPIN_PHASE_RAD,
          r = spin * clear(dist);
        return [
          px + Math.sin(angle) * dist + Math.cos(a) * r,
          muzzle + Math.cos(angle) * Math.cos(yaw) * dist,
          pz + Math.sin(yaw) * dist + Math.sin(a) * r,
        ];
      };
      const head = colourAt(c.colour, age / c.time_s, i, hash(i, seed, COMET_COLOUR_STREAM));
      if (age < c.time_s + COMET_HEAD_TAIL_S)
        writer.head(
          path(age),
          head,
          1.9 * c.size,
          c.pop || c.split ? 1 : age > c.time_s ? 1 - (age - c.time_s) / COMET_HEAD_TAIL_S : 1,
          c.halo,
        );
      if (c.pop && age >= c.time_s && age < c.time_s + COMET_POP_DURATION_S) {
        const origin = path(c.time_s);
        if (age - c.time_s < COMET_POP_FLASH_S)
          writer.glow(origin, WHITE, 3, 0.5 * (1 - (age - c.time_s) / COMET_POP_FLASH_S));
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
          colourAt(c.colour, 0, i, hash(i, seed, COMET_COLOUR_STREAM)),
          1.6 * c.size,
        );
      }
    }
  } else if (design.kind === 'wheel') {
    const w = design.ground.wheel;
    if (time >= w.duration_s) return;
    const speed = w.spin_hz * Math.PI * 2,
      spin =
        time < WHEEL_SPIN_RAMP_S
          ? 0.5 * speed * time * time
          : speed * (time - WHEEL_SPIN_RAMP_S / 2);
    for (let j = 0; j < w.drivers; j++) {
      const a = spin + (j / w.drivers) * Math.PI * 2;
      writer.head(
        [px + Math.cos(a) * w.radius_m, w.height_m + Math.sin(a) * w.radius_m, pz],
        WHITE,
        WHEEL_HEAD_SIZE_PX,
        1,
      );
    }
    writer.glow([px, w.height_m, pz], rgb('#ffe2b0'), 1.6, 0.12);
  } else if (design.kind === 'spinner') {
    const s = design.ground.spinner;
    for (let i = 0; i < s.count; i++) {
      const age = time - i * SPINNER_STAGGER_S;
      if (age < 0 || age >= s.duration_s) continue;
      const phase = hash(i, seed, SPINNER_PHASE_STREAM) * SPINNER_PHASE_TAU_RAD,
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
    // Fountains currently draw only their single-emitter muzzle glow, not spray particles.
    if (time < f.duration_s && f.emitters === 1)
      writer.glow([px, f.height_m, pz], rgb(FOUNTAIN_GLOW_COLOUR), f.glow, f.glow_alpha);
  } else if (design.kind === 'tourbillon') {
    const t = design.ground.tourbillon;
    for (let i = 0; i < t.count; i++) {
      const age = time - i * TOUBILLON_STAGGER_S;
      if (age < 0 || age >= t.time_s + TOUBILLON_TAIL_S) continue;
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
        age > t.time_s ? 1 - (age - t.time_s) / TOUBILLON_TAIL_S : 1,
      );
    }
  }
}
