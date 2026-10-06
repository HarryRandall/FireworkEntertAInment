/** Packs source-sampled births without evaluating per-spark motion or appearance. */
import { unit } from '../sim/directions';
import { sparkTuning } from '../sim/spark-tuning';
import type { SprayBirthSink, SprayOptions } from '../sim/spray';

// Nine RGBA texels per birth. Width is a power of two below WebGL2's minimum limit.
export const BIRTH_TEXTURE_WIDTH = 1024;
const BIRTH_SCALARS = 36;
const TEXEL_COMPONENTS = 4;
// Prototype point budget bounds candidate vertices, including invisible forks/streaks.
const MAX_CANDIDATES = 140000;
const INITIAL_BIRTHS = BIRTH_TEXTURE_WIDTH;
const INDEX_COMPONENTS = 2;
// Scalar lanes in the nine-texel birth record, matching birthLane in the GLSL kernel.
const ID_LANE = 8;
const SEED_LANE = 9;
const FLICKER_CLOCK_LANE = 27;
// Two unsigned 16-bit limbs retain signed 32-bit hash inputs without NaN float payloads.
const WORD_MASK = 0xffff;
const HIGH_WORD_SHIFT = 16;
const HIGH_WORD_LANE = 32;
// RGBA group offsets in scalar lanes; vector length and alpha lane are the XYZ/W layout.
const VECTOR_COMPONENTS = 3;
const INHERITED_LANE = 4;
const CLOCK_LANE = 8;
const COLOUR_LANE = 12;
const MOTION_LANE = 16;
const CONTROL_LANE = 20;
const EXTRA_LANE = 24;
const DIRECTION_LANE = 28;
/** Float32 prototype direction lookup, RGBA padded for nearest texture reads. */
export function sprayDirections(): Float32Array {
  const values = new Float32Array(sparkTuning.DIRECTION_COUNT * TEXEL_COMPONENTS);
  for (let index = 0; index < sparkTuning.DIRECTION_COUNT; index++) {
    values.set(unit(index, sparkTuning.DIRECTION_SEED), index * TEXEL_COMPONENTS);
  }
  return values;
}
/** Reusable frame storage. Hash inputs use two exact Float32 limbs to retain signed 32-bit seeds. */
export class SprayBirths {
  data = new Float32Array(INITIAL_BIRTHS * BIRTH_SCALARS);
  indices = new Float32Array(MAX_CANDIDATES * INDEX_COMPONENTS);
  births = 0;
  count = 0;

  /** Clears populated lengths before synchronous source sampling for a frame. */
  reset(): void {
    this.births = 0;
    this.count = 0;
  }
  /** Copies birth inputs in source-relative seconds, metres and inherited m/s.
   * No per-spark motion is evaluated; reused input tuples are copied synchronously. */
  // eslint-disable-next-line max-params -- The synchronous CPU/GPU boundary copies scalar controls without allocating a wrapper per spark.
  readonly receive: SprayBirthSink = (slot, origin, inherited, alpha, now, options) => {
    if (this.count >= MAX_CANDIDATES) return;
    this.reserve();
    const offset = this.births * BIRTH_SCALARS;
    this.data.set(origin, offset);
    this.data[offset + VECTOR_COMPONENTS] = alpha;
    this.data.set(inherited, offset + INHERITED_LANE);
    this.data[offset + CLOCK_LANE + 2] = slot.age;
    this.data[offset + CLOCK_LANE + VECTOR_COMPONENTS] = slot.life;
    this.packAppearance(offset, options);
    this.packDirection(offset, options);
    this.packWord(offset + ID_LANE, offset + HIGH_WORD_LANE, slot.id);
    this.packWord(offset + SEED_LANE, offset + HIGH_WORD_LANE + 1, options.seed);
    this.packWord(
      offset + FLICKER_CLOCK_LANE,
      offset + HIGH_WORD_LANE + 2,
      Math.floor((now + slot.id * sparkTuning.FLICKER_PHASE_S) * sparkTuning.FLICKER_HZ),
    );
    const candidates = Math.max(
      (options.fork ?? 0) !== 0 ? sparkTuning.FORK_COUNT : 1,
      1 + Math.min(sparkTuning.MAX_STREAK, options.streak ?? 0),
    );
    for (let sample = 0; sample < candidates && this.count < MAX_CANDIDATES; sample++) {
      const index = this.count * INDEX_COMPONENTS;
      this.indices[index] = this.births;
      this.indices[index + 1] = sample;
      this.count++;
    }
    this.births++;
  };
  private packAppearance(offset: number, options: SprayOptions): void {
    this.data.set(options.colour, offset + COLOUR_LANE);
    this.data[offset + COLOUR_LANE + VECTOR_COMPONENTS] = options.size;
    this.data[offset + MOTION_LANE] = options.spread;
    this.data[offset + MOTION_LANE + 1] = resolvedDrag(options.drag);
    this.data[offset + MOTION_LANE + 2] = options.gravity ?? sparkTuning.DEFAULT_GRAVITY_M_S2;
    this.data[offset + MOTION_LANE + VECTOR_COMPONENTS] = options.flicker;
    this.data[offset + CONTROL_LANE] = options.speedDist === 'gerb' ? 1 : 0;
    this.data[offset + CONTROL_LANE + 1] = options.streak ?? 0;
    this.data[offset + CONTROL_LANE + 2] = options.fork ?? 0;
    this.data[offset + CONTROL_LANE + VECTOR_COMPONENTS] = options.glitter ?? 0;
  }
  private packDirection(offset: number, options: SprayOptions): void {
    this.data[offset + EXTRA_LANE] = options.glitterDelay ?? sparkTuning.GLITTER_DELAY_S;
    this.data[offset + EXTRA_LANE + 1] = options.cone ?? 0;
    this.data[offset + EXTRA_LANE + 2] = options.dir ? 1 : 0;
    for (let channel = 0; channel < VECTOR_COMPONENTS; channel++) {
      this.data[offset + DIRECTION_LANE + channel] = options.dir?.[channel] ?? 0;
    }
  }
  private packWord(lowLane: number, highLane: number, value: number): void {
    this.data[lowLane] = value & WORD_MASK;
    this.data[highLane] = value >>> HIGH_WORD_SHIFT;
  }
  private reserve(): void {
    if ((this.births + 1) * BIRTH_SCALARS <= this.data.length) return;
    const data = new Float32Array(this.data.length * 2);
    data.set(this.data);
    this.data = data;
  }
}

function resolvedDrag(drag: number | undefined): number {
  return drag === undefined || drag === 0 || Number.isNaN(drag)
    ? sparkTuning.DEFAULT_DRAG_PER_S
    : drag;
}
