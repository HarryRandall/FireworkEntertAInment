/** Bounded source-birth readback expectations from the original CPU callbacks. */
import { simulate, sparkState, type SprayBirthSink } from '../../packages/fireworks/src/sim/index';
import type { SprayTrajectory } from '../../packages/fireworks/src/sim/spray-source';
import type { SprayOptions } from '../../packages/fireworks/src/sim/spray';
import type { Design } from '../../packages/fireworks/src/schema/index';
import { SpraySources } from '../../packages/fireworks/src/view/spray-sources';
import {
  SOURCE_TEXTURE_WIDTH,
  SOURCE_COMPONENTS,
  SOURCE_SCALARS,
} from '../../packages/fireworks/src/view/source-layout';
import { packed } from './spray-expectations';

// Bound transport and readback per instant; both live and inactive candidates span all sources.
const SAMPLED_BIRTHS = 128;
const SAMPLED_INACTIVE = 128;
const CANDIDATE_COMPONENTS = 2;
const OUTPUT_STRIDE = 9;
const PARITY_SEED = 2147483647;
const POSITION_M: [number, number] = [21, -14];
// Prototype source-clock scheduling and identity constants, unchanged from spraySlots.
const SLOT_INTERVAL_FACTOR = 1.15;
const SLOT_ID_STRIDE = 7;

/** Captures live CPU initial conditions and evenly selected inactive candidates at source time in seconds.
 * The dual receiver observes each original callback; no GPU trajectory is used to form expectations. */
export function birthParityFrame(design: Design, time: number) {
  const sources = new SpraySources();
  sources.reset(time);
  const expectedByCandidate = new Map<number, number[]>();
  const cpuBirths = new Map<number, { age: number; life: number; alpha: number; now: number }>();
  const sourceInputs: {
    trajectory: SprayTrajectory;
    start: number;
    end: number;
    now: number;
    options: SprayOptions;
    candidateStart: number;
    candidateEnd: number;
  }[] = [];
  const appearanceByCandidate = new Map<number, number[]>();
  const scratch = new Float64Array(17 * 8);
  const identities: {
    start: number;
    end: number;
    samples: number;
    cluster: number;
    lastSlot: number;
    now: number;
    interval: number;
    seed: number;
  }[] = [];
  let sourceStart = 0;
  let sampleCount = 1;
  let clusterCandidates = 1;
  let lastSlot = 0;
  let slotInterval = 1;
  const receive: SprayBirthSink = (slot, origin, inherited, alpha, now, options) => {
    const slotIndex = Math.floor(slot.emissionTime / slotInterval);
    const clusterIndex = slot.id - slotIndex * SLOT_ID_STRIDE;
    const candidate =
      sourceStart + ((lastSlot - slotIndex) * clusterCandidates + clusterIndex) * sampleCount;
    cpuBirths.set(candidate, { age: slot.age, life: slot.life, alpha, now });
    expectedByCandidate.set(candidate, [...origin, ...inherited, slot.emissionTime, 1, slot.id]);
    const rows = sparkState(
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
    for (let sample = 0; sample < sampleCount; sample++) {
      appearanceByCandidate.set(
        candidate + sample,
        sample < rows ? [...scratch.subarray(sample * 8, sample * 8 + 8)] : Array(8).fill(0),
      );
    }
  };
  simulate(design, time, {
    seed: PARITY_SEED,
    position: POSITION_M,
    sprayBirth: receive,
    spraySource: (trajectory, start, end, now, options) => {
      sourceStart = sources.count;
      sources.receive(trajectory, start, end, now, options);
      sourceInputs.push({
        trajectory,
        start,
        end,
        now,
        options,
        candidateStart: sourceStart,
        candidateEnd: sources.count,
      });
      const offset = (sources.sources - 1) * SOURCE_SCALARS;
      sampleCount = sources.data[offset + 10];
      clusterCandidates = sources.data[offset + 11];
      const interval = (options.life / options.count) * SLOT_INTERVAL_FACTOR;
      slotInterval = interval;
      lastSlot = Math.floor(Math.min(now, end) / interval);
      identities.push({
        start: sourceStart,
        end: sources.count,
        samples: sampleCount,
        cluster: clusterCandidates,
        lastSlot,
        now,
        interval,
        seed: options.seed,
      });
    },
  });
  const live = [...expectedByCandidate.keys()];
  const liveStep = Math.max(1, Math.ceil(live.length / SAMPLED_BIRTHS));
  const selected = new Set(live.filter((_, index) => index % liveStep === 0));
  const inactiveStep = Math.max(1, Math.ceil(sources.count / SAMPLED_INACTIVE));
  for (let index = 0; index < sources.count; index += inactiveStep) selected.add(index);
  const indices: number[] = [];
  const expected: number[] = [];
  const appearance: number[] = [];
  for (const candidate of selected) {
    const source = identities.find((entry) => candidate >= entry.start && candidate < entry.end);
    if (!source) throw new Error('Candidate has no CPU source');
    const sparkIndex = Math.floor((candidate - source.start) / source.samples);
    const clusterIndex = sparkIndex % source.cluster;
    const slot = source.lastSlot - Math.floor(sparkIndex / source.cluster);
    const id = slot * SLOT_ID_STRIDE + clusterIndex;
    const firstSample = candidate - ((candidate - source.start) % source.samples);
    const reference = expectedByCandidate.get(firstSample);
    // Identity remains defined for inactive candidates, including unused cluster lanes.
    indices.push(candidate, 0);
    appearance.push(...(appearanceByCandidate.get(candidate) ?? Array(8).fill(0)));
    expected.push(...(reference ?? [0, 0, 0, 0, 0, 0, 0, 0, id]));
  }
  const used =
    Math.ceil((sources.sources * SOURCE_SCALARS) / (SOURCE_TEXTURE_WIDTH * SOURCE_COMPONENTS)) *
    SOURCE_TEXTURE_WIDTH *
    SOURCE_COMPONENTS;
  return {
    expected,
    appearance,
    diagnostic: {
      sourceInputs,
      cpuBirths,
      candidates: indices.filter((_, index) => index % CANDIDATE_COMPONENTS === 0),
      sourceTexels: Array.from(sources.data.subarray(0, sources.sources * SOURCE_SCALARS)),
      clockTexels: Array.from(sources.clocks.subarray(0, sources.sources * SOURCE_COMPONENTS)),
    },
    liveBirths: live.length,
    feedback: {
      births: packed(sources.data.subarray(0, used)),
      indices: packed(new Float32Array(indices)),
      count: indices.length / CANDIDATE_COMPONENTS,
      time,
      clocks: packed(sources.clocks),
      sourceCount: sources.sources,
    },
  };
}

// Highp Float32 motion is sampled twice over a 16 ms interval. Cancellation amplifies source
// position rounding in inherited velocity; these physical bounds cover that amplification.
const TIME_TOLERANCE_S = 0.000002;
const ORIGIN_TOLERANCE_M = 0.001;
const INHERITED_TOLERANCE_M_S = 0.015;
const RELATIVE_TOLERANCE = 100 * 2 ** -23;
/** Compares initial conditions in metres, m/s and seconds; IDs and visibility must match exactly. */
export function expectBirthParity(actual: number[], expected: number[]): string[] {
  if (actual.length !== expected.length)
    return [`Readback length ${actual.length}, expected ${expected.length}`];
  const failures: string[] = [];
  for (let index = 0; index < expected.length; index++) {
    const lane = index % OUTPUT_STRIDE;
    let tolerance = 0;
    if (lane < 3) tolerance = ORIGIN_TOLERANCE_M;
    else if (lane < 6) tolerance = INHERITED_TOLERANCE_M_S;
    else if (lane === 6) tolerance = TIME_TOLERANCE_S;
    const allowed =
      tolerance === 0 ? 0 : tolerance + RELATIVE_TOLERANCE * Math.abs(expected[index]);
    if (!Number.isFinite(actual[index]) || Math.abs(actual[index] - expected[index]) > allowed) {
      failures.push(
        `Row ${Math.floor(index / OUTPUT_STRIDE)}, lane ${lane}: ${actual[index]} vs ${expected[index]}, tolerance ${allowed}`,
      );
    }
  }
  return failures;
}
