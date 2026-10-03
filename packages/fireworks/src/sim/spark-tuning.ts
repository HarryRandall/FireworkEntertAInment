/** Shared numeric contract for CPU and GLSL spark motion and appearance. */
// Packed vector layout: three components per position or colour.
const VECTOR_COMPONENTS = 3;
// Packed reference row: x/y/z/r/g/b/size/alpha, eight scalar values.
const SPARK_STRIDE = 8;
// Prototype visual tuning: direction count (directions).
const DIRECTION_COUNT = 4096;
// Prototype deterministic seed partition: direction stream (dimensionless hash stream).
const DIRECTION_STREAM = 31;
// Prototype deterministic seed partition: speed stream (dimensionless hash stream).
const SPEED_STREAM = 3;
// Prototype deterministic seed partition: size stream (dimensionless hash stream).
const SIZE_STREAM = 4;
// Prototype visual tuning: default gravity m s2 (m/s²).
const DEFAULT_GRAVITY_M_S2 = 3;
// Prototype visual tuning: gerb speed min (speed fraction).
const GERB_SPEED_MIN = 0.65;
// Prototype visual tuning: gerb speed range (speed fraction).
const GERB_SPEED_RANGE = 0.35;
// Prototype visual tuning: spark speed min (speed fraction).
const SPARK_SPEED_MIN = 0.12;
// Prototype visual tuning: spark speed range (speed fraction).
const SPARK_SPEED_RANGE = 0.9;
// Prototype visual tuning: streak size factor (size multiplier).
const STREAK_SIZE_FACTOR = 0.9;
// Prototype visual tuning: birth alpha cutoff (opacity).
const BIRTH_ALPHA_CUTOFF = 0.004;
// Prototype visual tuning: streak step s (seconds).
const STREAK_STEP_S = 0.008;
// Prototype visual tuning: default drag per s (1/s).
const DEFAULT_DRAG_PER_S = 2.5;
// Prototype streak sample cap, in points per spark, bounds the reference kernel.
const MAX_STREAK = 16;
// Prototype deterministic seed partition: direction seed (dimensionless seed).
const DIRECTION_SEED = 7919;
// Packed x/y/z/r/g/b/size/alpha offsets, scalar lanes in the CPU reference row.
const COLOUR_OFFSET = 3;
// Fork selector sentinel: -1 means the parent remains active; zero means it is spent.
const NO_FORK = -1;
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
// Prototype visual tuning: glint alpha max (opacity multiplier).
const GLINT_ALPHA_MAX = 2.4;
// Prototype visual tuning: flicker hz (Hz).
const FLICKER_HZ = 28;
// Prototype visual tuning: flicker phase s (seconds per spark ID).
const FLICKER_PHASE_S = 0.013;
// Prototype visual tuning: glint life s (seconds).
const GLINT_LIFE_S = 0.07;

/** Prototype tuning and packed-layout constants, shared with the GLSL source. */
export const sparkTuning = {
  VECTOR_COMPONENTS,
  SPARK_STRIDE,
  DIRECTION_COUNT,
  DIRECTION_STREAM,
  SPEED_STREAM,
  SIZE_STREAM,
  DEFAULT_GRAVITY_M_S2,
  GERB_SPEED_MIN,
  GERB_SPEED_RANGE,
  SPARK_SPEED_MIN,
  SPARK_SPEED_RANGE,
  STREAK_SIZE_FACTOR,
  BIRTH_ALPHA_CUTOFF,
  STREAK_STEP_S,
  DEFAULT_DRAG_PER_S,
  MAX_STREAK,
  DIRECTION_SEED,
  COLOUR_OFFSET,
  NO_FORK,
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
  GLINT_ALPHA_MAX,
  FLICKER_HZ,
  FLICKER_PHASE_S,
  GLINT_LIFE_S,
} as const;
