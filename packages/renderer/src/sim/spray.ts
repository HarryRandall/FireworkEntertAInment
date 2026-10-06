/** Source-clock spray scheduling and allocation-free per-spark state for particle writers. */
import { prototypeOr } from './numeric';
import type { Vec3 } from './colour';

import { sparkState, packedNumber } from './spark-state';
export { sparkState } from './spark-state';
import type { ParticleWriter } from './particles';
import { hash } from './random';

// Packed reference row: x/y/z/r/g/b/size/alpha, eight scalar values.
const SPARK_STRIDE = 8;
// Prototype deterministic seed partition: cluster stream (dimensionless hash stream).
const CLUSTER_STREAM = 9;
// Prototype deterministic seed partition: birth stream (dimensionless hash stream).
const BIRTH_STREAM = 1;
// Prototype deterministic seed partition: life stream (dimensionless hash stream).
const LIFE_STREAM = 2;
// Prototype visual tuning: slot id stride (IDs per source slot).
const SLOT_ID_STRIDE = 7;
// Prototype visual tuning: velocity step s (seconds).
const VELOCITY_STEP_S = 0.016;
// Prototype visual tuning: default inherit (velocity fraction).
const DEFAULT_INHERIT = 0.22;
// Prototype visual tuning: birth alpha cutoff (opacity).
const BIRTH_ALPHA_CUTOFF = 0.004;
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
// GPU receivers do not need a reference output buffer; this empty sentinel is never written.
const GPU_REFERENCE_OUTPUT = new Float64Array(0);

// Packed x/y/z/r/g/b/size/alpha offsets, scalar lanes in the CPU reference row.
const COLOUR_OFFSET = 3;
const SIZE_OFFSET = 6;
const ALPHA_OFFSET = 7;

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
export function spraySlots(
  start: number,
  end: number,
  now: number,
  options: SprayOptions,
): SpraySlot[] {
  const slots: SpraySlot[] = [];
  if (options.count <= 0) return slots;
  const slotIntervalS = (options.life / options.count) * SLOT_INTERVAL_FACTOR;
  const firstSlot = Math.max(
    Math.floor(start / slotIntervalS),
    Math.floor((now - options.life * LIFE_SCALE) / slotIntervalS),
  );
  const lastSlot = Math.floor(Math.min(now, end) / slotIntervalS);
  for (let slotIndex = lastSlot; slotIndex >= firstSlot; slotIndex--) {
    const clusterSize =
      1 +
      Math.floor(
        hash(slotIndex, options.seed, CLUSTER_STREAM) *
          prototypeOr(options.cluster, DEFAULT_CLUSTER),
      );
    for (let clusterIndex = 0; clusterIndex < clusterSize; clusterIndex++) {
      const id = slotIndex * SLOT_ID_STRIDE + clusterIndex;
      const emissionTime = (slotIndex + hash(id, options.seed, BIRTH_STREAM)) * slotIntervalS;
      if (emissionTime < start || emissionTime > end || emissionTime > now) continue;
      const lifeRandom = hash(id, options.seed, LIFE_STREAM);
      const shortLifeWeight = LIFE_RANDOM_WEIGHT * lifeRandom + LIFE_BASE_WEIGHT;
      // A sixteenth-power tail keeps most sparks short with rare long-lived embers.
      let longLifeTail = lifeRandom * lifeRandom;
      longLifeTail *= longLifeTail;
      longLifeTail *= longLifeTail;
      longLifeTail *= longLifeTail;
      const life =
        options.life *
        LIFE_SCALE *
        (LIFE_RANDOM_WEIGHT * shortLifeWeight * shortLifeWeight + LIFE_BASE_WEIGHT * longLifeTail);
      const age = now - emissionTime;
      if (age <= life) slots.push({ id, emissionTime, age, life });
    }
  }
  return slots;
}

/** Synchronous birth hand-off: seconds on the source clock, metre origin, inherited m/s.
 * The receiver must copy reused velocity lanes before returning; controls are validated. */
// eslint-disable-next-line max-params -- The synchronous sampled birth boundary keeps tuples and controls separate without a wrapper allocation.
export type SprayBirthSink = (
  slot: SpraySlot,
  origin: Vec3,
  inherited: Vec3,
  alpha: number,
  now: number,
  options: SprayOptions,
) => void;

/** Appends live spray points by sampling source positions in metres at birth.
 * start, end and now are seconds on the source clock; options supplies tuning. */
// eslint-disable-next-line max-params -- The source-clock API keeps its tested start/end/now scalars and existing controls without adding a source object in star loops.
export function spray(
  writer: ParticleWriter,
  source: (time: number) => Vec3,
  start: number,
  end: number,
  now: number,
  options: SprayOptions,
): void {
  if (!writer.sprays) return;
  writer.sprayPhase?.(true);
  try {
    sampleSpray(writer, source, start, end, now, options);
  } finally {
    writer.sprayPhase?.(false);
  }
}

// eslint-disable-next-line max-params -- A reused velocity tuple avoids allocating a context per spark for the source finite difference.
function sampleInheritedVelocity(
  velocity: Vec3,
  source: (time: number) => Vec3,
  emissionTime: number,
  end: number,
  inherit: number,
): void {
  let velocityX = 0;
  let velocityY = 0;
  let velocityZ = 0;

  if (inherit !== 0) {
    // Use the backward difference near source shut-off to avoid sampling beyond it.
    const back = emissionTime + VELOCITY_STEP_S > end;
    const before = source(back ? emissionTime - VELOCITY_STEP_S : emissionTime);
    const after = source(back ? emissionTime : emissionTime + VELOCITY_STEP_S);
    velocityX = ((after[0] - before[0]) / VELOCITY_STEP_S) * inherit;
    velocityY = ((after[1] - before[1]) / VELOCITY_STEP_S) * inherit;
    velocityZ = ((after[2] - before[2]) / VELOCITY_STEP_S) * inherit;
  }
  velocity[0] = velocityX;
  velocity[1] = velocityY;
  velocity[2] = velocityZ;
}

function appendReferenceSamples(writer: ParticleWriter, out: Float64Array, count: number): void {
  for (let i = 0; i < count; i++) {
    const offset = i * SPARK_STRIDE;
    writer.spark(
      [packedNumber(out, offset), packedNumber(out, offset + 1), packedNumber(out, offset + 2)],
      [
        packedNumber(out, offset + COLOUR_OFFSET),
        packedNumber(out, offset + COLOUR_OFFSET + 1),
        packedNumber(out, offset + COLOUR_OFFSET + 2),
      ],
      packedNumber(out, offset + SIZE_OFFSET),
      packedNumber(out, offset + ALPHA_OFFSET),
    );
  }
}

// eslint-disable-next-line max-params -- Keep the source-clock scalars separate at this profiled kernel boundary, avoiding an options object allocation per emitting star.
function sampleSpray(
  writer: ParticleWriter,
  source: (time: number) => Vec3,
  start: number,
  end: number,
  now: number,
  options: SprayOptions,
): void {
  const velocity: Vec3 = [0, 0, 0];
  const out = writer.sprayBirth
    ? GPU_REFERENCE_OUTPUT
    : new Float64Array((MAX_STREAK + 1) * SPARK_STRIDE);
  for (const slot of spraySlots(start, end, now, options)) {
    const emissionTime = slot.emissionTime;
    const alpha = options.alphaAt ? options.alphaAt(emissionTime) : (options.alpha ?? 1);
    if (alpha <= BIRTH_ALPHA_CUTOFF) continue;
    const origin = source(emissionTime);
    sampleInheritedVelocity(
      velocity,
      source,
      emissionTime,
      end,
      options.inherit ?? DEFAULT_INHERIT,
    );
    if (writer.sprayBirth) {
      writer.sprayBirth(slot, origin, velocity, alpha, now, options);
      continue;
    }
    const count = sparkState(
      slot.id,
      slot.age,
      slot.life,
      now,
      origin[0],
      origin[1],
      origin[2],
      velocity[0],
      velocity[1],
      velocity[2],
      alpha,
      options,
      out,
    );
    appendReferenceSamples(writer, out, count);
  }
}
