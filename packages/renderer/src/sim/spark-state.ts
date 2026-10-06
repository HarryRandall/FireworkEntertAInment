/** Per-spark analytic motion and visual envelopes for the CPU spray reference. */
import { sparkTuning } from './spark-tuning';

import { fillFork } from './spark-fork';
import { selectGlitter, fillAppearance } from './spark-appearance';
import { prototypeOr } from './numeric';

import { unit } from './directions';
import { hash } from './random';
import type { SprayOptions } from './spray';

const {
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
} = sparkTuning;

// Retain Float32 quantisation of the prototype's shared direction lookup.
const SPRAY_DIRECTIONS = new Float32Array(DIRECTION_COUNT * VECTOR_COMPONENTS);

// Preserve the prototype Float32 direction quantisation before any spark motion.
for (let i = 0; i < DIRECTION_COUNT; i++) {
  SPRAY_DIRECTIONS.set(unit(i, DIRECTION_SEED), i * VECTOR_COMPONENTS);
}

// Scalar lanes in the packed x/y/z/r/g/b/size/alpha reference output.
const SIZE_OFFSET = 6;
const ALPHA_OFFSET = 7;

/** Reused synchronous numeric kernel lanes: metre positions, m/s velocities and source-relative seconds. */
export interface SparkWorkspace {
  id: number;
  age: number;
  life: number;
  now: number;
  originX: number;
  originY: number;
  originZ: number;
  inheritedX: number;
  inheritedY: number;
  inheritedZ: number;
  birthAlpha: number;
  dragPerS: number;
  gravityMS2: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  progress: number;
  sizeRandom: number;
  glint: number;
  size: number;
  alpha: number;
}
// Synchronous kernel scratch is reused across sparks. No callbacks or nested kernel calls
// occur while it is live; every consumed field is assigned for each invocation.
const workspace: SparkWorkspace = {
  id: 0,
  age: 0,
  life: 0,
  now: 0,
  originX: 0,
  originY: 0,
  originZ: 0,
  inheritedX: 0,
  inheritedY: 0,
  inheritedZ: 0,
  birthAlpha: 0,
  dragPerS: 0,
  gravityMS2: 0,
  velocityX: 0,
  velocityY: 0,
  velocityZ: 0,
  progress: 0,
  sizeRandom: 0,
  glint: 0,
  size: 0,
  alpha: 0,
};
/** Writes x/y/z/r/g/b/size/alpha into caller-owned storage. No source callbacks,
 * allocations or variable loops here: this is the reference kernel for GLSL.
 * Times are source-relative seconds, origins are metres and inherited velocities
 * are m/s; birthAlpha is a dimensionless opacity multiplier. Returns written rows.
 * A spark emits at most four fork points or one point plus sixteen streak points.
 */
export function sparkState /* eslint-disable-line max-params -- The tested public reference kernel keeps scalar lanes for GLSL parity; one synchronous workspace is reused across invocations. */(
  id: number,
  age: number,
  life: number,
  now: number,
  originX: number,
  originY: number,
  originZ: number,
  inheritedX: number,
  inheritedY: number,
  inheritedZ: number,
  birthAlpha: number,
  options: SprayOptions,
  out: Float64Array,
): number {
  if (age < 0 || age > life || birthAlpha <= BIRTH_ALPHA_CUTOFF) return 0;
  const state = workspace;
  state.id = id;
  state.age = age;
  state.life = life;
  state.now = now;
  state.originX = originX;
  state.originY = originY;
  state.originZ = originZ;
  state.inheritedX = inheritedX;
  state.inheritedY = inheritedY;
  state.inheritedZ = inheritedZ;
  state.birthAlpha = birthAlpha;
  initialiseVelocity(state, options);
  const forkCount = fillFork(state, options, out);
  if (forkCount !== NO_FORK) return forkCount;
  state.progress = age / life;
  state.sizeRandom = hash(id, options.seed, SIZE_STREAM);
  if (!selectGlitter(state, options)) return 0;
  fillAppearance(state, options, out);
  return fillMotionAndStreak(state, options, out);
}

function initialiseVelocity(state: SparkWorkspace, options: SprayOptions): void {
  state.dragPerS = prototypeOr(options.drag, DEFAULT_DRAG_PER_S);
  state.gravityMS2 = options.gravity ?? DEFAULT_GRAVITY_M_S2;
  const directionOffset =
    Math.floor(hash(state.id, options.seed, DIRECTION_STREAM) * DIRECTION_COUNT) *
    VECTOR_COMPONENTS;
  let directionX = packedNumber(SPRAY_DIRECTIONS, directionOffset);
  let directionY = packedNumber(SPRAY_DIRECTIONS, directionOffset + 1);
  let directionZ = packedNumber(SPRAY_DIRECTIONS, directionOffset + 2);
  if (options.dir) {
    directionX = directionX * (options.cone ?? 0) + options.dir[0];
    directionY = directionY * (options.cone ?? 0) + options.dir[1];
    directionZ = directionZ * (options.cone ?? 0) + options.dir[2];
  }
  const speedRandom = hash(state.id, options.seed, SPEED_STREAM);
  const speed =
    options.spread *
    (options.speedDist === 'gerb'
      ? GERB_SPEED_MIN + GERB_SPEED_RANGE * speedRandom
      : SPARK_SPEED_MIN + SPARK_SPEED_RANGE * speedRandom * speedRandom);
  state.velocityX = directionX * speed + state.inheritedX;
  state.velocityY = directionY * speed + state.inheritedY;
  state.velocityZ = directionZ * speed + state.inheritedZ;
}

function fillMotionAndStreak(
  state: SparkWorkspace,
  options: SprayOptions,
  out: Float64Array,
): number {
  // Integrate exponential drag and constant gravity analytically, without frame stepping.
  const dragIntegralS = (1 - Math.exp(-state.dragPerS * state.age)) / state.dragPerS;
  out[0] = state.originX + state.velocityX * dragIntegralS;
  out[1] =
    state.originY +
    state.velocityY * dragIntegralS -
    (state.gravityMS2 / state.dragPerS) * (state.age - dragIntegralS);
  out[2] = state.originZ + state.velocityZ * dragIntegralS;
  out[SIZE_OFFSET] = state.size;
  out[ALPHA_OFFSET] = state.alpha;
  let count = 1;
  for (let streakIndex = 1; streakIndex <= MAX_STREAK; streakIndex++) {
    if (state.glint >= 0 || streakIndex > (options.streak ?? 0)) break;
    const streakAgeS = state.age - streakIndex * STREAK_STEP_S;
    if (streakAgeS < 0) break;
    const streakDragIntegralS = (1 - Math.exp(-state.dragPerS * streakAgeS)) / state.dragPerS;
    const offset = count * SPARK_STRIDE;
    out[offset] = state.originX + state.velocityX * streakDragIntegralS;
    out[offset + 1] =
      state.originY +
      state.velocityY * streakDragIntegralS -
      (state.gravityMS2 / state.dragPerS) * (streakAgeS - streakDragIntegralS);
    out[offset + 2] = state.originZ + state.velocityZ * streakDragIntegralS;
    for (let channel = 0; channel < VECTOR_COMPONENTS; channel++)
      out[offset + COLOUR_OFFSET + channel] = packedNumber(out, COLOUR_OFFSET + channel);
    out[offset + SIZE_OFFSET] = state.size * STREAK_SIZE_FACTOR;
    out[offset + ALPHA_OFFSET] = state.alpha * (1 - streakIndex / ((options.streak ?? 0) + 1));
    count++;
  }
  return count;
}

/** Reads a populated scalar lane; invalid packed indices remain visible bounds failures. */
export function packedNumber(values: ArrayLike<number>, index: number): number {
  const value = values[index];
  if (value === undefined) throw new RangeError('Packed particle lane is outside its storage');
  return value;
}
