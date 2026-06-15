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
  MIN_WHITE_CORE_BLUR_PERCENT,
  MIN_WHITE_CORE_SIZE_PERCENT,
} from './render-tuning';

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
} as const;

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

export const BURST_TRAIL_MAX_STOPS = 5;
export const BURST_TRAIL_PARTICLES_PER_STAR_MAX = 2000;
export const BURST_TRAIL_FLICKER_LIFE_MAX = 0.5;

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
        front: z.coerce.number().min(0).max(12).default(1.4),
        tail: z.coerce.number().min(0).max(12).default(1.4),
        curve: z.coerce.number().min(0.2).max(4).default(1),
      })
      .default({ front: 1.4, tail: 1.4, curve: 1 }),
    lifetime: z
      .object({
        baseSeconds: z.coerce.number().min(0.05).max(8).default(0.9),
        variationPercent: z.coerce.number().min(0).max(100).default(30),
        afterglowSeconds: z.coerce.number().min(0).max(6).default(0.35),
      })
      .default({ baseSeconds: 0.9, variationPercent: 30, afterglowSeconds: 0.35 }),
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
        spin: z.coerce.number().min(0).max(8).default(1.2),
      })
      .default({
        gravity: -0.014,
        drag: 1.6,
        inheritedVelocity: 0.02,
        turbulence: 0.04,
        driftX: 0,
        driftY: -0.012,
        driftZ: 0,
        spin: 1.2,
      }),
    stops: z.array(BurstTrailStopSchema).max(BURST_TRAIL_MAX_STOPS).default([]),
  })
  .default({
    version: 2,
    enabled: true,
    preset: 'sparkDust',
    colourMode: 'gold',
    particlesPerStar: 24,
    frontClump: 0.45,
    width: { front: 1.4, tail: 1.4, curve: 1 },
    lifetime: { baseSeconds: 0.9, variationPercent: 30, afterglowSeconds: 0.35 },
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
      spin: 1.2,
    },
    stops: [],
  });

export const FireworkDesignSchema = z.object({
  size: z.coerce
    .number()
    .min(1)
    .transform((value) => Math.min(MAX_STAR_COUNT, value))
    .default(MAX_STAR_COUNT),
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
  burst: z
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
    }),
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
      boom: z.enum(['auto', 'light', 'heavy']).default('auto'),
    })
    .default({ boom: 'auto' }),
  pistil: z
    .object({
      enabled: z.boolean().default(false),
      color: ColorSchema.optional(),
      sizeRatio: z.coerce.number().min(0.1).max(0.9).default(0.38),
      speedRatio: z.coerce.number().min(0.1).max(0.9).default(0.48),
    })
    .default({ enabled: false, sizeRatio: 0.38, speedRatio: 0.48 }),
  strobe: z
    .object({
      enabled: z.boolean().default(false),
      frequencyHz: z.coerce.number().min(2).max(28).default(12),
      dutyCycle: z.coerce.number().min(0.1).max(0.9).default(0.45),
    })
    .default({ enabled: false, frequencyHz: 12, dutyCycle: 0.45 }),
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
    })
    .default({ enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 }),
  mortar: z
    .object({
      smokeParticles: z.coerce.number().int().min(0).max(500).default(100),
      sound: z.boolean().default(true),
    })
    .default({ smokeParticles: 100, sound: true }),
  /**
   * Generalised star calibration shared by every non-brocade effect.
   *
   * `heads.enabled` is the switch for visible burst star heads. Enabled
   * stars render as glowing orbs; disabled heads still leave hidden carrier
   * paths when trails are enabled.
   * `trail` selects between no trail, loose spark dust, and brocade-style
   * distance-emitted streak squares. All values are admin-tunable through
   * the shared physics panel on the admin effects page.
   */
  stars: z
    .object({
      heads: z
        .object({
          enabled: z.boolean().default(false),
          /** Size budget of each glowing star orb. */
          size: z.coerce.number().min(10).max(1000).default(260),
          /** Halo brightness multiplier, same encoding as brocade heads. */
          glowStrength: z.coerce.number().min(0).max(3).default(0.7),
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
          glowSize: z.coerce
            .number()
            .min(MIN_GLOW_SIZE)
            .max(MAX_GLOW_SIZE)
            .default(DEFAULT_GLOW_SIZE),
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
          /** Large coloured background glow strength, 0-100%. */
          glowBlur: z.coerce
            .number()
            .min(MIN_GLOW_BLUR)
            .max(MAX_GLOW_BLUR)
            .default(DEFAULT_GLOW_BLUR),
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
        })
        .default({ enabled: false, size: 260, glowStrength: 0.7, ...HEAD_APPEARANCE_DEFAULTS }),
      trail: z
        .object({
          mode: z.enum(STAR_TRAIL_MODES).default('spark'),
          /** Arc-length spacing (world units) between streak emissions. */
          step: z.coerce.number().min(1).max(10).default(3.2),
          /** Radius (world units) of the tube streak squares scatter within. */
          tubeRadius: z.coerce.number().min(0.3).max(12).default(1.6),
          /** Size multiplier for each streak square. */
          squareSize: z.coerce.number().min(0.3).max(4).default(0.8),
          /** Base life of each streak square, in seconds. */
          lifeSeconds: z.coerce.number().min(0.1).max(4).default(0.9),
          colorMode: z.enum(STAR_TRAIL_COLOR_MODES).default('gold'),
          /** Probability a streak square pops white-hot (glitter twinkle). */
          flicker: z.coerce.number().min(0).max(1).default(0),
        })
        .default({
          mode: 'spark',
          step: 3.2,
          tubeRadius: 1.6,
          squareSize: 0.8,
          lifeSeconds: 0.9,
          colorMode: 'gold',
          flicker: 0,
        }),
    })
    .default({
      heads: { enabled: false, size: 260, glowStrength: 0.7, ...HEAD_APPEARANCE_DEFAULTS },
      trail: {
        mode: 'spark',
        step: 3.2,
        tubeRadius: 1.6,
        squareSize: 0.8,
        lifeSeconds: 0.9,
        colorMode: 'gold',
        flicker: 0,
      },
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
      streakCount: z.coerce.number().int().min(8).max(64).optional(),
      /** Arc-length spacing (world units) between trail square emissions. */
      trailStep: z.coerce.number().min(1).max(10).default(3),
      /** Radius (world units) of the tube trail squares scatter within. */
      tubeRadius: z.coerce.number().min(0.5).max(12).default(3.2),
      /** Render the glowing head orbs. Off leaves the trails as bare streaks. */
      headsEnabled: z.boolean().default(true),
      /** Size budget of each glowing head orb. */
      headSize: z.coerce.number().min(100).max(4000).default(900),
      /** Halo brightness multiplier; also drives scene light tinting. */
      glowStrength: z.coerce.number().min(0).max(3).default(1),
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
      glowStrength: 1,
      greenRatio: 0.5,
      headColors: { green: { r: 0.4, g: 1, b: 0.5 }, red: { r: 1, g: 0.28, b: 0.32 } },
      palette: { hot: { r: 1, g: 0.93, b: 0.72 }, ember: { r: 1, g: 0.42, b: 0.14 } },
    }),
});

export type FireworkDesign = z.infer<typeof FireworkDesignSchema>;

const DEFAULT_TRAIL_STREAK = { streakSize: 1, streakLength: 1, streakLife: 1 };

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    lifetime: { baseSeconds: 0.4, variationPercent: 20, afterglowSeconds: 0 },
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
    particlesPerStar: 24,
    frontClump: 0.35,
    width: { front: 1.1, tail: 2.1, curve: 1.15 },
    lifetime: { baseSeconds: 0.82, variationPercent: 55, afterglowSeconds: 0.3 },
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
      spin: 2.2,
    },
    stops: [
      burstTrailStop(0, 1.05, 0.74, 55, { circle: 76, square: 16, triangle: 8 }),
      burstTrailStop(55, 0.55, 0.55, 60, { circle: 82, square: 12, triangle: 6 }),
      burstTrailStop(100, 0.16, 0.32, 70, { circle: 90, square: 8, triangle: 2 }),
    ],
  },
  solidStreaks: {
    version: 2,
    enabled: true,
    preset: 'solidStreaks',
    colourMode: 'gold',
    particlesPerStar: 84,
    frontClump: 0.55,
    width: { front: 1.35, tail: 1.35, curve: 1 },
    lifetime: { baseSeconds: 1, variationPercent: 28, afterglowSeconds: 0.45 },
    intensity: { brightness: 1, fadeSoftness: 1 },
    flicker: { chance: 0.08, strength: 0.9, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.014,
      drag: 1.6,
      inheritedVelocity: 0.02,
      turbulence: 0.045,
      driftX: 0,
      driftY: -0.012,
      driftZ: 0,
      spin: 1.3,
    },
    stops: [
      burstTrailStop(0, 1.45, 1, 28, { circle: 4, square: 88, triangle: 8 }),
      burstTrailStop(32, 1.1, 0.86, 30, { circle: 5, square: 86, triangle: 9 }),
      burstTrailStop(100, 0.32, 0.48, 34, { circle: 8, square: 84, triangle: 8 }),
    ],
  },
  willowHang: {
    version: 2,
    enabled: true,
    preset: 'willowHang',
    colourMode: 'gold',
    particlesPerStar: 72,
    frontClump: 0.46,
    width: { front: 1.15, tail: 2.2, curve: 1.6 },
    lifetime: { baseSeconds: 2.25, variationPercent: 34, afterglowSeconds: 1.15 },
    intensity: { brightness: 0.9, fadeSoftness: 1.8 },
    flicker: { chance: 0.06, strength: 0.55, lifetimeMultiplier: 0.5 },
    motion: {
      gravity: -0.12,
      drag: 0.85,
      inheritedVelocity: 0.015,
      turbulence: 0.06,
      driftX: 0,
      driftY: -0.08,
      driftZ: 0,
      spin: 0.7,
    },
    stops: [
      burstTrailStop(0, 1.2, 0.86, 30, { circle: 8, square: 84, triangle: 8 }),
      burstTrailStop(48, 0.88, 0.72, 36, { circle: 12, square: 78, triangle: 10 }),
      burstTrailStop(100, 0.28, 0.38, 42, { circle: 22, square: 68, triangle: 10 }),
    ],
  },
  cometTail: {
    version: 2,
    enabled: true,
    preset: 'cometTail',
    colourMode: 'starFade',
    particlesPerStar: 96,
    frontClump: 0.68,
    width: { front: 2.6, tail: 0.8, curve: 0.72 },
    lifetime: { baseSeconds: 1.25, variationPercent: 24, afterglowSeconds: 0.55 },
    intensity: { brightness: 1.15, fadeSoftness: 0.9 },
    flicker: { chance: 0.04, strength: 0.65, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.028,
      drag: 1.3,
      inheritedVelocity: 0.04,
      turbulence: 0.05,
      driftX: 0,
      driftY: -0.018,
      driftZ: 0,
      spin: 1.1,
    },
    stops: [
      burstTrailStop(0, 1.65, 1.28, 20, { circle: 6, square: 84, triangle: 10 }),
      burstTrailStop(42, 0.92, 0.86, 24, { circle: 8, square: 80, triangle: 12 }),
      burstTrailStop(100, 0.22, 0.42, 32, { circle: 18, square: 72, triangle: 10 }),
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
    lifetime: { baseSeconds: 1.45, variationPercent: 22, afterglowSeconds: 0.8 },
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
      spin: 1.4,
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
    colourMode: 'gold',
    particlesPerStar: 84,
    frontClump: 0.55,
    width: { front: 1.35, tail: 1.35, curve: 1 },
    lifetime: { baseSeconds: 1, variationPercent: 28, afterglowSeconds: 0.45 },
    intensity: { brightness: 1, fadeSoftness: 1 },
    flicker: { chance: 0.08, strength: 0.9, lifetimeMultiplier: 0.45 },
    motion: {
      gravity: -0.014,
      drag: 1.6,
      inheritedVelocity: 0.02,
      turbulence: 0.045,
      driftX: 0,
      driftY: -0.012,
      driftZ: 0,
      spin: 1.3,
    },
    stops: [
      burstTrailStop(0, 1.45, 1, 28, { circle: 4, square: 88, triangle: 8 }),
      burstTrailStop(32, 1.1, 0.86, 30, { circle: 5, square: 86, triangle: 9 }),
      burstTrailStop(100, 0.32, 0.48, 34, { circle: 8, square: 84, triangle: 8 }),
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

export function applyBurstTrailFrontClump(trail: BurstTrail, frontClump: number): BurstTrail {
  const clump = Math.min(1, Math.max(0, frontClump));
  const frontDensity = round2(0.65 + clump * 1.55);
  const middleDensity = round2(0.45 + (1 - Math.abs(clump - 0.5) * 2) * 0.55);
  const tailDensity = round2(0.52 - clump * 0.42);
  const stops = normaliseBurstTrailStops(trail.stops);
  const nextStops =
    stops.length >= 3
      ? stops.map((stop, index) => {
          if (index === 0) return { ...stop, density: frontDensity };
          if (index === stops.length - 1) return { ...stop, density: Math.max(0, tailDensity) };
          return { ...stop, density: middleDensity };
        })
      : [
          { ...stops[0], position: 0, density: frontDensity },
          burstTrailStop(45, middleDensity, stops[0]?.size ?? 0.85, stops[0]?.sizeVariation ?? 28, {
            ...(stops[0]?.shapeWeights ?? { circle: 4, square: 88, triangle: 8 }),
          }),
          {
            ...(stops[1] ?? stops[0]),
            position: 100,
            density: Math.max(0, tailDensity),
          },
        ];
  return { ...trail, frontClump: round2(clump), stops: normaliseBurstTrailStops(nextStops) };
}

function normaliseFireworkDesign(design: FireworkDesign): FireworkDesign {
  const presetDefaults = makeBurstTrailPreset(design.burstTrail.preset);
  const merged = deepMergeDesign(presetDefaults, design.burstTrail) as BurstTrail;
  return {
    ...design,
    burstTrail: {
      ...merged,
      version: 2,
      stops: normaliseBurstTrailStops(
        merged.stops.length > 0 ? merged.stops : presetDefaults.stops,
      ),
    },
  };
}

export const DEFAULT_DESIGN: FireworkDesign = normaliseFireworkDesign(
  FireworkDesignSchema.parse({}),
);

export function safeParseFireworkDesign(input: unknown): FireworkDesign {
  const parsed = FireworkDesignSchema.safeParse(input);
  return parsed.success ? normaliseFireworkDesign(parsed.data) : DEFAULT_DESIGN;
}

const FIREWORK_RENDER_DEFAULT_KEYS = new Set([
  'size',
  'color',
  'secondaryColor',
  'secondaryColorRatio',
  'liftVelocity',
  'shellLife',
  'pattern',
  'geometry',
  'trailProfile',
  'burstTrail',
  'burst',
  'flair',
  'crackle',
  'sound',
  'pistil',
  'strobe',
  'trail',
  'split',
  'mortar',
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
      return 'wave';
    default:
      return 'fibonacci';
  }
}

function shellTypeToGeometry(shellType: string | undefined): FireworkGeometry {
  switch (shellType) {
    case 'brocade':
      return 'crown';
    case 'palm':
      return 'radial_arms';
    case 'ring':
      return 'ring';
    case 'crossette':
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
    case 'pistil':
      return 'pistil';
    case 'silverFish':
      return 'fish';
    case 'waterfall':
      return 'waterfall';
    case 'whirl':
      return 'whirl';
    default:
      return 'sphere';
  }
}

function glitterToTrailProfile(
  glitter: unknown,
  shellType: string | undefined,
): FireworkTrailProfile {
  if (shellType === 'strobe' || shellType === 'ghost') return 'blink';
  if (shellType === 'crossette') return 'fragmenting';
  if (shellType === 'crackle') return 'crackle';
  if (shellType === 'brocade') return 'glitter';
  if (shellType === 'pearls') return 'pearls';
  if (shellType === 'silverFish') return 'fish';
  if (shellType === 'waterfall') return 'waterfall';
  if (shellType === 'whirl') return 'whirl';
  if (shellType === 'willow' || shellType === 'fallingLeaves' || shellType === 'horsetail') {
    return 'long_hang';
  }
  if (shellType === 'palm' || shellType === 'comet' || shellType === 'tail') return 'thick_tail';

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
  heads: {
    enabled: boolean;
    size: number;
    glowStrength: number;
    glowPadding: number;
    whiteCoreSizePercent: number;
    whiteCoreBlurPercent: number;
    coreSoftness: number;
    coreBrightness: number;
    coreOpacityFalloff: number;
    glowSize: number;
    glowSoftness: number;
    glowOpacityFalloff: number;
    glowBlur: number;
    backgroundGlowOpacityFalloff: number;
    backgroundGlowSoftness: number;
  };
  trail: {
    mode: StarTrailMode;
    step: number;
    tubeRadius: number;
    squareSize: number;
    lifeSeconds: number;
    colorMode: StarTrailColorMode;
    flicker: number;
  };
};

function starsBlock(
  heads: [size: number, glow: number] | null,
  trail?: Partial<StarsLike['trail']>,
): StarsLike {
  return {
    heads: heads
      ? { enabled: true, size: heads[0], glowStrength: heads[1], ...HEAD_APPEARANCE_DEFAULTS }
      : { enabled: false, size: 260, glowStrength: 0.7, ...HEAD_APPEARANCE_DEFAULTS },
    trail: {
      mode: 'none',
      step: 3.2,
      tubeRadius: 1.6,
      squareSize: 0.8,
      lifeSeconds: 0.9,
      colorMode: 'gold',
      flicker: 0,
      ...trail,
    },
  };
}

/**
 * Realistic per-shell-type star treatment for legacy catalogue specs: which
 * shells read as glowing orbs, and which lay brocade-style streak trails.
 */
function shellTypeToStars(shellType: string | undefined): StarsLike {
  switch (shellType) {
    case 'peony':
      return starsBlock([220, 0.55]);
    case 'crysanthemum':
    case 'chrysanthemum':
      return starsBlock([240, 0.7], {
        mode: 'streak',
        step: 3,
        squareSize: 0.7,
        lifeSeconds: 0.9,
        flicker: 0.12,
      });
    case 'willow':
    case 'fallingLeaves':
      return starsBlock([190, 0.45], {
        mode: 'streak',
        step: 2.6,
        tubeRadius: 1.5,
        squareSize: 0.65,
        lifeSeconds: 2.3,
        flicker: 0.06,
      });
    case 'horsetail':
      return starsBlock([340, 0.8], {
        mode: 'streak',
        step: 2.2,
        tubeRadius: 2.4,
        squareSize: 0.9,
        lifeSeconds: 1.8,
        flicker: 0.05,
      });
    case 'palm':
      return starsBlock([620, 1.1], {
        mode: 'streak',
        step: 2.4,
        tubeRadius: 3.4,
        squareSize: 1.15,
        lifeSeconds: 1.2,
      });
    case 'ring':
      return starsBlock([260, 0.85]);
    case 'pearls':
      return starsBlock([430, 1]);
    case 'strobe':
    case 'ghost':
      return starsBlock([240, 0.9]);
    case 'crossette':
      return starsBlock([320, 0.8], {
        mode: 'streak',
        step: 2.8,
        squareSize: 0.75,
        lifeSeconds: 0.7,
        colorMode: 'starFade',
      });
    case 'comet':
    case 'tail':
      return starsBlock([900, 1.2], {
        mode: 'streak',
        step: 2,
        tubeRadius: 3,
        squareSize: 1.1,
        lifeSeconds: 1.3,
      });
    case 'mine':
      return starsBlock([200, 0.65], {
        mode: 'streak',
        step: 2.8,
        squareSize: 0.6,
        lifeSeconds: 0.5,
        colorMode: 'starFade',
      });
    case 'pistil':
    case 'floral':
      return starsBlock([230, 0.7], {
        mode: 'streak',
        step: 3.2,
        tubeRadius: 1.4,
        squareSize: 0.65,
        lifeSeconds: 0.7,
        colorMode: 'star',
      });
    case 'silverFish':
      return starsBlock([170, 0.7], {
        mode: 'streak',
        step: 2.4,
        tubeRadius: 1,
        squareSize: 0.55,
        lifeSeconds: 0.5,
        colorMode: 'silver',
      });
    case 'waterfall':
      return starsBlock([200, 0.55], {
        mode: 'streak',
        step: 2,
        squareSize: 0.7,
        lifeSeconds: 2.6,
        colorMode: 'silver',
      });
    case 'whirl':
      return starsBlock([220, 0.9], {
        mode: 'streak',
        step: 2.6,
        tubeRadius: 1.2,
        squareSize: 0.6,
        lifeSeconds: 0.7,
        colorMode: 'silver',
      });
    case 'crackle':
      return starsBlock([120, 0.6]);
    default:
      return starsBlock(null, { mode: 'spark' });
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
  const pistilColor =
    typeof spec.pistilColor === 'string' ? hexToRendererColor(spec.pistilColor) : secondaryColor;
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
    pistil: {
      enabled: spec.pistil === true || geometry === 'pistil',
      ...(pistilColor == null ? {} : { color: pistilColor }),
      sizeRatio: 0.34,
      speedRatio: 0.48,
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
    sound: { boom: size != null && size > 240 ? 'heavy' : 'auto' },
    mortar: { sound: true, smokeParticles: size != null && size > 240 ? 130 : 100 },
  };
}

export function compileFireworkDesign(params: {
  baseModel?: unknown;
  variantOverrides?: unknown;
  primaryColor?: string | null;
  colorPalette?: string[] | null;
  legacySpec?: unknown;
}): FireworkDesign {
  const legacyDesignLike = isRecord(params.legacySpec)
    ? (fireworkSpecToDesignLike(params.legacySpec) ?? params.legacySpec)
    : params.legacySpec;
  const baseDefaults = extractBaseDefaults(params.baseModel);
  const legacyOrDefault = legacyDesignLike ?? DEFAULT_DESIGN;
  let withBase = deepMergeDesign(legacyOrDefault, baseDefaults);
  // Blink-type shells (strobe, ghost) strobe by default. Express that through
  // strobe.enabled — the field the editor's Strobe toggle controls — and gate
  // the runtime blink on strobe.enabled alone (see Effects.starBehaviour). This
  // way turning the toggle off, which merges strobe.enabled: false below, truly
  // stops the flicker instead of the blink trail profile forcing it back on.
  if (isRecord(withBase) && withBase.trailProfile === 'blink') {
    const strobeRecord = isRecord(withBase.strobe) ? withBase.strobe : {};
    withBase = { ...withBase, strobe: { ...strobeRecord, enabled: true } };
  }
  const withVariant = deepMergeDesign(withBase, params.variantOverrides);
  const compiled = isRecord(withVariant) ? { ...withVariant } : {};

  if (!isRecord(compiled.trail) && typeof compiled.trailProfile === 'string') {
    compiled.trail = trailProfileToSettings(compiled.trailProfile as FireworkTrailProfile);
  }

  const legacyBurstTrail = inferBurstTrailFromLegacy(compiled);
  compiled.burstTrail = isRecord(compiled.burstTrail)
    ? deepMergeDesign(legacyBurstTrail, compiled.burstTrail)
    : legacyBurstTrail;

  const explicitColor = params.primaryColor
    ? hexToRendererColor(params.primaryColor)
    : params.colorPalette?.[0]
      ? hexToRendererColor(params.colorPalette[0])
      : null;
  if (explicitColor) {
    compiled.color = explicitColor;
  }
  if (params.colorPalette?.[1]) {
    const secondaryColor = hexToRendererColor(params.colorPalette[1]);
    if (secondaryColor) compiled.secondaryColor = secondaryColor;
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
  return {
    ...design,
    size: Math.round(Math.max(1, Math.min(MAX_STAR_COUNT, design.size * scale))),
    burst: {
      ...design.burst,
      speed: [design.burst.speed[0] * scale, design.burst.speed[1] * scale],
    },
  };
}

/**
 * Estimate how long a single shell takes from launch to the last particle
 * fading, in seconds. Mirrors the particle physics in `Particle.update`
 * (quadratic drag, gravity, shell mass 0.5) closely enough for preview
 * timelines; it does not need to be frame-exact.
 */
export function estimateDesignDurationSeconds(design: FireworkDesign): number {
  const liftVelocity = design.liftVelocity ?? 11 + Math.min(design.size / 40, 6);
  const dragK = 0.5 * 0.47 * 1.22 * (Math.PI / 10000);
  const shellMass = 0.5;
  const dt = 1 / 60;
  let vy = liftVelocity * 0.96;
  let liftTime = 0;
  while (vy > 0 && liftTime < design.shellLife) {
    vy += ((-dragK * vy * Math.abs(vy)) / shellMass) * dt;
    vy += -9.82 * dt;
    liftTime += dt;
  }

  const burstLife = Math.max(design.burst.life[0], design.burst.life[1]);
  const longHangGeometry =
    design.geometry === 'weeping' ||
    design.geometry === 'falling_tail' ||
    design.geometry === 'waterfall';
  const starLifeMultiplier = longHangGeometry ? 1.6 : 1;
  // Flair/trail particles spawned near a star's death linger a little longer.
  const trailTail = Math.max(1, 1.25 * design.trail.length);
  // Streak trails melt away shortly after their head dies; give the timeline
  // room for the last squares' staggered fade.
  const streakTail =
    design.burstTrail.enabled && design.burstTrail.particlesPerStar > 0
      ? (design.burstTrail.lifetime.baseSeconds + design.burstTrail.lifetime.afterglowSeconds) * 1.1
      : 0;
  return liftTime + burstLife * starLifeMultiplier + Math.max(trailTail, streakTail);
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
