import { z } from 'zod';
import {
  BURST_TRAIL_FADE_MODES,
  BURST_TRAIL_FLICKER_LIFE_MAX,
  BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX,
  BURST_TRAIL_MAX_STOPS,
  BURST_TRAIL_PARTICLES_PER_STAR_MAX,
  BURST_TRAIL_PRESETS,
  DEFAULT_TRAIL_CLOSING_COLOUR,
  RgbSchema,
  round2,
  STAR_TRAIL_COLOR_MODES,
  TRAIL_CLOSING_DEFAULTS,
  TRAIL_OPENING_DEFAULTS,
} from './fields.ts';

export const BurstTrailShapeWeightsSchema = z
  .object({
    circle: z.coerce.number().min(0).max(100).default(0),
    square: z.coerce.number().min(0).max(100).default(100),
    triangle: z.coerce.number().min(0).max(100).default(0),
  })
  .default({ circle: 0, square: 100, triangle: 0 });

export const BurstTrailStopSchema = z.object({
  position: z.coerce.number().min(0).max(100),
  density: z.coerce.number().min(0).max(4).default(1),
  size: z.coerce.number().min(0.08).max(24).default(1),
  sizeVariation: z.coerce.number().min(0).max(100).default(25),
  shapeWeights: BurstTrailShapeWeightsSchema,
});

export const TrailOpeningSchema = z
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

export const TrailClosingSchema = z
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

export const BurstTrailSchema = z
  .object({
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
