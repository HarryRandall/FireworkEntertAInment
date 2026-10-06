/** Camera-controlled Node phase audit of the live finale frame path, excluding driver/GPU work. */
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { framingFor } from '../src/sim/framing.ts';
import { StageControls } from '../src/view/stage-controls.ts';
import { stressShots } from '../tests/support/stress-scene.ts';
import { shotDuration } from '../src/sim/index.ts';
import { ParticleLayers } from '../src/view/buffers.ts';
import { GpuSprays } from '../src/view/gpu-sprays.ts';
import { FrameProfiler } from '../src/view/frame-profile.ts';
import { drawViewerFrame } from '../src/view/viewer-frame.ts';

// Dimensionless zoom factors deliberately exceed both control ranges, so controls clamp to each limit.
const NEAR_ZOOM_FACTOR = 0.000001;
const FAR_ZOOM_FACTOR = 1000000;
// Exercise both actual control ranges, including the owner's free-camera-only failure path.
const CAMERA_CASES = [
  { mode: 'audience', free: false, zoom: NEAR_ZOOM_FACTOR },
  { mode: 'audience', free: false, zoom: FAR_ZOOM_FACTOR },
  { mode: 'free', free: true, zoom: NEAR_ZOOM_FACTOR },
  { mode: 'free', free: true, zoom: FAR_ZOOM_FACTOR },
];
// Same projection as the live viewer, in degrees, viewport ratio and clipping metres.
const FOV_DEG = 45;
const ASPECT = 1.6;
const NEAR_M = 0.5;
const FAR_M = 4000;
// Advance the exponential control easing for twelve seconds in bounded 100 ms steps.
const SETTLE_FRAMES = 120;
const SETTLE_STEP_MS = 100;
// Sample the whole show at 60 Hz, then repeat to distinguish growth from steady playback.
const SAMPLE_HZ = 60;
const shots = stressShots();
const duration = Math.max(...shots.map((shot) => shot.t0 + shotDuration(shot.design)));
for (const cameraCase of CAMERA_CASES) {
  const layers = new ParticleLayers();
  const sprays = new GpuSprays(layers.uniforms);
  const profiler = new FrameProfiler({
    createQuery() {},
    getExtension() {
      return null;
    },
    bufferData() {},
    bufferSubData() {},
    texImage2D() {},
    texSubImage2D() {},
    texStorage2D() {},
  });
  const camera = new THREE.PerspectiveCamera(FOV_DEG, ASPECT, NEAR_M, FAR_M);
  const controls = new StageControls(camera, new EventTarget(), () => {});
  const framing = framingFor(shots, false, ASPECT, FOV_DEG);
  controls.frame(framing, true);
  controls.setFree(cameraCase.free);
  controls.zoom(cameraCase.zoom);
  const now = performance.now();
  for (let frame = 1; frame <= SETTLE_FRAMES; frame++)
    controls.update(now + frame * SETTLE_STEP_MS);
  const distance_m = camera.position.distanceTo(new THREE.Vector3(...framing.target));
  const viewer = {
    profiler,
    camera,
    shots,
    layers,
    t: 0,
    options: {},
    sprayMode: 'gpu',
    count: 0,
    gpuCandidateCount: 0,
    fillMs: 0,
    frameMs: 0,
    scene: new THREE.Scene(),
    renderer: { domElement: { dataset: {} } },
    output: {
      render(_renderer, _scene, _camera, observer) {
        observer?.pass('draw', () => {});
        observer?.pass('output', () => {});
      },
    },
  };
  for (const run of ['cold', 'warm']) {
    const rows = [];
    const countDigest = createHash('sha256');
    let replacements = 0;
    let previous = [];
    for (let frame = 0; frame <= Math.ceil(duration * SAMPLE_HZ); frame++) {
      viewer.t = frame / SAMPLE_HZ;
      profiler.request();
      const start = performance.now();
      drawViewerFrame(viewer, sprays);
      const cpuMs = performance.now() - start;
      const storage = [
        sprays.points.material.uniforms.uSources.value,
        sprays.points.material.uniforms.uSourceClocks.value,
        ...[...layers.group.children, sprays.points].flatMap((mesh) =>
          Object.values(mesh.geometry.attributes),
        ),
      ];
      if (previous.length)
        replacements += storage.filter((value, index) => value !== previous[index]).length;
      previous = storage;
      countDigest.update(`${viewer.count}:${sprays.sources.count};`);
      rows.push({
        time_s: viewer.t,
        count: viewer.count,
        candidates: sprays.sources.count,
        sources: sprays.sources.sources,
        cpuMs,
        ...profiler.result,
      });
    }
    const sorted = rows.map((row) => row.cpuMs).sort((a, b) => a - b);
    const peak = rows.reduce((best, row) => (row.count > best.count ? row : best));
    console.log(
      JSON.stringify({
        mode: cameraCase.mode,
        zoom: cameraCase.zoom,
        distance_m,
        cameraPosition: camera.position.toArray(),
        originNdc: new THREE.Vector3().project(camera).toArray(),
        run,
        frames: rows.length,
        replacements,
        countDigest: countDigest.digest('hex'),
        medianMs: sorted[Math.floor(sorted.length / 2)],
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        maxMs: sorted.at(-1),
        peak,
        sourceBytes: sprays.sources.data.byteLength,
        clockBytes: sprays.sources.clocks.byteLength,
        candidateBufferBytes:
          sprays.points.geometry.getAttribute('position')?.array.byteLength ?? 0,
      }),
    );
  }
  controls.dispose();
  layers.dispose();
  sprays.dispose();
}
