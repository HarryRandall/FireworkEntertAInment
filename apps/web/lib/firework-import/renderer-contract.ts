/**
 * Runtime sources whose bytes define the import renderer evidence boundary.
 * The contract test hashes both each path and its contents, so adding, removing
 * or changing a capture-affecting source requires a new version fingerprint.
 */
export const FIREWORKS_ENGINE_IMPORT_RENDERER_SOURCE_FILES = [
  'ui/replay/FireworkReplayCanvas.tsx',
  'app/internal/import-render/ImportRenderHarness.tsx',
  '../../packages/fireworks/src/Effects.ts',
  '../../packages/fireworks/src/FireworksEngine.ts',
  '../../packages/fireworks/src/Lights.ts',
  '../../packages/fireworks/src/Particle.ts',
  '../../packages/fireworks/src/ParticlePool.ts',
  '../../packages/fireworks/src/Scheduler.ts',
  '../../packages/fireworks/src/SoundHandler.ts',
  '../../packages/fireworks/src/World.ts',
  '../../packages/fireworks/src/behaviours.ts',
  '../../packages/fireworks/src/clock.ts',
  '../../packages/fireworks/src/design.ts',
  '../../packages/fireworks/src/editor-ranges.ts',
  '../../packages/fireworks/src/effect-catalogue.ts',
  '../../packages/fireworks/src/effects/burst.ts',
  '../../packages/fireworks/src/effects/colours.ts',
  '../../packages/fireworks/src/effects/constants.ts',
  '../../packages/fireworks/src/effects/geometry.ts',
  '../../packages/fireworks/src/effects/ground.ts',
  '../../packages/fireworks/src/effects/launch.ts',
  '../../packages/fireworks/src/effects/lift.ts',
  '../../packages/fireworks/src/effects/math.ts',
  '../../packages/fireworks/src/effects/secondary.ts',
  '../../packages/fireworks/src/effects/stars.ts',
  '../../packages/fireworks/src/effects/trail-shape.ts',
  '../../packages/fireworks/src/effects/trails.ts',
  '../../packages/fireworks/src/effects/types.ts',
  '../../packages/fireworks/src/emission.ts',
  '../../packages/fireworks/src/launch-positions.ts',
  '../../packages/fireworks/src/model/colours.ts',
  '../../packages/fireworks/src/model/compile.ts',
  '../../packages/fireworks/src/model/design-schema.ts',
  '../../packages/fireworks/src/model/diagnostics.ts',
  '../../packages/fireworks/src/model/fields.ts',
  '../../packages/fireworks/src/model/geometry-schema.ts',
  '../../packages/fireworks/src/model/launch-schema.ts',
  '../../packages/fireworks/src/model/normalise.ts',
  '../../packages/fireworks/src/model/records.ts',
  '../../packages/fireworks/src/model/scaling.ts',
  '../../packages/fireworks/src/model/schema.ts',
  '../../packages/fireworks/src/model/star-schema.ts',
  '../../packages/fireworks/src/model/trail-presets.ts',
  '../../packages/fireworks/src/model/trail-schema.ts',
  '../../packages/fireworks/src/random.ts',
  '../../packages/fireworks/src/render-tuning.ts',
  '../../packages/fireworks/src/replay-cache-key.ts',
  '../../packages/fireworks/src/shaders.ts',
  '../../packages/fireworks/src/spec.ts',
  '../../packages/fireworks/src/style-defaults.ts',
  '../../packages/fireworks/src/timing.ts',
  '../../packages/fireworks/src/types.ts',
  'lib/firework-import/reconstruction.ts',
  'lib/firework-import/render-metrics.ts',
  'lib/firework-import/reconstruction-shot.ts',
] as const;

/**
 * The fingerprint is verified against the source list above in the test gate.
 * Sealed evidence is invalid as soon as the deployed renderer bytes drift.
 */
export const FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION =
  'showcrafter.fireworks-engine.import-renderer.v1+sha256.f32ad4d4942a4bd99339dc594b37514e70e44c8920e7f3958465da1160702572' as const;

export const FIREWORKS_ENGINE_FIXED_STEP_SECONDS = 1 / 60;

export function quantiseFireworksEngineTimeSeconds(
  timeSeconds: number,
  rounding: 'floor' | 'nearest' | 'ceil' = 'nearest',
): number {
  const bounded = Math.max(0, timeSeconds);
  const frame =
    rounding === 'floor'
      ? Math.floor(bounded / FIREWORKS_ENGINE_FIXED_STEP_SECONDS + 1e-9)
      : rounding === 'ceil'
        ? Math.ceil(bounded / FIREWORKS_ENGINE_FIXED_STEP_SECONDS - 1e-9)
        : Math.round(bounded / FIREWORKS_ENGINE_FIXED_STEP_SECONDS);
  return frame * FIREWORKS_ENGINE_FIXED_STEP_SECONDS;
}
