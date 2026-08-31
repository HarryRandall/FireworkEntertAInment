/**
 * Runtime sources whose bytes define the import renderer evidence boundary.
 * The contract test hashes both each path and its contents, so adding, removing
 * or changing a capture-affecting source requires a new version fingerprint.
 */
export const FIREWORKS_ENGINE_IMPORT_RENDERER_SOURCE_FILES = [
  'app/components/app/FireworkReplayCanvas.tsx',
  'app/internal/import-render/ImportRenderHarness.tsx',
  'lib/fireworks/Effects.ts',
  'lib/fireworks/FireworksEngine.ts',
  'lib/fireworks/Lights.ts',
  'lib/fireworks/Particle.ts',
  'lib/fireworks/ParticlePool.ts',
  'lib/fireworks/Scheduler.ts',
  'lib/fireworks/World.ts',
  'lib/fireworks/design.ts',
  'lib/fireworks/effect-catalogue.ts',
  'lib/fireworks/random.ts',
  'lib/fireworks/render-tuning.ts',
  'lib/fireworks/shaders.ts',
  'lib/fireworks/spec.ts',
  'lib/fireworks/style-defaults.ts',
  'lib/fireworks/timing.ts',
  'lib/import-reconstruction.ts',
  'lib/import-render-metrics.ts',
  'lib/reconstruction-shot.ts',
] as const;

/**
 * The fingerprint is verified against the source list above in the test gate.
 * Sealed evidence is invalid as soon as the deployed renderer bytes drift.
 */
export const FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION =
  'showcrafter.fireworks-engine.import-renderer.v1+sha256.f24d5b8e1e7ff87737d1ffe1ff05d9ac4a07b59f7ad1c03f0bb6e7ace1aa51ff' as const;

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
