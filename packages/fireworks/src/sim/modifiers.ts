/** Ordered layer-modifier composition and its independent child-particle events. */
import type { Layer, Trail } from '../schema/index';
import { mix, WHITE, type Vec3 } from './colour';
import type { StarDirection } from './directions';
import { unit } from './directions';
import { starPos } from './motion';
import { ParticleWriter } from './particles';
import { rgb } from './colour';
import { spray, TRAIL_DENSITY, TRAIL_LIFE } from './spray';
import { hash } from './random';

// Prototype split-child flash opacity and head halo multiplier, dimensionless.
const CHILD_FLASH_ALPHA = 0.5;
const CHILD_HALO_ALPHA = 0.5;
// Prototype visual tuning: crackle rgb (linear RGB).
const CRACKLE_RGB = [1, 0.85, 0.55] as Vec3;
// Prototype deterministic seed partition: crackle key stride (dimensionless key multiplier).
const CRACKLE_KEY_STRIDE = 31;
// Prototype deterministic seed partition: crackle seed scale (dimensionless seed multiplier).
const CRACKLE_SEED_SCALE = 37;
// Prototype visual tuning: crackle flash s (seconds).
const CRACKLE_FLASH_S = 0.025;
// Prototype visual tuning: crackle flash alpha (opacity).
const CRACKLE_FLASH_ALPHA = 0.35;
// Prototype visual tuning: crackle flash size (renderer size).
const CRACKLE_FLASH_SIZE = 0.9;
// Prototype visual tuning: crackle alpha (opacity multiplier).
const CRACKLE_ALPHA = 2.2;
// Prototype visual tuning: crackle size (renderer size).
const CRACKLE_SIZE = 0.65;
// Prototype visual tuning: crackle life s (seconds).
const CRACKLE_LIFE_S = 0.06;
// Prototype visual tuning: crackle fall m s (m/s).
const CRACKLE_FALL_M_S = 1.5;
// Prototype visual tuning: crackle delay power (dimensionless exponent).
const CRACKLE_DELAY_POWER = 1.2;
// Prototype visual tuning: crackle delay range s (seconds).
const CRACKLE_DELAY_RANGE_S = 0.55;
// Prototype visual tuning: crackle delay s (seconds).
const CRACKLE_DELAY_S = 0.05;
// Prototype visual tuning: crossette axis limit (unit direction component, avoids a near-parallel basis).
const CROSSETTE_AXIS_LIMIT = 0.9;
// Prototype visual tuning: child fade start (life fraction).
const CHILD_FADE_START = 0.6;
// Prototype visual tuning: child fade window (life fraction).
const CHILD_FADE_WINDOW = 0.4;
// Prototype visual tuning: child phase rad (radians).
const CHILD_PHASE_RAD = 0.6;
// Prototype visual tuning: child forward bias (velocity direction fraction).
const CHILD_FORWARD_BIAS = 0.25;
// Prototype visual tuning: child drag per s (1/s).
const CHILD_DRAG_PER_S = 3;
// Prototype visual tuning: child trail flicker (opacity variation).
const CHILD_TRAIL_FLICKER = 0.2;
// Prototype visual tuning: child trail drag per s (1/s).
const CHILD_TRAIL_DRAG_PER_S = 2.6;
// Prototype visual tuning: child trail factor (density or life multiplier).
const CHILD_TRAIL_FACTOR = 0.7;
// Prototype visual tuning: child trail min life s (seconds).
const CHILD_TRAIL_MIN_LIFE_S = 0.35;
// Prototype visual tuning: child trail default count (sparks).
const CHILD_TRAIL_DEFAULT_COUNT = 20;
// Prototype visual tuning: child trail min count (sparks).
const CHILD_TRAIL_MIN_COUNT = 24;
// Prototype visual tuning: child flash s (seconds).
const CHILD_FLASH_S = 0.05;
// Prototype visual tuning: child flash size (renderer size).
const CHILD_FLASH_SIZE = 2.5;
// Prototype visual tuning: child trail default life s (seconds).
const CHILD_TRAIL_DEFAULT_LIFE_S = 0.5;
// Prototype visual tuning: child trail gravity m s2 (m/s²).
const CHILD_TRAIL_GRAVITY_M_S2 = 3;
// Prototype deterministic seed partition: child seed scale (dimensionless seed multiplier).
const CHILD_SEED_SCALE = 17;
// Prototype deterministic seed partition: child star seed step (dimensionless seed offset).
const CHILD_STAR_SEED_STEP = 11;
// Prototype visual tuning: pop fade power (dimensionless exponent).
const POP_FADE_POWER = 1.5;
// Prototype visual tuning: pop size (renderer size).
const POP_SIZE = 0.75;
// Prototype visual tuning: continuous crackle reach m (metres).
const CONTINUOUS_CRACKLE_REACH_M = 1.2;
// Prototype deterministic seed partition: pop seed offset (dimensionless seed offset).
const POP_SEED_OFFSET = 41;
// Prototype deterministic seed partition: pop key stride (dimensionless key multiplier).
const POP_KEY_STRIDE = 64;
// Prototype visual tuning: pop colour per s (1/s).
const POP_COLOUR_PER_S = 5;
// Prototype visual tuning: crackle event window s (seconds).
const CRACKLE_EVENT_WINDOW_S = 0.6;
// Prototype visual tuning: pop reach m (metres).
const POP_REACH_M = 3.5;
// Prototype visual tuning: pop expansion per s (1/s).
const POP_EXPANSION_PER_S = 6;
// Prototype visual tuning: pop flash s (seconds).
const POP_FLASH_S = 0.05;
// Prototype visual tuning: pop flash alpha (opacity).
const POP_FLASH_ALPHA = 0.55;
// Prototype visual tuning: terminal crackle head s (seconds).
const TERMINAL_CRACKLE_HEAD_S = 0.45;
// Prototype visual tuning: child life fraction (life fraction).
const CHILD_LIFE_FRACTION = 0.4;
// Prototype visual tuning: terminal crackle reach m (metres).
const TERMINAL_CRACKLE_REACH_M = 4.5;
// Prototype visual tuning: terminal crackle window s (seconds).
const TERMINAL_CRACKLE_WINDOW_S = 0.7;
// Prototype deterministic seed partition: continuous crackle event key stride (dimensionless key multiplier).
const CONTINUOUS_CRACKLE_EVENT_KEY_STRIDE = 977;
// Prototype visual tuning: continuous crackle count (sparks).
const CONTINUOUS_CRACKLE_COUNT = 3;
// Prototype deterministic seed partition: continuous crackle key stride (dimensionless key multiplier).
const CONTINUOUS_CRACKLE_KEY_STRIDE = 53;
// Prototype visual tuning: continuous crackle jitter s (seconds).
const CONTINUOUS_CRACKLE_JITTER_S = 0.12;
// Prototype visual tuning: continuous crackle interval s (seconds).
const CONTINUOUS_CRACKLE_INTERVAL_S = 0.18;
// Prototype visual tuning: continuous crackle slots (events).
const CONTINUOUS_CRACKLE_SLOTS = 40;
// Prototype visual tuning: child burn shrink (size multiplier).
const CHILD_BURN_SHRINK = 0.65;
// Prototype visual tuning: child head size factor (size multiplier).
const CHILD_HEAD_SIZE_FACTOR = 1.7;
// Prototype visual tuning: child reach fraction (layer radius fraction).
const CHILD_REACH_FRACTION = 0.3;
// Prototype visual tuning: child life max s (seconds).
const CHILD_LIFE_MAX_S = 0.9;
// Prototype visual tuning: parent velocity step s (seconds).
const PARENT_VELOCITY_STEP_S = 0.02;
// Prototype visual tuning: pop fall m s2 (m/s², quadratic fall coefficient).
const POP_FALL_M_S2 = 1.2;
// Prototype visual tuning: terminal crackle head size factor (size multiplier).
const TERMINAL_CRACKLE_HEAD_SIZE_FACTOR = 1.2;
// Prototype visual tuning: terminal crackle head alpha (opacity multiplier).
const TERMINAL_CRACKLE_HEAD_ALPHA = 0.4;
// Prototype visual tuning: pop life s (seconds).
const POP_LIFE_S = 0.6;
// Prototype visual tuning: pop alpha (opacity multiplier).
const POP_ALPHA = 1.5;

// Prototype random streams independently sample crackle timing, direction, reach and repetition.
const CRACKLE_TIME_STREAM = 23;
const CRACKLE_AZIMUTH_STREAM = 21;
const CRACKLE_VERTICAL_STREAM = 22;
const CRACKLE_REACH_STREAM = 24;
const CONTINUOUS_CRACKLE_JITTER_STREAM = 26;

/** Composition order: twist, additive motion, ghost colour, burn fade, brightness
 * modifiers in stored order, parent termination, then independent child events.
 * Terminating effects use the earliest trigger; child events still run independently.
 * Glitter adjusts tail controls and whistle is retained as a sound control.
 */
/** Returns the parent-star end time in seconds after terminal modifiers. */
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

/** Appends short-lived crackle sparks emitted from an origin in metres. */
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
    const tp =
        at +
        CRACKLE_DELAY_S +
        CRACKLE_DELAY_RANGE_S *
          Math.pow(
            hash(key * CRACKLE_KEY_STRIDE + c, seed, CRACKLE_TIME_STREAM),
            CRACKLE_DELAY_POWER,
          ),
      age = now - tp;
    if (age < 0 || age > CRACKLE_LIFE_S) continue;
    const a = hash(key, c + seed * CRACKLE_SEED_SCALE, CRACKLE_AZIMUTH_STREAM) * Math.PI * 2,
      y = hash(key, c + seed * CRACKLE_SEED_SCALE, CRACKLE_VERTICAL_STREAM) * 2 - 1;
    const r = Math.sqrt(1 - y * y),
      dist = reach * Math.sqrt(hash(key, c + seed * CRACKLE_SEED_SCALE, CRACKLE_REACH_STREAM));
    const p: Vec3 = [
      origin[0] + Math.cos(a) * r * dist,
      origin[1] + y * dist - CRACKLE_FALL_M_S * (tp - at),
      origin[2] + Math.sin(a) * r * dist,
    ];
    const k = 1 - age / CRACKLE_LIFE_S,
      colour = CRACKLE_RGB;
    writer.spark(p, colour, CRACKLE_SIZE, CRACKLE_ALPHA * k * k);
    if (age < CRACKLE_FLASH_S)
      writer.glow(p, colour, CRACKLE_FLASH_SIZE, CRACKLE_FLASH_ALPHA * (1 - age / CRACKLE_FLASH_S));
  }
}

/** Source-clock inputs for a split child's independent trail. */
export interface ChildTrail {
  /** Child birth time in seconds on the parent source clock. */
  at: number;
  /** Evaluation time in seconds on the same source clock. */
  now: number;
  /** Authored count, lifetime in seconds, speed in m/s, size and glitter controls. */
  trail: Pick<Trail, 'sparks' | 'length_s' | 'spread_m_s' | 'size' | 'glitter'>;
  /** Linear RGB colour of the child trail. */
  colour: Vec3;
  /** Dimensionless seed partition for the child source. */
  seed: number;
}
// Child paths share the same closed-form motion for heads and trails.
/** Appends crossette heads and optional trails from origin in metres.
 * velocity specifies the parent's travel direction in m/s; age and life are
 * seconds, reach is metres, gravity is m/s², colour is linear RGB and size is
 * renderer units. Child sources use the parent's clock through tail.at/now. */
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
  tail?: ChildTrail,
): void {
  if (age < 0 || age > life) return;
  const length = Math.hypot(...velocity) || 1;
  const fx = velocity[0] / length,
    fy = velocity[1] / length,
    fz = velocity[2] / length;
  const ax = Math.abs(fy) < CROSSETTE_AXIS_LIMIT ? 0 : 1,
    ay = Math.abs(fy) < CROSSETTE_AXIS_LIMIT ? 1 : 0;
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
  if (age < CHILD_FLASH_S)
    writer.glow(origin, WHITE, CHILD_FLASH_SIZE, CHILD_FLASH_ALPHA * (1 - age / CHILD_FLASH_S));
  const progress = age / life,
    alpha = progress > CHILD_FADE_START ? 1 - (progress - CHILD_FADE_START) / CHILD_FADE_WINDOW : 1;
  for (let c = 0; c < count; c++) {
    const a = (c / count) * Math.PI * 2 + CHILD_PHASE_RAD,
      ca = Math.cos(a),
      sa = Math.sin(a),
      e = 1 - Math.exp(-CHILD_DRAG_PER_S * age);
    if (tail) {
      const path = (time: number): Vec3 => {
        const s = time - tail.at,
          e = 1 - Math.exp(-CHILD_DRAG_PER_S * s);
        return [
          origin[0] + (px * ca + bx * sa + fx * CHILD_FORWARD_BIAS) * reach * e,
          origin[1] +
            (py * ca + by * sa + fy * CHILD_FORWARD_BIAS) * reach * e -
            (gravity / CHILD_DRAG_PER_S) * (s - e / CHILD_DRAG_PER_S),
          origin[2] + (pz * ca + bz * sa + fz * CHILD_FORWARD_BIAS) * reach * e,
        ];
      };
      spray(writer, path, tail.at, tail.at + life, tail.now, {
        count: Math.max(
          CHILD_TRAIL_MIN_COUNT,
          Math.round(
            (tail.trail.sparks || CHILD_TRAIL_DEFAULT_COUNT) * TRAIL_DENSITY * CHILD_TRAIL_FACTOR,
          ),
        ),
        life: Math.max(
          CHILD_TRAIL_MIN_LIFE_S,
          (tail.trail.length_s || CHILD_TRAIL_DEFAULT_LIFE_S) * TRAIL_LIFE * CHILD_TRAIL_FACTOR,
        ),
        spread: tail.trail.spread_m_s,
        gravity: CHILD_TRAIL_GRAVITY_M_S2,
        drag: CHILD_TRAIL_DRAG_PER_S,
        size: tail.trail.size,
        flicker: CHILD_TRAIL_FLICKER,
        glitter: tail.trail.glitter,
        colour: tail.colour,
        seed: tail.seed + c,
        alpha,
        inherit: 0,
      });
    }
    writer.head(
      [
        origin[0] + (px * ca + bx * sa + fx * CHILD_FORWARD_BIAS) * reach * e,
        origin[1] +
          (py * ca + by * sa + fy * CHILD_FORWARD_BIAS) * reach * e -
          (gravity / CHILD_DRAG_PER_S) * (age - e / CHILD_DRAG_PER_S),
        origin[2] + (pz * ca + bz * sa + fz * CHILD_FORWARD_BIAS) * reach * e,
      ],
      colour,
      size,
      alpha,
      CHILD_HALO_ALPHA,
    );
  }
}

/** Appends child events for a layer at its age in seconds. */
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
        next = starPos(layer, q, at + PARENT_VELOCITY_STEP_S, centre);
      crossette(
        writer,
        origin,
        [next[0] - origin[0], next[1] - origin[1], next[2] - origin[2]],
        age - at,
        Math.min(CHILD_LIFE_MAX_S, life * CHILD_LIFE_FRACTION),
        m.count,
        layer.radius_m * CHILD_REACH_FRACTION,
        layer.gravity_m_s2,
        base,
        CHILD_HEAD_SIZE_FACTOR * layer.head.size * (1 - CHILD_BURN_SHRINK * m.at * m.at),
        {
          at,
          now: age,
          trail: layer.trail,
          colour:
            layer.trail.colour === 'star'
              ? base
              : rgb(layer.trail.colour === 'house' ? '#ffe2a8' : layer.trail.colour),
          seed: seed * CHILD_SEED_SCALE + index * CHILD_STAR_SEED_STEP,
        },
      );
    } else if (m.kind === 'crackle' && age >= at) {
      if (m.spread === 'continuous') {
        for (let k = 0; k < CONTINUOUS_CRACKLE_SLOTS; k++) {
          const tp =
            at +
            k * CONTINUOUS_CRACKLE_INTERVAL_S +
            CONTINUOUS_CRACKLE_JITTER_S *
              hash(
                index * CONTINUOUS_CRACKLE_KEY_STRIDE + k,
                seed,
                CONTINUOUS_CRACKLE_JITTER_STREAM,
              );
          if (tp > life || tp > age) break;
          if (age - tp > CRACKLE_EVENT_WINDOW_S) continue;
          crackle(
            writer,
            starPos(layer, q, tp, centre),
            tp,
            age,
            CONTINUOUS_CRACKLE_COUNT,
            index * CONTINUOUS_CRACKLE_EVENT_KEY_STRIDE + k,
            seed,
            CONTINUOUS_CRACKLE_REACH_M,
          );
        }
      } else if (age < at + TERMINAL_CRACKLE_WINDOW_S) {
        crackle(
          writer,
          starPos(layer, q, at, centre),
          at,
          age,
          m.count * 2,
          index,
          seed,
          TERMINAL_CRACKLE_REACH_M,
        );
        if (layer.head.visible && age < at + TERMINAL_CRACKLE_HEAD_S)
          writer.head(
            starPos(layer, q, age, centre),
            appearance.colour,
            TERMINAL_CRACKLE_HEAD_SIZE_FACTOR * layer.head.size,
            TERMINAL_CRACKLE_HEAD_ALPHA *
              (1 - (age - at) / TERMINAL_CRACKLE_HEAD_S) *
              appearance.alpha,
            0,
          );
      }
    } else if (m.kind === 'pop' && age >= life && age < life + POP_LIFE_S) {
      const pt = age - life,
        origin = starPos(layer, q, life, centre);
      if (pt < POP_FLASH_S) writer.glow(origin, WHITE, 2, POP_FLASH_ALPHA * (1 - pt / POP_FLASH_S));
      const e = (1 - Math.exp(-POP_EXPANSION_PER_S * pt)) * POP_REACH_M * m.amount,
        k = Math.pow(1 - pt / POP_LIFE_S, POP_FADE_POWER),
        colour = mix(WHITE, base, Math.min(1, pt * POP_COLOUR_PER_S));
      for (let c = 0; c < m.count; c++) {
        const u = unit(index * POP_KEY_STRIDE + c, seed + POP_SEED_OFFSET);
        writer.spark(
          [
            origin[0] + u[0] * e,
            origin[1] + u[1] * e - POP_FALL_M_S2 * pt * pt,
            origin[2] + u[2] * e,
          ],
          colour,
          POP_SIZE,
          POP_ALPHA * k,
        );
      }
    }
  }
}

/** Returns the layer's clamped glitter intensity and delayed tail start in seconds. */
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
