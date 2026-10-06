/** Frame construction and submission, separate from viewer transport and lifecycle. */
import { simulate, shotDuration } from '../sim/index';
import { CAKE_TOP_M, cakeHole } from './props';
import type { makeWorld } from './world';
import { SETTINGS } from './settings';
import { shakeAt, type ShakeEvent } from '../sim/shake';
import type { Vec3 } from '../sim/colour';
import type { Viewer } from './viewer';
import { disposeTree } from './world';
import type { SoundShot } from '../sim/events';
import type { GpuSprays } from './gpu-sprays';
// Prototype smoothing weight for displayed milliseconds, dimensionless.
const TIMING_OLD_WEIGHT = 0.9;
// Prototype exponential smoothing weight for displayed frame rate, dimensionless.
const FPS_OLD_WEIGHT = 0.92;
// Completed draw diagnostics use microsecond precision in show seconds, never transport input.
const DRAWN_TIME_DECIMALS = 6;
// Milliseconds per second, SI time conversion.
const MS_PER_SECOND = 1000;
/** Samples a viewer's current sequence seconds, packs attributes and submits unchanged GPU passes. */
export function drawViewerFrame(
  viewer: Pick<
    Viewer,
    | 'profiler'
    | 't'
    | 'shots'
    | 'options'
    | 'sprayMode'
    | 'layers'
    | 'count'
    | 'gpuCandidateCount'
    | 'fillMs'
    | 'output'
    | 'renderer'
    | 'scene'
    | 'camera'
    | 'frameMs'
  >,
  sprays: GpuSprays,
): void {
  const profiling = viewer.profiler.requested;
  if (profiling) viewer.profiler.begin(viewer.t);
  const start = performance.now();
  sprays.sources.reset(viewer.t);
  const frames = viewer.shots.flatMap((shot, index) => {
    const time = viewer.t - (shot.t0 ?? 0);
    if (time < 0 || time > shotDuration(shot.design)) return [];
    const placement =
      viewer.options.prop === 'cake' ? { position: cakeHole(index), muzzle_m: CAKE_TOP_M } : {};
    return [
      simulate(shot.design, time, {
        ...shot,
        ...placement,
        smoke: SETTINGS.smoke,
        sprayPhase: profiling ? viewer.profiler.sprayPhase : undefined,
        spraySource: viewer.sprayMode === 'gpu' ? sprays.sources.receive : undefined,
      }),
    ];
  });
  const simulated = performance.now();
  if (profiling) viewer.profiler.simulation(simulated - start);
  viewer.layers.upload(frames);
  sprays.upload();
  if (profiling && viewer.profiler.result)
    viewer.profiler.result.packingMs = performance.now() - simulated;
  viewer.gpuCandidateCount = sprays.sources.count;
  viewer.count = frames.reduce((sum, frame) => sum + frame.kinds.length, sprays.sources.count);
  viewer.fillMs =
    viewer.fillMs * TIMING_OLD_WEIGHT + (performance.now() - start) * (1 - TIMING_OLD_WEIGHT);
  viewer.output.render(
    viewer.renderer,
    viewer.scene,
    viewer.camera,
    profiling ? viewer.profiler : undefined,
  );
  recordFrameDiagnostics(viewer, performance.now() - start);
}

/** Applies non-accumulating rotational radians after controls restore the absolute camera pose. */
export function applyViewerShake(
  viewer: Viewer,
  events: readonly ShakeEvent[],
  offset: Vec3,
  position: Vec3,
): void {
  if (
    !SETTINGS.shake ||
    !viewer.playing ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  viewer.camera.position.toArray(position);
  shakeAt(events, viewer.t, position, offset);
  const scale = Math.min(1, viewer.speed) ** 2;
  viewer.camera.rotateX(offset[0] * scale);
  viewer.camera.rotateY(offset[1] * scale);
  viewer.camera.rotateZ(offset[2] * scale);
}

/** Applies shared rendering preferences and wakes a visible viewer for a settings redraw. */
export function applyViewerSettings(viewer: Viewer, world: ReturnType<typeof makeWorld>): void {
  world.setSettings(SETTINGS.stars, SETTINGS.grid);
  viewer.controls.setFree(SETTINGS.free);
  viewer.invalidate();
}

/** Clears sequence/path frame intervals and CPU/GPU milliseconds before a new comparison. */
export function resetViewerReadout(viewer: Viewer): void {
  viewer.frameTimes.reset();
  viewer.profiler.reset();
  viewer.fillMs = 0;
  viewer.frameMs = 0;
}

/** Returns acoustic placements in world metres, matching particle cake holes when enabled. */
export function soundShots(viewer: Viewer): SoundShot[] {
  return viewer.shots.map((shot, index) =>
    viewer.options.prop === 'cake'
      ? { ...shot, position: cakeHole(index), muzzle_m: CAKE_TOP_M }
      : shot,
  );
}
/** Frees the viewer's scene, output target and WebGL context after transport cleanup. */
export function disposeViewerScene(viewer: Viewer, sprays: GpuSprays): void {
  viewer.scene.remove(viewer.layers.group);
  viewer.scene.remove(sprays.points);
  sprays.dispose();
  viewer.layers.dispose();
  disposeTree(viewer.scene);
  viewer.profiler.dispose();
  viewer.output.dispose();
  viewer.renderer.dispose();
  viewer.renderer.forceContextLoss();
}

/** Advances show seconds by wall-clock seconds times speed; returns whether the final frame needs drawing. */
function advanceViewerPlayback(
  viewer: Pick<Viewer, 'fps' | 't' | 'speed' | 'duration' | 'options' | 'playing'>,
  dt: number,
): boolean {
  if (dt > 0) viewer.fps = viewer.fps * FPS_OLD_WEIGHT + (1 / dt) * (1 - FPS_OLD_WEIGHT);
  const next = viewer.t + dt * viewer.speed;
  if (next <= viewer.duration) {
    viewer.t = next;
    return false;
  }
  if (viewer.options.loop !== false && viewer.duration > 0) {
    viewer.t = next % viewer.duration;
    return false;
  }
  viewer.t = viewer.duration;
  viewer.playing = false;
  return true;
}

// Record raw CPU submission separately from smoothed readouts and display cadence.
function recordFrameDiagnostics(
  viewer: Pick<Viewer, 'renderer' | 't' | 'count' | 'gpuCandidateCount' | 'frameMs'>,
  elapsedMs: number,
): void {
  const diagnostics = viewer.renderer.domElement.dataset;
  diagnostics.cpuFrameMs = String(elapsedMs);
  diagnostics.cpuParticles = String(viewer.count - viewer.gpuCandidateCount);
  diagnostics.gpuCandidates = String(viewer.gpuCandidateCount);
  diagnostics.drawnTime = viewer.t.toFixed(DRAWN_TIME_DECIMALS);
  diagnostics.drawPending = 'false';
  viewer.frameMs = viewer.frameMs * TIMING_OLD_WEIGHT + elapsedMs * (1 - TIMING_OLD_WEIGHT);
}

/** Whether a visible viewer has work, including an external soundtrack clock. */
export function viewerLiveDrawPending(
  viewer: Pick<Viewer, 'playing'>,
  onScreen: boolean,
  dirty: boolean,
  cameraMoving: boolean,
): boolean {
  return onScreen && !document.hidden && (dirty || viewer.playing || cameraMoving);
}

/** Records playback cadence and advances only a locally owned sequence clock. */
export function tickViewerPlayback(viewer: Viewer, dt: number): boolean {
  if (!viewer.playing) return false;
  viewer.frameTimes.record(dt * MS_PER_SECOND);
  return !viewer.externalClock && advanceViewerPlayback(viewer, dt);
}
