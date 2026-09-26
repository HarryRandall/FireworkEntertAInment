import type { FireworkStarLayer, LaunchShellShape } from '@showcrafter/fireworks/design';
import {
  BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX,
  MAX_STAR_COUNT,
  FIREWORK_PATTERNS,
  FIREWORK_TRAIL_PROFILES,
} from '@showcrafter/fireworks/design';
import {
  DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF,
  DEFAULT_BACKGROUND_GLOW_SOFTNESS,
  DEFAULT_CORE_BRIGHTNESS,
  DEFAULT_CORE_OPACITY_FALLOFF,
  DEFAULT_CORE_SOFTNESS,
  DEFAULT_GLOW_BLUR,
  DEFAULT_GLOW_OPACITY_FALLOFF,
  DEFAULT_GLOW_PADDING,
  DEFAULT_GLOW_SIZE,
  DEFAULT_GLOW_SOFTNESS,
  DEFAULT_HEAD_GLOW_STRENGTH,
  DEFAULT_WHITE_CORE_BLUR_PERCENT,
  DEFAULT_WHITE_CORE_SIZE_PERCENT,
  MAX_BACKGROUND_GLOW_OPACITY_FALLOFF,
  MAX_BACKGROUND_GLOW_SOFTNESS,
  MAX_CORE_BRIGHTNESS,
  MAX_CORE_OPACITY_FALLOFF,
  MAX_CORE_SOFTNESS,
  MAX_GLOW_BLUR,
  MAX_GLOW_OPACITY_FALLOFF,
  MAX_GLOW_PADDING,
  MAX_GLOW_SIZE,
  MAX_GLOW_SOFTNESS,
  MAX_HEAD_GLOW_STRENGTH,
  MAX_WHITE_CORE_BLUR_PERCENT,
  MAX_WHITE_CORE_SIZE_PERCENT,
  MIN_BACKGROUND_GLOW_OPACITY_FALLOFF,
  MIN_BACKGROUND_GLOW_SOFTNESS,
  MIN_CORE_BRIGHTNESS,
  MIN_CORE_OPACITY_FALLOFF,
  MIN_CORE_SOFTNESS,
  MIN_GLOW_BLUR,
  MIN_GLOW_OPACITY_FALLOFF,
  MIN_GLOW_PADDING,
  MIN_GLOW_SIZE,
  MIN_GLOW_SOFTNESS,
  MIN_HEAD_GLOW_STRENGTH,
  MIN_WHITE_CORE_BLUR_PERCENT,
  MIN_WHITE_CORE_SIZE_PERCENT,
} from '@showcrafter/fireworks/render-tuning';
import type { JsonRecord } from './types.ts';

export type StarColourPatternEntry = FireworkStarLayer['colourPattern']['colours'][number];

export const BOOM_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
];

export const TRAIL_PRESET_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'sparkDust', label: 'Spark dust' },
  { value: 'solidStreaks', label: 'Solid streaks' },
  { value: 'willowHang', label: 'Willow hang' },
  { value: 'cometTail', label: 'Comet tail' },
  { value: 'denseBrocade', label: 'Dense brocade' },
  { value: 'silverRain', label: 'Silver rain' },
  { value: 'ghostFade', label: 'Ghost fade' },
  { value: 'dragonEgg', label: 'Dragon egg' },
  { value: 'titaniumFlash', label: 'Titanium flash' },
  { value: 'custom', label: 'Custom' },
];

export const PATTERN_OPTIONS = FIREWORK_PATTERNS.map((pattern) => ({
  value: pattern,
  label:
    {
      fibonacci: 'Fibonacci sphere',
      wave: 'Wave phase',
      strobe: 'Strobe phase',
    }[pattern] ?? pattern,
}));

export const STAR_COLOUR_PATTERN_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'random', label: 'Random mix' },
  { value: 'bands', label: 'Bands' },
  { value: 'stripes', label: 'Stripes' },
] as const;

export const STAR_COLOUR_AXIS_OPTIONS = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
] as const;

export const TRAIL_PROFILE_OPTIONS = FIREWORK_TRAIL_PROFILES.map((profile) => ({
  value: profile,
  label:
    {
      none: 'None',
      spark: 'Spark',
      glitter: 'Glitter',
      long_hang: 'Long hang',
      thick_tail: 'Thick tail',
      fragmenting: 'Fragmenting',
      spray: 'Spray',
      blink: 'Blink',
      crackle: 'Crackle',
      pearls: 'Pearls',
      fish: 'Flying fish',
      waterfall: 'Waterfall',
      whirl: 'Tourbillion',
    }[profile] ?? profile,
}));

export const TRAIL_LIFETIME_MODE_OPTIONS = [
  { value: 'dynamic', label: 'Follow star life' },
  { value: 'fixed', label: 'Fixed duration' },
];

export const CRACKLE_COLOUR_OPTIONS = [
  { value: 'silver', label: 'Silver' },
  { value: 'star', label: 'Star colour' },
  { value: 'gold', label: 'Gold' },
];

export const CRACKLE_SOUND_OPTIONS = [
  { value: 'crackle', label: 'Crackle' },
  { value: 'lightBoom', label: 'Light report' },
  { value: 'heavyBoom', label: 'Heavy report' },
];

export const TRAIL_COLOR_OPTIONS = [
  { value: 'star', label: 'Star colour' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'ember', label: 'Ember' },
  { value: 'starFade', label: 'Star, fading to ember' },
];

export const TRAIL_PARTICLE_SHAPE_OPTIONS = [
  { value: 'square', label: 'Square' },
  { value: 'circle', label: 'Glowing disc' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'mixed', label: 'Mixed' },
] as const;

export const LAUNCH_SHELL_SHAPE_OPTIONS = [
  { value: 'circle', label: 'Glowing disc' },
  { value: 'orb', label: 'Soft orb' },
  { value: 'square', label: 'Square' },
  { value: 'triangle', label: 'Triangle' },
] satisfies { value: LaunchShellShape; label: string }[];

export const LIFT_APPEARANCE_OPTIONS = [
  { value: 'inherit', label: 'Match burst trail' },
  { value: 'custom', label: 'Custom settings' },
];

export const STAR_COUNT_MIN = 1;

export const STAR_COUNT_MAX = MAX_STAR_COUNT;

export const STAR_SIZE_MIN = 10;

export const STAR_SIZE_MAX = 1000;

export const STAR_SIZE_STEP = 10;

export const STAR_SPEED_MIN = 0;

export const STAR_SPEED_MAX = 20;

export const STAR_GRAVITY_MIN = -2;

export const STAR_GRAVITY_MAX = 1;

export const STAR_OPENING_COLOUR_HEX = '#ff6b14';

export const STAR_OPENING_PERCENT_MIN = 1;

export const STAR_OPENING_PERCENT_MAX = 100;

export const STAR_CLOSING_COLOUR_HEX = '#ffd666';

export const STAR_CLOSING_PERCENT_MIN = 1;

export const STAR_CLOSING_PERCENT_MAX = 100;

export const STAR_CLOSING_END_PERCENT_MIN = 0;

export const STAR_CLOSING_END_PERCENT_MAX = 100;

export const STAR_LIFE_MIN = 0.05;

export const STAR_LIFE_MAX = 30;

export const STAR_COLOUR_PATTERN_MAX_COLOURS = 8;

export const TRAIL_PARTICLE_SIZE_MAX = 24;

export const TRAIL_PARTICLE_SCALE_MAX = 4;

export const TRAIL_PARTICLE_LIFE_MAX = 2;

export const TRAIL_OPENING_BRIGHTNESS_MAX = 300;

export const SHELL_TRAIL_SPREAD_ANGLE_MAX = 60;

export const TRAIL_SPREAD_ANGLE_MAX = 80;

export const TRAIL_FRONT_SPREAD_ANGLE_MIN = 1;

export const TRAIL_FRONT_SPREAD_ANGLE_MAX = BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX;

export const TRAIL_BIAS_MIN = -100;

export const TRAIL_BIAS_MAX = 100;

export const TRAIL_HEAD_GAP_MAX = 300;

export const TRAIL_SPACING_CURVE_MIN = 0.2;

export const TRAIL_SPACING_CURVE_MAX = 4;

export const TRAIL_ROTATION_MAX = 8;

export const LAUNCH_SHELL_SIZE_SCALE_MIN = 0.25;

export const LAUNCH_SHELL_SIZE_SCALE_MAX = 4;

export const LAUNCH_SHELL_BRIGHTNESS_MAX = 3;

export const SHELL_TRAIL_TUBE_DIAMETER_MAX = 90;

export const SHELL_TRAIL_CURVE_MIN = 0.2;

export const SHELL_TRAIL_CURVE_MAX = 4;

export const LIFT_PARTICLE_AMOUNT_MAX = 1000;

export const LIFT_PARTICLE_SIZE_MAX = 180;

export const LIFT_PARTICLE_HEIGHT_PERCENT_MAX = 100;

export const LIFT_PARTICLE_FLICKER_STRENGTH_MAX = 3;

export const LIFT_PARTICLE_GRAVITY_MIN = -2;

export const LIFT_PARTICLE_GRAVITY_MAX = 1;

export const LIFT_PARTICLE_DRAG_MAX = 6;

export const LIFT_PARTICLE_INHERITED_VELOCITY_MAX = 1;

export const LIFT_PARTICLE_TURBULENCE_MAX = 2;

export const LIFT_PATH_SAMPLES_MAX = 12;

export const LIFT_SWIRL_STRENGTH_MAX = 4;

export const LIFT_SWIRL_RADIUS_MAX = 180;

export const LIFT_SWIRL_LOOP_COUNT_MAX = 6;

export const LIFT_SWIRL_LOOP_LENGTH_MIN = 5;

export const LIFT_SWIRL_LOOP_LENGTH_MAX = 100;

export const LIFT_SWIRL_LOOP_HEIGHT_MAX = 180;

export const LIFT_SWIRL_RATE_MAX = 16;

export const LAUNCH_SMOKE_PARTICLES_MAX = 500;

export const LAUNCH_SMOKE_SIZE_MAX = 220;

export const LAUNCH_SMOKE_SPREAD_MAX = 140;

export const LAUNCH_SMOKE_DRIFT_MAX = 4;

export const LAUNCH_SMOKE_HEIGHT_MAX = 900;

export const HEAD_GLOW_STRENGTH_RANGE = {
  min: MIN_HEAD_GLOW_STRENGTH,
  defaultValue: DEFAULT_HEAD_GLOW_STRENGTH,
  max: MAX_HEAD_GLOW_STRENGTH,
};

export const CORE_SOFTNESS_RANGE = {
  min: MIN_CORE_SOFTNESS,
  defaultValue: DEFAULT_CORE_SOFTNESS,
  max: MAX_CORE_SOFTNESS,
};

export const CORE_BRIGHTNESS_RANGE = {
  min: MIN_CORE_BRIGHTNESS,
  defaultValue: DEFAULT_CORE_BRIGHTNESS,
  max: MAX_CORE_BRIGHTNESS,
};

export const WHITE_CORE_SIZE_RANGE = {
  min: MIN_WHITE_CORE_SIZE_PERCENT,
  defaultValue: DEFAULT_WHITE_CORE_SIZE_PERCENT,
  max: MAX_WHITE_CORE_SIZE_PERCENT,
};

export const WHITE_CORE_BLUR_RANGE = {
  min: MIN_WHITE_CORE_BLUR_PERCENT,
  defaultValue: DEFAULT_WHITE_CORE_BLUR_PERCENT,
  max: MAX_WHITE_CORE_BLUR_PERCENT,
};

export const CORE_OPACITY_RANGE = {
  min: MIN_CORE_OPACITY_FALLOFF,
  defaultValue: DEFAULT_CORE_OPACITY_FALLOFF,
  max: MAX_CORE_OPACITY_FALLOFF,
};

export const GLOW_SIZE_RANGE = {
  min: MIN_GLOW_SIZE,
  defaultValue: DEFAULT_GLOW_SIZE,
  max: MAX_GLOW_SIZE,
};

export const GLOW_SOFTNESS_RANGE = {
  min: MIN_GLOW_SOFTNESS,
  defaultValue: DEFAULT_GLOW_SOFTNESS,
  max: MAX_GLOW_SOFTNESS,
};

export const GLOW_OPACITY_RANGE = {
  min: MIN_GLOW_OPACITY_FALLOFF,
  defaultValue: DEFAULT_GLOW_OPACITY_FALLOFF,
  max: MAX_GLOW_OPACITY_FALLOFF,
};

export const BACKGROUND_GLOW_SIZE_RANGE = {
  min: MIN_GLOW_PADDING,
  defaultValue: DEFAULT_GLOW_PADDING,
  max: MAX_GLOW_PADDING,
};

export const BACKGROUND_GLOW_STRENGTH_RANGE = {
  min: MIN_GLOW_BLUR,
  defaultValue: DEFAULT_GLOW_BLUR,
  max: MAX_GLOW_BLUR,
};

export const BACKGROUND_GLOW_SOFTNESS_RANGE = {
  min: MIN_BACKGROUND_GLOW_SOFTNESS,
  defaultValue: DEFAULT_BACKGROUND_GLOW_SOFTNESS,
  max: MAX_BACKGROUND_GLOW_SOFTNESS,
};

export const BACKGROUND_GLOW_OPACITY_RANGE = {
  min: MIN_BACKGROUND_GLOW_OPACITY_FALLOFF,
  defaultValue: DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF,
  max: MAX_BACKGROUND_GLOW_OPACITY_FALLOFF,
};

export const LIFT_VELOCITY_OPTIONS = [
  { value: 'small', label: 'Small', velocity: 7 },
  { value: 'normal', label: 'Normal', velocity: 15 },
  { value: 'high', label: 'High', velocity: 20 },
  { value: 'custom', label: 'Custom', velocity: null },
] as const;

export type LiftVelocityMode = (typeof LIFT_VELOCITY_OPTIONS)[number]['value'];

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRecord(parent: JsonRecord, key: string): JsonRecord {
  return isRecord(parent[key]) ? (parent[key] as JsonRecord) : {};
}

export function ensureRecord(parent: JsonRecord, key: string): JsonRecord {
  if (!isRecord(parent[key])) parent[key] = {};
  return parent[key] as JsonRecord;
}

export function rangeMid(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

export function rangeHalfWidth(range: [number, number]): number {
  return Math.abs(range[1] - range[0]) / 2;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function lifeRangeFromMidAndHalfWidth(mid: number, halfWidth: number): [number, number] {
  const safeMid = clampNumber(mid, STAR_LIFE_MIN, STAR_LIFE_MAX);
  const safeHalfWidth = clampNumber(
    halfWidth,
    0,
    Math.min(safeMid - STAR_LIFE_MIN, STAR_LIFE_MAX - safeMid),
  );
  return [round2(safeMid - safeHalfWidth), round2(safeMid + safeHalfWidth)];
}

export function boundedRangeFromMidpoint(
  mid: number,
  halfWidth: number,
  min: number,
  max: number,
): [number, number] {
  const safeMid = clampNumber(mid, min, max);
  const safeHalfWidth = clampNumber(halfWidth, 0, Math.min(safeMid - min, max - safeMid));
  return [round2(safeMid - safeHalfWidth), round2(safeMid + safeHalfWidth)];
}

export function formatSeconds(value: number): string {
  return `${value.toFixed(Number.isInteger(value * 10) ? 1 : 2)}s`;
}

export function formatLifeVariation(value: number): string {
  return value <= 0 ? 'None' : `+/-${value.toFixed(Number.isInteger(value * 10) ? 1 : 2)}s`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function formatDegrees(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} deg`;
}

export function formatMultiplier(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}x`;
}

export function formatProbability(value: number): string {
  return formatPercent(value * 100);
}

export function formatRotation(value: number): string {
  if (value <= 0) return 'Off';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}x`;
}

export function formatTurns(value: number): string {
  if (value <= 0) return 'Off';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} r/s`;
}

export function formatLoopCount(value: number): string {
  if (value <= 0) return 'Off';
  const formatted = value.toFixed(value % 1 === 0 ? 0 : 1);
  return `${formatted} ${value === 1 ? 'loop' : 'loops'}`;
}

export function trailBiasFromFrontClump(frontClump: number): number {
  return round2((frontClump - 0.5) * 200);
}

export function frontClumpFromTrailBias(value: number): number {
  return round2((value - TRAIL_BIAS_MIN) / (TRAIL_BIAS_MAX - TRAIL_BIAS_MIN));
}

export function formatTrailBias(value: number): string {
  if (Math.abs(value) < 1) return 'Even';
  return value > 0 ? `Head ${Math.round(value)}%` : `Tail ${Math.round(Math.abs(value))}%`;
}

export function hexToRgbObject(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const int = Number.parseInt(clean, 16);
  return {
    r: ((int >> 16) & 0xff) / 255,
    g: ((int >> 8) & 0xff) / 255,
    b: (int & 0xff) / 255,
  };
}

export function rgbObjectToHex(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const r = Number(value.r);
  const g = Number(value.g);
  const b = Number(value.b);
  if (![r, g, b].every(Number.isFinite)) return null;
  const toByte = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * 255)));
  return `#${[toByte(r), toByte(g), toByte(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function liftVelocityPresetMode(value: number): LiftVelocityMode {
  const rounded = round2(value);
  const preset = LIFT_VELOCITY_OPTIONS.find(
    (option) => option.velocity != null && option.velocity === rounded,
  );
  return preset?.value ?? 'custom';
}

export type BurstTrail = FireworkStarLayer['burstTrail'];

export type BurstTrailStop = BurstTrail['stops'][number];

export type StarHeadOpening = FireworkStarLayer['head']['opening'];

export type StarHeadClosing = FireworkStarLayer['head']['closing'];

export type BurstTrailOpening = BurstTrail['opening'];

export type BurstTrailClosing = BurstTrail['closing'];

export type TrailParticleShapeOption = (typeof TRAIL_PARTICLE_SHAPE_OPTIONS)[number]['value'];

export const TRAIL_PARTICLE_SHAPE_WEIGHTS: Record<
  TrailParticleShapeOption,
  BurstTrailStop['shapeWeights']
> = {
  square: { circle: 0, square: 100, triangle: 0 },
  circle: { circle: 100, square: 0, triangle: 0 },
  triangle: { circle: 0, square: 0, triangle: 100 },
  mixed: { circle: 25, square: 50, triangle: 25 },
};

export function cloneTrail(trail: BurstTrail): BurstTrail {
  return JSON.parse(JSON.stringify(trail)) as BurstTrail;
}

export function averageShapeWeights(
  stops: readonly BurstTrailStop[],
): BurstTrailStop['shapeWeights'] {
  if (stops.length === 0) return TRAIL_PARTICLE_SHAPE_WEIGHTS.square;
  return {
    circle: round2(stops.reduce((sum, stop) => sum + stop.shapeWeights.circle, 0) / stops.length),
    square: round2(stops.reduce((sum, stop) => sum + stop.shapeWeights.square, 0) / stops.length),
    triangle: round2(
      stops.reduce((sum, stop) => sum + stop.shapeWeights.triangle, 0) / stops.length,
    ),
  };
}

export function shapeOptionFromStops(stops: readonly BurstTrailStop[]): TrailParticleShapeOption {
  const weights = averageShapeWeights(stops);
  return shapeOptionFromWeights(weights);
}

export function shapeOptionFromWeights(
  weights: BurstTrailStop['shapeWeights'],
): TrailParticleShapeOption {
  if (weights.circle >= 99.5 && weights.square <= 0.5 && weights.triangle <= 0.5) return 'circle';
  if (weights.triangle >= 99.5 && weights.circle <= 0.5 && weights.square <= 0.5) {
    return 'triangle';
  }
  if (weights.square >= 99.5 && weights.circle <= 0.5 && weights.triangle <= 0.5) return 'square';
  return 'mixed';
}
