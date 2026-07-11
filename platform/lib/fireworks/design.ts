/**
 * "Design" schema for individual firework cues used by the 3D renderer.
 *
 * A {@link FireworkDesign} is the lower-level draw description (pattern,
 * particle count, colour, etc.) that the {@link FireworksEngine} consumes.
 * The higher-level catalogue {@link FireworkSpec} (in `./spec.ts`) is
 * translated to this design shape at render time.
 */
import { z } from 'zod';
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
  DEFAULT_HEAD_GLOW_STRENGTH,
  DEFAULT_WHITE_CORE_BLUR_PERCENT,
  DEFAULT_WHITE_CORE_SIZE_PERCENT,
  MAX_BACKGROUND_GLOW_OPACITY_FALLOFF,
  MAX_BACKGROUND_GLOW_SOFTNESS,
  MAX_BRIGHTNESS_HOLD_EXPONENT,
  MAX_BRIGHTNESS_HOLD_PERCENT,
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
  MIN_BRIGHTNESS_HOLD_EXPONENT,
  MIN_BRIGHTNESS_HOLD_PERCENT,
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
} from './render-tuning';
import { estimateFireworkDesignTiming } from './timing';

export { estimateFireworkDesignTiming } from './timing';

/**
 * Persisted head-orb appearance defaults. These live on the design (per effect
 * and per firework) so the look an editor dials in is saved and inherited,
 * rather than being a runtime-only preview tuning. Values mirror the
 * render-tuning defaults so unset designs render identically to the old global
 * preview defaults.
 */
const HEAD_APPEARANCE_DEFAULTS = {
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

const DEFAULT_STAR_HEAD_SIZE = 360;
const DEFAULT_STAR_INNER_HEAD_SIZE = Math.round(DEFAULT_STAR_HEAD_SIZE * 0.62);
const DEFAULT_STAR_OPENING_COLOUR = { r: 1, g: 0.42, b: 0.08 };
const DEFAULT_STAR_CLOSING_COLOUR = { r: 1, g: 0.84, b: 0.4 };
const DEFAULT_TRAIL_CLOSING_COLOUR = { r: 1, g: 0.34, b: 0.08 };

const STAR_HEAD_OPENING_DEFAULTS = {
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

const STAR_HEAD_CLOSING_DEFAULTS = {
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

const TRAIL_OPENING_DEFAULTS = {
  size: {
    startPercent: 100,
  },
  visibility: {
    brightnessPercent: 100,
    particlesPercent: 100,
    revealPercent: 24,
  },
};

const TRAIL_CLOSING_DEFAULTS = {
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

export const FIREWORK_GEOMETRIES = [
  'sphere',
  'crown',
  'weeping',
  'radial_arms',
  'ring',
  'split_cross',
  'falling_tail',
  'single_tail',
  'upward_fan',
  'fragment_cloud',
  'pistil',
  'pearls',
  'fish',
  'waterfall',
  'whirl',
  // New geometries for the expanded effect catalogue.
  // bowtie: two opposed lobes fired in a flat plane (cross / figure-eight shell).
  // roman_candle: ground-launched repeated star ejection, not an aerial burst.
  // fountain: ground-origin steady glitter spray, no mortar burst.
  'bowtie',
  'roman_candle',
  'fountain',
] as const;
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
  'custom',
] as const;
export type BurstTrailPreset = (typeof BURST_TRAIL_PRESETS)[number];

export const BURST_TRAIL_SHAPES = ['circle', 'square', 'triangle'] as const;
export type BurstTrailShape = (typeof BURST_TRAIL_SHAPES)[number];

export const LAUNCH_SHELL_SHAPES = ['circle', 'orb', 'square', 'triangle'] as const;
export type LaunchShellShape = (typeof LAUNCH_SHELL_SHAPES)[number];

export const BURST_TRAIL_MAX_STOPS = 5;
export const BURST_TRAIL_PARTICLES_PER_STAR_MAX = 2000;
export const BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX = 10;
export const BURST_TRAIL_FLICKER_LIFE_MAX = 0.5;
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

const RgbSchema = z.object({
  r: z.coerce.number().min(0).max(1),
  g: z.coerce.number().min(0).max(1),
  b: z.coerce.number().min(0).max(1),
});

const ColorSchema = z.union([RgbSchema, z.literal('random')]);

const MAX_STAR_COUNT = 100;
export const DEFAULT_LAUNCH_SMOKE_COLOR = { r: 0.15, g: 0.15, b: 0.16 } as const;

const RangeSchema = z.tuple([z.coerce.number(), z.coerce.number()]);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const BurstTrailShapeWeightsSchema = z
  .object({
    circle: z.coerce.number().min(0).max(100).default(0),
    square: z.coerce.number().min(0).max(100).default(100),
    triangle: z.coerce.number().min(0).max(100).default(0),
  })
  .default({ circle: 0, square: 100, triangle: 0 });

const BurstTrailStopSchema = z.object({
  position: z.coerce.number().min(0).max(100),
  density: z.coerce.number().min(0).max(4).default(1),
  size: z.coerce.number().min(0.08).max(24).default(1),
  sizeVariation: z.coerce.number().min(0).max(100).default(25),
  shapeWeights: BurstTrailShapeWeightsSchema,
});

const TrailOpeningSchema = z
  .object({
    size: z
      .object({
        /** Size at the beginning of the burst path, as a percentage of normal trail size. */
        startPercent: z.coerce.number().min(1).max(100).default(100),
      })
      .default(TRAIL_OPENING_DEFAULTS.size),
    visibility: z
      .object({
        /** Brightness at the beginning of the burst path, as a percentage of normal brightness. */
        brightnessPercent: z.coerce.number().min(0).max(300).default(100),
        /** Percentage of the per-star trail budget visible at the beginning of the burst path. */
        particlesPercent: z.coerce.number().min(0).max(100).default(100),
        /** Percentage of the star path used to ramp size, brightness, and count to normal. */
        revealPercent: z.coerce.number().min(1).max(100).default(24),
      })
      .default(TRAIL_OPENING_DEFAULTS.visibility),
  })
  .default(TRAIL_OPENING_DEFAULTS);

const TrailClosingSchema = z
  .object({
    colour: z
      .object({
        enabled: z.boolean().default(false),
        color: RgbSchema.default(DEFAULT_TRAIL_CLOSING_COLOUR),
        /** Percentage of each trail particle's life used to fade into closing colour. */
        fadePercent: z.coerce.number().min(1).max(100).default(22),
      })
      .default(TRAIL_CLOSING_DEFAULTS.colour),
    size: z
      .object({
        enabled: z.boolean().default(false),
        /** Final size as a percentage of the trail particle's normal size. */
        endPercent: z.coerce.number().min(0).max(100).default(0),
        /** Percentage of each trail particle's life used to shrink to final size. */
        shrinkPercent: z.coerce.number().min(1).max(100).default(22),
      })
      .default(TRAIL_CLOSING_DEFAULTS.size),
    spreadFade: z
      .object({
        /** Fade the far tail when the tail spread angle exceeds this many degrees. */
        enabled: z.boolean().default(true),
        startAngle: z.coerce.number().min(0).max(80).default(60),
        /** Opacity reached at the far tail when the tail angle is at its maximum. */
        endOpacityPercent: z.coerce.number().min(0).max(100).default(12),
      })
      .default(TRAIL_CLOSING_DEFAULTS.spreadFade),
  })
  .default(TRAIL_CLOSING_DEFAULTS);

const LaunchShellTrailSchema = z
  .object({
    tubeDiameter: z.coerce.number().min(0).max(90).default(0),
    frontAngle: z.coerce.number().min(0).max(60).default(0),
    tailAngle: z.coerce.number().min(0).max(60).default(0),
    curve: z.coerce.number().min(0.2).max(4).default(1),
  })
  .default({ tubeDiameter: 0, frontAngle: 0, tailAngle: 0, curve: 1 });

const LaunchShellSchema = z
  .object({
    visible: z.boolean().default(true),
    shape: z.enum(LAUNCH_SHELL_SHAPES).default('circle'),
    colour: ColorSchema.optional(),
    sizeScale: z.coerce.number().min(0.25).max(4).default(1),
    brightness: z.coerce.number().min(0).max(3).default(1),
    glowStrength: z.coerce
      .number()
      .min(MIN_HEAD_GLOW_STRENGTH)
      .max(MAX_HEAD_GLOW_STRENGTH)
      .default(DEFAULT_HEAD_GLOW_STRENGTH),
    trail: LaunchShellTrailSchema,
  })
  .default({
    visible: true,
    shape: 'circle',
    sizeScale: 1,
    brightness: 1,
    glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
    trail: { tubeDiameter: 0, frontAngle: 0, tailAngle: 0, curve: 1 },
  });

const LaunchLiftParticlesSchema = z
  .object({
    enabled: z.boolean().default(true),
    amount: z.coerce.number().int().min(0).max(1000).default(100),
    colour: ColorSchema.optional(),
    height: z.coerce
      .number()
      .min(0)
      .transform((value) => Math.min(100, value))
      .default(100),
    shapeWeights: BurstTrailShapeWeightsSchema,
    particleSize: z
      .object({
        base: z.coerce.number().min(1).max(180).default(30),
        headScale: z.coerce.number().min(0).max(4).default(1),
        tailScale: z.coerce.number().min(0).max(4).default(0.35),
        variationPercent: z.coerce.number().min(0).max(100).default(20),
      })
      .default({ base: 30, headScale: 1, tailScale: 0.35, variationPercent: 20 }),
    frontClump: z.coerce.number().min(0).max(1).default(0.55),
    spacing: z
      .object({
        curve: z.coerce.number().min(0.2).max(4).default(1),
        jitterPercent: z.coerce.number().min(0).max(100).default(35),
        clusterStrength: z.coerce.number().min(0).max(100).default(0),
        pathSamples: z.coerce.number().int().min(1).max(12).default(5),
      })
      .default({ curve: 1, jitterPercent: 35, clusterStrength: 0, pathSamples: 5 }),
    lifetime: z
      .object({
        baseSeconds: z.coerce.number().min(0.1).max(8).default(0.8),
        variationPercent: z.coerce.number().min(0).max(100).default(35),
        afterglowSeconds: z.coerce.number().min(0).max(6).default(0.1),
      })
      .default({ baseSeconds: 0.8, variationPercent: 35, afterglowSeconds: 0.1 }),
    intensity: z
      .object({
        brightness: z.coerce.number().min(0).max(3).default(1),
        fadeSoftness: z.coerce.number().min(0.2).max(4).default(1),
      })
      .default({ brightness: 1, fadeSoftness: 1 }),
    flicker: z
      .object({
        chance: z.coerce.number().min(0).max(1).default(0.08),
        strength: z.coerce.number().min(0).max(3).default(0.8),
        lifetimeMultiplier: z.coerce
          .number()
          .min(0)
          .transform((value) => Math.min(BURST_TRAIL_FLICKER_LIFE_MAX, value))
          .default(0.45),
      })
      .default({ chance: 0.08, strength: 0.8, lifetimeMultiplier: 0.45 }),
    motion: z
      .object({
        gravity: z.coerce.number().min(-2).max(1).default(-0.09),
        drag: z.coerce.number().min(0).max(6).default(2.55),
        inheritedVelocity: z.coerce.number().min(0).max(1).default(0.02),
        turbulence: z.coerce.number().min(0).max(2).default(0.04),
        driftX: z.coerce.number().min(-2).max(2).default(0),
        driftY: z.coerce.number().min(-2).max(2).default(-0.012),
        driftZ: z.coerce.number().min(-2).max(2).default(0),
        spin: z.coerce.number().min(0).max(8).default(0),
        swirlStrength: z.coerce.number().min(0).max(4).default(0),
        swirlRadius: z.coerce.number().min(0).max(180).default(0),
        swirlLoopCount: z.coerce.number().min(0).max(6).default(0),
        swirlLoopLength: z.coerce.number().min(5).max(100).default(100),
        swirlLoopHeight: z.coerce.number().min(0).max(180).default(0),
        swirlRate: z.coerce.number().min(0).max(16).default(4),
      })
      .default({
        gravity: -0.09,
        drag: 2.55,
        inheritedVelocity: 0.02,
        turbulence: 0.04,
        driftX: 0,
        driftY: -0.012,
        driftZ: 0,
        spin: 0,
        swirlStrength: 0,
        swirlRadius: 0,
        swirlLoopCount: 0,
        swirlLoopLength: 100,
        swirlLoopHeight: 0,
        swirlRate: 4,
      }),
  })
  .default({
    enabled: true,
    amount: 100,
    height: 100,
    shapeWeights: { circle: 0, square: 100, triangle: 0 },
    particleSize: { base: 30, headScale: 1, tailScale: 0.35, variationPercent: 20 },
    frontClump: 0.55,
    spacing: { curve: 1, jitterPercent: 35, clusterStrength: 0, pathSamples: 5 },
    lifetime: { baseSeconds: 0.8, variationPercent: 35, afterglowSeconds: 0.1 },
    intensity: { brightness: 1, fadeSoftness: 1 },
    flicker: { chance: 0.08, strength: 0.8, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.09,
      drag: 2.55,
      inheritedVelocity: 0.02,
      turbulence: 0.04,
      driftX: 0,
      driftY: -0.012,
      driftZ: 0,
      spin: 0,
      swirlStrength: 0,
      swirlRadius: 0,
      swirlLoopCount: 0,
      swirlLoopLength: 100,
      swirlLoopHeight: 0,
      swirlRate: 4,
    },
  });

const LaunchSchema = z
  .object({
    shell: LaunchShellSchema,
    liftParticles: LaunchLiftParticlesSchema,
    smoke: z
      .object({
        enabled: z.boolean().default(true),
        particles: z.coerce.number().int().min(0).max(500).default(100),
        size: z.coerce.number().min(4).max(220).default(86),
        lifeSeconds: z.coerce.number().min(0.2).max(12).default(3.2),
        spread: z.coerce.number().min(0).max(140).default(30),
        drift: z.coerce.number().min(0).max(4).default(1),
        height: z.coerce.number().min(0).max(900).default(360),
      })
      .default({
        enabled: true,
        particles: 100,
        size: 86,
        lifeSeconds: 3.2,
        spread: 30,
        drift: 1,
        height: 360,
      }),
  })
  .default({
    shell: {
      visible: true,
      shape: 'circle',
      sizeScale: 1,
      brightness: 1,
      glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
      trail: { tubeDiameter: 0, frontAngle: 0, tailAngle: 0, curve: 1 },
    },
    liftParticles: {
      enabled: true,
      amount: 100,
      height: 100,
      shapeWeights: { circle: 0, square: 100, triangle: 0 },
      particleSize: { base: 30, headScale: 1, tailScale: 0.35, variationPercent: 20 },
      frontClump: 0.55,
      spacing: { curve: 1, jitterPercent: 35, clusterStrength: 0, pathSamples: 5 },
      lifetime: { baseSeconds: 0.8, variationPercent: 35, afterglowSeconds: 0.1 },
      intensity: { brightness: 1, fadeSoftness: 1 },
      flicker: { chance: 0.08, strength: 0.8, lifetimeMultiplier: 0.45 },
      motion: {
        gravity: -0.09,
        drag: 2.55,
        inheritedVelocity: 0.02,
        turbulence: 0.04,
        driftX: 0,
        driftY: -0.012,
        driftZ: 0,
        spin: 0,
        swirlStrength: 0,
        swirlRadius: 0,
        swirlLoopCount: 0,
        swirlLoopLength: 100,
        swirlLoopHeight: 0,
        swirlRate: 4,
      },
    },
    smoke: {
      enabled: true,
      particles: 100,
      size: 86,
      lifeSeconds: 3.2,
      spread: 30,
      drift: 1,
      height: 360,
    },
  });

const BurstTrailSchema = z
  .object({
    version: z.literal(2).default(2),
    enabled: z.boolean().default(true),
    preset: z.enum(BURST_TRAIL_PRESETS).default('sparkDust'),
    colourMode: z.enum(STAR_TRAIL_COLOR_MODES).default('gold'),
    particlesPerStar: z.coerce
      .number()
      .int()
      .min(0)
      .transform((value) => Math.min(BURST_TRAIL_PARTICLES_PER_STAR_MAX, value))
      .default(24),
    frontClump: z.coerce.number().min(0).max(1).default(0.45),
    width: z
      .object({
        front: z.coerce
          .number()
          .min(0)
          .default(1.4)
          .transform((value) => Math.min(BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX, value)),
        tail: z.coerce.number().min(0).max(80).default(1.4),
        curve: z.coerce.number().min(0.2).max(4).default(1),
      })
      .default({ front: 1.4, tail: 1.4, curve: 1 }),
    particleSize: z
      .object({
        base: z.coerce.number().min(0.08).max(24).default(1.2),
        headScale: z.coerce.number().min(0).max(4).default(1),
        tailScale: z.coerce.number().min(0).max(4).default(0.35),
        variationPercent: z.coerce.number().min(0).max(100).default(8),
      })
      .default({ base: 1.2, headScale: 1, tailScale: 0.35, variationPercent: 8 }),
    opening: TrailOpeningSchema,
    closing: TrailClosingSchema,
    placement: z
      .object({
        headGapPercent: z.coerce.number().min(0).max(300).default(60),
      })
      .default({ headGapPercent: 60 }),
    spacing: z
      .object({
        curve: z.coerce.number().min(0.2).max(4).default(1),
        jitterPercent: z.coerce.number().min(0).max(100).default(18),
      })
      .default({ curve: 1, jitterPercent: 18 }),
    lifetime: z
      .object({
        mode: z.enum(BURST_TRAIL_FADE_MODES).default('dynamic'),
        percent: z.coerce
          .number()
          .min(0)
          .transform((value) => round2(Math.min(2, value > 2 ? value / 100 : value)))
          .default(0.18),
        baseSeconds: z.coerce.number().min(0.05).max(8).default(0.9),
        variationPercent: z.coerce.number().min(0).max(100).default(30),
        afterglowSeconds: z.coerce.number().min(0).max(6).default(0.35),
      })
      .default({
        mode: 'dynamic',
        percent: 0.18,
        baseSeconds: 0.9,
        variationPercent: 30,
        afterglowSeconds: 0.35,
      }),
    intensity: z
      .object({
        brightness: z.coerce.number().min(0).max(3).default(1),
        fadeSoftness: z.coerce.number().min(0.2).max(4).default(1),
      })
      .default({ brightness: 1, fadeSoftness: 1 }),
    flicker: z
      .object({
        chance: z.coerce.number().min(0).max(1).default(0.08),
        strength: z.coerce.number().min(0).max(3).default(0.8),
        lifetimeMultiplier: z.coerce
          .number()
          .min(0)
          .transform((value) => Math.min(BURST_TRAIL_FLICKER_LIFE_MAX, value))
          .default(0.45),
      })
      .default({ chance: 0.08, strength: 0.8, lifetimeMultiplier: 0.45 }),
    motion: z
      .object({
        gravity: z.coerce.number().min(-2).max(1).default(-0.014),
        drag: z.coerce.number().min(0).max(6).default(1.6),
        inheritedVelocity: z.coerce.number().min(0).max(1).default(0.02),
        turbulence: z.coerce.number().min(0).max(2).default(0.04),
        driftX: z.coerce.number().min(-2).max(2).default(0),
        driftY: z.coerce.number().min(-2).max(2).default(-0.012),
        driftZ: z.coerce.number().min(-2).max(2).default(0),
        spin: z.coerce.number().min(0).max(8).default(0),
      })
      .default({
        gravity: -0.014,
        drag: 1.6,
        inheritedVelocity: 0.02,
        turbulence: 0.04,
        driftX: 0,
        driftY: -0.012,
        driftZ: 0,
        spin: 0,
      }),
    stops: z.array(BurstTrailStopSchema).max(BURST_TRAIL_MAX_STOPS).default([]),
  })
  .default({
    version: 2,
    enabled: true,
    preset: 'custom',
    colourMode: 'starFade',
    particlesPerStar: 178,
    frontClump: 0.55,
    width: { front: 10, tail: 0, curve: 1 },
    particleSize: { base: 1.2, headScale: 1, tailScale: 0.35, variationPercent: 8 },
    opening: TRAIL_OPENING_DEFAULTS,
    closing: TRAIL_CLOSING_DEFAULTS,
    placement: { headGapPercent: 60 },
    spacing: { curve: 1, jitterPercent: 18 },
    lifetime: {
      mode: 'dynamic',
      percent: 0.18,
      baseSeconds: 8,
      variationPercent: 30,
      afterglowSeconds: 0.15,
    },
    intensity: { brightness: 1, fadeSoftness: 1 },
    flicker: { chance: 0.08, strength: 0.8, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.014,
      drag: 1.6,
      inheritedVelocity: 0.02,
      turbulence: 0.04,
      driftX: 0,
      driftY: -0.012,
      driftZ: 0,
      spin: 0,
    },
    stops: [
      {
        position: 0,
        density: 1,
        size: 2.68,
        sizeVariation: 0,
        shapeWeights: { circle: 0, square: 100, triangle: 0 },
      },
      {
        position: 100,
        density: 1,
        size: 0.08,
        sizeVariation: 0,
        shapeWeights: { circle: 0, square: 100, triangle: 0 },
      },
    ],
  });

const StarBurstSchema = z
  .object({
    speed: RangeSchema.default([2, 4]),
    gravity: RangeSchema.default([-0.24, -0.02]),
    life: RangeSchema.default([0.5, 6.5]),
    flairSizeStrobe: RangeSchema.optional(),
    flairColorMode: z.enum(['bombColor', 'random', 'mixed']).default('mixed'),
  })
  .default({
    speed: [2, 4],
    gravity: [-0.24, -0.02],
    life: [0.5, 6.5],
    flairColorMode: 'mixed',
  });

const StarHeadOpeningSchema = z
  .object({
    colour: z
      .object({
        enabled: z.boolean().default(false),
        color: RgbSchema.default(DEFAULT_STAR_OPENING_COLOUR),
        /** Percentage of the star's own life used to fade from opening colour. */
        fadePercent: z.coerce.number().min(1).max(100).default(24),
      })
      .default(STAR_HEAD_OPENING_DEFAULTS.colour),
    size: z
      .object({
        enabled: z.boolean().default(false),
        /** Starting size as a percentage of the layer's full star size. */
        startPercent: z.coerce.number().min(1).max(100).default(35),
        /** Percentage of the star's own life used to reach full size. */
        growPercent: z.coerce.number().min(1).max(100).default(22),
      })
      .default(STAR_HEAD_OPENING_DEFAULTS.size),
  })
  .default(STAR_HEAD_OPENING_DEFAULTS);

const StarHeadClosingSchema = z
  .object({
    colour: z
      .object({
        enabled: z.boolean().default(false),
        color: RgbSchema.default(DEFAULT_STAR_CLOSING_COLOUR),
        /** Percentage of the star's life used to fade into its closing colour. */
        fadePercent: z.coerce.number().min(1).max(100).default(22),
      })
      .default(STAR_HEAD_CLOSING_DEFAULTS.colour),
    size: z
      .object({
        enabled: z.boolean().default(false),
        /** Final size as a percentage of the layer's full star size. */
        endPercent: z.coerce.number().min(0).max(100).default(0),
        /** Percentage of the star's life used to shrink to its final size. */
        shrinkPercent: z.coerce.number().min(1).max(100).default(22),
      })
      .default(STAR_HEAD_CLOSING_DEFAULTS.size),
  })
  .default(STAR_HEAD_CLOSING_DEFAULTS);

const StarHeadSchema = z
  .object({
    /** Render the star head sprite. Trails can still use the star path when this is false. */
    visible: z.boolean().default(true),
    /** Size budget of each glowing star orb. */
    size: z.coerce.number().min(10).max(1000).default(DEFAULT_STAR_HEAD_SIZE),
    /** Opening colour fade and size growth, both relative to this star's life. */
    opening: StarHeadOpeningSchema,
    /** End-of-life colour and size controls for the star head. */
    closing: StarHeadClosingSchema,
    /** Halo brightness multiplier, same encoding as brocade heads. */
    glowStrength: z.coerce
      .number()
      .min(MIN_HEAD_GLOW_STRENGTH)
      .max(MAX_HEAD_GLOW_STRENGTH)
      .default(DEFAULT_HEAD_GLOW_STRENGTH),
    /** Background glow size around each orb, as a percentage of star size. */
    glowPadding: z.coerce
      .number()
      .min(MIN_GLOW_PADDING)
      .max(MAX_GLOW_PADDING)
      .default(DEFAULT_GLOW_PADDING),
    /** White-hot centre size, as a percentage of the coloured core. */
    whiteCoreSizePercent: z.coerce
      .number()
      .min(MIN_WHITE_CORE_SIZE_PERCENT)
      .max(MAX_WHITE_CORE_SIZE_PERCENT)
      .default(DEFAULT_WHITE_CORE_SIZE_PERCENT),
    /** Feather on the white centre's edge, 0-100%. */
    whiteCoreBlurPercent: z.coerce
      .number()
      .min(MIN_WHITE_CORE_BLUR_PERCENT)
      .max(MAX_WHITE_CORE_BLUR_PERCENT)
      .default(DEFAULT_WHITE_CORE_BLUR_PERCENT),
    /** Coloured core edge: 0 hard disc, 100 fully feathered soft orb. */
    coreSoftness: z.coerce
      .number()
      .min(MIN_CORE_SOFTNESS)
      .max(MAX_CORE_SOFTNESS)
      .default(DEFAULT_CORE_SOFTNESS),
    /** Percentage gain on the core's centre intensity. */
    coreBrightness: z.coerce
      .number()
      .min(MIN_CORE_BRIGHTNESS)
      .max(MAX_CORE_BRIGHTNESS)
      .default(DEFAULT_CORE_BRIGHTNESS),
    /** Core alpha fade: 0 solid edge, 100 transparent feathered edge. */
    coreOpacityFalloff: z.coerce
      .number()
      .min(MIN_CORE_OPACITY_FALLOFF)
      .max(MAX_CORE_OPACITY_FALLOFF)
      .default(DEFAULT_CORE_OPACITY_FALLOFF),
    /** Close star glow radius, 0-100%. */
    glowSize: z.coerce.number().min(MIN_GLOW_SIZE).max(MAX_GLOW_SIZE).default(DEFAULT_GLOW_SIZE),
    /** Close star glow falloff: 0 tight, 100 soft. */
    glowSoftness: z.coerce
      .number()
      .min(MIN_GLOW_SOFTNESS)
      .max(MAX_GLOW_SOFTNESS)
      .default(DEFAULT_GLOW_SOFTNESS),
    /** Close star glow alpha fade: 0 late edge fade, 100 early fade. */
    glowOpacityFalloff: z.coerce
      .number()
      .min(MIN_GLOW_OPACITY_FALLOFF)
      .max(MAX_GLOW_OPACITY_FALLOFF)
      .default(DEFAULT_GLOW_OPACITY_FALLOFF),
    /** Large coloured background glow strength, 0-150%. */
    glowBlur: z.coerce.number().min(MIN_GLOW_BLUR).max(MAX_GLOW_BLUR).default(DEFAULT_GLOW_BLUR),
    /** Background glow alpha fade: 0 late edge fade, 100 early fade. */
    backgroundGlowOpacityFalloff: z.coerce
      .number()
      .min(MIN_BACKGROUND_GLOW_OPACITY_FALLOFF)
      .max(MAX_BACKGROUND_GLOW_OPACITY_FALLOFF)
      .default(DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF),
    /** Background glow blur: 0 tight wash, 100 heavily diffused wash. */
    backgroundGlowSoftness: z.coerce
      .number()
      .min(MIN_BACKGROUND_GLOW_SOFTNESS)
      .max(MAX_BACKGROUND_GLOW_SOFTNESS)
      .default(DEFAULT_BACKGROUND_GLOW_SOFTNESS),
    /** Percent of life the head holds full brightness before fading. */
    brightnessHoldPercent: z.coerce
      .number()
      .min(MIN_BRIGHTNESS_HOLD_PERCENT)
      .max(MAX_BRIGHTNESS_HOLD_PERCENT)
      .default(DEFAULT_BRIGHTNESS_HOLD_PERCENT),
    /** Exponent shaping the post-hold fade (higher = sharper wink-out). */
    brightnessHoldExponent: z.coerce
      .number()
      .min(MIN_BRIGHTNESS_HOLD_EXPONENT)
      .max(MAX_BRIGHTNESS_HOLD_EXPONENT)
      .default(DEFAULT_BRIGHTNESS_HOLD_EXPONENT),
  })
  .default({
    visible: true,
    size: DEFAULT_STAR_HEAD_SIZE,
    opening: STAR_HEAD_OPENING_DEFAULTS,
    closing: STAR_HEAD_CLOSING_DEFAULTS,
    glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
    ...HEAD_APPEARANCE_DEFAULTS,
  });

const StarColourPatternSchema = z
  .object({
    mode: z.enum(['solid', 'random', 'bands', 'stripes']).default('solid'),
    axis: z.enum(['vertical', 'horizontal']).default('vertical'),
    count: z.coerce
      .number()
      .int()
      .min(1)
      .default(3)
      .transform((value) => Math.min(6, value)),
    colours: z
      .array(
        z.object({
          color: ColorSchema,
          weight: z.coerce.number().min(0).max(100).default(100),
        }),
      )
      .max(8)
      .default([]),
  })
  .default({
    mode: 'solid',
    axis: 'vertical',
    count: 3,
    colours: [],
  });

const StarLayerSchema = z
  .object({
    enabled: z.boolean().default(true),
    count: z.coerce.number().int().min(1).max(MAX_STAR_COUNT).default(MAX_STAR_COUNT),
    color: ColorSchema.optional(),
    colourPattern: StarColourPatternSchema,
    burst: StarBurstSchema,
    head: StarHeadSchema,
    burstTrail: BurstTrailSchema,
  })
  .default({
    enabled: true,
    count: MAX_STAR_COUNT,
    burst: {
      speed: [2, 4],
      gravity: [-0.24, -0.02],
      life: [0.5, 6.5],
      flairColorMode: 'mixed',
    },
    head: {
      visible: true,
      size: DEFAULT_STAR_HEAD_SIZE,
      opening: STAR_HEAD_OPENING_DEFAULTS,
      closing: STAR_HEAD_CLOSING_DEFAULTS,
      glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
      ...HEAD_APPEARANCE_DEFAULTS,
    },
    colourPattern: {
      mode: 'solid',
      axis: 'vertical',
      count: 3,
      colours: [],
    },
    burstTrail: {
      version: 2,
      enabled: true,
      preset: 'sparkDust',
      colourMode: 'star',
      particlesPerStar: 24,
      frontClump: 0.35,
      width: { front: 1.1, tail: 2.1, curve: 1.15 },
      particleSize: { base: 0.65, headScale: 1, tailScale: 0.45, variationPercent: 55 },
      opening: TRAIL_OPENING_DEFAULTS,
      closing: TRAIL_CLOSING_DEFAULTS,
      placement: { headGapPercent: 35 },
      spacing: { curve: 1, jitterPercent: 55 },
      lifetime: {
        mode: 'dynamic',
        percent: 0.14,
        baseSeconds: 0.82,
        variationPercent: 55,
        afterglowSeconds: 0.1,
      },
      intensity: { brightness: 0.72, fadeSoftness: 1.3 },
      flicker: { chance: 0.22, strength: 0.75, lifetimeMultiplier: 0.45 },
      motion: {
        gravity: -0.035,
        drag: 2.4,
        inheritedVelocity: 0.02,
        turbulence: 0.2,
        driftX: 0,
        driftY: -0.018,
        driftZ: 0,
        spin: 0,
      },
      stops: [],
    },
  });

/**
 * Per-geometry shape tuning. Every value here was previously a hardcoded
 * constant inside the renderer ({@link Effects}); the defaults are exactly
 * those constants, so designs without an explicit `geometryTuning` block
 * render identically to before. Only the group matching the design's
 * `geometry` is read, and the values save with the effect JSON like any
 * other design field.
 */
export const GEOMETRY_TUNING_DEFAULTS = {
  ring: {
    countPercent: 72,
    wobble: 0.18,
    verticalSquash: 0.96,
    tiltVariation: 1.1,
    lifePercent: 82,
  },
  crown: { lift: 0.55, liftVariation: 0.62, spread: 0.65, spreadVariation: 0.35 },
  weeping: {
    lift: 0.35,
    liftVariation: 0.45,
    spread: 0.65,
    spreadVariation: 0.35,
    lifePercent: 125,
    gravityPercent: 52,
    dragPercent: 58,
  },
  radialArms: {
    arms: 7,
    countPercent: 46,
    angleJitter: 0.1,
    armLength: 0.74,
    lift: 0.22,
    liftVariation: 0.44,
    dragPercent: 82,
  },
  fallingTail: {
    countPercent: 62,
    spread: 0.28,
    spreadVariation: 0.5,
    sink: 0.05,
    sinkVariation: 0.42,
    lifePercent: 125,
    gravityPercent: 45,
    dragPercent: 58,
  },
  pearls: {
    countPercent: 18,
    spread: 0.45,
    spreadVariation: 0.28,
    lift: 0.5,
    liftVariation: 0.35,
    lifePercent: 62,
    gravityPercent: 115,
    dragPercent: 135,
  },
  fragmentCloud: { countPercent: 90, speedBase: 0.72, speedVariation: 0.78 },
  bowtie: {
    countPercent: 82,
    fanAngleDegrees: 111.6,
    verticalScale: 0.34,
    depthScale: 0.16,
    lengthBase: 0.82,
    lengthVariation: 0.22,
  },
  fish: {
    countPercent: 72,
    verticalScale: 0.25,
    lifeBaseSeconds: 0.8,
    lifeVariationSeconds: 1.8,
    wiggleStrength: 1.8,
    wiggleRate: 14,
    wiggleRateCross: 17,
    gravityPercent: 55,
    dragPercent: 55,
    headSizePercent: 65,
    trailLifePercent: 60,
  },
  waterfall: {
    countPercent: 78,
    curtainWidth: 2.2,
    scatterX: 28,
    scatterZ: 24,
    dropStart: 58,
    fallSpeed: 1,
    fallSpeedVariation: 1.45,
    sideDrift: 0.28,
    depthDrift: 0.2,
    lifePercent: 135,
    gravityBase: -0.32,
    gravityVariation: 0.34,
    dragPercent: 28,
    headSizePercent: 75,
  },
  whirl: {
    countPercent: 28,
    minCount: 32,
    verticalBias: -0.15,
    spinStrength: 2.4,
    spinRate: 18,
    lifeBaseSeconds: 1,
    lifeVariationSeconds: 2,
    gravityPercent: 70,
    dragPercent: 62,
    headSizePercent: 80,
    trailLifePercent: 70,
  },
  singleTail: {
    inheritPercent: 35,
    driftPercent: 12,
    riseFactor: 0.55,
    pushFactor: 0.35,
    lifePercent: 90,
    headSizePercent: 60,
    trailLifePercent: 125,
  },
  upwardFan: {
    countPercent: 90,
    minCount: 36,
    spreadAngleDegrees: 165.6,
    fanBase: 0.45,
    fanVariation: 0.8,
    spawnScatter: 34,
    riseBase: 24,
    riseVariation: 22,
    riseSpeed: 1.2,
    riseSpeedVariation: 0.85,
    depthScale: 0.45,
    lifePercent: 72,
    dragPercent: 57.6,
    headSizePercent: 75,
    trailLifePercent: 60,
  },
  romanCandle: {
    shotsPercent: 8,
    minShots: 4,
    durationPercent: 40,
    durationMinSeconds: 3,
    durationMaxSeconds: 10,
    spread: 0.55,
    azimuth: 0.4,
    speedBase: 0.95,
    speedVariation: 0.35,
    muzzleScatter: 12,
    lateralScale: 0.28,
    depthScale: 0.22,
    riseBase: 1,
    riseVariation: 0.32,
    lifePercent: 92,
    dragPercent: 68,
    headSizePercent: 92,
    trailLifePercent: 85,
  },
  fountain: {
    durationPercent: 26,
    durationMinSeconds: 2.5,
    durationMaxSeconds: 10,
    ratePercent: 140,
    minRatePerSecond: 40,
    // Exactly the old 0.85 rad cone so default fountains are unchanged.
    coneAngleDegrees: (0.85 * 180) / Math.PI,
    speedBase: 0.45,
    speedVariation: 0.75,
    spawnScatter: 10,
    lateralScale: 0.55,
    lifePercent: 60,
    dragPercent: 115,
    headSizePercent: 40,
    trailLifePercent: 40,
  },
} as const;

const percent = (def: number, min = 1, max = 300) =>
  z.coerce.number().min(min).max(max).default(def);

const GeometryTuningSchema = z
  .object({
    /** Halo hoop: stars break in a flat, randomly tilted circle. */
    ring: z
      .object({
        /** Percentage of the layer's star count used by the ring. */
        countPercent: percent(72, 1, 100),
        /** Out-of-plane jitter so the hoop doesn't read as a razor line. */
        wobble: z.coerce.number().min(0).max(1).default(0.18),
        /** Vertical scale of the hoop; 1 is a perfect circle. */
        verticalSquash: z.coerce.number().min(0.2).max(1.5).default(0.96),
        /** Random tilt range of the hoop plane, in radians. */
        tiltVariation: z.coerce.number().min(0).max(3).default(1.1),
        /** Star life as a percentage of the layer's burst life. */
        lifePercent: percent(82, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.ring),
    /** Palm / pine-tree crowns: stars thrown up and out, then drooping. */
    crown: z
      .object({
        /** Upward throw of each frond. */
        lift: z.coerce.number().min(0).max(2).default(0.55),
        /** Random extra upward throw. */
        liftVariation: z.coerce.number().min(0).max(2).default(0.62),
        /** Sideways reach of the fronds. */
        spread: z.coerce.number().min(0).max(2).default(0.65),
        /** Random extra sideways reach. */
        spreadVariation: z.coerce.number().min(0).max(2).default(0.35),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.crown),
    /** Weeping willow: low throw, long hang, slow fall. */
    weeping: z
      .object({
        lift: z.coerce.number().min(0).max(2).default(0.35),
        liftVariation: z.coerce.number().min(0).max(2).default(0.45),
        spread: z.coerce.number().min(0).max(2).default(0.65),
        spreadVariation: z.coerce.number().min(0).max(2).default(0.35),
        /** Star life as a percentage of the layer's burst life. */
        lifePercent: percent(125, 10, 300),
        /** Gravity strength as a percentage of the layer's burst gravity. */
        gravityPercent: percent(52, 5, 300),
        /** Air resistance as a percentage of the standard star drag. */
        dragPercent: percent(58, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.weeping),
    /** Spider / radial arms: stars grouped into straight spokes. */
    radialArms: z
      .object({
        /** Number of spokes. */
        arms: z.coerce.number().int().min(2).max(24).default(7),
        countPercent: percent(46, 1, 100),
        /** Random angular scatter of each star off its spoke, in radians. */
        angleJitter: z.coerce.number().min(0).max(1).default(0.1),
        /** Base length of each spoke relative to burst speed. */
        armLength: z.coerce.number().min(0.1).max(2).default(0.74),
        lift: z.coerce.number().min(-1).max(2).default(0.22),
        liftVariation: z.coerce.number().min(0).max(2).default(0.44),
        dragPercent: percent(82, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.radialArms),
    /** Horsetail: stars pushed out sideways and immediately sinking. */
    fallingTail: z
      .object({
        countPercent: percent(62, 1, 100),
        spread: z.coerce.number().min(0).max(2).default(0.28),
        spreadVariation: z.coerce.number().min(0).max(2).default(0.5),
        /** Initial downward speed. */
        sink: z.coerce.number().min(0).max(2).default(0.05),
        sinkVariation: z.coerce.number().min(0).max(2).default(0.42),
        lifePercent: percent(125, 10, 300),
        gravityPercent: percent(45, 5, 300),
        dragPercent: percent(58, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fallingTail),
    /** Pearls: a sparse ring of slow, bright individual stars. */
    pearls: z
      .object({
        countPercent: percent(18, 1, 100),
        spread: z.coerce.number().min(0).max(2).default(0.45),
        spreadVariation: z.coerce.number().min(0).max(2).default(0.28),
        lift: z.coerce.number().min(-1).max(2).default(0.5),
        liftVariation: z.coerce.number().min(0).max(2).default(0.35),
        lifePercent: percent(62, 10, 300),
        gravityPercent: percent(115, 5, 300),
        dragPercent: percent(135, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.pearls),
    /** Fragment cloud: an irregular scatter with uneven star speeds. */
    fragmentCloud: z
      .object({
        countPercent: percent(90, 1, 100),
        /** Minimum speed factor applied to each star. */
        speedBase: z.coerce.number().min(0.1).max(2).default(0.72),
        /** Random extra speed on top of the base. */
        speedVariation: z.coerce.number().min(0).max(2).default(0.78),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fragmentCloud),
    /** Bow tie: two opposed fans fired in a flat plane. */
    bowtie: z
      .object({
        countPercent: percent(82, 1, 100),
        /** Total opening angle of each fan, in degrees. */
        fanAngleDegrees: z.coerce.number().min(10).max(180).default(111.6),
        /** Vertical thickness of the fans. */
        verticalScale: z.coerce.number().min(0).max(1.5).default(0.34),
        /** Front-to-back thickness of the fans. */
        depthScale: z.coerce.number().min(0).max(1.5).default(0.16),
        /** Base lobe length relative to burst speed. */
        lengthBase: z.coerce.number().min(0.1).max(2).default(0.82),
        lengthVariation: z.coerce.number().min(0).max(2).default(0.22),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.bowtie),
    /** Darting fish: stars swim away on wiggling paths. */
    fish: z
      .object({
        /** Percentage of the design size used as the swarm count. */
        countPercent: percent(72, 1, 200),
        /** Vertical flattening of the swarm; 1 is a full sphere. */
        verticalScale: z.coerce.number().min(0).max(1.5).default(0.25),
        lifeBaseSeconds: z.coerce.number().min(0.1).max(8).default(0.8),
        lifeVariationSeconds: z.coerce.number().min(0).max(8).default(1.8),
        /** Strength of the swimming force. */
        wiggleStrength: z.coerce.number().min(0).max(8).default(1.8),
        /** Wiggle oscillations per second on the primary axis. */
        wiggleRate: z.coerce.number().min(0).max(40).default(14),
        /** Wiggle oscillations per second on the crossing axis. */
        wiggleRateCross: z.coerce.number().min(0).max(40).default(17),
        gravityPercent: percent(55, 5, 300),
        dragPercent: percent(55, 10, 300),
        /** Star head size as a percentage of the layer's size budget. */
        headSizePercent: percent(65, 5, 200),
        trailLifePercent: percent(60, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fish),
    /** Waterfall: a wide curtain of stars pouring straight down. */
    waterfall: z
      .object({
        countPercent: percent(78, 1, 200),
        /** Curtain width relative to the design size. */
        curtainWidth: z.coerce.number().min(0.2).max(6).default(2.2),
        /** Random horizontal scatter of each spawn point, in world units. */
        scatterX: z.coerce.number().min(0).max(120).default(28),
        /** Random depth scatter of each spawn point, in world units. */
        scatterZ: z.coerce.number().min(0).max(120).default(24),
        /** How far below the burst point stars may start, in world units. */
        dropStart: z.coerce.number().min(0).max(240).default(58),
        /** Base downward speed. */
        fallSpeed: z.coerce.number().min(0).max(6).default(1),
        fallSpeedVariation: z.coerce.number().min(0).max(6).default(1.45),
        /** Sideways drift while falling. */
        sideDrift: z.coerce.number().min(0).max(2).default(0.28),
        depthDrift: z.coerce.number().min(0).max(2).default(0.2),
        lifePercent: percent(135, 10, 300),
        /** Base gravity while falling (negative pulls down). */
        gravityBase: z.coerce.number().min(-2).max(0).default(-0.32),
        gravityVariation: z.coerce.number().min(0).max(2).default(0.34),
        dragPercent: percent(28, 10, 300),
        headSizePercent: percent(75, 5, 200),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.waterfall),
    /** Whirl: spinning shower with corkscrew arms. */
    whirl: z
      .object({
        countPercent: percent(28, 1, 200),
        /** Minimum number of stars regardless of design size. */
        minCount: z.coerce.number().int().min(1).max(200).default(32),
        /** Vertical bias of the initial throw; negative sends more stars down. */
        verticalBias: z.coerce.number().min(-1).max(1).default(-0.15),
        /** Strength of the spiral force. */
        spinStrength: z.coerce.number().min(0).max(10).default(2.4),
        /** Spiral oscillations per second. */
        spinRate: z.coerce.number().min(0).max(40).default(18),
        lifeBaseSeconds: z.coerce.number().min(0.1).max(8).default(1),
        lifeVariationSeconds: z.coerce.number().min(0).max(8).default(2),
        gravityPercent: percent(70, 5, 300),
        dragPercent: percent(62, 10, 300),
        headSizePercent: percent(80, 5, 200),
        trailLifePercent: percent(70, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.whirl),
    /** Comet: one bright tailed head continuing along the trail. */
    singleTail: z
      .object({
        /** How much of the shell's velocity the comet keeps, as a percentage. */
        inheritPercent: percent(35, 0, 100),
        /** Random sideways drift as a percentage of burst speed. */
        driftPercent: percent(12, 0, 100),
        /** Minimum upward speed as a fraction of burst speed. */
        riseFactor: z.coerce.number().min(0).max(2).default(0.55),
        /** Extra upward push added to the inherited rise. */
        pushFactor: z.coerce.number().min(0).max(2).default(0.35),
        lifePercent: percent(90, 10, 300),
        headSizePercent: percent(60, 5, 200),
        trailLifePercent: percent(125, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.singleTail),
    /** Mine: a ground burst fanning stars straight up from the tube. */
    upwardFan: z
      .object({
        /** Percentage of the star count used by the fan. */
        countPercent: percent(90, 1, 200),
        /** Lower bound on the fan count regardless of shell size. */
        minCount: z.coerce.number().int().min(1).max(200).default(36),
        /** Total sideways opening angle of the fan, in degrees. */
        spreadAngleDegrees: z.coerce.number().min(10).max(300).default(165.6),
        /** Minimum sideways throw factor. */
        fanBase: z.coerce.number().min(0).max(2).default(0.45),
        fanVariation: z.coerce.number().min(0).max(2).default(0.8),
        /** Random horizontal scatter of each spawn point, in world units. */
        spawnScatter: z.coerce.number().min(0).max(120).default(34),
        /** Base spawn height above the tube, in world units. */
        riseBase: z.coerce.number().min(0).max(120).default(24),
        riseVariation: z.coerce.number().min(0).max(120).default(22),
        /** Base upward speed factor. */
        riseSpeed: z.coerce.number().min(0).max(4).default(1.2),
        riseSpeedVariation: z.coerce.number().min(0).max(4).default(0.85),
        /** Front-to-back thickness of the fan. */
        depthScale: z.coerce.number().min(0).max(1.5).default(0.45),
        lifePercent: percent(72, 10, 300),
        dragPercent: percent(57.6, 10, 300),
        headSizePercent: percent(75, 5, 200),
        trailLifePercent: percent(60, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.upwardFan),
    /** Roman candle: staggered single shots from a ground tube. */
    romanCandle: z
      .object({
        /** Shots as a percentage of the star count. */
        shotsPercent: percent(8, 1, 100),
        minShots: z.coerce.number().int().min(1).max(60).default(4),
        /** Sequence length as a percentage of the shell life. */
        durationPercent: percent(40, 5, 100),
        durationMinSeconds: z.coerce.number().min(0.5).max(30).default(3),
        durationMaxSeconds: z.coerce.number().min(1).max(30).default(10),
        /** Sideways aim wobble per shot, in radians. */
        spread: z.coerce.number().min(0).max(2).default(0.55),
        /** Front-to-back aim wobble per shot, in radians. */
        azimuth: z.coerce.number().min(0).max(2).default(0.4),
        /** Minimum shot speed factor. */
        speedBase: z.coerce.number().min(0.1).max(3).default(0.95),
        speedVariation: z.coerce.number().min(0).max(3).default(0.35),
        /** Random muzzle scatter of each shot, in world units. */
        muzzleScatter: z.coerce.number().min(0).max(60).default(12),
        /** Sideways speed factor of each shot. */
        lateralScale: z.coerce.number().min(0).max(1.5).default(0.28),
        depthScale: z.coerce.number().min(0).max(1.5).default(0.22),
        /** Base upward speed factor. */
        riseBase: z.coerce.number().min(0).max(4).default(1),
        riseVariation: z.coerce.number().min(0).max(4).default(0.32),
        lifePercent: percent(92, 10, 300),
        dragPercent: percent(68, 10, 300),
        headSizePercent: percent(92, 5, 200),
        trailLifePercent: percent(85, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.romanCandle),
    /** Fountain: a steady ground glitter spray with no mortar burst. */
    fountain: z
      .object({
        /** Spray length as a percentage of the shell life. */
        durationPercent: percent(26, 5, 100),
        durationMinSeconds: z.coerce.number().min(0.5).max(30).default(2.5),
        durationMaxSeconds: z.coerce.number().min(1).max(30).default(10),
        /** Sparks per second as a percentage of the star count. */
        ratePercent: percent(140, 10, 600),
        minRatePerSecond: z.coerce.number().min(1).max(400).default(40),
        /** Total opening angle of the spray cone, in degrees. */
        coneAngleDegrees: z.coerce
          .number()
          .min(2)
          .max(180)
          .default(GEOMETRY_TUNING_DEFAULTS.fountain.coneAngleDegrees),
        /** Minimum spark speed factor. */
        speedBase: z.coerce.number().min(0.05).max(3).default(0.45),
        speedVariation: z.coerce.number().min(0).max(3).default(0.75),
        /** Random scatter of each spark's spawn point, in world units. */
        spawnScatter: z.coerce.number().min(0).max(60).default(10),
        /** Sideways speed factor of the spray. */
        lateralScale: z.coerce.number().min(0).max(1.5).default(0.55),
        lifePercent: percent(60, 5, 300),
        dragPercent: percent(115, 10, 300),
        headSizePercent: percent(40, 5, 200),
        trailLifePercent: percent(40, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fountain),
  })
  .default(GEOMETRY_TUNING_DEFAULTS);

export type FireworkGeometryTuning = z.infer<typeof GeometryTuningSchema>;
export type GeometryTuningGroupKey = keyof FireworkGeometryTuning;

export const FireworkDesignSchema = z.object({
  size: z.coerce
    .number()
    .min(1)
    .transform((value) => Math.min(MAX_STAR_COUNT, value))
    .default(MAX_STAR_COUNT),
  colour: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({ enabled: true }),
  color: ColorSchema.default('random'),
  secondaryColor: ColorSchema.optional(),
  /** Fraction of the burst that takes the secondary/accent colour (0..1).
   *  Defaults to ~0.22 in the renderer when omitted. */
  secondaryColorRatio: z.coerce.number().min(0).max(1).optional(),
  liftVelocity: z.coerce.number().min(4).max(40).optional(),
  shellLife: z.coerce.number().min(2).max(60).default(20),
  pattern: z.enum(FIREWORK_PATTERNS).default('fibonacci'),
  geometry: z.enum(FIREWORK_GEOMETRIES).default('sphere'),
  trailProfile: z.enum(FIREWORK_TRAIL_PROFILES).default('spark'),
  burstTrail: BurstTrailSchema,
  burst: StarBurstSchema,
  flair: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  crackle: z
    .object({
      enabled: z.boolean().default(true),
      probability: z.coerce.number().min(0).max(1).default(0.05),
      sound: z.enum(['crackle', 'lightBoom', 'heavyBoom']).default('crackle'),
    })
    .default({ enabled: true, probability: 0.05, sound: 'crackle' }),
  sound: z
    .object({
      launch: z.boolean().default(true),
      boom: z.enum(['none', 'auto', 'light', 'heavy']).default('auto'),
    })
    .default({ launch: true, boom: 'auto' }),
  strobe: z
    .object({
      enabled: z.boolean().default(false),
      frequencyHz: z.coerce.number().min(2).max(28).default(12),
      dutyCycle: z.coerce.number().min(0.1).max(0.9).default(0.45),
      /** Percentage of stars that strobe; the rest burn steadily. */
      amountPercent: z.coerce.number().min(0).max(100).default(100),
      /** Star size during the dark phase, as a percentage of the lit size. */
      dimPercent: z.coerce.number().min(0).max(60).default(4.5),
      /** Per-star phase offset so stars don't all blink in unison. 0 = synchronised. */
      desync: z.coerce.number().min(0).max(1).default(0.037),
    })
    .default({
      enabled: false,
      frequencyHz: 12,
      dutyCycle: 0.45,
      amountPercent: 100,
      dimPercent: 4.5,
      desync: 0.037,
    }),
  trail: z
    .object({
      density: z.coerce.number().min(0).max(4).default(1),
      length: z.coerce.number().min(0.2).max(4).default(1),
      sparkle: z.coerce.number().min(0).max(1).default(0.35),
      thickness: z.coerce.number().min(0.4).max(4).default(1),
      streakSize: z.coerce.number().min(0.4).max(4).default(1),
      streakLength: z.coerce.number().min(0.4).max(4).default(1),
      streakLife: z.coerce.number().min(0.2).max(4).default(1),
    })
    .default({
      density: 1,
      length: 1,
      sparkle: 0.35,
      thickness: 1,
      streakSize: 1,
      streakLength: 1,
      streakLife: 1,
    }),
  split: z
    .object({
      enabled: z.boolean().default(false),
      fragments: z.coerce.number().int().min(2).max(8).default(4),
      speed: z.coerce.number().min(0.4).max(4).default(1.55),
      delayRatio: z.coerce.number().min(0.15).max(0.85).default(0.42),
      /** Minimum fragment burn time in seconds. */
      lifeBaseSeconds: z.coerce.number().min(0.1).max(6).default(0.65),
      /** Random extra burn time added on top of the base, in seconds. */
      lifeVariationSeconds: z.coerce.number().min(0).max(6).default(1.6),
      /** Fragment head size as a percentage of the parent star's size budget. */
      headSizePercent: z.coerce.number().min(5).max(200).default(50),
      /** Fragment trail life as a percentage of the parent star's trail life. */
      trailLifePercent: z.coerce.number().min(5).max(300).default(60),
    })
    .default({
      enabled: false,
      fragments: 4,
      speed: 1.55,
      delayRatio: 0.42,
      lifeBaseSeconds: 0.65,
      lifeVariationSeconds: 1.6,
      headSizePercent: 50,
      trailLifePercent: 60,
    }),
  geometryTuning: GeometryTuningSchema,
  mortar: z
    .object({
      smokeParticles: z.coerce.number().int().min(0).max(500).default(100),
      sound: z.boolean().default(true),
    })
    .default({ smokeParticles: 100, sound: true }),
  launch: LaunchSchema,
  /**
   * Layered star calibration for non-brocade effects. `outer` is the main
   * burst. `core` is the inner burst, active by default for star-based effects,
   * with the same count, physics, head appearance, colour, and trail model as
   * the outer layer.
   */
  stars: z
    .object({
      outer: StarLayerSchema,
      core: StarLayerSchema.default({
        enabled: true,
        count: 38,
        burst: {
          speed: [0.8, 1.8],
          gravity: [-0.22, -0.02],
          life: [0.4, 5.4],
          flairColorMode: 'mixed',
        },
        head: {
          visible: true,
          size: DEFAULT_STAR_INNER_HEAD_SIZE,
          opening: STAR_HEAD_OPENING_DEFAULTS,
          closing: STAR_HEAD_CLOSING_DEFAULTS,
          glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
          ...HEAD_APPEARANCE_DEFAULTS,
        },
        colourPattern: {
          mode: 'solid',
          axis: 'vertical',
          count: 3,
          colours: [],
        },
        burstTrail: {
          version: 2,
          enabled: false,
          preset: 'none',
          colourMode: 'gold',
          particlesPerStar: 0,
          frontClump: 0,
          width: { front: 0, tail: 0, curve: 1 },
          particleSize: { base: 0.6, headScale: 1, tailScale: 0.6, variationPercent: 0 },
          opening: TRAIL_OPENING_DEFAULTS,
          closing: TRAIL_CLOSING_DEFAULTS,
          placement: { headGapPercent: 0 },
          spacing: { curve: 1, jitterPercent: 0 },
          lifetime: {
            mode: 'dynamic',
            percent: 0.1,
            baseSeconds: 0.4,
            variationPercent: 20,
            afterglowSeconds: 0,
          },
          intensity: { brightness: 0, fadeSoftness: 1 },
          flicker: { chance: 0, strength: 0, lifetimeMultiplier: 0.45 },
          motion: {
            gravity: -0.014,
            drag: 1.6,
            inheritedVelocity: 0,
            turbulence: 0,
            driftX: 0,
            driftY: -0.012,
            driftZ: 0,
            spin: 0,
          },
          stops: [],
        },
      }),
    })
    .default({
      outer: StarLayerSchema.parse({
        enabled: true,
        count: MAX_STAR_COUNT,
        burst: {
          speed: [2, 4],
          gravity: [-0.24, -0.02],
          life: [0.5, 6.5],
          flairColorMode: 'mixed',
        },
        head: {
          visible: true,
          size: DEFAULT_STAR_HEAD_SIZE,
          opening: STAR_HEAD_OPENING_DEFAULTS,
          closing: STAR_HEAD_CLOSING_DEFAULTS,
          glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
          ...HEAD_APPEARANCE_DEFAULTS,
        },
      }),
      core: StarLayerSchema.parse({ enabled: true }),
    }),
  /**
   * Brocade crown calibration. Only read when the design is a brocade crown
   * (`geometry: 'crown'` + `trailProfile: 'glitter'`). Defaults mirror the
   * renderer constants the brocade rework shipped with, so designs without an
   * explicit `brocade` block look identical to before.
   */
  brocade: z
    .object({
      /** Streak heads per shell. Falls back to `size` when absent. */
      streakCount: z.coerce.number().int().min(1).max(100).optional(),
      /** Arc-length spacing (world units) between trail square emissions. */
      trailStep: z.coerce.number().min(1).max(10).default(3),
      /** Radius (world units) of the tube trail squares scatter within. */
      tubeRadius: z.coerce.number().min(0.5).max(12).default(3.2),
      /** Render the glowing head orbs. Off leaves the trails as bare streaks. */
      headsEnabled: z.boolean().default(true),
      /** Size budget of each glowing head orb. */
      headSize: z.coerce.number().min(100).max(4000).default(900),
      /** Halo brightness multiplier; also drives scene light tinting. */
      glowStrength: z.coerce
        .number()
        .min(MIN_HEAD_GLOW_STRENGTH)
        .max(MAX_HEAD_GLOW_STRENGTH)
        .default(DEFAULT_HEAD_GLOW_STRENGTH),
      /** Probability a head is green rather than red. */
      greenRatio: z.coerce.number().min(0).max(1).default(0.5),
      headColors: z
        .object({
          green: RgbSchema.default({ r: 0.4, g: 1, b: 0.5 }),
          red: RgbSchema.default({ r: 1, g: 0.28, b: 0.32 }),
        })
        .default({ green: { r: 0.4, g: 1, b: 0.5 }, red: { r: 1, g: 0.28, b: 0.32 } }),
      /** Trail fire gradient: white-gold hot core cooling to ember tips. */
      palette: z
        .object({
          hot: RgbSchema.default({ r: 1, g: 0.93, b: 0.72 }),
          ember: RgbSchema.default({ r: 1, g: 0.42, b: 0.14 }),
        })
        .default({ hot: { r: 1, g: 0.93, b: 0.72 }, ember: { r: 1, g: 0.42, b: 0.14 } }),
    })
    .default({
      trailStep: 3,
      tubeRadius: 3.2,
      headsEnabled: true,
      headSize: 900,
      glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
      greenRatio: 0.5,
      headColors: { green: { r: 0.4, g: 1, b: 0.5 }, red: { r: 1, g: 0.28, b: 0.32 } },
      palette: { hot: { r: 1, g: 0.93, b: 0.72 }, ember: { r: 1, g: 0.42, b: 0.14 } },
    }),
});

export type FireworkDesign = z.infer<typeof FireworkDesignSchema>;
export type StarLayerKey = 'outer' | 'core';
export type FireworkStarLayer = FireworkDesign['stars'][StarLayerKey];

const DEFAULT_TRAIL_STREAK = { streakSize: 1, streakLength: 1, streakLife: 1 };

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBurstTrailPreset(value: unknown): value is BurstTrailPreset {
  return typeof value === 'string' && (BURST_TRAIL_PRESETS as readonly string[]).includes(value);
}

function deepMergeDesign(base: unknown, override: unknown): unknown {
  if (!isRecord(base)) return override;
  if (!isRecord(override)) return base;
  const merged: RecordLike = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] =
      isRecord(value) && isRecord(merged[key]) ? deepMergeDesign(merged[key], value) : value;
  }
  return merged;
}

type BurstTrail = FireworkDesign['burstTrail'];
type BurstTrailStop = BurstTrail['stops'][number];

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function burstTrailStop(
  position: number,
  density: number,
  size: number,
  sizeVariation: number,
  shapeWeights: BurstTrailStop['shapeWeights'],
): BurstTrailStop {
  return { position, density, size, sizeVariation, shapeWeights };
}

const BURST_TRAIL_PRESET_DEFAULTS: Record<BurstTrailPreset, BurstTrail> = {
  none: {
    version: 2,
    enabled: false,
    preset: 'none',
    colourMode: 'gold',
    particlesPerStar: 0,
    frontClump: 0,
    width: { front: 0, tail: 0, curve: 1 },
    particleSize: { base: 0.6, headScale: 1, tailScale: 0.6, variationPercent: 0 },
    opening: TRAIL_OPENING_DEFAULTS,
    closing: TRAIL_CLOSING_DEFAULTS,
    placement: { headGapPercent: 0 },
    spacing: { curve: 1, jitterPercent: 0 },
    lifetime: {
      mode: 'dynamic',
      percent: 0.1,
      baseSeconds: 0.4,
      variationPercent: 20,
      afterglowSeconds: 0,
    },
    intensity: { brightness: 0, fadeSoftness: 1 },
    flicker: { chance: 0, strength: 0, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.014,
      drag: 1.6,
      inheritedVelocity: 0,
      turbulence: 0,
      driftX: 0,
      driftY: -0.012,
      driftZ: 0,
      spin: 0,
    },
    stops: [
      burstTrailStop(0, 0, 0.6, 0, { circle: 0, square: 100, triangle: 0 }),
      burstTrailStop(100, 0, 0.4, 0, { circle: 0, square: 100, triangle: 0 }),
    ],
  },
  sparkDust: {
    version: 2,
    enabled: true,
    preset: 'sparkDust',
    colourMode: 'star',
    particlesPerStar: 40,
    frontClump: 0.35,
    width: { front: 1.4, tail: 2.5, curve: 1.15 },
    particleSize: { base: 0.7, headScale: 1, tailScale: 0.45, variationPercent: 55 },
    opening: TRAIL_OPENING_DEFAULTS,
    closing: TRAIL_CLOSING_DEFAULTS,
    placement: { headGapPercent: 35 },
    spacing: { curve: 1, jitterPercent: 55 },
    lifetime: {
      mode: 'dynamic',
      percent: 0.16,
      baseSeconds: 1.1,
      variationPercent: 55,
      afterglowSeconds: 0.18,
    },
    intensity: { brightness: 0.92, fadeSoftness: 1.3 },
    flicker: { chance: 0.22, strength: 0.75, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.035,
      drag: 2.2,
      inheritedVelocity: 0.02,
      turbulence: 0.2,
      driftX: 0,
      driftY: -0.018,
      driftZ: 0,
      spin: 0,
    },
    stops: [
      burstTrailStop(0, 1.1, 0.78, 55, { circle: 76, square: 16, triangle: 8 }),
      burstTrailStop(55, 0.6, 0.58, 60, { circle: 82, square: 12, triangle: 6 }),
      burstTrailStop(100, 0.18, 0.34, 70, { circle: 90, square: 8, triangle: 2 }),
    ],
  },
  solidStreaks: {
    version: 2,
    enabled: true,
    preset: 'solidStreaks',
    colourMode: 'gold',
    particlesPerStar: 104,
    frontClump: 0.55,
    width: { front: 2.4, tail: 2.4, curve: 1 },
    particleSize: { base: 1.0, headScale: 1, tailScale: 0.55, variationPercent: 28 },
    opening: TRAIL_OPENING_DEFAULTS,
    closing: TRAIL_CLOSING_DEFAULTS,
    placement: { headGapPercent: 45 },
    spacing: { curve: 1, jitterPercent: 22 },
    lifetime: {
      mode: 'dynamic',
      percent: 0.22,
      baseSeconds: 1.5,
      variationPercent: 28,
      afterglowSeconds: 0.3,
    },
    intensity: { brightness: 1.1, fadeSoftness: 1 },
    flicker: { chance: 0.08, strength: 0.9, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.018,
      drag: 1.4,
      inheritedVelocity: 0.02,
      turbulence: 0.045,
      driftX: 0,
      driftY: -0.012,
      driftZ: 0,
      spin: 0,
    },
    stops: [
      burstTrailStop(0, 1.5, 1.05, 28, { circle: 4, square: 88, triangle: 8 }),
      burstTrailStop(32, 1.15, 0.9, 30, { circle: 5, square: 86, triangle: 9 }),
      burstTrailStop(100, 0.34, 0.5, 34, { circle: 8, square: 84, triangle: 8 }),
    ],
  },
  willowHang: {
    version: 2,
    enabled: true,
    preset: 'willowHang',
    colourMode: 'gold',
    particlesPerStar: 92,
    frontClump: 0.46,
    width: { front: 1.4, tail: 2.8, curve: 1.6 },
    particleSize: { base: 0.86, headScale: 1, tailScale: 0.45, variationPercent: 34 },
    opening: TRAIL_OPENING_DEFAULTS,
    closing: TRAIL_CLOSING_DEFAULTS,
    placement: { headGapPercent: 55 },
    spacing: { curve: 1.35, jitterPercent: 24 },
    lifetime: {
      mode: 'dynamic',
      percent: 0.34,
      baseSeconds: 2.6,
      variationPercent: 34,
      afterglowSeconds: 0.4,
    },
    intensity: { brightness: 0.95, fadeSoftness: 1.6 },
    flicker: { chance: 0.06, strength: 0.55, lifetimeMultiplier: 0.5 },
    motion: {
      gravity: -0.12,
      drag: 0.8,
      inheritedVelocity: 0.015,
      turbulence: 0.06,
      driftX: 0,
      driftY: -0.08,
      driftZ: 0,
      spin: 0,
    },
    stops: [
      burstTrailStop(0, 1.25, 0.9, 30, { circle: 8, square: 84, triangle: 8 }),
      burstTrailStop(48, 0.92, 0.75, 36, { circle: 12, square: 78, triangle: 10 }),
      burstTrailStop(100, 0.3, 0.4, 42, { circle: 22, square: 68, triangle: 10 }),
    ],
  },
  cometTail: {
    version: 2,
    enabled: true,
    preset: 'cometTail',
    colourMode: 'starFade',
    particlesPerStar: 112,
    frontClump: 0.68,
    width: { front: 3.0, tail: 0.9, curve: 0.72 },
    particleSize: { base: 1.1, headScale: 1.15, tailScale: 0.35, variationPercent: 20 },
    opening: TRAIL_OPENING_DEFAULTS,
    closing: TRAIL_CLOSING_DEFAULTS,
    placement: { headGapPercent: 70 },
    spacing: { curve: 1.25, jitterPercent: 18 },
    lifetime: {
      mode: 'dynamic',
      percent: 0.24,
      baseSeconds: 1.5,
      variationPercent: 24,
      afterglowSeconds: 0.25,
    },
    intensity: { brightness: 1.2, fadeSoftness: 0.9 },
    flicker: { chance: 0.04, strength: 0.65, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.028,
      drag: 1.3,
      inheritedVelocity: 0.04,
      turbulence: 0.05,
      driftX: 0,
      driftY: -0.018,
      driftZ: 0,
      spin: 0,
    },
    stops: [
      burstTrailStop(0, 1.7, 1.35, 20, { circle: 6, square: 84, triangle: 10 }),
      burstTrailStop(42, 0.95, 0.9, 24, { circle: 8, square: 80, triangle: 12 }),
      burstTrailStop(100, 0.24, 0.44, 32, { circle: 18, square: 72, triangle: 10 }),
    ],
  },
  denseBrocade: {
    version: 2,
    enabled: true,
    preset: 'denseBrocade',
    colourMode: 'gold',
    particlesPerStar: 120,
    frontClump: 0.72,
    width: { front: 3.2, tail: 2.7, curve: 0.86 },
    particleSize: { base: 1, headScale: 1.12, tailScale: 0.45, variationPercent: 18 },
    opening: TRAIL_OPENING_DEFAULTS,
    closing: TRAIL_CLOSING_DEFAULTS,
    placement: { headGapPercent: 70 },
    spacing: { curve: 1.4, jitterPercent: 15 },
    lifetime: {
      mode: 'dynamic',
      percent: 0.24,
      baseSeconds: 1.45,
      variationPercent: 22,
      afterglowSeconds: 0.16,
    },
    intensity: { brightness: 1.15, fadeSoftness: 1.1 },
    flicker: { chance: 0.1, strength: 0.95, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.014,
      drag: 1.6,
      inheritedVelocity: 0.018,
      turbulence: 0.05,
      driftX: 0,
      driftY: -0.012,
      driftZ: 0,
      spin: 0,
    },
    stops: [
      burstTrailStop(0, 1.85, 1.15, 22, { circle: 4, square: 88, triangle: 8 }),
      burstTrailStop(25, 1.25, 0.92, 24, { circle: 5, square: 86, triangle: 9 }),
      burstTrailStop(70, 0.62, 0.64, 30, { circle: 8, square: 82, triangle: 10 }),
      burstTrailStop(100, 0.24, 0.42, 36, { circle: 14, square: 76, triangle: 10 }),
    ],
  },
  custom: {
    version: 2,
    enabled: true,
    preset: 'custom',
    colourMode: 'starFade',
    particlesPerStar: 178,
    frontClump: 0.55,
    width: { front: 10, tail: 0, curve: 1 },
    particleSize: { base: 1.2, headScale: 1, tailScale: 0.35, variationPercent: 8 },
    opening: TRAIL_OPENING_DEFAULTS,
    closing: TRAIL_CLOSING_DEFAULTS,
    placement: { headGapPercent: 60 },
    spacing: { curve: 1, jitterPercent: 18 },
    lifetime: {
      mode: 'dynamic',
      percent: 0.18,
      baseSeconds: 8,
      variationPercent: 30,
      afterglowSeconds: 0.15,
    },
    intensity: { brightness: 1, fadeSoftness: 1 },
    flicker: { chance: 0.08, strength: 0.8, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.014,
      drag: 1.6,
      inheritedVelocity: 0.02,
      turbulence: 0.045,
      driftX: 0,
      driftY: -0.012,
      driftZ: 0,
      spin: 0,
    },
    stops: [
      burstTrailStop(0, 1, 2.68, 0, { circle: 0, square: 100, triangle: 0 }),
      burstTrailStop(100, 1, 0.08, 0, { circle: 0, square: 100, triangle: 0 }),
    ],
  },
};

export function makeBurstTrailPreset(preset: BurstTrailPreset): BurstTrail {
  return cloneJson(BURST_TRAIL_PRESET_DEFAULTS[preset]);
}

export function normaliseBurstTrailStops(stops: readonly BurstTrailStop[]): BurstTrailStop[] {
  const source = stops.length > 0 ? stops : BURST_TRAIL_PRESET_DEFAULTS.sparkDust.stops;
  return source
    .slice(0, BURST_TRAIL_MAX_STOPS)
    .map((stop) => {
      const weights = stop.shapeWeights;
      const total = weights.circle + weights.square + weights.triangle;
      const shapeWeights =
        total > 0
          ? {
              circle: round2((weights.circle / total) * 100),
              square: round2((weights.square / total) * 100),
              triangle: round2((weights.triangle / total) * 100),
            }
          : { circle: 0, square: 100, triangle: 0 };
      return {
        position: round2(Math.min(100, Math.max(0, stop.position))),
        density: round2(Math.min(4, Math.max(0, stop.density))),
        size: round2(Math.min(24, Math.max(0.08, stop.size))),
        sizeVariation: round2(Math.min(100, Math.max(0, stop.sizeVariation))),
        shapeWeights,
      };
    })
    .sort((a, b) => a.position - b.position);
}

function legacySmokeParticlesFromSource(source: unknown): number | null {
  if (!isRecord(source)) return null;
  const launch = isRecord(source.launch) ? source.launch : null;
  const smoke = launch && isRecord(launch.smoke) ? launch.smoke : null;
  if (smoke?.particles !== undefined) return null;

  const mortar = isRecord(source.mortar) ? source.mortar : null;
  const raw = Number(mortar?.smokeParticles);
  if (!Number.isFinite(raw)) return null;
  return Math.min(500, Math.max(0, Math.round(raw)));
}

function launchSoundFromSource(source: unknown): boolean | null {
  if (!isRecord(source)) return null;
  const sound = isRecord(source.sound) ? source.sound : null;
  if (typeof sound?.launch === 'boolean') return sound.launch;

  const mortar = isRecord(source.mortar) ? source.mortar : null;
  if (typeof mortar?.sound === 'boolean') return mortar.sound;
  return null;
}

function legacyLiftParticlesFromSource(
  source: unknown,
): Partial<FireworkDesign['launch']['liftParticles']> | null {
  if (!isRecord(source)) return null;
  const launch = isRecord(source.launch) ? source.launch : null;
  const liftParticles = launch && isRecord(launch.liftParticles) ? launch.liftParticles : null;
  if (!liftParticles) return null;

  const next: Partial<FireworkDesign['launch']['liftParticles']> = {};

  if (!isRecord(liftParticles.particleSize)) {
    const size = Number(liftParticles.size);
    if (Number.isFinite(size)) {
      next.particleSize = {
        base: Math.min(180, Math.max(1, size)),
        headScale: 1,
        tailScale: 0.35,
        variationPercent: 20,
      };
    }
  }

  if (!isRecord(liftParticles.lifetime)) {
    const lifeSeconds = Number(liftParticles.lifeSeconds);
    if (Number.isFinite(lifeSeconds)) {
      next.lifetime = {
        baseSeconds: Math.min(8, Math.max(0.1, lifeSeconds)),
        variationPercent: 35,
        afterglowSeconds: 0.1,
      };
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

function legacyShellTrailFromSource(
  source: unknown,
): Partial<FireworkDesign['launch']['shell']['trail']> | null {
  if (!isRecord(source)) return null;
  const launch = isRecord(source.launch) ? source.launch : null;
  const shell = launch && isRecord(launch.shell) ? launch.shell : null;
  if (shell && isRecord(shell.trail)) return null;

  const liftParticles = launch && isRecord(launch.liftParticles) ? launch.liftParticles : null;
  if (!liftParticles) return null;

  const next: Partial<FireworkDesign['launch']['shell']['trail']> = {};
  const spread = Number(liftParticles.spread);
  if (Number.isFinite(spread)) {
    next.tubeDiameter = Math.min(90, Math.max(0, spread));
  }

  const width = isRecord(liftParticles.width) ? liftParticles.width : null;
  if (width) {
    const front = Number(width.front);
    const tail = Number(width.tail);
    const curve = Number(width.curve);
    if (Number.isFinite(front)) next.frontAngle = Math.min(60, Math.max(0, front));
    if (Number.isFinite(tail)) next.tailAngle = Math.min(60, Math.max(0, tail));
    if (Number.isFinite(curve)) next.curve = Math.min(4, Math.max(0.2, curve));
  }

  return Object.keys(next).length > 0 ? next : null;
}

function hasExplicitSectionEnabled(source: unknown, section: string): boolean {
  if (!isRecord(source)) return false;
  const sectionValue = isRecord(source[section]) ? source[section] : null;
  return typeof sectionValue?.enabled === 'boolean';
}

function sourceStars(source: unknown): RecordLike {
  return isRecord(source) && isRecord(source.stars) ? source.stars : {};
}

function normaliseBurstTrail(trail: BurstTrail): BurstTrail {
  const presetDefaults = makeBurstTrailPreset(trail.preset);
  const merged = deepMergeDesign(presetDefaults, trail) as BurstTrail;
  return {
    ...merged,
    version: 2,
    stops: normaliseBurstTrailStops(merged.stops.length > 0 ? merged.stops : presetDefaults.stops),
  };
}

function hydrateBurstTrailFragment(fragment: RecordLike): BurstTrail {
  const preset = isBurstTrailPreset(fragment.preset) ? fragment.preset : 'custom';
  return normaliseBurstTrail(deepMergeDesign(makeBurstTrailPreset(preset), fragment) as BurstTrail);
}

export function hydrateBurstTrailDefaults(source: unknown): unknown {
  if (!isRecord(source)) return source;

  let hydrated: RecordLike | null = null;
  const write = (key: string, value: unknown) => {
    hydrated ??= { ...source };
    hydrated[key] = value;
  };

  if (isRecord(source.burstTrail)) {
    write('burstTrail', hydrateBurstTrailFragment(source.burstTrail));
  }

  const stars = isRecord(source.stars) ? source.stars : null;
  if (stars) {
    let hydratedStars: RecordLike | null = null;
    for (const layerKey of ['outer', 'core'] as const) {
      const layer = isRecord(stars[layerKey]) ? stars[layerKey] : null;
      if (!layer || !isRecord(layer.burstTrail)) continue;
      hydratedStars ??= { ...stars };
      hydratedStars[layerKey] = {
        ...layer,
        burstTrail: hydrateBurstTrailFragment(layer.burstTrail),
      };
    }
    if (hydratedStars) write('stars', hydratedStars);
  }

  return hydrated ?? source;
}

function normaliseStarLayer(layer: FireworkStarLayer): FireworkStarLayer {
  return {
    ...layer,
    count: Math.min(MAX_STAR_COUNT, Math.max(1, Math.round(layer.count))),
    burstTrail: normaliseBurstTrail(layer.burstTrail),
  };
}

function parseStarLayerInput(input: unknown, fallback: FireworkStarLayer): FireworkStarLayer {
  const raw = isRecord(input) ? input : {};
  return normaliseStarLayer(StarLayerSchema.parse(deepMergeDesign(fallback, raw)));
}

function legacyOuterLayerFallback(
  design: FireworkDesign,
  source: unknown,
  burstTrail: BurstTrail,
): FireworkStarLayer {
  const stars = sourceStars(source);
  const legacyHeads = isRecord(stars.heads) ? stars.heads : {};
  const legacyEnabled =
    typeof legacyHeads.enabled === 'boolean' ? legacyHeads.enabled : design.stars.outer.enabled;
  const head = StarHeadSchema.parse(deepMergeDesign(design.stars.outer.head, legacyHeads));
  return normaliseStarLayer({
    ...design.stars.outer,
    enabled: legacyEnabled,
    count: design.size,
    burst: design.burst,
    head,
    burstTrail,
  });
}

function coreLayerFallback(outer: FireworkStarLayer): FireworkStarLayer {
  const speedMid = (outer.burst.speed[0] + outer.burst.speed[1]) / 2;
  const speedHalfWidth = Math.max(0.2, Math.abs(outer.burst.speed[1] - outer.burst.speed[0]) / 2);
  const coreSpeedMid = Math.max(0.5, speedMid * 0.48);
  return normaliseStarLayer(
    StarLayerSchema.parse({
      enabled: outer.enabled,
      count: Math.max(1, Math.round(outer.count * 0.38)),
      color: outer.color,
      burst: {
        ...outer.burst,
        speed: [
          round2(coreSpeedMid - speedHalfWidth * 0.55),
          round2(coreSpeedMid + speedHalfWidth * 0.55),
        ],
        life: [round2(outer.burst.life[0] * 0.62), round2(outer.burst.life[1] * 0.82)],
      },
      head: {
        ...outer.head,
        size: Math.max(10, Math.round(outer.head.size * 0.62)),
      },
      burstTrail: makeBurstTrailPreset('none'),
    }),
  );
}

function normaliseFireworkDesign(design: FireworkDesign, source?: unknown): FireworkDesign {
  const topLevelBurstTrail = normaliseBurstTrail(design.burstTrail);
  const legacySmokeParticles = legacySmokeParticlesFromSource(source);
  const launchSound = launchSoundFromSource(source);
  const legacyLiftParticles = legacyLiftParticlesFromSource(source);
  const legacyShellTrail = legacyShellTrailFromSource(source);
  const shell =
    legacyShellTrail == null
      ? design.launch.shell
      : (deepMergeDesign(design.launch.shell, {
          trail: legacyShellTrail,
        }) as FireworkDesign['launch']['shell']);
  const liftParticles =
    legacyLiftParticles == null
      ? design.launch.liftParticles
      : (deepMergeDesign(
          design.launch.liftParticles,
          legacyLiftParticles,
        ) as FireworkDesign['launch']['liftParticles']);
  const splitEnabled =
    design.geometry === 'split_cross' && !hasExplicitSectionEnabled(source, 'split')
      ? true
      : design.split.enabled;
  const stars = sourceStars(source);
  const outerFallback = legacyOuterLayerFallback(design, source, topLevelBurstTrail);
  const outer = parseStarLayerInput(stars.outer, outerFallback);
  const core = parseStarLayerInput(stars.core, coreLayerFallback(outer));
  return {
    ...design,
    geometry: design.geometry === 'pistil' ? 'sphere' : design.geometry,
    size: outer.count,
    burst: outer.burst,
    sound: {
      ...design.sound,
      ...(launchSound == null ? {} : { launch: launchSound }),
    },
    mortar: {
      ...design.mortar,
      ...(launchSound == null ? {} : { sound: launchSound }),
    },
    launch: {
      ...design.launch,
      shell,
      liftParticles,
      smoke: {
        ...design.launch.smoke,
        ...(legacySmokeParticles == null ? {} : { particles: legacySmokeParticles }),
      },
    },
    burstTrail: outer.burstTrail,
    split: {
      ...design.split,
      enabled: splitEnabled,
    },
    stars: {
      outer,
      core,
    },
  };
}

export const DEFAULT_DESIGN: FireworkDesign = normaliseFireworkDesign(
  FireworkDesignSchema.parse({}),
);

export function safeParseFireworkDesign(input: unknown): FireworkDesign {
  const parsed = FireworkDesignSchema.safeParse(input);
  return parsed.success ? normaliseFireworkDesign(parsed.data, input) : DEFAULT_DESIGN;
}

const FIREWORK_RENDER_DEFAULT_KEYS = new Set([
  'size',
  'colour',
  'color',
  'secondaryColor',
  'secondaryColorRatio',
  'liftVelocity',
  'shellLife',
  'pattern',
  'geometry',
  'trailProfile',
  'geometryTuning',
  'burstTrail',
  'burst',
  'flair',
  'crackle',
  'sound',
  'strobe',
  'trail',
  'split',
  'mortar',
  'launch',
  'stars',
  'brocade',
]);

const EFFECT_MODEL_STRUCTURE_KEYS = ['geometry', 'trailProfile'] as const;

export function canonicaliseEffectModelJson(input: unknown): RecordLike {
  const source = isRecord(input) ? input : {};
  const canonical: RecordLike = {};
  const topLevelDefaults: RecordLike = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === 'renderDefaults') continue;
    if (key === 'pistil') continue;
    if (FIREWORK_RENDER_DEFAULT_KEYS.has(key)) {
      topLevelDefaults[key] = value;
      continue;
    }
    canonical[key] = value;
  }

  const existingDefaults = isRecord(source.renderDefaults) ? source.renderDefaults : {};
  // `renderDefaults` wins so old top-level values cannot fight the live editor.
  const mergedDefaults = deepMergeDesign(topLevelDefaults, existingDefaults);
  const renderDefaults = isRecord(mergedDefaults) ? { ...mergedDefaults } : {};
  delete renderDefaults.pistil;

  for (const key of EFFECT_MODEL_STRUCTURE_KEYS) {
    const value = renderDefaults[key] ?? source[key];
    if (value !== undefined) {
      canonical[key] = value;
      renderDefaults[key] = value;
    }
  }

  canonical.renderDefaults = renderDefaults;
  return canonical;
}

function hexToRendererColor(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return {
    r: ((int >> 16) & 0xff) / 255,
    g: ((int >> 8) & 0xff) / 255,
    b: (int & 0xff) / 255,
  };
}

function shellTypeToPattern(shellType: string | undefined): FireworkPattern {
  switch (shellType) {
    case 'ghost':
    case 'strobe':
    case 'crossette':
    case 'crackle':
    case 'silverFish':
    case 'whirl':
      return 'strobe';
    case 'brocade':
    case 'kamuro':
    case 'palm':
    case 'floral':
    case 'fallingLeaves':
    case 'willow':
    case 'horsetail':
    case 'comet':
    case 'tail':
    case 'mine':
    case 'pearls':
    case 'waterfall':
    case 'roman_candle':
    case 'fountain':
      return 'wave';
    default:
      return 'fibonacci';
  }
}

function shellTypeToGeometry(shellType: string | undefined): FireworkGeometry {
  switch (shellType) {
    case 'brocade':
      return 'crown';
    case 'kamuro':
      // Kamuro reads as a dense falling umbrella of metallic streaks, same
      // drooping geometry as willow but tuned hotter and longer-lived.
      return 'weeping';
    case 'palm':
      return 'radial_arms';
    case 'ring':
    case 'saturn':
      // Saturn shell = a ring with a central pistil orb; the core star layer
      // supplies the central orb, the ring geometry supplies the halo.
      return 'ring';
    case 'crossette':
    case 'double_break':
      // Double-break reuses the crossette split machinery with a longer delay
      // and larger fragments so the shell reads as two successive breaks.
      return 'split_cross';
    case 'fallingLeaves':
    case 'horsetail':
      return 'falling_tail';
    case 'willow':
      return 'weeping';
    case 'crackle':
      return 'fragment_cloud';
    case 'comet':
    case 'tail':
      return 'single_tail';
    case 'mine':
      return 'upward_fan';
    case 'pearls':
      return 'pearls';
    case 'silverFish':
      return 'fish';
    case 'waterfall':
      return 'waterfall';
    case 'whirl':
      return 'whirl';
    case 'bowtie':
      // Bow-tie / cross shell: two opposed lobes in a flat plane.
      return 'bowtie';
    case 'roman_candle':
      return 'roman_candle';
    case 'fountain':
      return 'fountain';
    default:
      // peony, chrysanthemum, nishiki, diadem, pistil, strobe, ghost, floral
      // all render as a spherical burst; pistil/diadem/nishiki get their inner
      // core layer from the star layer config rather than a new geometry.
      return 'sphere';
  }
}

function glitterToTrailProfile(
  glitter: unknown,
  shellType: string | undefined,
): FireworkTrailProfile {
  if (shellType === 'strobe' || shellType === 'ghost') return 'blink';
  if (shellType === 'crossette' || shellType === 'double_break') return 'fragmenting';
  if (shellType === 'crackle') return 'crackle';
  if (shellType === 'brocade' || shellType === 'kamuro') return 'glitter';
  if (shellType === 'pearls') return 'pearls';
  if (shellType === 'silverFish') return 'fish';
  if (shellType === 'waterfall') return 'waterfall';
  if (shellType === 'whirl') return 'whirl';
  if (shellType === 'fountain') return 'glitter';
  if (shellType === 'roman_candle') return 'thick_tail';
  if (shellType === 'willow' || shellType === 'fallingLeaves' || shellType === 'horsetail') {
    return 'long_hang';
  }
  if (shellType === 'palm' || shellType === 'comet' || shellType === 'tail') return 'thick_tail';
  // saturn keeps a clean ring (no star trails); the central orb is a head, not a trail.
  if (shellType === 'saturn' || shellType === 'ring') return 'none';
  if (shellType === 'bowtie') return 'spark';

  switch (glitter) {
    case 'none':
      return 'none';
    case 'heavy':
    case 'thick':
      return 'glitter';
    case 'streamer':
      return 'thick_tail';
    case 'willow':
      return 'long_hang';
    default:
      return 'spark';
  }
}

type StarsLike = {
  outer: Partial<FireworkStarLayer>;
  core: Partial<FireworkStarLayer>;
};

function starsBlock(headSize: number | null): StarsLike {
  return {
    outer: {
      enabled: headSize != null,
      ...(headSize == null
        ? {}
        : {
            head: {
              visible: true,
              size: headSize,
              opening: STAR_HEAD_OPENING_DEFAULTS,
              closing: STAR_HEAD_CLOSING_DEFAULTS,
              glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
              ...HEAD_APPEARANCE_DEFAULTS,
            },
          }),
    },
    core: { enabled: headSize != null },
  };
}

/**
 * Realistic per-shell-type star treatment for legacy catalogue specs: which
 * shells read as glowing orbs, and which lay brocade-style streak trails.
 */
function shellTypeToStars(shellType: string | undefined): StarsLike {
  switch (shellType) {
    case 'peony':
      return starsBlock(220);
    case 'crysanthemum':
    case 'chrysanthemum':
      return starsBlock(240);
    case 'willow':
    case 'fallingLeaves':
      return starsBlock(190);
    case 'kamuro':
      // Kamuro: hot metallic heads that carry long falling streaks.
      return starsBlock(210);
    case 'horsetail':
      return starsBlock(340);
    case 'palm':
      return starsBlock(620);
    case 'ring':
      return starsBlock(260);
    case 'saturn':
      // Ring halo + a large central pistil orb via the core layer.
      return {
        outer: {
          enabled: true,
          head: {
            visible: true,
            size: 260,
            opening: STAR_HEAD_OPENING_DEFAULTS,
            closing: STAR_HEAD_CLOSING_DEFAULTS,
            glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
            ...HEAD_APPEARANCE_DEFAULTS,
          },
        },
        core: {
          enabled: true,
          head: {
            visible: true,
            size: 520,
            opening: STAR_HEAD_OPENING_DEFAULTS,
            closing: STAR_HEAD_CLOSING_DEFAULTS,
            glowStrength: 1.4,
            ...HEAD_APPEARANCE_DEFAULTS,
          },
        },
      };
    case 'pearls':
      return starsBlock(430);
    case 'strobe':
    case 'ghost':
      return starsBlock(240);
    case 'crossette':
      return starsBlock(320);
    case 'double_break':
      return starsBlock(260);
    case 'bowtie':
      return starsBlock(300);
    case 'comet':
    case 'tail':
      return starsBlock(900);
    case 'mine':
      return starsBlock(200);
    case 'pistil':
    case 'nishiki':
    case 'diadem':
    case 'floral':
      // Layered sphere: coloured outer stars + a contrasting glowing core.
      return {
        outer: {
          enabled: true,
          head: {
            visible: true,
            size: 230,
            opening: STAR_HEAD_OPENING_DEFAULTS,
            closing: STAR_HEAD_CLOSING_DEFAULTS,
            glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
            ...HEAD_APPEARANCE_DEFAULTS,
          },
        },
        core: {
          enabled: true,
          head: {
            visible: true,
            size: 360,
            opening: STAR_HEAD_OPENING_DEFAULTS,
            closing: STAR_HEAD_CLOSING_DEFAULTS,
            glowStrength: 1.3,
            ...HEAD_APPEARANCE_DEFAULTS,
          },
        },
      };
    case 'silverFish':
      return starsBlock(170);
    case 'waterfall':
      return starsBlock(200);
    case 'whirl':
      return starsBlock(220);
    case 'roman_candle':
      // Repeated large ascending stars from a ground tube.
      return starsBlock(420);
    case 'fountain':
      // Small bright glitter sparks in a steady ground spray.
      return starsBlock(130);
    case 'crackle':
      return starsBlock(120);
    default:
      return starsBlock(null);
  }
}

function trailProfileToSettings(profile: FireworkTrailProfile): FireworkDesign['trail'] {
  switch (profile) {
    case 'none':
      return { ...DEFAULT_TRAIL_STREAK, density: 0, length: 0.35, sparkle: 0, thickness: 0.6 };
    case 'glitter':
      return {
        ...DEFAULT_TRAIL_STREAK,
        density: 1.8,
        length: 1.35,
        sparkle: 0.78,
        thickness: 1.15,
      };
    case 'long_hang':
      return { ...DEFAULT_TRAIL_STREAK, density: 1.45, length: 2.4, sparkle: 0.28, thickness: 0.9 };
    case 'thick_tail':
      return {
        ...DEFAULT_TRAIL_STREAK,
        density: 2.1,
        length: 1.45,
        sparkle: 0.45,
        thickness: 1.65,
      };
    case 'fragmenting':
      return { ...DEFAULT_TRAIL_STREAK, density: 1.1, length: 0.95, sparkle: 0.5, thickness: 0.95 };
    case 'spray':
      return { ...DEFAULT_TRAIL_STREAK, density: 2.4, length: 0.9, sparkle: 0.6, thickness: 1.2 };
    case 'blink':
      return { ...DEFAULT_TRAIL_STREAK, density: 0.65, length: 0.75, sparkle: 0.9, thickness: 1.0 };
    case 'crackle':
      return { ...DEFAULT_TRAIL_STREAK, density: 1.5, length: 0.8, sparkle: 1, thickness: 1.0 };
    case 'pearls':
      return { ...DEFAULT_TRAIL_STREAK, density: 0.25, length: 0.45, sparkle: 0.1, thickness: 1.4 };
    case 'fish':
      return { ...DEFAULT_TRAIL_STREAK, density: 0.9, length: 0.55, sparkle: 0.45, thickness: 0.7 };
    case 'waterfall':
      return { ...DEFAULT_TRAIL_STREAK, density: 2.2, length: 2.8, sparkle: 0.22, thickness: 0.85 };
    case 'whirl':
      return { ...DEFAULT_TRAIL_STREAK, density: 2, length: 0.9, sparkle: 0.8, thickness: 1.1 };
    default:
      return { ...DEFAULT_TRAIL_STREAK, density: 1, length: 1, sparkle: 0.35, thickness: 1 };
  }
}

function isStarTrailColorMode(value: unknown): value is StarTrailColorMode {
  return typeof value === 'string' && (STAR_TRAIL_COLOR_MODES as readonly string[]).includes(value);
}

function legacyNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function burstTrailPresetForLegacy(input: RecordLike): BurstTrailPreset {
  const geometry = typeof input.geometry === 'string' ? input.geometry : null;
  const trailProfile = typeof input.trailProfile === 'string' ? input.trailProfile : null;
  const stars = isRecord(input.stars) ? input.stars : {};
  const starTrail = isRecord(stars.trail) ? stars.trail : {};
  const trailMode = typeof starTrail.mode === 'string' ? starTrail.mode : null;
  const flair = isRecord(input.flair) ? input.flair : {};
  if (flair.enabled === false || trailProfile === 'none' || trailMode === 'none') return 'none';
  if (geometry === 'crown' && trailProfile === 'glitter') return 'denseBrocade';
  if (
    geometry === 'weeping' ||
    geometry === 'falling_tail' ||
    geometry === 'waterfall' ||
    trailProfile === 'long_hang' ||
    trailProfile === 'waterfall'
  ) {
    return 'willowHang';
  }
  if (geometry === 'single_tail' || trailProfile === 'thick_tail') return 'cometTail';
  if (trailMode === 'spark') return 'sparkDust';
  return 'solidStreaks';
}

function inferBurstTrailFromLegacy(input: RecordLike): BurstTrail {
  const preset = burstTrailPresetForLegacy(input);
  const trail = makeBurstTrailPreset(preset);
  const legacyTrail = isRecord(input.trail) ? input.trail : {};
  const stars = isRecord(input.stars) ? input.stars : {};
  const starTrail = isRecord(stars.trail) ? stars.trail : {};
  const brocade = isRecord(input.brocade) ? input.brocade : {};

  const colourMode = isStarTrailColorMode(starTrail.colorMode) ? starTrail.colorMode : null;
  if (colourMode) trail.colourMode = colourMode;

  const legacyEnabled =
    preset !== 'none' &&
    (!isRecord(input.flair) || (input.flair as RecordLike).enabled !== false) &&
    starTrail.mode !== 'none';
  trail.enabled = legacyEnabled;

  const density = legacyNumber(legacyTrail.density);
  const step = legacyNumber(starTrail.step) ?? legacyNumber(brocade.trailStep);
  const tubeRadius = legacyNumber(starTrail.tubeRadius) ?? legacyNumber(brocade.tubeRadius);
  const squareSize = legacyNumber(starTrail.squareSize);
  const thickness = legacyNumber(legacyTrail.thickness);
  const lifeSeconds = legacyNumber(starTrail.lifeSeconds);
  const trailLength = legacyNumber(legacyTrail.length);
  const flicker = legacyNumber(starTrail.flicker) ?? legacyNumber(legacyTrail.sparkle);

  if (preset === 'sparkDust' && density != null) {
    trail.particlesPerStar = Math.max(0, Math.round(24 * density));
  } else if (step != null && step > 0) {
    trail.particlesPerStar = Math.max(0, Math.round(trail.particlesPerStar * (3.2 / step)));
  }

  if (tubeRadius != null) {
    trail.width = {
      ...trail.width,
      front: Math.max(0, Math.min(12, tubeRadius)),
      tail: Math.max(0, Math.min(12, preset === 'cometTail' ? tubeRadius * 0.35 : tubeRadius)),
    };
  }

  const sizeScale = (squareSize ?? 1) * (thickness ?? 1);
  if (Number.isFinite(sizeScale) && sizeScale > 0) {
    trail.stops = trail.stops.map((stop) => ({
      ...stop,
      size: round2(Math.max(0.08, Math.min(24, stop.size * sizeScale))),
    }));
  }

  if (lifeSeconds != null || trailLength != null) {
    trail.lifetime = {
      ...trail.lifetime,
      baseSeconds: Math.max(0.05, Math.min(8, lifeSeconds ?? trail.lifetime.baseSeconds)),
      afterglowSeconds: Math.max(
        0,
        Math.min(6, Math.max(0.25, (trailLength ?? trail.lifetime.baseSeconds) * 0.3)),
      ),
    };
  }

  if (flicker != null) {
    trail.flicker = {
      ...trail.flicker,
      chance: Math.max(0, Math.min(1, flicker)),
    };
  }

  return normaliseFireworkDesign({ ...DEFAULT_DESIGN, burstTrail: trail }).burstTrail;
}

function extractBaseDefaults(baseModel: unknown): unknown {
  if (!isRecord(baseModel)) return baseModel;
  if (!isRecord(baseModel.renderDefaults)) return baseModel;
  return canonicaliseEffectModelJson(baseModel).renderDefaults;
}

function mergeDefaultFragments(fragments: readonly unknown[] | undefined): unknown {
  if (!fragments?.length) return {};
  return fragments.reduce<unknown>(
    (merged, fragment) => deepMergeDesign(merged, hydrateBurstTrailDefaults(fragment)),
    {},
  );
}

function burstTrailOverrideKind(source: unknown): 'topLevel' | 'outer' | null {
  if (!isRecord(source)) return null;

  let kind: 'topLevel' | 'outer' | null = isRecord(source.burstTrail) ? 'topLevel' : null;
  const stars = sourceStars(source);
  const outer = isRecord(stars.outer) ? stars.outer : null;
  if (outer && isRecord(outer.burstTrail)) kind = 'outer';
  return kind;
}

function lastBurstTrailOverrideKind(sources: readonly unknown[]): 'topLevel' | 'outer' | null {
  return sources.reduce<'topLevel' | 'outer' | null>(
    (latest, source) => burstTrailOverrideKind(source) ?? latest,
    null,
  );
}

function syncTopLevelBurstTrailToOuterStar(compiled: RecordLike, sources: readonly unknown[]) {
  if (lastBurstTrailOverrideKind(sources) !== 'topLevel' || !isRecord(compiled.burstTrail)) return;

  const stars = isRecord(compiled.stars) ? { ...compiled.stars } : {};
  const outer = isRecord(stars.outer) ? { ...stars.outer } : {};
  outer.burstTrail = compiled.burstTrail;
  stars.outer = outer;
  compiled.stars = stars;
}

function fireworkSpecToDesignLike(spec: RecordLike): RecordLike | null {
  if (typeof spec.shellType !== 'string') return null;
  const spreadSize = typeof spec.spreadSize === 'number' ? spec.spreadSize : null;
  const starCount = typeof spec.starCount === 'number' ? spec.starCount : null;
  const starDensity = typeof spec.starDensity === 'number' ? spec.starDensity : 1;
  const starLifeMs = typeof spec.starLifeMs === 'number' ? spec.starLifeMs : null;
  const shellType = spec.shellType;
  const color =
    typeof spec.outerColor === 'string'
      ? hexToRendererColor(spec.outerColor)
      : typeof spec.color === 'string'
        ? hexToRendererColor(spec.color)
        : null;
  const secondaryColor =
    typeof spec.secondColor === 'string'
      ? hexToRendererColor(spec.secondColor)
      : typeof spec.innerColor === 'string'
        ? hexToRendererColor(spec.innerColor)
        : null;
  const geometry = shellTypeToGeometry(shellType);
  const trailProfile = glitterToTrailProfile(spec.glitter, shellType);
  const size =
    starCount ?? (spreadSize == null ? undefined : Math.round(spreadSize * 52 * starDensity));
  const lifeSeconds = starLifeMs == null ? undefined : starLifeMs / 1000;
  const spreadSpeed = spreadSize == null ? null : Math.max(0.8, spreadSize);

  return {
    pattern: shellTypeToPattern(shellType),
    geometry,
    trailProfile,
    ...(size == null ? {} : { size }),
    ...(color == null ? {} : { color }),
    ...(secondaryColor == null ? {} : { secondaryColor }),
    trail: trailProfileToSettings(trailProfile),
    stars: shellTypeToStars(shellType),
    burst: {
      ...(spreadSpeed == null
        ? {}
        : { speed: [Math.max(0.6, spreadSpeed * 0.42), spreadSpeed * 0.82] }),
      ...(lifeSeconds == null ? {} : { life: [Math.max(0.45, lifeSeconds * 0.45), lifeSeconds] }),
      flairColorMode: spec.glitter === 'none' ? 'bombColor' : 'mixed',
      ...(shellType === 'strobe' ? { flairSizeStrobe: [8, 180] } : {}),
    },
    flair: { enabled: trailProfile !== 'none' && shellType !== 'ring' },
    crackle: {
      enabled: spec.crackle === true || shellType === 'crackle',
      probability: spec.crackle === true || shellType === 'crackle' ? 0.08 : 0,
      sound: 'crackle',
    },
    strobe: {
      enabled: spec.strobe === true || shellType === 'strobe',
      frequencyHz: shellType === 'strobe' ? 14 : 9,
      dutyCycle: 0.42,
    },
    split: {
      enabled: spec.crossette === true || shellType === 'crossette',
      fragments: 4,
      speed: shellType === 'crossette' ? 1.8 : 1.4,
      delayRatio: 0.42,
    },
    sound: { launch: true, boom: size != null && size > 240 ? 'heavy' : 'auto' },
    mortar: { sound: true, smokeParticles: size != null && size > 240 ? 130 : 100 },
    launch: { smoke: { particles: size != null && size > 240 ? 130 : 100 } },
  };
}

export function compileFireworkDesign(params: {
  baseModel?: unknown;
  effectStyleDefaults?: readonly unknown[];
  fireworkStyleDefaults?: readonly unknown[];
  variantOverrides?: unknown;
  primaryColor?: string | null;
  colorPalette?: string[] | null;
  legacySpec?: unknown;
}): FireworkDesign {
  const legacyDesignLike = isRecord(params.legacySpec)
    ? (fireworkSpecToDesignLike(params.legacySpec) ?? params.legacySpec)
    : params.legacySpec;
  const baseDefaults = hydrateBurstTrailDefaults(extractBaseDefaults(params.baseModel));
  const effectStyleDefaults = mergeDefaultFragments(params.effectStyleDefaults);
  const fireworkStyleDefaults = mergeDefaultFragments(params.fireworkStyleDefaults);
  const variantOverrides = hydrateBurstTrailDefaults(params.variantOverrides);
  const burstTrailOverrideSources = [
    ...(params.effectStyleDefaults ?? []),
    baseDefaults,
    ...(params.fireworkStyleDefaults ?? []),
    variantOverrides,
  ];
  const legacyOrDefault = legacyDesignLike ?? DEFAULT_DESIGN;
  let withBase = deepMergeDesign(
    deepMergeDesign(legacyOrDefault, effectStyleDefaults),
    baseDefaults,
  );
  const baseLegacySmokeParticles = legacySmokeParticlesFromSource(baseDefaults);
  if (baseLegacySmokeParticles != null) {
    withBase = deepMergeDesign(withBase, {
      launch: { smoke: { particles: baseLegacySmokeParticles } },
    });
  }
  const baseLaunchSound = launchSoundFromSource(baseDefaults);
  if (baseLaunchSound != null) {
    withBase = deepMergeDesign(withBase, {
      sound: { launch: baseLaunchSound },
      mortar: { sound: baseLaunchSound },
    });
  }
  // Blink-type shells (strobe, ghost) strobe by default. Express that through
  // strobe.enabled — the field the editor's Strobe toggle controls — and gate
  // the runtime blink on strobe.enabled alone (see Effects.starBehaviour). This
  // way turning the toggle off, which merges strobe.enabled: false below, truly
  // stops the flicker instead of the blink trail profile forcing it back on.
  if (isRecord(withBase) && withBase.trailProfile === 'blink') {
    const strobeRecord = isRecord(withBase.strobe) ? withBase.strobe : {};
    withBase = { ...withBase, strobe: { ...strobeRecord, enabled: true } };
  }
  const withVariant = deepMergeDesign(
    deepMergeDesign(withBase, fireworkStyleDefaults),
    variantOverrides,
  );
  const compiled = isRecord(withVariant) ? { ...withVariant } : {};
  const variantLegacySmokeParticles = legacySmokeParticlesFromSource(variantOverrides);
  if (variantLegacySmokeParticles != null) {
    compiled.launch = deepMergeDesign(compiled.launch, {
      smoke: { particles: variantLegacySmokeParticles },
    });
  }
  const variantLaunchSound = launchSoundFromSource(variantOverrides);
  if (variantLaunchSound != null) {
    compiled.sound = deepMergeDesign(compiled.sound, { launch: variantLaunchSound });
    compiled.mortar = deepMergeDesign(compiled.mortar, { sound: variantLaunchSound });
  }

  if (!isRecord(compiled.trail) && typeof compiled.trailProfile === 'string') {
    compiled.trail = trailProfileToSettings(compiled.trailProfile as FireworkTrailProfile);
  }

  const legacyBurstTrail = inferBurstTrailFromLegacy(compiled);
  compiled.burstTrail = isRecord(compiled.burstTrail)
    ? deepMergeDesign(legacyBurstTrail, hydrateBurstTrailFragment(compiled.burstTrail))
    : legacyBurstTrail;
  syncTopLevelBurstTrailToOuterStar(compiled, burstTrailOverrideSources);

  const colourSettings = isRecord(compiled.colour) ? compiled.colour : {};
  const colourEnabled = colourSettings.enabled !== false;
  const explicitColor = params.primaryColor
    ? hexToRendererColor(params.primaryColor)
    : params.colorPalette?.[0]
      ? hexToRendererColor(params.colorPalette[0])
      : null;
  if (colourEnabled && explicitColor) {
    compiled.color = explicitColor;
  }
  if (colourEnabled && params.colorPalette?.[1]) {
    const secondaryColor = hexToRendererColor(params.colorPalette[1]);
    if (secondaryColor) compiled.secondaryColor = secondaryColor;
  }
  if (!colourEnabled) {
    compiled.color = { r: 1, g: 1, b: 1 };
    delete compiled.secondaryColor;
    delete compiled.secondaryColorRatio;
    if (isRecord(compiled.stars)) {
      const stars = { ...compiled.stars };
      for (const layerKey of ['outer', 'core']) {
        const layer = isRecord(stars[layerKey]) ? { ...stars[layerKey] } : {};
        layer.color = { r: 1, g: 1, b: 1 };
        layer.colourPattern = {
          mode: 'solid',
          axis: 'vertical',
          count: 1,
          colours: [{ color: { r: 1, g: 1, b: 1 }, weight: 100 }],
        };
        stars[layerKey] = layer;
      }
      compiled.stars = stars;
    }
  }

  return safeParseFireworkDesign(compiled);
}

const CALIBER_BASELINE_MM = 30;

function parseCaliberMm(caliber: string): number | null {
  const mm = caliber.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  if (mm) return parseFloat(mm[1]);
  const inches = caliber.match(/^(\d+(?:\.\d+)?)\s*["""]/);
  if (inches) return parseFloat(inches[1]) * 25.4;
  return null;
}

export function scaleDesignForCaliber(
  design: FireworkDesign,
  caliber: string | null,
): FireworkDesign {
  if (!caliber) return design;
  const mm = parseCaliberMm(caliber);
  if (!mm) return design;
  const scale = mm / CALIBER_BASELINE_MM;
  const scaleLayer = (layer: FireworkStarLayer): FireworkStarLayer => ({
    ...layer,
    count: Math.round(Math.max(1, Math.min(MAX_STAR_COUNT, layer.count * scale))),
    burst: {
      ...layer.burst,
      speed: [layer.burst.speed[0] * scale, layer.burst.speed[1] * scale],
    },
  });
  const outer = scaleLayer(design.stars.outer);
  const core = scaleLayer(design.stars.core);
  return {
    ...design,
    size: outer.count,
    burst: outer.burst,
    burstTrail: outer.burstTrail,
    stars: { outer, core },
  };
}

/**
 * Per-cue render emphasis (schema 1.4.0). Climaxes, drops and finale beats get
 * visibly bigger and brighter shells without changing the underlying product:
 * more stars (capped at {@link MAX_STAR_COUNT}), faster/wider bursts, and a
 * higher launch. `size` drives the burst flash in `Lights`, so scaling it also
 * brightens the flash for free.
 */
const EMPHASIS_SCALE: Record<'normal' | 'accent' | 'peak', number> = {
  normal: 1.0,
  accent: 1.2,
  peak: 1.5,
};

export function scaleDesignForEmphasis(
  design: FireworkDesign,
  emphasis: 'normal' | 'accent' | 'peak' | null | undefined,
): FireworkDesign {
  if (!emphasis || emphasis === 'normal') return design;
  const scale = EMPHASIS_SCALE[emphasis];
  const scaleLayer = (layer: FireworkStarLayer): FireworkStarLayer => ({
    ...layer,
    count: Math.round(Math.max(1, Math.min(MAX_STAR_COUNT, layer.count * scale))),
    burst: {
      ...layer.burst,
      speed: [layer.burst.speed[0] * scale, layer.burst.speed[1] * scale],
    },
  });
  const outer = scaleLayer(design.stars.outer);
  const core = scaleLayer(design.stars.core);
  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  return {
    ...design,
    size: outer.count,
    burst: outer.burst,
    burstTrail: outer.burstTrail,
    stars: { outer, core },
    liftVelocity: liftVelocity * scale,
  };
}

/**
 * Estimate how long a single shell takes from launch to the last particle
 * fading, in seconds. Mirrors the particle physics in `Particle.update`
 * (quadratic drag, gravity, shell mass 0.5) closely enough for preview
 * timelines; it does not need to be frame-exact.
 */
export function estimateDesignDurationSeconds(design: FireworkDesign): number {
  return estimateFireworkDesignTiming(design).endSeconds;
}

export type LaunchPosition = { x: number; y: number; z: number };

export const DEFAULT_LAUNCH_POSITIONS: LaunchPosition[] = [
  { x: -200, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 200, y: 0, z: 0 },
];

export function parseLaunchPositions(input: unknown): LaunchPosition[] {
  if (!Array.isArray(input)) return DEFAULT_LAUNCH_POSITIONS;
  const positions = input
    .slice(0, 3)
    .map((entry): LaunchPosition | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const r = entry as Record<string, unknown>;
      const x = Number(r.x);
      const y = Number(r.y);
      const z = Number(r.z);
      if (![x, y, z].every(Number.isFinite)) return null;
      return { x, y, z };
    })
    .filter((p): p is LaunchPosition => p !== null);
  while (positions.length < 3) {
    positions.push(DEFAULT_LAUNCH_POSITIONS[positions.length]);
  }
  return positions.slice(0, 3);
}
