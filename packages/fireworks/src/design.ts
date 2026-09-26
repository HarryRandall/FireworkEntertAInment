/** Public, server-safe design API. */
export {
  DEFAULT_LAUNCH_POSITIONS,
  parseLaunchPositions,
  type LaunchPosition,
} from './launch-positions.ts';
export { canonicaliseEffectModelJson, compileFireworkDesign } from './model/compile.ts';
export {
  DEFAULT_DESIGN,
  fireworkDesignFragmentError,
  hydrateBurstTrailDefaults,
  safeParseFireworkDesign,
} from './model/normalise.ts';
export {
  estimateDesignDurationSeconds,
  scaleDesignForCaliber,
  scaleDesignForEmphasis,
} from './model/scaling.ts';
export {
  BURST_TRAIL_FADE_MODES,
  BURST_TRAIL_FLICKER_LIFE_MAX,
  BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX,
  BURST_TRAIL_MAX_STOPS,
  BURST_TRAIL_PARTICLES_PER_STAR_MAX,
  BURST_TRAIL_PRESETS,
  BURST_TRAIL_SHAPES,
  DEFAULT_LAUNCH_SMOKE_COLOR,
  FIREWORK_GEOMETRIES,
  FIREWORK_PATTERNS,
  FIREWORK_TRAIL_PROFILES,
  FireworkDesignSchema,
  GEOMETRY_TUNING_DEFAULTS,
  LAUNCH_SHELL_SHAPES,
  STAR_AIR_RESISTANCE_PERCENT_MAX,
  DEFAULT_STAR_COUNT,
  MAX_STAR_COUNT,
  DEFAULT_LIFT_VELOCITY,
  LAUNCH_SHELL_SIZE_MIN,
  LAUNCH_SHELL_SIZE_MAX,
  DEFAULT_LAUNCH_SHELL_SIZE,
  DEFAULT_FOUNTAIN_RATE,
  MAX_FOUNTAIN_RATE,
  STAR_TERMINAL_VELOCITY_MAX,
  STAR_TRAIL_COLOR_MODES,
  STAR_TRAIL_MODES,
} from './model/schema.ts';
export type {
  BurstTrailFadeMode,
  BurstTrailPreset,
  BurstTrailShape,
  FireworkDesign,
  FireworkGeometry,
  FireworkGeometryTuning,
  FireworkPattern,
  FireworkStarLayer,
  FireworkTrailProfile,
  GeometryTuningGroupKey,
  LaunchShellShape,
  StarLayerKey,
  StarTrailColorMode,
  StarTrailMode,
} from './model/schema.ts';
export { makeBurstTrailPreset, normaliseBurstTrailStops } from './model/trail-presets.ts';
export { estimateFireworkDesignTiming } from './timing.ts';

export { validateFireworkDesign } from './model/compile.ts';
export { RendererValidationError } from './model/diagnostics.ts';
export type { RenderDiagnostic, RenderResult } from './model/diagnostics.ts';
