import { z } from 'zod';
import { RENDERER_GEOMETRIES } from '../behaviours.ts';
import {
  DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF,
  DEFAULT_BACKGROUND_GLOW_SOFTNESS,
  DEFAULT_BRIGHTNESS_HOLD_EXPONENT,
  DEFAULT_BRIGHTNESS_HOLD_PERCENT,
  DEFAULT_CORE_BRIGHTNESS,
  DEFAULT_CORE_OPACITY_FALLOFF,
  DEFAULT_CORE_SOFTNESS,
  DEFAULT_GLOW_BLUR,
  DEFAULT_GLOW_OPACITY_FALLOFF,
  DEFAULT_GLOW_PADDING,
  DEFAULT_GLOW_SIZE,
  DEFAULT_GLOW_SOFTNESS,
  DEFAULT_WHITE_CORE_BLUR_PERCENT,
  DEFAULT_WHITE_CORE_SIZE_PERCENT,
} from '../render-tuning.ts';

/**
 * Persisted head-orb appearance defaults. These live on the design (per effect
 * and per firework) so the look an editor dials in is saved and inherited,
 * rather than being a runtime-only preview tuning. Values mirror the
 * render-tuning defaults so unset designs render identically to the old global
 * preview defaults.
 */
export const HEAD_APPEARANCE_DEFAULTS = {
  glowPadding: DEFAULT_GLOW_PADDING,
  whiteCoreSizePercent: DEFAULT_WHITE_CORE_SIZE_PERCENT,
  whiteCoreBlurPercent: DEFAULT_WHITE_CORE_BLUR_PERCENT,
  coreSoftness: DEFAULT_CORE_SOFTNESS,
  coreBrightness: DEFAULT_CORE_BRIGHTNESS,
  coreOpacityFalloff: DEFAULT_CORE_OPACITY_FALLOFF,
  glowSize: DEFAULT_GLOW_SIZE,
  glowSoftness: DEFAULT_GLOW_SOFTNESS,
  glowOpacityFalloff: DEFAULT_GLOW_OPACITY_FALLOFF,
  glowBlur: DEFAULT_GLOW_BLUR,
  backgroundGlowOpacityFalloff: DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF,
  backgroundGlowSoftness: DEFAULT_BACKGROUND_GLOW_SOFTNESS,
  brightnessHoldPercent: DEFAULT_BRIGHTNESS_HOLD_PERCENT,
  brightnessHoldExponent: DEFAULT_BRIGHTNESS_HOLD_EXPONENT,
} as const;

export const DEFAULT_STAR_HEAD_SIZE = 360;

export const DEFAULT_STAR_INNER_HEAD_SIZE = Math.round(DEFAULT_STAR_HEAD_SIZE * 0.62);

export const DEFAULT_STAR_OPENING_COLOUR = { r: 1, g: 0.42, b: 0.08 };

export const DEFAULT_STAR_CLOSING_COLOUR = { r: 1, g: 0.84, b: 0.4 };

export const DEFAULT_TRAIL_CLOSING_COLOUR = { r: 1, g: 0.34, b: 0.08 };

export const STAR_HEAD_OPENING_DEFAULTS = {
  colour: {
    enabled: false,
    color: DEFAULT_STAR_OPENING_COLOUR,
    fadePercent: 24,
  },
  size: {
    enabled: false,
    startPercent: 35,
    growPercent: 22,
  },
};

export const STAR_HEAD_CLOSING_DEFAULTS = {
  colour: {
    enabled: false,
    color: DEFAULT_STAR_CLOSING_COLOUR,
    fadePercent: 22,
  },
  size: {
    enabled: false,
    endPercent: 0,
    shrinkPercent: 22,
  },
};

export const TRAIL_OPENING_DEFAULTS = {
  size: {
    startPercent: 100,
  },
  visibility: {
    brightnessPercent: 100,
    particlesPercent: 100,
    revealPercent: 24,
  },
};

export const TRAIL_CLOSING_DEFAULTS = {
  colour: {
    enabled: false,
    color: DEFAULT_TRAIL_CLOSING_COLOUR,
    fadePercent: 22,
  },
  size: {
    enabled: false,
    endPercent: 0,
    shrinkPercent: 22,
  },
  spreadFade: {
    enabled: true,
    startAngle: 60,
    endOpacityPercent: 12,
  },
};

/** Valid burst patterns the renderer knows how to draw. */
export const FIREWORK_PATTERNS = ['fibonacci', 'wave', 'strobe'] as const;

export type FireworkPattern = (typeof FIREWORK_PATTERNS)[number];

export const FIREWORK_GEOMETRIES = RENDERER_GEOMETRIES;

export type FireworkGeometry = (typeof FIREWORK_GEOMETRIES)[number];

/**
 * How each star renders its persistent trail.
 *
 * - `none`: clean glowing stars (peony, ring, pearls, strobe).
 * - `spark`: legacy loose spark dust, now upgraded into `burstTrail`.
 * - `streak`: brocade-style distance-based square emission along the star's
 *   own trajectory — the "super realistic" look generalised to every effect.
 */
export const STAR_TRAIL_MODES = ['none', 'spark', 'streak'] as const;

export type StarTrailMode = (typeof STAR_TRAIL_MODES)[number];

/** Colour treatment of streak-trail particles as they age. */
export const STAR_TRAIL_COLOR_MODES = ['star', 'gold', 'silver', 'ember', 'starFade'] as const;

export type StarTrailColorMode = (typeof STAR_TRAIL_COLOR_MODES)[number];

export const BURST_TRAIL_PRESETS = [
  'none',
  'sparkDust',
  'solidStreaks',
  'willowHang',
  'cometTail',
  'denseBrocade',
  'silverRain',
  'ghostFade',
  'dragonEgg',
  'titaniumFlash',
  'custom',
] as const;

export type BurstTrailPreset = (typeof BURST_TRAIL_PRESETS)[number];

export const BURST_TRAIL_SHAPES = ['circle', 'square', 'triangle'] as const;

export type BurstTrailShape = (typeof BURST_TRAIL_SHAPES)[number];

export const LAUNCH_SHELL_SHAPES = ['circle', 'orb', 'square', 'triangle'] as const;

export const BURST_TRAIL_MAX_STOPS = 5;

export const BURST_TRAIL_PARTICLES_PER_STAR_MAX = 2000;

export const BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX = 10;

export const BURST_TRAIL_FLICKER_LIFE_MAX = 0.5;

export const STAR_AIR_RESISTANCE_PERCENT_MAX = 300;

export const STAR_TERMINAL_VELOCITY_MAX = 18;

export const BURST_TRAIL_FADE_MODES = ['dynamic', 'fixed'] as const;

export type BurstTrailFadeMode = (typeof BURST_TRAIL_FADE_MODES)[number];

export const FIREWORK_TRAIL_PROFILES = [
  'none',
  'spark',
  'glitter',
  'long_hang',
  'thick_tail',
  'fragmenting',
  'spray',
  'blink',
  'crackle',
  'pearls',
  'fish',
  'waterfall',
  'whirl',
] as const;

export type FireworkTrailProfile = (typeof FIREWORK_TRAIL_PROFILES)[number];

export const RgbSchema = z.object({
  r: z.coerce.number().min(0).max(1),
  g: z.coerce.number().min(0).max(1),
  b: z.coerce.number().min(0).max(1),
});

export const ColorSchema = z.union([RgbSchema, z.literal('random')]);

export const DEFAULT_STAR_COUNT = 100;
export const MAX_STAR_COUNT = 200;
export const DEFAULT_LIFT_VELOCITY = 13.5;
export const DEFAULT_BURST_FLASH_INTENSITY = 0.5;
export const MAX_BURST_FLASH_INTENSITY = 4;
export const LAUNCH_SHELL_SIZE_MIN = 1;
export const LAUNCH_SHELL_SIZE_MAX = 1000;
export const DEFAULT_LAUNCH_SHELL_SIZE = 110;
export const DEFAULT_FOUNTAIN_RATE = 140;
export const MAX_FOUNTAIN_RATE = 600;

export function orderedRangeSchema(min: number, max: number) {
  return z
    .tuple([z.coerce.number().min(min).max(max), z.coerce.number().min(min).max(max)])
    .transform(
      ([first, second]) =>
        (first <= second ? [first, second] : [second, first]) as [number, number],
    );
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const DEFAULT_TRAIL_STREAK = { streakSize: 1, streakLength: 1, streakLife: 1 };
