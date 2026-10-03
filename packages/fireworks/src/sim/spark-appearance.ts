/** Glitter and cooling envelopes for the allocation-free CPU spray kernel. */
import type { SprayOptions } from './spray';
import { packedNumber, type SparkWorkspace } from './spark-state';
import { hash } from './random';
import { rgb } from './colour';
// Packed vector layout: three components per position or colour.
const VECTOR_COMPONENTS = 3;
// Prototype deterministic seed partition: glitter stream (dimensionless hash stream).
const GLITTER_STREAM = 7;
// Prototype deterministic seed partition: glitter time stream (dimensionless hash stream).
const GLITTER_TIME_STREAM = 6;
// Prototype visual tuning: glint colour weight (linear RGB fraction).
const GLINT_COLOUR_WEIGHT = 0.35;
// Prototype visual tuning: glint white weight (linear RGB fraction).
const GLINT_WHITE_WEIGHT = 0.65;
// Prototype visual tuning: dormant colour weight (linear RGB fraction).
const DORMANT_COLOUR_WEIGHT = 0.3;
// Prototype visual tuning: dormant ember weight (linear RGB fraction).
const DORMANT_EMBER_WEIGHT = 0.7;
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
// Prototype cooling colour, sRGB converted to linear RGB for interpolation.
const EMBER = rgb('#ff7a33');
// Packed x/y/z/r/g/b/size/alpha offsets, scalar lanes in the CPU reference row.
const COLOUR_OFFSET = 3;

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
