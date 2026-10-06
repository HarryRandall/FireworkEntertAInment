/** Node-only finale simulation and attribute packing timings, excluding driver and GPU work. */
import { performance } from 'node:perf_hooks';
import { stressShots } from '../tests/support/stress-scene.ts';
import { simulate, shotDuration } from '../src/sim/index.ts';
import { ParticleLayers } from '../src/view/buffers.ts';
import { baselinePacking } from './baseline-packing.mjs';
import { SprayBirths } from '../src/view/spray-births.ts';
import { SpraySources } from '../src/view/spray-sources.ts';

// Fixed show seconds cover the climb, busiest finale and fading tail. Repetitions warm the JIT.
const TIMES_S = [5, 11.2, 13, 14];
const WARMUP = 30;
const SAMPLES = 100;
const profilePhases = process.argv.includes('--phases');
const shots = stressShots();
const referenceIndex = process.argv.indexOf('--baseline-ref');
const reference = referenceIndex >= 0 ? process.argv[referenceIndex + 1] : undefined;
if (referenceIndex >= 0 && !reference) throw new Error('--baseline-ref requires a Git revision');
const Packing = reference ? await baselinePacking(reference) : ParticleLayers;
const layers = new Packing();
const births = new SprayBirths();
const sources = new SpraySources();
function frame(time, mode) {
  births.reset();
  sources.reset(time);
  let sprayMs = 0;
  let sprayStart = 0;
  const sprayPhase = (active) => {
    if (active) sprayStart = performance.now();
    else sprayMs += performance.now() - sprayStart;
  };
  const start = performance.now();
  const frames = shots.flatMap((shot) => {
    const local = time - shot.t0;
    if (local < 0 || local > shotDuration(shot.design)) return [];
    return [
      simulate(shot.design, local, {
        ...shot,
        sprayPhase: profilePhases ? sprayPhase : undefined,
        sprayBirth: mode === 'gpu-sampled' ? births.receive : undefined,
        spraySource: mode === 'gpu' ? sources.receive : undefined,
      }),
    ];
  });
  const simulated = performance.now();
  layers.upload(frames);
  const packed = performance.now();
  return {
    simulationMs: simulated - start,
    nonSprayMs: simulated - start - sprayMs,
    sprayMs,
    packingMs: packed - simulated,
    totalMs: packed - start,
    cpuParticles: frames.reduce((sum, frame) => sum + frame.kinds.length, 0),
    sampledBirthCandidates: births.count,
    sources: sources.sources,
    candidates: sources.count,
  };
}
function median(samples, key) {
  return samples.map((sample) => sample[key]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
}
for (const mode of ['gpu-sampled', 'gpu', 'cpu']) {
  for (const time of TIMES_S) {
    for (let repeat = 0; repeat < WARMUP; repeat++) frame(time, mode);
    const samples = Array.from({ length: SAMPLES }, () => frame(time, mode));
    console.log(
      JSON.stringify({
        mode,
        time_s: time,
        cpuParticles: samples[0].cpuParticles,
        sampledBirthCandidates: samples[0].sampledBirthCandidates,
        sources: samples[0].sources,
        candidates: samples[0].candidates,
        simulationMs: median(samples, 'simulationMs'),
        packingMs: median(samples, 'packingMs'),
        totalMs: median(samples, 'totalMs'),
        ...(profilePhases
          ? { nonSprayMs: median(samples, 'nonSprayMs'), sprayMs: median(samples, 'sprayMs') }
          : {}),
      }),
    );
  }
}
layers.dispose();
