/** Closed-form simulation of comet, wheel, spinner, fountain and tourbillon effects. */
import type { Design } from '../../schema/index';
import { colourAt, rgb, WHITE, type Vec3 } from '../colour';
import { MUZZLE_M, type ShotPlacement } from '../launch';
import { crackle, crossette } from '../modifiers';
import { ParticleWriter } from '../particles';
import { spray } from '../spray';
import { cometSmoke } from '../smoke';
import { hash } from '../random';

// Prototype comet pop flash opacity, dimensionless.
const COMET_POP_FLASH_ALPHA = 0.5;
// Prototype visual tuning: half turn deg (degrees, angle conversion).
const HALF_TURN_DEG = 180;
// Prototype visual tuning: comet flicker (opacity variation).
const COMET_FLICKER = 0.6;
// Prototype visual tuning: comet split gravity m s2 (m/s²).
const COMET_SPLIT_GRAVITY_M_S2 = 6;
// Prototype visual tuning: comet cluster (sparks per slot).
const COMET_CLUSTER = 5;
// Prototype deterministic seed partition: comet split seed scale (dimensionless seed multiplier).
const COMET_SPLIT_SEED_SCALE = 29;
// Prototype visual tuning: comet split size factor (size multiplier).
const COMET_SPLIT_SIZE_FACTOR = 1.6;
// Prototype visual tuning: comet velocity step s (seconds).
const COMET_VELOCITY_STEP_S = 0.02;
// Prototype visual tuning: comet pop key offset (dimensionless key offset).
const COMET_POP_KEY_OFFSET = 7;
// Prototype visual tuning: comet pop count (sparks).
const COMET_POP_COUNT = 30;
// Prototype visual tuning: comet pop flash size (renderer size).
const COMET_POP_FLASH_SIZE = 3;
// Prototype visual tuning: comet head size factor (size multiplier).
const COMET_HEAD_SIZE_FACTOR = 1.9;
// Prototype visual tuning: comet inherit (velocity fraction).
const COMET_INHERIT = 0.05;
// Prototype visual tuning: comet spin inherit (velocity fraction).
const COMET_SPIN_INHERIT = 0.55;
// Prototype deterministic seed partition: comet seed scale (dimensionless seed multiplier).
const COMET_SEED_SCALE = 71;
// Prototype visual tuning: comet glitter flicker (opacity variation).
const COMET_GLITTER_FLICKER = 0.9;
// Prototype visual tuning: comet spray size factor (size multiplier).
const COMET_SPRAY_SIZE_FACTOR = 1.1;
// Prototype visual tuning: comet drag per s (1/s).
const COMET_DRAG_PER_S = 2.4;
// Prototype visual tuning: comet gravity m s2 (m/s²).
const COMET_GRAVITY_M_S2 = 4;
// Prototype visual tuning: comet spread m s (m/s).
const COMET_SPREAD_M_S = 0.8;
// Prototype visual tuning: comet spray tail s (seconds).
const COMET_SPRAY_TAIL_S = 1.4;
// Prototype visual tuning: comet height range (height multiplier).
const COMET_HEIGHT_RANGE = 0.3;
// Prototype visual tuning: comet height min (height multiplier).
const COMET_HEIGHT_MIN = 0.85;
// Prototype visual tuning: comet spin spread m s (m/s).
const COMET_SPIN_SPREAD_M_S = 1.4;
// Prototype visual tuning: comet pop reach m (metres).
const COMET_POP_REACH_M = 5;
// Prototype deterministic seed partition: comet split seed step (dimensionless seed offset).
const COMET_SPLIT_SEED_STEP = 5;
// Prototype visual tuning: comet split density divisor (dimensionless divisor).
const COMET_SPLIT_DENSITY_DIVISOR = 6;
// Prototype visual tuning: comet split trail life s (seconds).
const COMET_SPLIT_TRAIL_LIFE_S = 0.6;
// Prototype visual tuning: comet split trail spread m s (m/s).
const COMET_SPLIT_TRAIL_SPREAD_M_S = 0.6;
// Prototype visual tuning: wheel glow alpha (opacity).
const WHEEL_GLOW_ALPHA = 0.12;
// Prototype visual tuning: wheel glow size (renderer size).
const WHEEL_GLOW_SIZE = 1.6;
// Prototype visual tuning: wheel cluster (sparks per slot).
const WHEEL_CLUSTER = 4;
// Prototype deterministic seed partition: wheel seed scale (dimensionless seed multiplier).
const WHEEL_SEED_SCALE = 43;
// Prototype visual tuning: wheel flicker (opacity variation).
const WHEEL_FLICKER = 0.3;
// Prototype visual tuning: wheel drag per s (1/s).
const WHEEL_DRAG_PER_S = 1.8;
// Prototype visual tuning: wheel gravity m s2 (m/s²).
const WHEEL_GRAVITY_M_S2 = 7;
// Prototype visual tuning: wheel spray life s (seconds).
const WHEEL_SPRAY_LIFE_S = 1.1;
// Prototype visual tuning: wheel tail s (seconds).
const WHEEL_TAIL_S = 1.2;
// Prototype visual tuning: wheel spread m s (m/s).
const WHEEL_SPREAD_M_S = 0.5;
// Prototype visual tuning: wheel spray size (renderer size).
const WHEEL_SPRAY_SIZE = 0.5;
// Prototype visual tuning: spinner z wander scale (wander fraction).
const SPINNER_Z_WANDER_SCALE = 0.8;
// Prototype visual tuning: spinner cluster (sparks per slot).
const SPINNER_CLUSTER = 4;
// Prototype visual tuning: spinner height m (metres).
const SPINNER_HEIGHT_M = 0.25;
// Prototype deterministic seed partition: spinner seed scale (dimensionless seed multiplier).
const SPINNER_SEED_SCALE = 61;
// Prototype visual tuning: spinner flicker (opacity variation).
const SPINNER_FLICKER = 0.4;
// Prototype visual tuning: spinner x harmonic scale (wander fraction).
const SPINNER_X_HARMONIC_SCALE = 0.3;
// Prototype visual tuning: spinner drag per s (1/s).
const SPINNER_DRAG_PER_S = 2.2;
// Prototype visual tuning: spinner gravity m s2 (m/s²).
const SPINNER_GRAVITY_M_S2 = 9;
// Prototype visual tuning: spinner spread m s (m/s).
const SPINNER_SPREAD_M_S = 2.4;
// Prototype visual tuning: spinner orbit m (metres).
const SPINNER_ORBIT_M = 0.6;
// Prototype visual tuning: spinner z rate rad s (rad/s).
const SPINNER_Z_RATE_RAD_S = 0.7;
// Prototype visual tuning: spinner bounce m (metres).
const SPINNER_BOUNCE_M = 0.35;
// Prototype visual tuning: spinner bounce rad s (rad/s).
const SPINNER_BOUNCE_RAD_S = 5;
// Prototype visual tuning: spinner x harmonic rad s (rad/s).
const SPINNER_X_HARMONIC_RAD_S = 2.3;
// Prototype visual tuning: spinner x rate rad s (rad/s).
const SPINNER_X_RATE_RAD_S = 0.9;
// Prototype visual tuning: spinner spacing m (metres).
const SPINNER_SPACING_M = 3;
// Prototype visual tuning: spinner spray life s (seconds).
const SPINNER_SPRAY_LIFE_S = 0.6;
// Prototype visual tuning: spinner spray size (renderer size).
const SPINNER_SPRAY_SIZE = 0.3;
// Prototype visual tuning: spinner inherit (velocity fraction).
const SPINNER_INHERIT = 0.25;
// Prototype visual tuning: spinner head size (renderer size).
const SPINNER_HEAD_SIZE = 0.8;
// Prototype visual tuning: spinner spray tail s (seconds).
const SPINNER_SPRAY_TAIL_S = 1;
// Prototype deterministic seed partition: fountain emitter seed step (dimensionless seed offset).
const FOUNTAIN_EMITTER_SEED_STEP = 17;
// Prototype deterministic seed partition: fountain seed scale (dimensionless seed multiplier).
const FOUNTAIN_SEED_SCALE = 53;
// Prototype visual tuning: tourbillon head size (renderer size).
const TOURBILLON_HEAD_SIZE = 1.6;
// Prototype visual tuning: tourbillon spacing m (metres).
const TOURBILLON_SPACING_M = 14;
// Prototype deterministic seed partition: tourbillon seed scale (dimensionless seed multiplier).
const TOURBILLON_SEED_SCALE = 91;
// Prototype visual tuning: tourbillon flicker (opacity variation).
const TOURBILLON_FLICKER = 0.6;
// Prototype visual tuning: tourbillon drag per s (1/s).
const TOURBILLON_DRAG_PER_S = 2.2;
// Prototype visual tuning: tourbillon gravity m s2 (m/s²).
const TOURBILLON_GRAVITY_M_S2 = 5;
// Prototype visual tuning: tourbillon spread m s (m/s).
const TOURBILLON_SPREAD_M_S = 3.2;
// Prototype visual tuning: tourbillon spray life s (seconds).
const TOURBILLON_SPRAY_LIFE_S = 0.9;
// Prototype visual tuning: tourbillon spray tail s (seconds).
const TOURBILLON_SPRAY_TAIL_S = 1;
// Prototype visual tuning: tourbillon spray size (renderer size).
const TOURBILLON_SPRAY_SIZE = 1;

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
 * Fills the current frame with ground-effect heads, glows, source-clock sprays and smoke.
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
      const spread = (c.spread_deg * Math.PI) / HALF_TURN_DEG;
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
      if (age < 0 || age > c.time_s + COMET_SPRAY_TAIL_S) continue;
      const height =
        c.height_m *
        (c.pattern === 'sequence'
          ? COMET_HEIGHT_MIN + COMET_HEIGHT_RANGE * hash(i, seed, COMET_HEIGHT_STREAM)
          : 1);
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
      const original = colourAt(c.colour, 0, i, hash(i, seed, COMET_COLOUR_STREAM));
      const tail = c.trail === 'star' ? original : rgb(c.trail === 'house' ? '#ffe2a8' : c.trail);
      spray(writer, path, 0, c.time_s, age, {
        count: c.sparks,
        life: c.tail_life_s,
        spread: c.spin_rad_s ? COMET_SPIN_SPREAD_M_S : COMET_SPREAD_M_S,
        gravity: COMET_GRAVITY_M_S2,
        drag: COMET_DRAG_PER_S,
        size: COMET_SPRAY_SIZE_FACTOR * c.size,
        flicker: c.glitter ? COMET_GLITTER_FLICKER : COMET_FLICKER,
        glitter: c.glitter,
        colour: tail,
        seed: seed * COMET_SEED_SCALE + i,
        inherit: c.spin_rad_s ? COMET_SPIN_INHERIT : COMET_INHERIT,
        cluster: COMET_CLUSTER,
      });
      cometSmoke(writer, seed, i, px, pz, age);
      const head = colourAt(c.colour, age / c.time_s, i, hash(i, seed, COMET_COLOUR_STREAM));
      if (age < c.time_s + COMET_HEAD_TAIL_S)
        writer.head(
          path(age),
          head,
          COMET_HEAD_SIZE_FACTOR * c.size,
          c.pop || c.split ? 1 : age > c.time_s ? 1 - (age - c.time_s) / COMET_HEAD_TAIL_S : 1,
          c.halo,
        );
      if (c.pop && age >= c.time_s && age < c.time_s + COMET_POP_DURATION_S) {
        const origin = path(c.time_s);
        if (age - c.time_s < COMET_POP_FLASH_S)
          writer.glow(
            origin,
            WHITE,
            COMET_POP_FLASH_SIZE,
            COMET_POP_FLASH_ALPHA * (1 - (age - c.time_s) / COMET_POP_FLASH_S),
          );
        crackle(
          writer,
          origin,
          c.time_s,
          age,
          COMET_POP_COUNT,
          i + COMET_POP_KEY_OFFSET,
          seed,
          COMET_POP_REACH_M,
        );
      }
      if (c.split && age >= c.time_s) {
        const origin = path(c.time_s),
          before = path(c.time_s - COMET_VELOCITY_STEP_S);
        crossette(
          writer,
          origin,
          [origin[0] - before[0], origin[1] - before[1], origin[2] - before[2]],
          age - c.time_s,
          c.split.life_s,
          c.split.count,
          c.split.distance_m,
          COMET_SPLIT_GRAVITY_M_S2,
          colourAt(c.colour, 0, i, hash(i, seed, COMET_COLOUR_STREAM)),
          COMET_SPLIT_SIZE_FACTOR * c.size,
          {
            at: c.time_s,
            now: age,
            colour: tail,
            seed: seed * COMET_SPLIT_SEED_SCALE + i * COMET_SPLIT_SEED_STEP,
            trail: {
              sparks: c.sparks / COMET_SPLIT_DENSITY_DIVISOR,
              length_s: COMET_SPLIT_TRAIL_LIFE_S,
              spread_m_s: COMET_SPLIT_TRAIL_SPREAD_M_S,
              size: c.size,
              glitter: 0,
            },
          },
        );
      }
    }
  } else if (design.kind === 'wheel') {
    const w = design.ground.wheel;
    if (time > w.duration_s + WHEEL_TAIL_S) return;
    const speed = w.spin_hz * Math.PI * 2,
      spin =
        time < WHEEL_SPIN_RAMP_S
          ? 0.5 * speed * time * time
          : speed * (time - WHEEL_SPIN_RAMP_S / 2);
    for (let j = 0; j < w.drivers; j++) {
      const a = spin + (j / w.drivers) * Math.PI * 2;
      const path = (t: number): Vec3 => {
        const spin =
          t < WHEEL_SPIN_RAMP_S ? 0.5 * speed * t * t : speed * (t - WHEEL_SPIN_RAMP_S / 2);
        const a = spin + (j / w.drivers) * Math.PI * 2;
        return [px + Math.cos(a) * w.radius_m, w.height_m + Math.sin(a) * w.radius_m, pz];
      };
      spray(writer, path, 0, w.duration_s, time, {
        count: w.sparks,
        life: WHEEL_SPRAY_LIFE_S,
        spread: WHEEL_SPREAD_M_S,
        gravity: WHEEL_GRAVITY_M_S2,
        drag: WHEEL_DRAG_PER_S,
        size: WHEEL_SPRAY_SIZE,
        flicker: WHEEL_FLICKER,
        glitter: w.glitter,
        colour: rgb(w.colour),
        seed: seed * WHEEL_SEED_SCALE + j,
        inherit: 1,
        cluster: WHEEL_CLUSTER,
      });
      if (time < w.duration_s)
        writer.head(
          [px + Math.cos(a) * w.radius_m, w.height_m + Math.sin(a) * w.radius_m, pz],
          WHITE,
          WHEEL_HEAD_SIZE_PX,
          1,
        );
    }
    if (time < w.duration_s)
      writer.glow([px, w.height_m, pz], rgb('#ffe2b0'), WHEEL_GLOW_SIZE, WHEEL_GLOW_ALPHA);
  } else if (design.kind === 'spinner') {
    const s = design.ground.spinner;
    for (let i = 0; i < s.count; i++) {
      const age = time - i * SPINNER_STAGGER_S;
      if (age < 0 || age > s.duration_s + SPINNER_SPRAY_TAIL_S) continue;
      const phase = hash(i, seed, SPINNER_PHASE_STREAM) * SPINNER_PHASE_TAU_RAD,
        w = s.wander_m;
      const path = (t: number): Vec3 => {
        const a = t * s.spin_rad_s;
        return [
          px +
            (i - (s.count - 1) / 2) * SPINNER_SPACING_M +
            Math.sin(t * SPINNER_X_RATE_RAD_S + phase) * w +
            Math.sin(t * SPINNER_X_HARMONIC_RAD_S + phase * 2) * w * SPINNER_X_HARMONIC_SCALE +
            Math.cos(a) * SPINNER_ORBIT_M,
          SPINNER_HEIGHT_M +
            Math.abs(Math.sin(t * SPINNER_BOUNCE_RAD_S + phase)) * SPINNER_BOUNCE_M,
          pz +
            Math.cos(t * SPINNER_Z_RATE_RAD_S + phase) * w * SPINNER_Z_WANDER_SCALE +
            Math.sin(a) * SPINNER_ORBIT_M,
        ];
      };
      const colour = rgb(s.colours[i % s.colours.length] ?? '#ffffff');
      spray(writer, path, 0, s.duration_s, age, {
        count: s.sparks,
        life: SPINNER_SPRAY_LIFE_S,
        spread: SPINNER_SPREAD_M_S,
        gravity: SPINNER_GRAVITY_M_S2,
        drag: SPINNER_DRAG_PER_S,
        size: SPINNER_SPRAY_SIZE,
        flicker: SPINNER_FLICKER,
        colour,
        seed: seed * SPINNER_SEED_SCALE + i,
        inherit: SPINNER_INHERIT,
        cluster: SPINNER_CLUSTER,
      });
      if (age < s.duration_s) writer.head(path(age), colour, SPINNER_HEAD_SIZE, 1);
    }
  } else if (design.kind === 'fountain') {
    const f = design.ground.fountain;
    for (let e = 0; e < f.emitters; e++) {
      const ex = px + (e - (f.emitters - 1) / 2) * f.spacing_m;
      spray(writer, () => [ex, f.height_m, pz], 0, f.duration_s, time, {
        count: Math.round((f.rate_per_s * f.life_s) / Math.sqrt(f.emitters)),
        life: f.life_s,
        spread: f.speed_m_s,
        speedDist: 'gerb',
        streak: f.streak,
        gravity: f.gravity_m_s2,
        drag: f.drag_per_s,
        size: f.size,
        flicker: f.flicker,
        glitter: f.glitter,
        fork: f.fork,
        colour: rgb(f.colour),
        seed: seed * FOUNTAIN_SEED_SCALE + e * FOUNTAIN_EMITTER_SEED_STEP,
        dir: f.direction,
        cone: f.cone,
        inherit: 0,
      });
    }
    if (time < f.duration_s && f.emitters === 1)
      writer.glow(
        [px, f.glow_height_m ?? f.height_m, pz],
        rgb(FOUNTAIN_GLOW_COLOUR),
        f.glow,
        f.glow_alpha,
      );
  } else if (design.kind === 'tourbillon') {
    const t = design.ground.tourbillon;
    for (let i = 0; i < t.count; i++) {
      const age = time - i * TOUBILLON_STAGGER_S;
      if (age < 0 || age > t.time_s + TOURBILLON_SPRAY_TAIL_S) continue;
      const path = (tt: number): Vec3 => {
        const u = Math.min(1, tt / t.time_s),
          y = muzzle + (t.height_m - muzzle) * (1 - (1 - u) ** 2);
        const a = tt * t.spin_rad_s + i,
          c = clear(y - muzzle);
        return [
          px + (i - (t.count - 1) / 2) * TOURBILLON_SPACING_M * u + Math.cos(a) * t.radius_m * c,
          y,
          pz + Math.sin(a) * t.radius_m * c,
        ];
      };
      spray(writer, path, 0, t.time_s, age, {
        count: t.sparks,
        life: TOURBILLON_SPRAY_LIFE_S,
        spread: TOURBILLON_SPREAD_M_S,
        gravity: TOURBILLON_GRAVITY_M_S2,
        drag: TOURBILLON_DRAG_PER_S,
        size: TOURBILLON_SPRAY_SIZE,
        flicker: TOURBILLON_FLICKER,
        colour: rgb('#ffe2a8'),
        seed: seed * TOURBILLON_SEED_SCALE + i,
      });
      const u = Math.min(1, age / t.time_s),
        y = muzzle + (t.height_m - muzzle) * (1 - (1 - u) ** 2),
        a = age * t.spin_rad_s + i,
        c = clear(y - muzzle);
      if (age < t.time_s + TOUBILLON_TAIL_S)
        writer.head(
          [
            px + (i - (t.count - 1) / 2) * TOURBILLON_SPACING_M * u + Math.cos(a) * t.radius_m * c,
            y,
            pz + Math.sin(a) * t.radius_m * c,
          ],
          rgb('#fff0c8'),
          TOURBILLON_HEAD_SIZE,
          age > t.time_s ? 1 - (age - t.time_s) / TOUBILLON_TAIL_S : 1,
        );
    }
  }
}
