/** Public, server-safe design API. */
export { FireworkDesignSchema } from './design-schema.ts';
export type { FireworkDesign, FireworkStarLayer, StarLayerKey } from './design-schema.ts';
export {
  BURST_TRAIL_FADE_MODES,
  BURST_TRAIL_FLICKER_LIFE_MAX,
  BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX,
  BURST_TRAIL_MAX_STOPS,
  BURST_TRAIL_PARTICLES_PER_STAR_MAX,
  BURST_TRAIL_PRESETS,
  BURST_TRAIL_SHAPES,
  ColorSchema,
  DEFAULT_STAR_CLOSING_COLOUR,
  DEFAULT_STAR_HEAD_SIZE,
  DEFAULT_STAR_INNER_HEAD_SIZE,
  DEFAULT_STAR_OPENING_COLOUR,
  DEFAULT_TRAIL_CLOSING_COLOUR,
  DEFAULT_TRAIL_STREAK,
  FIREWORK_GEOMETRIES,
  FIREWORK_PATTERNS,
  FIREWORK_TRAIL_PROFILES,
  HEAD_APPEARANCE_DEFAULTS,
  LAUNCH_SHELL_SHAPES,
  MAX_STAR_COUNT,
  RgbSchema,
  STAR_AIR_RESISTANCE_PERCENT_MAX,
  STAR_HEAD_CLOSING_DEFAULTS,
  STAR_HEAD_OPENING_DEFAULTS,
  STAR_TERMINAL_VELOCITY_MAX,
  STAR_TRAIL_COLOR_MODES,
  STAR_TRAIL_MODES,
  TRAIL_CLOSING_DEFAULTS,
  TRAIL_OPENING_DEFAULTS,
  orderedRangeSchema,
  round2,
} from './fields.ts';
export type {
  BurstTrailFadeMode,
  BurstTrailPreset,
  BurstTrailShape,
  FireworkGeometry,
  FireworkPattern,
  FireworkTrailProfile,
  StarTrailColorMode,
  StarTrailMode,
} from './fields.ts';
export { GEOMETRY_TUNING_DEFAULTS, GeometryTuningSchema, percent } from './geometry-schema.ts';
export type { FireworkGeometryTuning, GeometryTuningGroupKey } from './geometry-schema.ts';
export {
  DEFAULT_LAUNCH_SMOKE_COLOR,
  LaunchLiftParticlesSchema,
  LaunchSchema,
  LaunchShellSchema,
  LaunchShellTrailSchema,
} from './launch-schema.ts';
export type { LaunchShellShape } from './launch-schema.ts';
export {
  StarBurstSchema,
  StarColourPatternSchema,
  StarFlairSizeRangeSchema,
  StarGravityRangeSchema,
  StarHeadClosingSchema,
  StarHeadOpeningSchema,
  StarHeadSchema,
  StarLayerSchema,
  StarLifeRangeSchema,
  StarSpeedRangeSchema,
} from './star-schema.ts';
export {
  BurstTrailSchema,
  BurstTrailShapeWeightsSchema,
  BurstTrailStopSchema,
  TrailClosingSchema,
  TrailOpeningSchema,
} from './trail-schema.ts';
