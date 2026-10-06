/** DOM-free, bounded CPU references and parity preparation for package tests. */
import { simulate, sparkState, type SprayBirthSink, type SprayOptions } from '../src/sim/index';
import type { Design } from '../src/schema/index';
import { BIRTH_TEXTURE_WIDTH, SprayBirths } from '../src/view/spray-births';

/** Packed x/y/z/r/g/b/size/alpha scalar lanes per spark output row. */
export const SPARK_STRIDE = 8;
// One spark has at most 17 candidate rows, including fork and streak candidates.
const MAX_ROWS_PER_SPARK = 17;
// Upload layout, in scalar lanes: RGBA texels, nine texels per birth and two candidate indices.
const TEXEL_COMPONENTS = 4;
const BIRTH_SCALARS = 36;
const CANDIDATE_COMPONENTS = 2;
const TEXTURE_ROW_SCALARS = BIRTH_TEXTURE_WIDTH * TEXEL_COMPONENTS;
// Harness budget, in source sparks per fixed instant. Even spacing spans the whole birth stream.
/** Maximum evenly sampled source sparks per instant, in the bounded reference harness. */
export const SAMPLED_SPARKS_PER_TIME = 128;
/** Fixed show times in seconds from launch, used for repeatable direct seeks. */
export const FIXED_TIMES_S = [0.4, 1.6, 2.2, 3.1, 5.0];
const PARITY_SEED = 2147483647;
const PARITY_POSITION_M: [number, number] = [21, -14];

/** Collects every sampleEvery-th birth, where sampleEvery is a positive integer.
 * The callback mutates only the returned collector; output timings are milliseconds. */
export function parityFrame(sampleEvery = 1) {
  const births = new SprayBirths();
  const expected: number[] = [];
  const scratch = new Float64Array(SPARK_STRIDE * MAX_ROWS_PER_SPARK);
  const timings = { sparkStateMs: 0, packingMs: 0 };
  let visited = 0;
  const receive: SprayBirthSink = (...[slot, origin, inherited, alpha, now, options]) => {
    if (visited++ % sampleEvery !== 0) return;
    const first = births.count;
    const packingStart = performance.now();
    births.receive(slot, origin, inherited, alpha, now, options);
    timings.packingMs += performance.now() - packingStart;
    const kernelStart = performance.now();
    const count = sparkState(
      slot.id,
      slot.age,
      slot.life,
      now,
      ...origin,
      ...inherited,
      alpha,
      options,
      scratch,
    );
    timings.sparkStateMs += performance.now() - kernelStart;
    for (let row = 0; row < births.count - first; row++) {
      for (let lane = 0; lane < SPARK_STRIDE; lane++) {
        expected.push(row < count ? (scratch[row * SPARK_STRIDE + lane] ?? NaN) : 0);
      }
    }
  };
  return { births, expected, receive, timings };
}

/** Samples at most 128 source sparks at timeS (seconds), retaining every child/streak row.
 * Time is from show start. Two deterministic source passes count then sample births;
 * design is not mutated and no accumulated state is used. */
export function buildParityFrame(design: Design, timeS: number) {
  let totalBirths = 0;
  const start = performance.now();
  const options = { seed: PARITY_SEED, position: PARITY_POSITION_M };
  simulate(design, timeS, {
    ...options,
    sprayBirth: () => {
      totalBirths++;
    },
  });
  const frame = parityFrame(Math.max(1, Math.ceil(totalBirths / SAMPLED_SPARKS_PER_TIME)));
  simulate(design, timeS, { ...options, sprayBirth: frame.receive });
  return { ...frame, totalBirths, simulateMs: performance.now() - start };
}

// Float32 has 24 significant binary bits. GLSL highp exp/pow/trig and repeated operations
// amplify rounding beyond a single ulp. These bounds allow ~100 ulps of relative error,
// with a 0.1 mm absolute position floor for cancellation near zero. They are not visual thresholds.
const RELATIVE_TOLERANCE = 100 * 2 ** -23;
const POSITION_TOLERANCE_M = 0.0001;
const APPEARANCE_TOLERANCE = 0.00003;

/** Checks all lanes once, returning the worst normalised error and its diagnostic.
 * Positions are metres; colour, size and alpha keep the existing renderer units and tolerances. */
export function parityError(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  let worstRatio = 0;
  let message = 'All GPU lanes match the CPU reference';
  if (actual.length !== expected.length) {
    return {
      worstRatio: Infinity,
      message: `Lane count ${String(actual.length)}, expected ${String(expected.length)}`,
    };
  }
  for (let index = 0; index < expected.length; index++) {
    const actualValue = actual[index] ?? NaN;
    const expectedValue = expected[index] ?? NaN;
    const tolerance = index % SPARK_STRIDE < 3 ? POSITION_TOLERANCE_M : APPEARANCE_TOLERANCE;
    const allowed = tolerance + RELATIVE_TOLERANCE * Math.abs(expectedValue);
    const ratio =
      Number.isFinite(actualValue) && Number.isFinite(expectedValue)
        ? Math.abs(actualValue - expectedValue) / allowed
        : Infinity;
    if (ratio > worstRatio) {
      worstRatio = ratio;
      message = `Worst lane ${String(index % SPARK_STRIDE)}, row ${String(Math.floor(index / SPARK_STRIDE))}: actual ${String(actualValue)}, expected ${String(expectedValue)}, tolerance ${String(allowed)}, ratio ${String(ratio)}`;
    }
  }
  return { worstRatio, message };
}

/** Base64 preserves the Float32 upload bytes without expanding every scalar into JSON numbers. */
export function packed(values: Float32Array): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}
/** Packs populated birth texture rows and candidate pairs into exact Float32 byte strings. */
export function feedbackFrame(frame: ReturnType<typeof parityFrame>) {
  // Only complete populated texture rows cross the browser boundary, rather than spare capacity.
  const usedScalars =
    Math.ceil((frame.births.births * BIRTH_SCALARS) / TEXTURE_ROW_SCALARS) * TEXTURE_ROW_SCALARS;
  return {
    births: packed(frame.births.data.subarray(0, usedScalars)),
    indices: packed(frame.births.indices.subarray(0, frame.births.count * CANDIDATE_COMPONENTS)),
    count: frame.births.count,
  };
}

/** Exercises every synthetic fork, glitter, gerb and streak control at the boundary ages in seconds. */
export function modifierParityFrame() {
  const frame = parityFrame();
  const modes: Partial<SprayOptions>[] = [
    { fork: 1, streak: 16 },
    { glitter: 1, glitterDelay: 0.35 },
    { speedDist: 'gerb', dir: [0, 1, 0], cone: 0.4, streak: 16 },
    { drag: 0, inherit: 0, flicker: 1 },
  ];
  for (const controls of modes) {
    for (let id = -8; id < 40; id++) {
      for (const age of [0, 0.05, 0.2, 0.36, 0.5, 0.61, 0.85, 1.01]) {
        frame.receive({ id, age, life: 1, emissionTime: 0 }, [3, 12, -4], [0.4, -1, 2], 0.8, age, {
          count: 20,
          life: 1,
          spread: 2.2,
          size: 1,
          flicker: 0.6,
          colour: [1, 0.5, 0.1],
          seed: 2147483647,
          ...controls,
        });
      }
    }
  }
  return frame;
}
