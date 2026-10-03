/** Frame construction and submission, separate from viewer transport and lifecycle. */
import { simulate, shotDuration } from '../sim/index';
import { CAKE_TOP_M, cakeHole } from './props';
import type { makeWorld } from './world';
import { SETTINGS } from './settings';
import { shakeAt, type ShakeEvent } from '../sim/shake';
import type { Vec3 } from '../sim/colour';
import type { Viewer } from './viewer';
import type { GpuSprays } from './gpu-sprays';
// Prototype smoothing weight for displayed milliseconds, dimensionless.
const TIMING_OLD_WEIGHT = 0.9;
/** Samples a viewer's current sequence seconds, packs attributes and submits unchanged GPU passes. */
export function drawViewerFrame(viewer: Viewer, sprays: GpuSprays): void {
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
  viewer.count = frames.reduce((sum, frame) => sum + frame.kinds.length, sprays.sources.count);
  viewer.fillMs =
    viewer.fillMs * TIMING_OLD_WEIGHT + (performance.now() - start) * (1 - TIMING_OLD_WEIGHT);
  viewer.output.render(
    viewer.renderer,
    viewer.scene,
    viewer.camera,
    profiling ? viewer.profiler : undefined,
  );
  viewer.frameMs =
    viewer.frameMs * TIMING_OLD_WEIGHT + (performance.now() - start) * (1 - TIMING_OLD_WEIGHT);
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
