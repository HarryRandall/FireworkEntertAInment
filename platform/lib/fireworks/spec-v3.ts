import { z } from "zod";
import {
  FireworkEffectSpecV2Schema,
  type BreakSpec,
  type FireworkEffectSpecV2,
  type ParticleLayerSpec,
  type ShotSpec,
} from "@/lib/fireworks/spec-v2";

export const FireworkEffectVersion3 = 3 as const;

export const CodePenFireworkPalette = {
  Red: "#ff0043",
  Green: "#14fc56",
  Blue: "#1e7fff",
  Purple: "#e60aff",
  Gold: "#ffbf36",
  White: "#ffffff",
} as const;

export const CodePenFireworkColors = Object.values(CodePenFireworkPalette);
export const InvisibleFireworkColor = "_INVISIBLE_" as const;

const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a full hex colour such as #ffbf36.");

const Vec3Schema = z.object({
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  z: z.number().finite().default(0),
});

export const CodePenGlitterSchema = z.enum([
  "none",
  "light",
  "medium",
  "heavy",
  "thick",
  "streamer",
  "willow",
]);

export const FireworkEffectSpecV3Schema = z.object({
  id: z.string().optional(),
  version: z.literal(3),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  source: z.enum(["manual", "video_inferred", "llm_generated", "catalogue", "legacy_migrated"]),
  confidence: z.number().min(0).max(1).default(1),
  seed: z.number().int().default(1),
  type: z.enum(["shell", "cake", "mine", "comet", "single_shot", "combo", "custom"]).default("shell"),
  durationSeconds: z.number().positive(),
  colorPalette: z.array(HexColorSchema).min(1).default([CodePenFireworkPalette.Gold]),
  renderProfile: z
    .object({
      quality: z.enum(["low", "medium", "high", "ultra"]).default("high"),
      maxParticles: z.number().int().positive().default(120_000),
      maxTrailSegments: z.number().int().nonnegative().default(260_000),
      useSmoke: z.boolean().default(true),
      useSkyLighting: z.boolean().default(true),
      deterministic: z.boolean().default(true),
      pixelRatioLimit: z.number().positive().default(2),
    })
    .default({
      quality: "high",
      maxParticles: 120_000,
      maxTrailSegments: 260_000,
      useSmoke: true,
      useSkyLighting: true,
      deterministic: true,
      pixelRatioLimit: 2,
    }),
  shell: z.object({
    family: z.enum([
      "chrysanthemum",
      "ghost",
      "strobe",
      "palm",
      "ring",
      "crossette",
      "floral",
      "falling_leaves",
      "willow",
      "crackle",
      "horsetail",
      "peony",
      "comet",
      "mine",
      "custom",
    ]),
    size: z.number().min(0.2).max(8).default(3),
    spreadSize: z.number().positive().optional(),
    starCount: z.number().int().positive().optional(),
    starDensity: z.number().positive().default(1),
    starLifeMs: z.number().positive().optional(),
    starLifeVariation: z.number().min(0).max(2).default(0.125),
    color: z.union([HexColorSchema, z.literal("random"), z.literal(InvisibleFireworkColor), z.array(HexColorSchema).min(2).max(4)]).optional(),
    secondColor: z.union([HexColorSchema, z.literal(InvisibleFireworkColor)]).optional(),
    glitter: CodePenGlitterSchema.default("none"),
    glitterColor: HexColorSchema.optional(),
    pistil: z.boolean().default(false),
    pistilColor: HexColorSchema.optional(),
    streamers: z.boolean().default(false),
    crossette: z.boolean().default(false),
    floral: z.boolean().default(false),
    fallingLeaves: z.boolean().default(false),
    crackle: z.boolean().default(false),
    strobe: z.boolean().default(false),
    strobeColor: HexColorSchema.optional(),
    horsetail: z.boolean().default(false),
    ring: z.boolean().default(false),
    smokeAmount: z.number().min(0).max(1).default(0.28),
  }),
  launch: z.object({
    enabled: z.boolean().default(true),
    fuseTimeSeconds: z.number().min(0).default(0),
    liftTimeSeconds: z.number().positive().default(1.15),
    heightMeters: z.number().positive().default(88),
    startPosition: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
    panDegrees: z.number().finite().default(0),
    tiltDegrees: z.number().finite().default(90),
    tracerColor: HexColorSchema.default(CodePenFireworkPalette.Gold),
    sparkFrequency: z.number().positive().default(32),
    sparkLifeMs: z.number().positive().default(320),
    sparkSpeed: z.number().nonnegative().default(0.5),
    randomWobble: z.number().min(0).default(0.035),
  }).default({
    enabled: true,
    fuseTimeSeconds: 0,
    liftTimeSeconds: 1.15,
    heightMeters: 88,
    startPosition: { x: 0, y: 0, z: 0 },
    panDegrees: 0,
    tiltDegrees: 90,
    tracerColor: CodePenFireworkPalette.Gold,
    sparkFrequency: 32,
    sparkLifeMs: 320,
    sparkSpeed: 0.5,
    randomWobble: 0.035,
  }),
  shots: z
    .array(
      z.object({
        index: z.number().int().min(0),
        timeOffsetSeconds: z.number().min(0).default(0),
        position: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
        panDegrees: z.number().finite().optional(),
        tiltDegrees: z.number().finite().optional(),
        scale: z.number().positive().default(1),
        seedOffset: z.number().int().default(0),
      }),
    )
    .default([{ index: 0, timeOffsetSeconds: 0, position: { x: 0, y: 0, z: 0 }, scale: 1, seedOffset: 0 }]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type FireworkEffectSpecV3 = z.infer<typeof FireworkEffectSpecV3Schema>;
export type CodePenGlitter = z.infer<typeof CodePenGlitterSchema>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function visibleColors(spec: FireworkEffectSpecV3): string[] {
  const raw = spec.shell.color;
  if (Array.isArray(raw)) return raw;
  if (raw && raw !== "random" && raw !== InvisibleFireworkColor) return [raw];
  return spec.colorPalette.length > 0 ? spec.colorPalette : [CodePenFireworkPalette.Gold];
}

function gradient(colors: string[], secondColor?: string) {
  const primary = colors[0] ?? CodePenFireworkPalette.Gold;
  const secondary =
    secondColor && secondColor !== InvisibleFireworkColor
      ? secondColor
      : colors[1] ?? primary;
  const fade = colors[colors.length - 1] ?? primary;
  return [
    { t: 0, color: CodePenFireworkPalette.White, alpha: 1 },
    { t: 0.18, color: primary, alpha: 1 },
    { t: 0.56, color: secondary, alpha: 0.88 },
    { t: 1, color: fade, alpha: secondColor === InvisibleFireworkColor ? 0 : 0 },
  ];
}

function glitterConfig(glitter: CodePenGlitter): {
  trailLength: number;
  trailSegments: number;
  sparkleNoise: number;
  twinkleFrequency: number;
  twinkleAmount: number;
  gravity: number;
  drag: number;
} {
  switch (glitter) {
    case "light":
      return { trailLength: 0.45, trailSegments: 5, sparkleNoise: 0.2, twinkleFrequency: 18, twinkleAmount: 0.22, gravity: -8.4, drag: 0.84 };
    case "medium":
      return { trailLength: 0.75, trailSegments: 8, sparkleNoise: 0.34, twinkleFrequency: 24, twinkleAmount: 0.34, gravity: -9.8, drag: 0.82 };
    case "heavy":
      return { trailLength: 1.1, trailSegments: 11, sparkleNoise: 0.5, twinkleFrequency: 30, twinkleAmount: 0.45, gravity: -10.8, drag: 0.78 };
    case "thick":
      return { trailLength: 1.35, trailSegments: 14, sparkleNoise: 0.62, twinkleFrequency: 34, twinkleAmount: 0.5, gravity: -10.2, drag: 0.76 };
    case "streamer":
      return { trailLength: 0.9, trailSegments: 10, sparkleNoise: 0.48, twinkleFrequency: 26, twinkleAmount: 0.36, gravity: -8.6, drag: 0.8 };
    case "willow":
      return { trailLength: 1.75, trailSegments: 18, sparkleNoise: 0.38, twinkleFrequency: 20, twinkleAmount: 0.34, gravity: -15.5, drag: 0.72 };
    case "none":
      return { trailLength: 0.38, trailSegments: 4, sparkleNoise: 0.08, twinkleFrequency: 8, twinkleAmount: 0.12, gravity: -8.2, drag: 0.86 };
  }
}

function particleCountFor(spec: FireworkEffectSpecV3): number {
  if (spec.shell.starCount) return spec.shell.starCount;
  const spreadSize = spec.shell.spreadSize ?? 300 + spec.shell.size * 100;
  const codePenSurfaceCount = Math.max(6, (spreadSize / 54) ** 2 * spec.shell.starDensity);
  const qualityScale = spec.renderProfile.quality === "ultra" ? 8 : spec.renderProfile.quality === "high" ? 6 : spec.renderProfile.quality === "medium" ? 4 : 2.5;
  return Math.round(clamp(codePenSurfaceCount * qualityScale, 24, 2200));
}

function distributionFor(spec: FireworkEffectSpecV3): ParticleLayerSpec["distribution"] {
  const family = spec.shell.family;
  if (family === "ring" || spec.shell.ring) {
    return { type: "ring", radius: 1, thickness: 0.06, verticalBias: 0, horizontalBias: 0, noiseAmount: 0.01, symmetry: 64 };
  }
  if (family === "palm") {
    return { type: "shell", radius: 1, thickness: 0.16, verticalBias: 0.02, horizontalBias: 0, noiseAmount: 0.03, symmetry: 7 };
  }
  if (family === "horsetail" || spec.shell.horsetail) {
    return { type: "shell", radius: 1, thickness: 0.18, verticalBias: -0.52, horizontalBias: 0, polarMin: 68, polarMax: 180, noiseAmount: 0.08, symmetry: 0 };
  }
  if (family === "falling_leaves" || spec.shell.fallingLeaves) {
    return { type: "shell", radius: 1, thickness: 0.22, verticalBias: -0.1, horizontalBias: 0, polarMin: 20, polarMax: 155, noiseAmount: 0.16, symmetry: 0 };
  }
  if (family === "mine") {
    return { type: "fan", radius: 1, thickness: 0.2, verticalBias: 0.42, horizontalBias: 0, angleStart: -42, angleEnd: 42, noiseAmount: 0.08, symmetry: 0 };
  }
  return { type: "shell", radius: 1, thickness: 0.2, verticalBias: 0.02, horizontalBias: 0, noiseAmount: 0.07, symmetry: 0 };
}

function primaryLayer(spec: FireworkEffectSpecV3): ParticleLayerSpec {
  const colors = visibleColors(spec);
  const glitter = glitterConfig(spec.shell.glitter);
  const spreadSize = spec.shell.spreadSize ?? 300 + spec.shell.size * 100;
  const speed = spreadSize / 96;
  const starLifeSeconds = (spec.shell.starLifeMs ?? 900 + spec.shell.size * 200) / 1000;
  const family = spec.shell.family;
  const drooping = family === "willow" || family === "horsetail" || spec.shell.horsetail;
  const strobe = spec.shell.strobe || family === "strobe";
  const crackle = spec.shell.crackle || family === "crackle";
  const crossette = spec.shell.crossette || family === "crossette";

  return {
    id: `${family}-stars`,
    enabled: true,
    role: strobe ? "strobe" : crossette ? "secondary_stars" : "primary_stars",
    particleCount: particleCountFor(spec),
    spawnMode: "instant",
    spawnDelaySeconds: 0,
    spawnDurationSeconds: 0,
    distribution: distributionFor(spec),
    velocity: {
      speedMin: clamp(speed * (drooping ? 3.2 : 5.8), 3, 28),
      speedMax: clamp(speed * (drooping ? 8.5 : 12.5), 9, 48),
      radialSpeed: 1,
      tangentialSpeed: family === "palm" ? 0.04 : 0.16,
      upwardBias: drooping ? -0.05 : 0.03,
      downwardBias: drooping ? 0.24 : 0.06,
      inheritedLaunchVelocity: spec.shell.horsetail ? 0.45 : 0.035,
      turbulence: family === "ghost" || family === "falling_leaves" ? 0.14 : 0.06,
      curl: family === "floral" || family === "falling_leaves" ? 0.12 : 0.03,
      drag: drooping ? 0.72 : glitter.drag,
      gravity: drooping ? -15.2 : glitter.gravity,
      windScale: drooping ? 0.45 : 0.2,
    },
    lifetime: {
      min: Math.max(0.28, starLifeSeconds * 0.82),
      max: starLifeSeconds * (family === "ghost" ? 1.45 : 1 + spec.shell.starLifeVariation),
      fadeIn: family === "ghost" || spec.shell.color === InvisibleFireworkColor ? 0.22 : 0.02,
      fadeOut: Math.max(0.35, starLifeSeconds * 0.32),
      random: spec.shell.starLifeVariation,
    },
    appearance: {
      texture: "spark_core",
      sizeStart: family === "palm" ? 12 : clamp(5 + spec.shell.size * 1.35, 5, 18),
      sizeEnd: family === "willow" || family === "horsetail" ? 0.2 : 1,
      sizeRandomness: 0.28,
      sizeAttenuation: true,
      colorGradient: gradient(colors, spec.shell.secondColor),
      emissiveIntensity: strobe ? 4.2 : crackle ? 3.7 : 3,
      alphaCurve: strobe ? "strobe" : spec.shell.glitter === "willow" || drooping ? "glitter_decay" : "spark_flicker",
      temperatureShift: 0,
      twinkleFrequency: strobe ? 18 : glitter.twinkleFrequency,
      twinkleAmount: strobe ? 0.75 : glitter.twinkleAmount,
      strobeFrequency: strobe ? 18 : 0,
      strobeDutyCycle: strobe ? 0.34 : 0.5,
      sparkleNoise: glitter.sparkleNoise,
    },
    trail: {
      enabled: spec.shell.glitter !== "none" || drooping || spec.shell.streamers,
      type: glitter.trailLength > 0.8 || drooping ? "spark_spawn" : "afterimage",
      lengthSeconds: drooping ? Math.max(1.4, glitter.trailLength) : glitter.trailLength,
      segmentCount: drooping ? Math.max(14, glitter.trailSegments) : glitter.trailSegments,
      widthStart: family === "palm" ? 5 : 3.2,
      widthEnd: 0,
      alphaDecay: 0.78,
      colorInheritsParticle: true,
      glitter: glitter.sparkleNoise,
      fragmentation: spec.shell.streamers ? 0.22 : 0.06,
    },
    events: {
      crossetteSplit: crossette,
      crackleBursts: crackle || crossette ? Math.max(24, Math.round(particleCountFor(spec) * (crossette ? 0.14 : 0.1))) : 0,
      secondaryBurstProbability: spec.shell.floral || family === "floral" ? 0.32 : 0,
      splitTime: crackle || crossette ? starLifeSeconds * 0.62 : undefined,
      splitCount: crossette ? 4 : 0,
      childParticleCount: crossette ? 4 : crackle ? 12 : 0,
    },
    blending: {
      mode: "additive",
      depthWrite: false,
      depthTest: true,
      renderOrder: strobe ? 22 : 20,
    },
    lod: {
      minQuality: "low",
      maxDistance: 10_000,
      particleBudgetWeight: 1,
    },
  };
}

function pistilLayer(spec: FireworkEffectSpecV3): ParticleLayerSpec | null {
  if (!spec.shell.pistil) return null;
  const color = spec.shell.pistilColor ?? (spec.colorPalette[0] === CodePenFireworkPalette.Gold || spec.colorPalette[0] === CodePenFireworkPalette.White ? CodePenFireworkPalette.Red : CodePenFireworkPalette.Gold);
  const base = primaryLayer({
    ...spec,
    shell: {
      ...spec.shell,
      size: spec.shell.size * 0.5,
      starCount: Math.max(36, Math.round(particleCountFor(spec) * 0.28)),
      starLifeMs: (spec.shell.starLifeMs ?? 900 + spec.shell.size * 200) * 0.62,
      color,
      secondColor: undefined,
      glitter: "light",
      pistil: false,
    },
    colorPalette: [color],
  });
  return { ...base, id: `${spec.shell.family}-pistil`, role: "secondary_stars", velocity: { ...base.velocity, speedMin: base.velocity.speedMin * 0.52, speedMax: base.velocity.speedMax * 0.52 } };
}

function smoke(amount: number): BreakSpec["smoke"] {
  return {
    enabled: amount > 0,
    amount,
    particleCount: Math.round(90 * amount),
    color: "#6B665D",
    opacity: 0.15,
    size: 12,
    riseSpeed: 0.72,
    expansion: 1.55,
    windScale: 0.82,
    turbulence: 0.48,
    lifetime: 5.2,
    fadeIn: 0.42,
    fadeOut: 2.7,
    texture: "smoke_puff",
    depthSoftening: 0.5,
  };
}

function burstTypeFor(spec: FireworkEffectSpecV3): BreakSpec["burstType"] {
  if (spec.shell.family === "chrysanthemum") return "chrysanthemum";
  if (spec.shell.family === "falling_leaves") return "falling_leaves";
  if (spec.shell.family === "horsetail") return "horsetail";
  if (spec.shell.family === "crossette") return "crossette";
  if (spec.shell.family === "crackle") return "crackle";
  if (spec.shell.family === "strobe") return "strobe";
  if (spec.shell.family === "willow") return "willow";
  if (spec.shell.family === "palm") return "palm";
  if (spec.shell.family === "ring") return "ring";
  if (spec.shell.family === "mine") return "mine";
  return "peony";
}

function shapeFor(spec: FireworkEffectSpecV3): BreakSpec["shape"] {
  if (spec.shell.family === "ring" || spec.shell.ring) return "ring";
  if (spec.shell.family === "palm") return "palm_fronds";
  if (spec.shell.family === "willow" || spec.shell.family === "horsetail") return "willow_droop";
  if (spec.shell.family === "falling_leaves") return "hemisphere";
  if (spec.shell.family === "mine") return "fan";
  return "sphere";
}

function breakSpecFor(spec: FireworkEffectSpecV3): BreakSpec {
  const layers = [primaryLayer(spec), pistilLayer(spec)].filter(
    (layer): layer is ParticleLayerSpec => Boolean(layer),
  );
  const colors = visibleColors(spec);
  return {
    enabled: true,
    timeOffsetSeconds: spec.launch.liftTimeSeconds,
    burstType: burstTypeFor(spec),
    shape: shapeFor(spec),
    layers,
    flash: {
      enabled: spec.shell.family !== "comet",
      color: colors[0] ?? CodePenFireworkPalette.White,
      intensity: spec.shell.family === "crackle" ? 4.2 : 3.5,
      size: clamp(8 + spec.shell.size * 2, 9, 22),
      duration: 0.08,
      bloomMultiplier: 1.85,
    },
    shockwave: { enabled: true, strength: 0.08 },
    smoke: smoke(spec.renderProfile.useSmoke ? spec.shell.smokeAmount : 0),
    subBreaks: [],
    reports: [{ kind: "break", loudness: spec.shell.family === "crackle" ? 0.86 : 0.7 }],
    randomness: { sourceModel: "codepen-v3", starLifeVariation: spec.shell.starLifeVariation },
    rotation: { pan: 0, tilt: 90, roll: 0 },
    scale: 1,
    colorPhases: colors.map((color, index) => ({ t: index / Math.max(1, colors.length - 1), color })),
  };
}

export function fireworkEffectSpecV3ToV2(spec: FireworkEffectSpecV3): FireworkEffectSpecV2 {
  const mainBreak = breakSpecFor(spec);
  const shots: ShotSpec[] = spec.shots.map((shot) => ({
    index: shot.index,
    timeOffsetSeconds: shot.timeOffsetSeconds + spec.launch.fuseTimeSeconds,
    launchPositionOffset: shot.position,
    panDegrees: shot.panDegrees ?? spec.launch.panDegrees,
    tiltDegrees: shot.tiltDegrees ?? spec.launch.tiltDegrees,
    rollDegrees: 0,
    launchHeightMeters: spec.launch.heightMeters * shot.scale,
    liftTimeSeconds: spec.launch.liftTimeSeconds,
    breakSpec: {
      ...structuredClone(mainBreak),
      scale: shot.scale,
      timeOffsetSeconds: spec.launch.enabled ? spec.launch.liftTimeSeconds : 0.01,
    },
    seedOffset: shot.seedOffset,
    confidence: spec.confidence,
  }));

  return FireworkEffectSpecV2Schema.parse({
    id: spec.id,
    version: 2,
    name: spec.name,
    description: spec.description ?? null,
    source: spec.source,
    confidence: spec.confidence,
    seed: spec.seed,
    type: spec.type === "single_shot" ? "single_shot" : spec.type === "custom" ? "custom" : spec.type,
    globalScale: 0.045,
    durationSeconds: spec.durationSeconds,
    prefireSeconds: spec.launch.fuseTimeSeconds,
    heightMeters: spec.launch.heightMeters,
    colorPalette: visibleColors(spec),
    renderProfile: {
      quality: spec.renderProfile.quality,
      maxParticles: spec.renderProfile.maxParticles,
      maxTrailSegments: spec.renderProfile.maxTrailSegments,
      useGPUShaders: true,
      useBloom: true,
      useHDR: true,
      useSmoke: spec.renderProfile.useSmoke,
      usePostFX: true,
      pixelRatioLimit: spec.renderProfile.pixelRatioLimit,
      lodDistanceScale: 1,
      deterministic: spec.renderProfile.deterministic,
      debugMode: false,
    },
    launch: {
      enabled: spec.launch.enabled,
      liftTimeSeconds: spec.launch.liftTimeSeconds,
      startPosition: spec.launch.startPosition,
      endHeightMeters: spec.launch.heightMeters,
      launchVelocity: spec.launch.heightMeters / spec.launch.liftTimeSeconds,
      arcAmount: 0.04,
      gravity: -9.8,
      drag: 0.96,
      tracerColor: spec.launch.tracerColor,
      tracerSize: 4.5,
      tracerLifetime: spec.launch.sparkLifeMs / 1000,
      tracerTrailLength: 0.45,
      tracerSparkRate: spec.launch.sparkFrequency,
      tracerSparkSize: 2.6,
      tracerSmokeAmount: 0.16,
      liftFlashSize: 8,
      liftFlashColor: "#FFE8A3",
      randomWobble: spec.launch.randomWobble,
      windInfluence: 0.16,
    },
    shotSequence: {
      shotCount: shots.length,
      durationSeconds: Math.max(0, spec.durationSeconds - spec.launch.liftTimeSeconds),
      cadenceMode: shots.length > 1 ? "custom" : "even",
      firingPattern: shots.length > 1 ? "CUSTOM" : "STR",
      rowCount: 1,
      tubesPerRow: Math.max(1, shots.length),
      rowSpacing: 0,
      tubeSpacing: 0.24,
      angleRangeDegrees: 0,
      fanAngles: [],
      volleyGroups: [],
      timingJitterSeconds: 0,
      symmetryJitter: 0.02,
      manufacturingVariation: 0.06,
      shots,
    },
    effectLayers: mainBreak.layers,
    audio: {
      events: shots.flatMap((shot) => [
        { timeSeconds: shot.timeOffsetSeconds, kind: "launch" as const, confidence: spec.confidence },
        { timeSeconds: shot.timeOffsetSeconds + spec.launch.liftTimeSeconds, kind: "burst" as const, confidence: spec.confidence },
      ]),
      gain: 1,
    },
    cameraHints: { targetHeightMeters: spec.launch.heightMeters * 0.58 },
    metadata: {
      ...spec.metadata,
      sourceSpecVersion: 3,
      codePenPalette: CodePenFireworkPalette,
    },
  });
}
