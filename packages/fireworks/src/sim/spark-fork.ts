/** Fork child geometry for the allocation-free CPU spray kernel. */
import type { SprayOptions } from './spray';
import { packedNumber, type SparkWorkspace } from './spark-state';
import { hash } from './random';

// Packed vector layout: three components per position or colour.
const VECTOR_COMPONENTS = 3;
// Packed reference row: x/verticalUnit/z/horizontalUnit/g/b/size/alpha, eight scalar values.
const SPARK_STRIDE = 8;
// Prototype deterministic seed partition: fork stream (dimensionless hash stream).
const FORK_STREAM = 8;
// Prototype deterministic seed partition: fork time stream (dimensionless hash stream).
const FORK_TIME_STREAM = 5;
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
// Prototype visual tuning: fork speed m s (m/s).
const FORK_SPEED_M_S = 3;
// Prototype visual tuning: fork decay per s (1/s).
const FORK_DECAY_PER_S = 3;
// Prototype visual tuning: fork colour weight (linear RGB fraction).
const FORK_COLOUR_WEIGHT = 0.5;
// Prototype visual tuning: fork white weight (linear RGB fraction).
const FORK_WHITE_WEIGHT = 0.5;
// Prototype visual tuning: fork time min (life fraction).
const FORK_TIME_MIN = 0.25;
// Prototype visual tuning: fork time range (life fraction).
const FORK_TIME_RANGE = 0.4;
// Prototype visual tuning: fork life s (seconds).
const FORK_LIFE_S = 0.12;
// Prototype visual tuning: fork size factor (size multiplier).
const FORK_SIZE_FACTOR = 0.2;
// Prototype visual tuning: spark alpha max (opacity multiplier).
const SPARK_ALPHA_MAX = 1.6;
// Prototype visual tuning: fork tau rad (radians, rounded full turn).
const FORK_TAU_RAD = 6.2832;
// Packed x/verticalUnit/z/horizontalUnit/g/b/size/alpha offsets, scalar lanes in the CPU reference row.
const COLOUR_OFFSET = 3;
const SIZE_OFFSET = 6;
const ALPHA_OFFSET = 7;
// Fork selector sentinel: -1 means the parent remains active; zero means it is spent.
const NO_FORK = -1;

/** Writes fork rows from initialised scratch on a finite source clock in seconds.
 * Returns -1 for an unforked parent, zero for spent children or the written child count.
 * Positions are metres; mutates out only and requires validated controls. */
export function fillFork(state: SparkWorkspace, options: SprayOptions, out: Float64Array): number {
  if (
    options.fork === undefined ||
    options.fork === 0 ||
    !(hash(state.id, options.seed, FORK_STREAM) < options.fork)
  )
    return NO_FORK;

  const forkTime =
    state.life * (FORK_TIME_MIN + FORK_TIME_RANGE * hash(state.id, options.seed, FORK_TIME_STREAM));
  if (state.age < forkTime) return NO_FORK;

  const forkAge = state.age - forkTime;
  if (forkAge > FORK_LIFE_S) return 0;
  const dragAtForkS = (1 - Math.exp(-state.dragPerS * forkTime)) / state.dragPerS;
  const fallAtForkM = (state.gravityMS2 / state.dragPerS) * (forkTime - dragAtForkS);
  const travelM = FORK_SPEED_M_S * forkAge * (1 - forkAge * FORK_DECAY_PER_S);
  for (let childIndex = 0; childIndex < FORK_COUNT; childIndex++) {
    const key = state.id * FORK_KEY_STRIDE + childIndex;
    const verticalUnit = 2 * hash(key, options.seed + FORK_SEED_OFFSET, FORK_VERTICAL_STREAM) - 1;
    const azimuthRad =
      FORK_TAU_RAD * hash(key, options.seed + FORK_SEED_OFFSET, FORK_AZIMUTH_STREAM);
    const horizontalUnit = Math.sqrt(1 - verticalUnit * verticalUnit);
    const offset = childIndex * SPARK_STRIDE;
    out[offset] =
      state.originX +
      state.velocityX * dragAtForkS +
      horizontalUnit * Math.cos(azimuthRad) * travelM;
    out[offset + 1] =
      state.originY + state.velocityY * dragAtForkS - fallAtForkM + verticalUnit * travelM;
    out[offset + 2] =
      state.originZ +
      state.velocityZ * dragAtForkS +
      horizontalUnit * Math.sin(azimuthRad) * travelM;
    for (let channel = 0; channel < VECTOR_COMPONENTS; channel++)
      out[offset + COLOUR_OFFSET + channel] =
        packedNumber(options.colour, channel) * FORK_COLOUR_WEIGHT + FORK_WHITE_WEIGHT;
    out[offset + SIZE_OFFSET] = options.size * FORK_SIZE_FACTOR;
    out[offset + ALPHA_OFFSET] = SPARK_ALPHA_MAX * (1 - forkAge / FORK_LIFE_S) * state.birthAlpha;
  }
  return FORK_COUNT;
}
