/** Glitter and cooling envelopes for the allocation-free CPU spray kernel. */
import { sparkTuning } from './spark-tuning';

import type { SprayOptions } from './spray';
import { packedNumber, type SparkWorkspace } from './spark-state';
import { hash } from './random';
import { rgb } from './colour';

const {
  VECTOR_COMPONENTS,
  GLITTER_STREAM,
  GLITTER_TIME_STREAM,
  GLINT_COLOUR_WEIGHT,
  GLINT_WHITE_WEIGHT,
  DORMANT_COLOUR_WEIGHT,
  DORMANT_EMBER_WEIGHT,
  DORMANT_ALPHA,
  GLITTER_DELAY_S,
  GLITTER_DELAY_MIN,
  GLITTER_DELAY_RANGE,
  GLITTER_LIFE_LIMIT,
  SPARK_SIZE_FACTOR,
  SIZE_MIN,
  SIZE_RANGE,
  SIZE_DECAY,
  SIZE_FLOOR,
  GLINT_SIZE_FACTOR,
  ALPHA_MIN,
  ALPHA_RANGE,
  EMBER_MIX_MAX,
  EMBER_MIX_RATE,
  WHITE_HOT_LIFE,
  ALPHA_FADE_POWER,
  SPARK_ALPHA_MAX,
  GLINT_ALPHA_MAX,
  FLICKER_HZ,
  FLICKER_PHASE_S,
  GLINT_LIFE_S,
  COLOUR_OFFSET,
} = sparkTuning;

// Prototype cooling colour, sRGB converted to linear RGB for interpolation.
const EMBER = rgb('#ff7a33');

/** Selects glitter on a finite source clock in seconds, mutating state.glint; false means spent. */
export function selectGlitter(state: SparkWorkspace, options: SprayOptions): boolean {
  state.glint = -1;
  if (
    options.glitter !== undefined &&
    options.glitter !== 0 &&
    hash(state.id, options.seed, GLITTER_STREAM) < options.glitter
  ) {
    const forkTime = Math.min(
      state.life * GLITTER_LIFE_LIMIT,
      (options.glitterDelay ?? GLITTER_DELAY_S) *
        (GLITTER_DELAY_MIN +
          GLITTER_DELAY_RANGE * hash(state.id, options.seed, GLITTER_TIME_STREAM)),
    );
    if (state.age < forkTime) state.glint = 0;
    else if (state.age < forkTime + GLINT_LIFE_S)
      state.glint = 1 - (state.age - forkTime) / GLINT_LIFE_S;
    else return false;
  }
  return true;
}

/** Writes linear RGB lanes and updates size/alpha on initialised kernel scratch; controls are validated. */
export function fillAppearance(
  state: SparkWorkspace,
  options: SprayOptions,
  out: Float64Array,
): void {
  const fl = sparkFlicker(state, options);
  state.size =
    options.size *
    SPARK_SIZE_FACTOR *
    (SIZE_MIN + SIZE_RANGE * state.sizeRandom * state.sizeRandom * state.sizeRandom) *
    ((1 - state.progress) * SIZE_DECAY + SIZE_FLOOR) *
    (state.glint > 0 ? GLINT_SIZE_FACTOR : 1);
  state.alpha =
    state.glint > 0
      ? Math.min(GLINT_ALPHA_MAX, fl * state.birthAlpha)
      : Math.min(
          SPARK_ALPHA_MAX,
          SPARK_ALPHA_MAX * Math.pow(1 - state.progress, ALPHA_FADE_POWER) * fl * state.birthAlpha,
        ) *
        (ALPHA_MIN + ALPHA_RANGE * state.sizeRandom * state.sizeRandom);
  for (let channel = 0; channel < VECTOR_COMPONENTS; channel++) {
    const colour = packedNumber(options.colour, channel);
    out[COLOUR_OFFSET + channel] = coolingChannel(
      colour,
      packedNumber(EMBER, channel),
      state.progress,
      state.glint,
    );
  }
}

function sparkFlicker(state: SparkWorkspace, options: SprayOptions): number {
  if (state.glint > 0) return GLINT_ALPHA_MAX * state.glint;
  if (state.glint === 0) return DORMANT_ALPHA;
  return (
    1 -
    options.flicker *
      hash(
        state.id,
        Math.floor((state.now + state.id * FLICKER_PHASE_S) * FLICKER_HZ),
        options.seed,
      )
  );
}

function coolingChannel(colour: number, ember: number, progress: number, glint: number): number {
  if (glint > 0) return colour * GLINT_COLOUR_WEIGHT + GLINT_WHITE_WEIGHT;
  if (glint === 0) return colour * DORMANT_COLOUR_WEIGHT + ember * DORMANT_EMBER_WEIGHT;
  if (progress < WHITE_HOT_LIFE) return 1 + (colour - 1) * (progress / WHITE_HOT_LIFE);
  return (
    colour +
    (ember - colour) * Math.min(EMBER_MIX_MAX, (progress - WHITE_HOT_LIFE) * EMBER_MIX_RATE)
  );
}
