/** DOM-free integration fixtures measure real simulation and packing through FrameProfiler.
 * Driver submission and GPU time are unavailable here; pass a source root to compare local snapshots.
 * Run with the repository's register-typescript.mjs loader.
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const sourceRoot = resolve(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
const load = (path) => import(pathToFileURL(resolve(sourceRoot, path)).href);
const { effectTemplates } = await load('packages/renderer/src/index.ts');
const { ParticleLayers } = await load('packages/renderer/src/view/buffers.ts');
const { GpuSprays } = await load('packages/renderer/src/view/gpu-sprays.ts');
const { FrameProfiler } = await load('packages/renderer/src/view/frame-profile.ts');
const { drawViewerFrame } = await load('packages/renderer/src/view/viewer-frame.ts');
const { stressShots } = await load('packages/renderer/tests/support/stress-scene.ts');

// Local fixture budget: warm allocation/JIT for 12 draws, then sample 30 identical frames.
const WARMUP_FRAMES = 12;
const SAMPLE_FRAMES = 30;
// Developed shell seconds and dense forty-shot finale seconds from package regression fixtures.
const DEVELOPED_TIME_S = 2.2;
const FINALE_TIME_S = 11.2;
// Small cake fixture: twelve authored tubes spaced by 80 milliseconds.
const CAKE_SHOTS = 12;
const CAKE_GAP_S = 0.08;
const peony = effectTemplates.find((entry) => entry.key === 'peony').design;
const fixtures = [
  { surface: 'editor', shots: [{ design: peony }], time: DEVELOPED_TIME_S },
  {
    surface: 'multishot editor',
    shots: Array.from({ length: CAKE_SHOTS }, (_, i) => ({
      design: peony,
      t0: i * CAKE_GAP_S,
      seed: i + 1,
    })),
    time: DEVELOPED_TIME_S,
    prop: 'cake',
  },
  { surface: 'show replay', shots: stressShots(), time: FINALE_TIME_S },
  { surface: 'catalogue live preview', shots: [{ design: peony }], time: DEVELOPED_TIME_S },
];
function median(values) {
  const ordered = values.toSorted((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}
const results = [];
for (const fixture of fixtures) {
  // No GL driver is installed: these no-op boundaries explicitly retain unsupported GPU status.
  const profiler = new FrameProfiler({
    createQuery() {},
    getExtension() {
      return null;
    },
  });
  const layers = new ParticleLayers();
  const sprays = new GpuSprays(layers.uniforms);
  const viewer = {
    profiler,
    layers,
    shots: fixture.shots,
    t: fixture.time,
    options: { prop: fixture.prop },
    sprayMode: 'gpu',
    count: 0,
    gpuCandidateCount: 0,
    fillMs: 0,
    frameMs: 0,
    renderer: { domElement: { dataset: {} } },
    output: { render() {} },
  };
  try {
    for (let i = 0; i < WARMUP_FRAMES; i++) drawViewerFrame(viewer, sprays);
    const samples = [];
    for (let i = 0; i < SAMPLE_FRAMES; i++) {
      profiler.request();
      drawViewerFrame(viewer, sprays);
      samples.push({ ...profiler.result });
    }
    results.push({
      surface: fixture.surface,
      shots: fixture.shots.length,
      time_s: fixture.time,
      simulationMs: median(samples.map((sample) => sample.simulationMs)),
      sprayMs: median(samples.map((sample) => sample.sprayMs)),
      packingMs: median(samples.map((sample) => sample.packingMs)),
      cpuParticles: viewer.count - viewer.gpuCandidateCount,
      gpuCandidates: viewer.gpuCandidateCount,
      gpuStatus: profiler.result.gpuStatus,
      drawGpuMs: null,
      outputGpuMs: null,
    });
  } finally {
    profiler.dispose();
    sprays.dispose();
    layers.dispose();
  }
}
process.stdout.write(
  JSON.stringify(
    { sourceRoot, warmupFrames: WARMUP_FRAMES, sampleFrames: SAMPLE_FRAMES, results },
    null,
    2,
  ) + '\n',
);
