import { z } from "zod";

export const FireworkEffectVersion = 2 as const;

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a full hex colour such as #FFD36A.");

export const Vec3Schema = z.object({
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  z: z.number().finite().default(0),
});

export const RotationSchema = z.object({
  pan: z.number().finite().default(0),
  tilt: z.number().finite().default(90),
  roll: z.number().finite().default(0),
  quaternion: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      z: z.number().finite(),
      w: z.number().finite(),
    })
    .optional(),
});

export const ProductDimensionsSchema = z.object({
  lengthMeters: z.number().nonnegative().optional(),
  widthMeters: z.number().nonnegative().optional(),
  heightMeters: z.number().nonnegative().optional(),
  weightKg: z.number().nonnegative().optional(),
});

export const MediaReferenceSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["image", "video", "datasheet", "audio", "external"]),
  url: z.string().url().optional(),
  storagePath: z.string().optional(),
  mimeType: z.string().optional(),
  label: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const RenderProfileSchema = z.object({
  quality: z.enum(["low", "medium", "high", "ultra"]).default("high"),
  maxParticles: z.number().int().positive().default(120_000),
  maxTrailSegments: z.number().int().nonnegative().default(300_000),
  useGPUShaders: z.boolean().default(true),
  useBloom: z.boolean().default(true),
  useHDR: z.boolean().default(true),
  useSmoke: z.boolean().default(true),
  usePostFX: z.boolean().default(true),
  pixelRatioLimit: z.number().positive().default(2),
  lodDistanceScale: z.number().positive().default(1),
  deterministic: z.boolean().default(true),
  debugMode: z.boolean().default(false),
});

export const ColorStopSchema = z.object({
  t: z.number().min(0).max(1),
  color: HexColorSchema,
  alpha: z.number().min(0).max(1).default(1),
});

export const DistributionSpecSchema = z.object({
  type: z.enum(["sphere", "shell", "ring", "disc", "cone", "fan", "line", "custom"]),
  radius: z.number().nonnegative().default(1),
  thickness: z.number().nonnegative().default(0.2),
  verticalBias: z.number().finite().default(0),
  horizontalBias: z.number().finite().default(0),
  angleStart: z.number().finite().optional(),
  angleEnd: z.number().finite().optional(),
  polarMin: z.number().finite().optional(),
  polarMax: z.number().finite().optional(),
  noiseAmount: z.number().nonnegative().default(0),
  symmetry: z.number().int().min(0).default(0),
  customPoints: z.array(Vec3Schema).optional(),
});

export const VelocitySpecSchema = z.object({
  speedMin: z.number().finite().default(10),
  speedMax: z.number().finite().default(22),
  radialSpeed: z.number().finite().default(1),
  tangentialSpeed: z.number().finite().default(0),
  upwardBias: z.number().finite().default(0),
  downwardBias: z.number().finite().default(0),
  inheritedLaunchVelocity: z.number().min(0).max(1).default(0),
  turbulence: z.number().nonnegative().default(0),
  curl: z.number().finite().default(0),
  drag: z.number().min(0).max(1).default(0.86),
  gravity: z.number().finite().default(-9.8),
  windScale: z.number().finite().default(0),
});

export const LifetimeSpecSchema = z.object({
  min: z.number().positive().default(1),
  max: z.number().positive().default(2),
  fadeIn: z.number().min(0).default(0.02),
  fadeOut: z.number().min(0).default(0.6),
  random: z.number().min(0).max(1).default(0.15),
});

export const AppearanceSpecSchema = z.object({
  texture: z
    .enum(["soft_disc", "spark_core", "star_sprite", "smoke_puff", "streak", "custom"])
    .default("spark_core"),
  sizeStart: z.number().nonnegative().default(8),
  sizeEnd: z.number().nonnegative().default(1),
  sizeRandomness: z.number().min(0).max(1).default(0.2),
  sizeAttenuation: z.boolean().default(true),
    colorGradient: z.array(ColorStopSchema).min(1).default([
    { t: 0, color: "#FFFFFF", alpha: 1 },
    { t: 1, color: "#FFD36A", alpha: 0 },
  ]),
  emissiveIntensity: z.number().nonnegative().default(2.5),
  alphaCurve: z
    .enum(["linear", "ease_out", "spark_flicker", "strobe", "glitter_decay", "custom"])
    .default("ease_out"),
  temperatureShift: z.number().finite().default(0),
  twinkleFrequency: z.number().nonnegative().default(0),
  twinkleAmount: z.number().min(0).max(1).default(0),
  strobeFrequency: z.number().nonnegative().default(0),
  strobeDutyCycle: z.number().min(0).max(1).default(0.5),
  sparkleNoise: z.number().min(0).max(1).default(0),
});

export const TrailSpecSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(["ribbon", "afterimage", "spark_spawn", "geometry_line"]).default("afterimage"),
  lengthSeconds: z.number().min(0).default(0),
  segmentCount: z.number().int().min(0).default(0),
  widthStart: z.number().nonnegative().default(2),
  widthEnd: z.number().nonnegative().default(0),
  alphaDecay: z.number().min(0).max(1).default(0.75),
  colorInheritsParticle: z.boolean().default(true),
  glitter: z.number().min(0).max(1).default(0),
  fragmentation: z.number().min(0).max(1).default(0),
});

export const ParticleEventsSpecSchema = z.object({
  crossetteSplit: z.boolean().default(false),
  crackleBursts: z.number().int().min(0).default(0),
  secondaryBurstProbability: z.number().min(0).max(1).default(0),
  splitTime: z.number().min(0).optional(),
  splitCount: z.number().int().min(0).default(0),
  childParticleCount: z.number().int().min(0).default(0),
});

export const BlendingSpecSchema = z.object({
  mode: z.enum(["additive", "normal_transparent", "premultiplied", "screen_like"]).default("additive"),
  depthWrite: z.boolean().default(false),
  depthTest: z.boolean().default(true),
  renderOrder: z.number().finite().default(20),
});

export const LodSpecSchema = z.object({
  minQuality: z.enum(["low", "medium", "high", "ultra"]).default("low"),
  maxDistance: z.number().positive().default(10_000),
  particleBudgetWeight: z.number().positive().default(1),
});

export const ParticleLayerSpecSchema = z.object({
  id: z.string().trim().min(1),
  enabled: z.boolean().default(true),
  role: z.enum([
    "primary_stars",
    "secondary_stars",
    "micro_sparks",
    "trail_sparks",
    "glitter",
    "strobe",
    "crackle",
    "smoke",
    "flash",
    "falling_leaves",
    "comets",
    "embers",
  ]),
  particleCount: z.number().int().min(0).default(120),
  spawnMode: z.enum(["instant", "burst_over_time", "continuous"]).default("instant"),
  spawnDelaySeconds: z.number().min(0).default(0),
  spawnDurationSeconds: z.number().min(0).default(0),
  distribution: DistributionSpecSchema,
  velocity: VelocitySpecSchema,
  lifetime: LifetimeSpecSchema,
  appearance: AppearanceSpecSchema,
  trail: TrailSpecSchema.default({
    enabled: false,
    type: "afterimage",
    lengthSeconds: 0,
    segmentCount: 0,
    widthStart: 2,
    widthEnd: 0,
    alphaDecay: 0.75,
    colorInheritsParticle: true,
    glitter: 0,
    fragmentation: 0,
  }),
  events: ParticleEventsSpecSchema.default({
    crossetteSplit: false,
    crackleBursts: 0,
    secondaryBurstProbability: 0,
    splitCount: 0,
    childParticleCount: 0,
  }),
  blending: BlendingSpecSchema.default({
    mode: "additive",
    depthWrite: false,
    depthTest: true,
    renderOrder: 20,
  }),
  lod: LodSpecSchema.default({
    minQuality: "low",
    maxDistance: 10_000,
    particleBudgetWeight: 1,
  }),
});

export const SmokeSpecSchema = z.object({
  enabled: z.boolean().default(false),
  amount: z.number().min(0).default(0),
  particleCount: z.number().int().min(0).default(0),
  color: HexColorSchema.default("#6B665D"),
  opacity: z.number().min(0).max(1).default(0.16),
  size: z.number().nonnegative().default(12),
  riseSpeed: z.number().finite().default(0.8),
  expansion: z.number().nonnegative().default(1.4),
  windScale: z.number().finite().default(0.8),
  turbulence: z.number().nonnegative().default(0.4),
  lifetime: z.number().positive().default(5),
  fadeIn: z.number().min(0).default(0.4),
  fadeOut: z.number().min(0).default(2.5),
  texture: z.enum(["smoke_puff", "soft_disc", "custom"]).default("smoke_puff"),
  depthSoftening: z.number().min(0).default(0.5),
});

export const FlashSpecSchema = z.object({
  enabled: z.boolean().default(false),
  color: HexColorSchema.default("#FFF4C8"),
  intensity: z.number().nonnegative().default(3),
  size: z.number().nonnegative().default(12),
  duration: z.number().positive().default(0.08),
  bloomMultiplier: z.number().nonnegative().default(1.5),
  lensFlare: z.record(z.string(), z.unknown()).optional(),
  shockwave: z.record(z.string(), z.unknown()).optional(),
});

export type ParticleLayerSpec = z.infer<typeof ParticleLayerSpecSchema>;

export const BreakSpecSchema: z.ZodType<{
  enabled: boolean;
  timeOffsetSeconds: number;
  burstType:
    | "peony"
    | "chrysanthemum"
    | "willow"
    | "brocade"
    | "palm"
    | "ring"
    | "double_ring"
    | "heart"
    | "smiley"
    | "crossette"
    | "crackle"
    | "strobe"
    | "glitter"
    | "falling_leaves"
    | "horsetail"
    | "fish"
    | "bees"
    | "dragon_eggs"
    | "lace"
    | "mine"
    | "comet_only"
    | "custom";
  shape:
    | "sphere"
    | "hemisphere"
    | "ring"
    | "torus"
    | "cone"
    | "fan"
    | "willow_droop"
    | "palm_fronds"
    | "heart"
    | "star"
    | "text_or_logo_future"
    | "custom_points";
  layers: ParticleLayerSpec[];
  flash?: z.infer<typeof FlashSpecSchema>;
  shockwave?: Record<string, unknown>;
  smoke?: z.infer<typeof SmokeSpecSchema>;
  subBreaks?: z.infer<typeof BreakSpecSchema>[];
  reports?: Array<Record<string, unknown>>;
  randomness?: Record<string, unknown>;
  rotation?: z.infer<typeof RotationSchema>;
  scale?: number;
  colorPhases?: Array<Record<string, unknown>>;
}> = z.lazy(() =>
  z.object({
    enabled: z.boolean().default(true),
    timeOffsetSeconds: z.number().min(0).default(1.15),
    burstType: z.enum([
      "peony",
      "chrysanthemum",
      "willow",
      "brocade",
      "palm",
      "ring",
      "double_ring",
      "heart",
      "smiley",
      "crossette",
      "crackle",
      "strobe",
      "glitter",
      "falling_leaves",
      "horsetail",
      "fish",
      "bees",
      "dragon_eggs",
      "lace",
      "mine",
      "comet_only",
      "custom",
    ]),
    shape: z.enum([
      "sphere",
      "hemisphere",
      "ring",
      "torus",
      "cone",
      "fan",
      "willow_droop",
      "palm_fronds",
      "heart",
      "star",
      "text_or_logo_future",
      "custom_points",
    ]),
    layers: z.array(ParticleLayerSpecSchema).default([]),
    flash: FlashSpecSchema.optional(),
    shockwave: z.record(z.string(), z.unknown()).optional(),
    smoke: SmokeSpecSchema.optional(),
    subBreaks: z.array(BreakSpecSchema).optional(),
    reports: z.array(z.record(z.string(), z.unknown())).optional(),
    randomness: z.record(z.string(), z.unknown()).optional(),
    rotation: RotationSchema.optional(),
    scale: z.number().positive().default(1),
    colorPhases: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
);

export const LaunchSpecSchema = z.object({
  enabled: z.boolean().default(true),
  liftTimeSeconds: z.number().positive().default(1.15),
  startPosition: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  endHeightMeters: z.number().nonnegative().default(90),
  launchVelocity: z.number().nonnegative().default(85),
  arcAmount: z.number().finite().default(0),
  gravity: z.number().finite().default(-9.8),
  drag: z.number().min(0).max(1).default(0.96),
  tracerColor: HexColorSchema.default("#FFD36A"),
  tracerSize: z.number().nonnegative().default(4),
  tracerLifetime: z.number().positive().default(0.65),
  tracerTrailLength: z.number().min(0).default(0.5),
  tracerSparkRate: z.number().nonnegative().default(28),
  tracerSparkSize: z.number().nonnegative().default(2.5),
  tracerSmokeAmount: z.number().min(0).default(0.15),
  liftFlashSize: z.number().nonnegative().default(8),
  liftFlashColor: HexColorSchema.default("#FFE8A3"),
  liftSound: z.record(z.string(), z.unknown()).optional(),
  randomWobble: z.number().min(0).default(0.04),
  windInfluence: z.number().min(0).default(0.15),
});

export const ShotSpecSchema = z.object({
  index: z.number().int().min(0),
  timeOffsetSeconds: z.number().min(0).default(0),
  launchPositionOffset: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  panDegrees: z.number().finite().default(0),
  tiltDegrees: z.number().finite().default(90),
  rollDegrees: z.number().finite().default(0),
  launchVelocity: z.number().nonnegative().optional(),
  launchHeightMeters: z.number().nonnegative().optional(),
  liftTimeSeconds: z.number().positive().optional(),
  tracer: LaunchSpecSchema.optional(),
  mineAtLaunch: BreakSpecSchema.optional(),
  breakSpec: BreakSpecSchema.optional(),
  soundCue: z.record(z.string(), z.unknown()).optional(),
  seedOffset: z.number().int().default(0),
  colorOverride: z.array(HexColorSchema).optional(),
  effectOverride: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(1).default(1),
});

export const ShotSequenceSpecSchema = z.object({
  shotCount: z.number().int().min(0).default(1),
  durationSeconds: z.number().min(0).default(0),
  cadenceMode: z.enum([
    "even",
    "custom",
    "accelerando",
    "decelerando",
    "volleys",
    "zipper",
    "randomized",
  ]),
  shots: z.array(ShotSpecSchema).default([]),
  firingPattern: z.enum([
    "STR",
    "STL",
    "STT",
    "FNR",
    "FNL",
    "FNT",
    "Z_SHAPE",
    "W_SHAPE",
    "V_SHAPE",
    "CENTER_OUT",
    "OUTSIDE_IN",
    "CUSTOM",
  ]),
  rowCount: z.number().int().min(1).default(1),
  tubesPerRow: z.number().int().min(1).default(1),
  rowSpacing: z.number().nonnegative().default(0),
  tubeSpacing: z.number().nonnegative().default(0),
  angleRangeDegrees: z.number().nonnegative().default(0),
  fanAngles: z.array(z.number().finite()).default([]),
  volleyGroups: z
    .array(
      z.object({
        id: z.string().optional(),
        shotIndexes: z.array(z.number().int().min(0)),
        timeOffsetSeconds: z.number().min(0),
      }),
    )
    .default([]),
  timingJitterSeconds: z.number().min(0).default(0),
  symmetryJitter: z.number().min(0).default(0),
  manufacturingVariation: z.number().min(0).default(0),
});

export const FireworkProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  manufacturer: z.string().nullable().optional(),
  productCode: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  subtype: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  vdlLikeDescription: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  shotCount: z.number().int().nonnegative().nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional(),
  caliber: z.string().nullable().optional(),
  heightMeters: z.number().nonnegative().nullable().optional(),
  widthMeters: z.number().nonnegative().nullable().optional(),
  safetyDistanceMeters: z.number().nonnegative().nullable().optional(),
  productDimensions: ProductDimensionsSchema.optional(),
  defaultEffectSpecId: z.string().nullable().optional(),
  mediaReferences: z.array(MediaReferenceSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AudioSpecSchema = z.object({
  events: z
    .array(
      z.object({
        timeSeconds: z.number().min(0),
        kind: z.enum(["launch", "burst", "crackle", "fade", "report", "lift"]),
        confidence: z.number().min(0).max(1).default(0.5),
      }),
    )
    .default([]),
  gain: z.number().finite().default(1),
});

export const FireworkEffectSpecV2Schema = z.object({
  id: z.string().optional(),
  version: z.literal(2),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  source: z.enum(["manual", "video_inferred", "llm_generated", "catalogue", "legacy_migrated"]),
  confidence: z.number().min(0).max(1).default(1),
  seed: z.number().int().default(1),
  type: z.enum([
    "shell",
    "cake",
    "candle",
    "mine",
    "comet",
    "single_shot",
    "rocket",
    "fountain",
    "flame",
    "combo",
    "custom",
  ]),
  globalScale: z.number().positive().default(0.045),
  durationSeconds: z.number().positive(),
  prefireSeconds: z.number().min(0).default(0),
  heightMeters: z.number().nonnegative().default(80),
  colorPalette: z.array(HexColorSchema).default(["#FFD36A"]),
  renderProfile: RenderProfileSchema.default({
    quality: "high",
    maxParticles: 120_000,
    maxTrailSegments: 300_000,
    useGPUShaders: true,
    useBloom: true,
    useHDR: true,
    useSmoke: true,
    usePostFX: true,
    pixelRatioLimit: 2,
    lodDistanceScale: 1,
    deterministic: true,
    debugMode: false,
  }),
  shotSequence: ShotSequenceSpecSchema,
  effectLayers: z.array(ParticleLayerSpecSchema).default([]),
  launch: LaunchSpecSchema.default({
    enabled: true,
    liftTimeSeconds: 1.15,
    startPosition: { x: 0, y: 0, z: 0 },
    endHeightMeters: 90,
    launchVelocity: 85,
    arcAmount: 0,
    gravity: -9.8,
    drag: 0.96,
    tracerColor: "#FFD36A",
    tracerSize: 4,
    tracerLifetime: 0.65,
    tracerTrailLength: 0.5,
    tracerSparkRate: 28,
    tracerSparkSize: 2.5,
    tracerSmokeAmount: 0.15,
    liftFlashSize: 8,
    liftFlashColor: "#FFE8A3",
    randomWobble: 0.04,
    windInfluence: 0.15,
  }),
  audio: AudioSpecSchema.default({ events: [], gain: 1 }),
  cameraHints: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const ShowCueV2Schema = z.object({
  id: z.string(),
  showId: z.string(),
  fireworkProductId: z.string().optional().nullable(),
  effectSpecId: z.string(),
  timeSeconds: z.number().min(0),
  position: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  rotation: RotationSchema.default({ pan: 0, tilt: 90, roll: 0 }),
  scale: z.number().positive().default(1),
  overrides: z.record(z.string(), z.unknown()).default({}),
  label: z.string().optional().nullable(),
  locked: z.boolean().default(false),
  track: z.string().optional().nullable(),
  layer: z.string().optional().nullable(),
  seedOverride: z.number().int().optional(),
});

export const ObservedFireworkEventSchema = z.object({
  timeSeconds: z.number().min(0),
  type: z.enum([
    "launch",
    "mine",
    "break",
    "secondary_break",
    "crackle",
    "strobe",
    "glitter",
    "smoke",
    "fade",
    "report",
    "unknown",
  ]),
  color: HexColorSchema.optional(),
  screenPosition: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
  estimatedHeight: z.number().nonnegative().optional(),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const VideoInferenceObservationSchema = z.object({
  observedEvents: z.array(ObservedFireworkEventSchema).default([]),
  inferredShotSequence: ShotSequenceSpecSchema.optional(),
  inferredEffectLayers: z.array(ParticleLayerSpecSchema).default([]),
  unknowns: z.array(z.string()).default([]),
  suggestedManualReviewFields: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  source: z
    .object({
      videoId: z.string().optional(),
      model: z.string().optional(),
      processorVersion: z.string().optional(),
      durationSeconds: z.number().nonnegative().optional(),
    })
    .default({}),
});

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Rotation = z.infer<typeof RotationSchema>;
export type RenderProfile = z.infer<typeof RenderProfileSchema>;
export type FireworkProduct = z.infer<typeof FireworkProductSchema>;
export type LaunchSpec = z.infer<typeof LaunchSpecSchema>;
export type BreakSpec = z.infer<typeof BreakSpecSchema>;
export type ShotSpec = z.infer<typeof ShotSpecSchema>;
export type ShotSequenceSpec = z.infer<typeof ShotSequenceSpecSchema>;
export type SmokeSpec = z.infer<typeof SmokeSpecSchema>;
export type FlashSpec = z.infer<typeof FlashSpecSchema>;
export type FireworkEffectSpecV2 = z.infer<typeof FireworkEffectSpecV2Schema>;
export type ShowCueV2 = z.infer<typeof ShowCueV2Schema>;
export type VideoInferenceObservation = z.infer<
  typeof VideoInferenceObservationSchema
>;

export function parseFireworkEffectSpecV2(value: unknown): FireworkEffectSpecV2 {
  return FireworkEffectSpecV2Schema.parse(value);
}

export function isFireworkEffectSpecV2(
  value: unknown,
): value is FireworkEffectSpecV2 {
  return FireworkEffectSpecV2Schema.safeParse(value).success;
}
