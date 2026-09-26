import { z } from 'zod';
import {
  DEFAULT_HEAD_GLOW_STRENGTH,
  MAX_HEAD_GLOW_STRENGTH,
  MIN_HEAD_GLOW_STRENGTH,
} from '../render-tuning.ts';
import {
  BURST_TRAIL_FLICKER_LIFE_MAX,
  ColorSchema,
  LAUNCH_SHELL_SHAPES,
  LAUNCH_SHELL_SIZE_MIN,
  LAUNCH_SHELL_SIZE_MAX,
  DEFAULT_LAUNCH_SHELL_SIZE,
  RgbSchema,
} from './fields.ts';
import { BurstTrailShapeWeightsSchema } from './trail-schema.ts';

export type LaunchShellShape = (typeof LAUNCH_SHELL_SHAPES)[number];

export const DEFAULT_LAUNCH_SMOKE_COLOR = { r: 0.15, g: 0.15, b: 0.16 } as const;

export const LaunchShellTrailSchema = z
  .object({
    tubeDiameter: z.coerce.number().min(0).max(90).default(0),
    frontAngle: z.coerce.number().min(0).max(60).default(0),
    tailAngle: z.coerce.number().min(0).max(60).default(0),
    curve: z.coerce.number().min(0.2).max(4).default(1),
  })
  .default({ tubeDiameter: 0, frontAngle: 0, tailAngle: 0, curve: 1 });

export const LaunchShellSchema = z
  .object({
    visible: z.boolean().default(true),
    shape: z.enum(LAUNCH_SHELL_SHAPES).default('circle'),
    colour: ColorSchema.optional(),
    size: z.coerce
      .number()
      .min(LAUNCH_SHELL_SIZE_MIN)
      .max(LAUNCH_SHELL_SIZE_MAX)
      .default(DEFAULT_LAUNCH_SHELL_SIZE),
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
    size: DEFAULT_LAUNCH_SHELL_SIZE,
    brightness: 1,
    glowStrength: DEFAULT_HEAD_GLOW_STRENGTH,
    trail: { tubeDiameter: 0, frontAngle: 0, tailAngle: 0, curve: 1 },
  });

export const LaunchLiftParticlesSchema = z
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

export const LaunchSchema = z
  .object({
    shell: LaunchShellSchema,
    liftParticles: LaunchLiftParticlesSchema,
    smoke: z
      .object({
        enabled: z.boolean().default(true),
        particles: z.coerce.number().int().min(0).max(500).default(100),
        colour: RgbSchema.default(DEFAULT_LAUNCH_SMOKE_COLOR),
        opacity: z.coerce.number().min(0).max(1).default(0.72),
        size: z.coerce.number().min(4).max(220).default(86),
        sizeVariationPercent: z.coerce.number().min(0).max(100).default(48),
        lifeSeconds: z.coerce.number().min(0.2).max(12).default(3.2),
        lifeVariationPercent: z.coerce.number().min(0).max(100).default(40),
        expansionPerSecond: z.coerce.number().min(-120).max(240).default(16),
        spread: z.coerce.number().min(0).max(140).default(30),
        drift: z.coerce.number().min(0).max(4).default(1),
        windX: z.coerce.number().min(-4).max(4).default(0),
        windZ: z.coerce.number().min(-4).max(4).default(0),
        turbulence: z.coerce.number().min(0).max(4).default(0.4),
        height: z.coerce.number().min(0).max(900).default(360),
      })
      .default({
        enabled: true,
        particles: 100,
        colour: DEFAULT_LAUNCH_SMOKE_COLOR,
        opacity: 0.72,
        size: 86,
        sizeVariationPercent: 48,
        lifeSeconds: 3.2,
        lifeVariationPercent: 40,
        expansionPerSecond: 16,
        spread: 30,
        drift: 1,
        windX: 0,
        windZ: 0,
        turbulence: 0.4,
        height: 360,
      }),
  })
  .default({
    shell: {
      visible: true,
      shape: 'circle',
      size: DEFAULT_LAUNCH_SHELL_SIZE,
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
      colour: DEFAULT_LAUNCH_SMOKE_COLOR,
      opacity: 0.72,
      size: 86,
      sizeVariationPercent: 48,
      lifeSeconds: 3.2,
      lifeVariationPercent: 40,
      expansionPerSecond: 16,
      spread: 30,
      drift: 1,
      windX: 0,
      windZ: 0,
      turbulence: 0.4,
      height: 360,
    },
  });
