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
} from '../render-tuning.ts';
import {
  ColorSchema,
  DEFAULT_STAR_CLOSING_COLOUR,
  DEFAULT_STAR_HEAD_SIZE,
  DEFAULT_STAR_OPENING_COLOUR,
  HEAD_APPEARANCE_DEFAULTS,
  MAX_STAR_COUNT,
  orderedRangeSchema,
  RgbSchema,
  STAR_AIR_RESISTANCE_PERCENT_MAX,
  STAR_HEAD_CLOSING_DEFAULTS,
  STAR_HEAD_OPENING_DEFAULTS,
  STAR_TERMINAL_VELOCITY_MAX,
  TRAIL_CLOSING_DEFAULTS,
  TRAIL_OPENING_DEFAULTS,
} from './fields.ts';
import { BurstTrailSchema } from './trail-schema.ts';

export const StarSpeedRangeSchema = orderedRangeSchema(0, 20);

export const StarGravityRangeSchema = orderedRangeSchema(-2, 1);

export const StarLifeRangeSchema = orderedRangeSchema(0.05, 30);

export const StarBurstSchema = z
  .object({
    speed: StarSpeedRangeSchema.default([2, 4]),
    gravity: StarGravityRangeSchema.default([-0.24, -0.02]),
    life: StarLifeRangeSchema.default([0.5, 6.5]),
    airResistancePercent: z.coerce
      .number()
      .min(0)
      .max(STAR_AIR_RESISTANCE_PERCENT_MAX)
      .default(100),
    terminalVelocity: z.coerce
      .number()
      .min(0)
      .max(STAR_TERMINAL_VELOCITY_MAX)
      .default(STAR_TERMINAL_VELOCITY_MAX),
    flairColorMode: z.enum(['bombColor', 'random', 'mixed']).default('mixed'),
  })
  .default({
    speed: [2, 4],
    gravity: [-0.24, -0.02],
    life: [0.5, 6.5],
    airResistancePercent: 100,
    terminalVelocity: STAR_TERMINAL_VELOCITY_MAX,
    flairColorMode: 'mixed',
  });

export const StarHeadOpeningSchema = z
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

export const StarHeadClosingSchema = z
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

export const StarHeadSchema = z
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

export const StarColourPatternSchema = z
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

export const StarLayerSchema = z
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
      airResistancePercent: 100,
      terminalVelocity: STAR_TERMINAL_VELOCITY_MAX,
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
