/** Fork child geometry for the allocation-free CPU spray kernel. */
import { sparkTuning } from './spark-tuning';

import type { SprayOptions } from './spray';
import { packedNumber, type SparkWorkspace } from './spark-state';
import { hash } from './random';

const {
  VECTOR_COMPONENTS,
  SPARK_STRIDE,
  FORK_STREAM,
  FORK_TIME_STREAM,
  FORK_KEY_STRIDE,
  FORK_SEED_OFFSET,
  FORK_VERTICAL_STREAM,
  FORK_AZIMUTH_STREAM,
  FORK_COUNT,
  FORK_SPEED_M_S,
  FORK_DECAY_PER_S,
  FORK_COLOUR_WEIGHT,
  FORK_WHITE_WEIGHT,
  FORK_TIME_MIN,
  FORK_TIME_RANGE,
  FORK_LIFE_S,
  FORK_SIZE_FACTOR,
  SPARK_ALPHA_MAX,
  FORK_TAU_RAD,
  COLOUR_OFFSET,
  NO_FORK,
} = sparkTuning;

// Scalar lanes in the packed x/y/z/r/g/b/size/alpha reference output.
const SIZE_OFFSET = 6;
const ALPHA_OFFSET = 7;

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
