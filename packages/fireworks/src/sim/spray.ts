/** Source-clock spray scheduling and allocation-free per-spark state for particle writers. */
import type { Vec3 } from './colour';
import { rgb } from './colour';
import { unit } from './directions';
import type { ParticleWriter } from './particles';
import { hash } from './random';

// Packed vector layout: three components per position or colour.
const VECTOR_COMPONENTS = 3;
// Packed reference row: x/y/z/r/g/b/size/alpha, eight scalar values.
const SPARK_STRIDE = 8;
// Prototype visual tuning: direction count (directions).
const DIRECTION_COUNT = 4096;
// Prototype deterministic seed partition: direction seed (dimensionless seed).
const DIRECTION_SEED = 7919;
// Prototype deterministic seed partition: cluster stream (dimensionless hash stream).
const CLUSTER_STREAM = 9;
// Prototype deterministic seed partition: birth stream (dimensionless hash stream).
const BIRTH_STREAM = 1;
// Prototype deterministic seed partition: life stream (dimensionless hash stream).
const LIFE_STREAM = 2;
// Prototype deterministic seed partition: direction stream (dimensionless hash stream).
const DIRECTION_STREAM = 31;
// Prototype deterministic seed partition: speed stream (dimensionless hash stream).
const SPEED_STREAM = 3;
// Prototype deterministic seed partition: fork stream (dimensionless hash stream).
const FORK_STREAM = 8;
// Prototype deterministic seed partition: fork time stream (dimensionless hash stream).
const FORK_TIME_STREAM = 5;
// Prototype deterministic seed partition: size stream (dimensionless hash stream).
const SIZE_STREAM = 4;
// Prototype deterministic seed partition: glitter stream (dimensionless hash stream).
const GLITTER_STREAM = 7;
// Prototype deterministic seed partition: glitter time stream (dimensionless hash stream).
const GLITTER_TIME_STREAM = 6;
// Prototype visual tuning: slot id stride (IDs per source slot).
const SLOT_ID_STRIDE = 7;
// Prototype deterministic seed partition: fork key stride (dimensionless key multiplier).
const FORK_KEY_STRIDE = 5;
// Prototype deterministic seed partition: fork seed offset (dimensionless seed offset).
const FORK_SEED_OFFSET = 7;
// Prototype deterministic seed partition: fork vertical stream (dimensionless hash stream).
const FORK_VERTICAL_STREAM = 31;
// Prototype deterministic seed partition: fork azimuth stream (dimensionless hash stream).
const FORK_AZIMUTH_STREAM = 32;
// Prototype visual tuning: fork count (children per fork).
const FORK_COUNT = 4;
// Prototype visual tuning: default gravity m s2 (m/s²).
const DEFAULT_GRAVITY_M_S2 = 3;
// Prototype visual tuning: fork speed m s (m/s).
const FORK_SPEED_M_S = 3;
// Prototype visual tuning: fork decay per s (1/s).
const FORK_DECAY_PER_S = 3;
// Prototype visual tuning: fork colour weight (linear RGB fraction).
const FORK_COLOUR_WEIGHT = 0.5;
// Prototype visual tuning: fork white weight (linear RGB fraction).
const FORK_WHITE_WEIGHT = 0.5;
// Prototype visual tuning: glint colour weight (linear RGB fraction).
const GLINT_COLOUR_WEIGHT = 0.35;
// Prototype visual tuning: glint white weight (linear RGB fraction).
const GLINT_WHITE_WEIGHT = 0.65;
// Prototype visual tuning: dormant colour weight (linear RGB fraction).
const DORMANT_COLOUR_WEIGHT = 0.3;
// Prototype visual tuning: dormant ember weight (linear RGB fraction).
const DORMANT_EMBER_WEIGHT = 0.7;
// Prototype visual tuning: gerb speed min (speed fraction).
const GERB_SPEED_MIN = 0.65;
// Prototype visual tuning: gerb speed range (speed fraction).
const GERB_SPEED_RANGE = 0.35;
// Prototype visual tuning: spark speed min (speed fraction).
const SPARK_SPEED_MIN = 0.12;
// Prototype visual tuning: spark speed range (speed fraction).
const SPARK_SPEED_RANGE = 0.9;
// Prototype visual tuning: fork time min (life fraction).
const FORK_TIME_MIN = 0.25;
// Prototype visual tuning: fork time range (life fraction).
const FORK_TIME_RANGE = 0.4;
// Prototype visual tuning: fork life s (seconds).
const FORK_LIFE_S = 0.12;
// Prototype visual tuning: fork size factor (size multiplier).
const FORK_SIZE_FACTOR = 0.2;
// Prototype visual tuning: dormant alpha (opacity multiplier).
const DORMANT_ALPHA = 0.2;
// Prototype visual tuning: glitter delay s (seconds).
const GLITTER_DELAY_S = 0.35;
// Prototype visual tuning: glitter delay min (delay multiplier).
const GLITTER_DELAY_MIN = 0.45;
// Prototype visual tuning: glitter delay range (delay multiplier).
const GLITTER_DELAY_RANGE = 1.1;
// Prototype visual tuning: glitter life limit (life fraction).
const GLITTER_LIFE_LIMIT = 0.9;
// Prototype visual tuning: spark size factor (size multiplier).
const SPARK_SIZE_FACTOR = 0.36;
// Prototype visual tuning: size min (size multiplier).
const SIZE_MIN = 0.55;
// Prototype visual tuning: size range (size multiplier).
const SIZE_RANGE = 1.1;
// Prototype visual tuning: size decay (size multiplier).
const SIZE_DECAY = 0.4;
// Prototype visual tuning: size floor (size multiplier).
const SIZE_FLOOR = 0.6;
// Prototype visual tuning: glint size factor (size multiplier).
const GLINT_SIZE_FACTOR = 1.5;
// Prototype visual tuning: alpha min (opacity multiplier).
const ALPHA_MIN = 0.55;
// Prototype visual tuning: alpha range (opacity multiplier).
const ALPHA_RANGE = 0.9;
// Prototype visual tuning: ember mix max (linear RGB fraction).
const EMBER_MIX_MAX = 0.55;
// Prototype visual tuning: ember mix rate (fraction per normalised life).
const EMBER_MIX_RATE = 0.7;
// Prototype visual tuning: streak size factor (size multiplier).
const STREAK_SIZE_FACTOR = 0.9;
// Prototype visual tuning: velocity step s (seconds).
const VELOCITY_STEP_S = 0.016;
// Prototype visual tuning: default inherit (velocity fraction).
const DEFAULT_INHERIT = 0.22;
// Prototype visual tuning: birth alpha cutoff (opacity).
const BIRTH_ALPHA_CUTOFF = 0.004;
// Prototype visual tuning: streak step s (seconds).
const STREAK_STEP_S = 0.008;
// Prototype visual tuning: white hot life (life fraction).
const WHITE_HOT_LIFE = 0.12;
// Prototype visual tuning: alpha fade power (dimensionless exponent).
const ALPHA_FADE_POWER = 1.4;
// Prototype visual tuning: spark alpha max (opacity multiplier).
const SPARK_ALPHA_MAX = 1.6;
// Prototype visual tuning: glint alpha max (opacity multiplier).
const GLINT_ALPHA_MAX = 2.4;
// Prototype visual tuning: flicker hz (Hz).
const FLICKER_HZ = 28;
// Prototype visual tuning: flicker phase s (seconds per spark ID).
const FLICKER_PHASE_S = 0.013;
// Prototype visual tuning: glint life s (seconds).
const GLINT_LIFE_S = 0.07;
// Prototype visual tuning: fork tau rad (radians, rounded full turn).
const FORK_TAU_RAD = 6.2832;
// Prototype visual tuning: default drag per s (1/s).
const DEFAULT_DRAG_PER_S = 2.5;
// Prototype visual tuning: life base weight (life fraction).
const LIFE_BASE_WEIGHT = 0.3;
// Prototype visual tuning: life random weight (life fraction).
const LIFE_RANDOM_WEIGHT = 0.7;
// Prototype visual tuning: life scale (life multiplier).
const LIFE_SCALE = 1.75;
// Prototype visual tuning: default cluster (sparks per slot).
const DEFAULT_CLUSTER = 3.4;
// Prototype visual tuning: slot interval factor (interval multiplier).
const SLOT_INTERVAL_FACTOR = 1.15;

/** Prototype shell-trail count multiplier, dimensionless visual tuning. */
export const TRAIL_DENSITY = 2.2;
/** Prototype shell-trail lifetime multiplier, dimensionless visual tuning. */
export const TRAIL_LIFE = 1.35;
// Prototype streak sample cap, in points per spark, bounds the reference kernel.
const MAX_STREAK = 16;
// Prototype cooling colour, sRGB converted to linear RGB for interpolation.
const EMBER = rgb('#ff7a33');
// Retain Float32 quantisation of the prototype's shared direction lookup.
const SPRAY_DIRECTIONS = new Float32Array(DIRECTION_COUNT * VECTOR_COMPONENTS);
for (let i = 0; i < DIRECTION_COUNT; i++)
  SPRAY_DIRECTIONS.set(unit(i, DIRECTION_SEED), i * VECTOR_COMPONENTS);

/** Source controls shared by scheduling, birth sampling and the per-spark kernel. */
export interface SprayOptions {
  /** Nominal live spark count before clustering; zero disables emission. */
  count: number;
  /** Base spark lifetime in seconds before per-slot variation. */
  life: number;
  /** Spark ejection speed scale in metres per second. */
  spread: number;
  /** Prototype spark size input in renderer units. */
  size: number;
  /** Dimensionless amplitude of random opacity reduction. */
  flicker: number;
  /** Linear RGB colour of the source. */
  colour: Vec3;
  /** Dimensionless seed for independent deterministic hash streams. */
  seed: number;
  /** Downward acceleration in metres per second squared. */
  gravity?: number;
  /** Velocity decay coefficient in inverse seconds; zero uses the prototype fallback. */
  drag?: number;
  /** Gerb selects the narrow fountain speed distribution. */
  speedDist?: 'gerb';
  /** Number of historical point samples, capped at sixteen. */
  streak?: number;
  /** Probability of replacing a spark with four short-lived children. */
  fork?: number | undefined;
  /** Probability of delayed ignition followed by a brief glint. */
  glitter?: number;
  /** Base glitter ignition delay in seconds. */
  glitterDelay?: number | undefined;
  /** Birth opacity multiplier, used when alphaAt is absent. */
  alpha?: number;
  /** Samples birth opacity at the emission time in source-relative seconds. */
  alphaAt?: ((emissionTime: number) => number) | undefined;
  /** Fraction of source velocity inherited at birth. */
  inherit?: number;
  /** Random cluster size scale in sparks per source slot. */
  cluster?: number;
  /** Optional dimensionless ejection direction added to the random direction. */
  dir?: Vec3;
  /** Dimensionless random-direction scale around dir. */
  cone?: number;
}
/** One live scheduled spark with no accumulated frame state. */
export interface SpraySlot {
  /** Stable dimensionless spark ID derived from the source clock. */
  id: number;
  /** Birth time in seconds on the source clock. */
  emissionTime: number;
  /** Seconds since emission at the requested instant. */
  age: number;
  /** Varied spark lifetime in seconds. */
  life: number;
}

/**
 * Returns live sparks for a source active from start to end, evaluated at now.
 * All times and options.life are in seconds on the same source clock. IDs and
 * lifetimes depend only on that clock and seed, so scrubbing retains identity.
 */
export function spraySlots(start: number, end: number, now: number, o: SprayOptions): SpraySlot[] {
  const slots: SpraySlot[] = [];
  if (o.count <= 0) return slots;
  const dt = (o.life / o.count) * SLOT_INTERVAL_FACTOR;
  const k0 = Math.max(Math.floor(start / dt), Math.floor((now - o.life * LIFE_SCALE) / dt));
  const k1 = Math.floor(Math.min(now, end) / dt);
  for (let k = k1; k >= k0; k--) {
    const m = 1 + Math.floor(hash(k, o.seed, CLUSTER_STREAM) * (o.cluster || DEFAULT_CLUSTER));
    for (let c = 0; c < m; c++) {
      const id = k * SLOT_ID_STRIDE + c;
      const emissionTime = (k + hash(id, o.seed, BIRTH_STREAM)) * dt;
      if (emissionTime < start || emissionTime > end || emissionTime > now) continue;
      const r = hash(id, o.seed, LIFE_STREAM),
        lr = LIFE_RANDOM_WEIGHT * r + LIFE_BASE_WEIGHT;
      // A sixteenth-power tail keeps most sparks short with rare long-lived embers.
      let r16 = r * r;
      r16 *= r16;
      r16 *= r16;
      r16 *= r16;
      const life = o.life * LIFE_SCALE * (LIFE_RANDOM_WEIGHT * lr * lr + LIFE_BASE_WEIGHT * r16);
      const age = now - emissionTime;
      if (age <= life) slots.push({ id, emissionTime, age, life });
    }
  }
  return slots;
}

/** Writes x/y/z/r/g/b/size/alpha into caller-owned storage. No source callbacks,
 * allocations or variable loops here: this is the reference kernel for GLSL.
 * Times are source-relative seconds, origins are metres and inherited velocities
 * are m/s; birthAlpha is a dimensionless opacity multiplier. Returns written rows.
 * A spark emits at most four fork points or one point plus sixteen streak points.
 */
export function sparkState(
  id: number,
  age: number,
  life: number,
  now: number,
  ox: number,
  oy: number,
  oz: number,
  vx: number,
  vy: number,
  vz: number,
  birthAlpha: number,
  o: SprayOptions,
  out: Float64Array,
): number {
  if (age < 0 || age > life || birthAlpha <= BIRTH_ALPHA_CUTOFF) return 0;
  const kd = o.drag || DEFAULT_DRAG_PER_S,
    g = o.gravity ?? DEFAULT_GRAVITY_M_S2;
  const di = Math.floor(hash(id, o.seed, DIRECTION_STREAM) * DIRECTION_COUNT) * VECTOR_COMPONENTS;
  let dx = SPRAY_DIRECTIONS[di]!,
    dy = SPRAY_DIRECTIONS[di + 1]!,
    dz = SPRAY_DIRECTIONS[di + 2]!;
  if (o.dir) {
    dx = dx * (o.cone ?? 0) + o.dir[0];
    dy = dy * (o.cone ?? 0) + o.dir[1];
    dz = dz * (o.cone ?? 0) + o.dir[2];
  }
  const hs = hash(id, o.seed, SPEED_STREAM);
  const speed =
    o.spread *
    (o.speedDist === 'gerb'
      ? GERB_SPEED_MIN + GERB_SPEED_RANGE * hs
      : SPARK_SPEED_MIN + SPARK_SPEED_RANGE * hs * hs);
  const ux = dx * speed + vx,
    uy = dy * speed + vy,
    uz = dz * speed + vz;
  if (o.fork && hash(id, o.seed, FORK_STREAM) < o.fork) {
    const fa = life * (FORK_TIME_MIN + FORK_TIME_RANGE * hash(id, o.seed, FORK_TIME_STREAM));
    if (age >= fa) {
      const fage = age - fa;
      if (fage > FORK_LIFE_S) return 0;
      const e0 = (1 - Math.exp(-kd * fa)) / kd,
        f0 = (g / kd) * (fa - e0);
      const d = FORK_SPEED_M_S * fage * (1 - fage * FORK_DECAY_PER_S);
      for (let b = 0; b < FORK_COUNT; b++) {
        const key = id * FORK_KEY_STRIDE + b;
        const y = 2 * hash(key, o.seed + FORK_SEED_OFFSET, FORK_VERTICAL_STREAM) - 1;
        const th = FORK_TAU_RAD * hash(key, o.seed + FORK_SEED_OFFSET, FORK_AZIMUTH_STREAM),
          r = Math.sqrt(1 - y * y);
        const offset = b * SPARK_STRIDE;
        out[offset] = ox + ux * e0 + r * Math.cos(th) * d;
        out[offset + 1] = oy + uy * e0 - f0 + y * d;
        out[offset + 2] = oz + uz * e0 + r * Math.sin(th) * d;
        for (let channel = 0; channel < VECTOR_COMPONENTS; channel++)
          out[offset + 3 + channel] = o.colour[channel]! * FORK_COLOUR_WEIGHT + FORK_WHITE_WEIGHT;
        out[offset + 6] = o.size * FORK_SIZE_FACTOR;
        out[offset + 7] = SPARK_ALPHA_MAX * (1 - fage / FORK_LIFE_S) * birthAlpha;
      }
      return FORK_COUNT;
    }
  }
  const u = age / life,
    h = hash(id, o.seed, SIZE_STREAM);
  let glint = -1;
  if (o.glitter && hash(id, o.seed, GLITTER_STREAM) < o.glitter) {
    const fa = Math.min(
      life * GLITTER_LIFE_LIMIT,
      (o.glitterDelay ?? GLITTER_DELAY_S) *
        (GLITTER_DELAY_MIN + GLITTER_DELAY_RANGE * hash(id, o.seed, GLITTER_TIME_STREAM)),
    );
    if (age < fa) glint = 0;
    else if (age < fa + GLINT_LIFE_S) glint = 1 - (age - fa) / GLINT_LIFE_S;
    else return 0;
  }
  const fl =
    glint >= 0
      ? glint > 0
        ? GLINT_ALPHA_MAX * glint
        : DORMANT_ALPHA
      : 1 - o.flicker * hash(id, Math.floor((now + id * FLICKER_PHASE_S) * FLICKER_HZ), o.seed);
  const size =
    o.size *
    SPARK_SIZE_FACTOR *
    (SIZE_MIN + SIZE_RANGE * h * h * h) *
    ((1 - u) * SIZE_DECAY + SIZE_FLOOR) *
    (glint > 0 ? GLINT_SIZE_FACTOR : 1);
  const alpha =
    glint > 0
      ? Math.min(GLINT_ALPHA_MAX, fl * birthAlpha)
      : Math.min(
          SPARK_ALPHA_MAX,
          SPARK_ALPHA_MAX * Math.pow(1 - u, ALPHA_FADE_POWER) * fl * birthAlpha,
        ) *
        (ALPHA_MIN + ALPHA_RANGE * h * h);
  for (let channel = 0; channel < VECTOR_COMPONENTS; channel++) {
    const colour = o.colour[channel]!;
    out[3 + channel] =
      glint > 0
        ? colour * GLINT_COLOUR_WEIGHT + GLINT_WHITE_WEIGHT
        : glint === 0
          ? colour * DORMANT_COLOUR_WEIGHT + EMBER[channel]! * DORMANT_EMBER_WEIGHT
          : u < WHITE_HOT_LIFE
            ? 1 + (colour - 1) * (u / WHITE_HOT_LIFE)
            : colour +
              (EMBER[channel]! - colour) *
                Math.min(EMBER_MIX_MAX, (u - WHITE_HOT_LIFE) * EMBER_MIX_RATE);
  }
  // Integrate exponential drag and constant gravity analytically, without frame stepping.
  const e = (1 - Math.exp(-kd * age)) / kd;
  out[0] = ox + ux * e;
  out[1] = oy + uy * e - (g / kd) * (age - e);
  out[2] = oz + uz * e;
  out[6] = size;
  out[7] = alpha;
  let count = 1;
  for (let s = 1; s <= MAX_STREAK; s++) {
    if (glint >= 0 || s > (o.streak ?? 0)) break;
    const ag = age - s * STREAK_STEP_S;
    if (ag < 0) break;
    const e2 = (1 - Math.exp(-kd * ag)) / kd,
      offset = count * SPARK_STRIDE;
    out[offset] = ox + ux * e2;
    out[offset + 1] = oy + uy * e2 - (g / kd) * (ag - e2);
    out[offset + 2] = oz + uz * e2;
    for (let channel = 0; channel < VECTOR_COMPONENTS; channel++)
      out[offset + 3 + channel] = out[3 + channel]!;
    out[offset + 6] = size * STREAK_SIZE_FACTOR;
    out[offset + 7] = alpha * (1 - s / ((o.streak ?? 0) + 1));
    count++;
  }
  return count;
}

/** Appends live spray points by sampling source positions in metres at birth.
 * start, end and now are seconds on the source clock; options supplies tuning. */
export function spray(
  writer: ParticleWriter,
  source: (time: number) => Vec3,
  start: number,
  end: number,
  now: number,
  o: SprayOptions,
): void {
  if (!writer.sprays) return;
  const out = new Float64Array((MAX_STREAK + 1) * SPARK_STRIDE);
  for (const slot of spraySlots(start, end, now, o)) {
    const te = slot.emissionTime,
      alpha = o.alphaAt ? o.alphaAt(te) : (o.alpha ?? 1);
    if (alpha <= BIRTH_ALPHA_CUTOFF) continue;
    const origin = source(te);
    let vx = 0,
      vy = 0,
      vz = 0;
    const inherit = o.inherit ?? DEFAULT_INHERIT;
    if (inherit) {
      // Use the backward difference near source shut-off to avoid sampling beyond it.
      const back = te + VELOCITY_STEP_S > end;
      const before = source(back ? te - VELOCITY_STEP_S : te),
        after = source(back ? te : te + VELOCITY_STEP_S);
      vx = ((after[0] - before[0]) / VELOCITY_STEP_S) * inherit;
      vy = ((after[1] - before[1]) / VELOCITY_STEP_S) * inherit;
      vz = ((after[2] - before[2]) / VELOCITY_STEP_S) * inherit;
    }
    const count = sparkState(
      slot.id,
      slot.age,
      slot.life,
      now,
      origin[0],
      origin[1],
      origin[2],
      vx,
      vy,
      vz,
      alpha,
      o,
      out,
    );
    for (let i = 0; i < count; i++) {
      const offset = i * SPARK_STRIDE;
      writer.spark(
        [out[offset]!, out[offset + 1]!, out[offset + 2]!],
        [out[offset + 3]!, out[offset + 4]!, out[offset + 5]!],
        out[offset + 6]!,
        out[offset + 7]!,
      );
    }
  }
}
