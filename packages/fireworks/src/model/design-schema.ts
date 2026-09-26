import { z } from 'zod';
import { isGroundGeometry } from '../behaviours.ts';
import { DEFAULT_HEAD_GLOW_STRENGTH } from '../render-tuning.ts';
import {
  ColorSchema,
  DEFAULT_STAR_HEAD_SIZE,
  DEFAULT_STAR_INNER_HEAD_SIZE,
  FIREWORK_GEOMETRIES,
  FIREWORK_PATTERNS,
  FIREWORK_TRAIL_PROFILES,
  HEAD_APPEARANCE_DEFAULTS,
  MAX_STAR_COUNT,
  DEFAULT_STAR_COUNT,
  DEFAULT_FOUNTAIN_RATE,
  STAR_HEAD_CLOSING_DEFAULTS,
  STAR_HEAD_OPENING_DEFAULTS,
  STAR_TERMINAL_VELOCITY_MAX,
  TRAIL_CLOSING_DEFAULTS,
  TRAIL_OPENING_DEFAULTS,
} from './fields.ts';
import { GeometryTuningSchema } from './geometry-schema.ts';
import { LaunchSchema } from './launch-schema.ts';
import { StarBurstSchema, StarLayerSchema } from './star-schema.ts';
import { BurstTrailSchema } from './trail-schema.ts';

export const FireworkDesignSchema = z
  .object({
    size: z.coerce
      .number()
      .min(1)
      .transform((value) => Math.min(MAX_STAR_COUNT, value))
      .default(DEFAULT_STAR_COUNT),
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
    liftVelocity: z.coerce.number().min(0).max(40).optional(),
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
        /** Chance per 60 Hz reference step while a star is inside the trigger window. */
        probability: z.coerce.number().min(0).max(1).default(0.05),
        triggerWindowSeconds: z.coerce.number().min(0.1).max(4).default(1),
        fragmentCount: z.coerce.number().int().min(1).max(200).default(48),
        fragmentCountVariationPercent: z.coerce.number().min(0).max(100).default(84),
        fragmentSize: z.coerce.number().min(1).max(120).default(24),
        fragmentSizeVariationPercent: z.coerce.number().min(0).max(100).default(90),
        fragmentSpeed: z.coerce.number().min(0).max(6).default(1.15),
        fragmentSpeedVariationPercent: z.coerce.number().min(0).max(100).default(70),
        fragmentLifeSeconds: z.coerce.number().min(0.05).max(4).default(0.7),
        fragmentLifeVariationPercent: z.coerce.number().min(0).max(100).default(86),
        fragmentGravity: z.coerce.number().min(-2).max(1).default(-0.2),
        colourMode: z.enum(['silver', 'star', 'gold']).default('silver'),
        sound: z.enum(['crackle', 'lightBoom', 'heavyBoom']).default('crackle'),
        soundChance: z.coerce.number().min(0).max(1).default(0.2),
        soundVolume: z.coerce.number().min(0).max(1).default(0.1),
      })
      .default({
        enabled: true,
        probability: 0.05,
        triggerWindowSeconds: 1,
        fragmentCount: 48,
        fragmentCountVariationPercent: 84,
        fragmentSize: 24,
        fragmentSizeVariationPercent: 90,
        fragmentSpeed: 1.15,
        fragmentSpeedVariationPercent: 70,
        fragmentLifeSeconds: 0.7,
        fragmentLifeVariationPercent: 86,
        fragmentGravity: -0.2,
        colourMode: 'silver',
        sound: 'crackle',
        soundChance: 0.2,
        soundVolume: 0.1,
      }),
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
          emissionRate: DEFAULT_FOUNTAIN_RATE,
          burst: {
            speed: [0.8, 1.8],
            gravity: [-0.22, -0.02],
            life: [0.4, 5.4],
            airResistancePercent: 100,
            terminalVelocity: STAR_TERMINAL_VELOCITY_MAX,
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
          count: DEFAULT_STAR_COUNT,
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
        }),
        core: StarLayerSchema.parse({ enabled: true }),
      }),
  })
  .superRefine((design, context) => {
    const isGroundEmitter = isGroundGeometry(design.geometry);
    if (!isGroundEmitter && design.liftVelocity !== undefined && design.liftVelocity < 4) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['liftVelocity'],
        message: 'Aerial fireworks require a lift velocity of at least 4.',
      });
    }
  });

export type FireworkDesign = z.infer<typeof FireworkDesignSchema>;

export type StarLayerKey = 'outer' | 'core';

export type FireworkStarLayer = FireworkDesign['stars'][StarLayerKey];
