/** Reusable per-source uploads and candidate ranges; frame work never visits individual sparks. */
import type { SpraySourceSink } from '../sim/spray-source';
import type { SprayOptions } from '../sim/spray';
import { sparkTuning } from '../sim/spark-tuning';
import { prototypeOr } from '../sim/numeric';
import {
  SOURCE_COMPONENTS,
  SOURCE_SCALARS,
  SOURCE_TEXTURE_WIDTH,
  sourceLane,
} from './source-layout';
import { packSourcePhases } from './source-phases';
import { packTrajectory, writeSourceLane } from './source-trajectory';
// Prototype scheduling: interval multiplier, maximum lifetime factor and default cluster size.
const SLOT_INTERVAL_FACTOR = 1.15;
const LIFE_SCALE = 1.75;
const DEFAULT_CLUSTER = 3.4;
// Growth doubles complete texture rows for WebGL uploads.
const INITIAL_SCALARS = SOURCE_TEXTURE_WIDTH * SOURCE_COMPONENTS;
// Exact Float32 limbs retain all signed 32-bit seed inputs without NaN payloads.
const WORD_MASK = 0xffff;
const WORD_SHIFT = 16;
// IEEE 754 binary64 storage size, in bytes.
const FLOAT64_BYTES = 8;
// One half of the binary64 encoding, in bytes.
const CLOCK_WORD_BYTES = 4;
// Float32 integer candidate indices remain exact below this hardware-independent limit.
// Float32 significand width in bits, from IEEE 754 binary32.
const FLOAT32_SIGNIFICAND_BITS = 24;
const MAX_EXACT_CANDIDATES = 2 ** FLOAT32_SIGNIFICAND_BITS;
// Prototype default inherited source velocity fraction.
const DEFAULT_INHERIT = 0.22;
/** Source records use source-clock seconds, metre trajectories and inherited m/s.
 * Only changed records mark the texture dirty. Each source contributes one bounded candidate range. */
export class SpraySources {
  data = new Float32Array(INITIAL_SCALARS);
  /** Four exact 16-bit limbs per current source clock, retaining binary64 flicker arithmetic. */
  clocks = new Float32Array(INITIAL_SCALARS);
  private readonly clockEncoding = new DataView(new ArrayBuffer(FLOAT64_BYTES));
  sources = 0;
  count = 0;
  time = 0;
  dirty = false;
  private readonly scratch = new Float32Array(SOURCE_SCALARS);
  /** Begins a stateless frame at sequence time in seconds; retains source record capacity. */
  reset(time: number): void {
    this.sources = 0;
    this.count = 0;
    this.time = time;
    this.dirty = false;
  }
  /** Copies validated source controls synchronously, without invoking source callbacks or selecting births. */
  // eslint-disable-next-line max-params -- The receiver mirrors the synchronous analytic source boundary without per-spark allocations.
  readonly receive: SpraySourceSink = (trajectory, start, end, now, options) => {
    const samples = candidateSamples(options);
    const cluster = prototypeOr(options.cluster, DEFAULT_CLUSTER);
    const clusterCandidates = Math.ceil(cluster);
    const interval = (options.life / options.count) * SLOT_INTERVAL_FACTOR;
    // An extra endpoint slot on each side covers floor rounding at direct-seek boundaries.
    const slots = Math.ceil((options.life * LIFE_SCALE) / interval) + 2;
    const candidateEnd = this.count + slots * clusterCandidates * samples;
    if (candidateEnd >= MAX_EXACT_CANDIDATES)
      throw new RangeError('Spray candidate range exceeds exact GPU indexing');
    this.scratch.fill(0);
    writeSourceLane(this.scratch, 0, sourceLane.bounds, [
      start,
      end,
      this.time - now,
      candidateEnd,
    ]);
    writeSourceLane(this.scratch, 0, sourceLane.schedule, [
      interval,
      options.life,
      options.inherit ?? DEFAULT_INHERIT,
      cluster,
    ]);
    writeSourceLane(this.scratch, 0, sourceLane.identity, [
      options.seed & WORD_MASK,
      options.seed >>> WORD_SHIFT,
      samples,
      clusterCandidates,
    ]);
    packAppearance(this.scratch, options);
    packTrajectory(this.scratch, 0, trajectory);
    const lastSlot = Math.floor(Math.min(now, end) / interval);
    const anchor = lastSlot * interval;
    writeSourceLane(this.scratch, 0, sourceLane.clock, [
      anchor,
      now - anchor,
      lastSlot,
      trajectory.kind === 'child' ? anchor - trajectory.start : anchor,
    ]);
    packSourcePhases(this.scratch, trajectory, anchor);
    this.scratch[sourceLane.fade * SOURCE_COMPONENTS + SOURCE_COMPONENTS - 1] = options.alpha ?? 1;
    this.scratch[sourceLane.trajectory * SOURCE_COMPONENTS + 1] = this.count;
    this.copyRecord();
    this.copyClock(now);
    this.count = candidateEnd;
    this.sources++;
  };
  private copyClock(now: number): void {
    const offset = this.sources * SOURCE_COMPONENTS;
    if (offset + SOURCE_COMPONENTS > this.clocks.length) {
      const clocks = new Float32Array(this.clocks.length * 2);
      clocks.set(this.clocks);
      this.clocks = clocks;
    }
    this.clockEncoding.setFloat64(0, now, true);
    const low = this.clockEncoding.getUint32(0, true);
    const high = this.clockEncoding.getUint32(CLOCK_WORD_BYTES, true);
    this.clocks[offset] = low & WORD_MASK;
    this.clocks[offset + 1] = low >>> WORD_SHIFT;
    this.clocks[offset + 2] = high & WORD_MASK;
    this.clocks[offset + SOURCE_COMPONENTS - 1] = high >>> WORD_SHIFT;
  }
  private copyRecord(): void {
    const offset = this.sources * SOURCE_SCALARS;
    if (offset + SOURCE_SCALARS > this.data.length) {
      const data = new Float32Array(this.data.length * 2);
      data.set(this.data);
      this.data = data;
      this.dirty = true;
    }
    for (let lane = 0; lane < SOURCE_SCALARS; lane++) {
      const value = this.scratch[lane];
      if (value === undefined) throw new RangeError('Missing source lane');
      // Copy signed zero too, so packed inputs cannot retain the sign from an earlier record.
      if (!Object.is(this.data[offset + lane], value)) {
        this.data[offset + lane] = value;
        this.dirty = true;
      }
    }
  }
}
function candidateSamples(options: SprayOptions): number {
  return Math.max(
    (options.fork ?? 0) !== 0 ? sparkTuning.FORK_COUNT : 1,
    1 + Math.min(sparkTuning.MAX_STREAK, options.streak ?? 0),
  );
}
function packAppearance(data: Float32Array, options: SprayOptions): void {
  writeSourceLane(data, 0, sourceLane.colour, [...options.colour, options.size]);
  writeSourceLane(data, 0, sourceLane.motion, [
    options.spread,
    prototypeOr(options.drag, sparkTuning.DEFAULT_DRAG_PER_S),
    options.gravity ?? sparkTuning.DEFAULT_GRAVITY_M_S2,
    options.flicker,
  ]);
  writeSourceLane(data, 0, sourceLane.controls, [
    options.speedDist === 'gerb' ? 1 : 0,
    options.streak ?? 0,
    options.fork ?? 0,
    options.glitter ?? 0,
  ]);
  writeSourceLane(data, 0, sourceLane.extra, [
    options.glitterDelay ?? sparkTuning.GLITTER_DELAY_S,
    options.cone ?? 0,
    options.dir ? 1 : 0,
  ]);
  writeSourceLane(data, 0, sourceLane.direction, options.dir ?? [0, 0, 0]);
}
