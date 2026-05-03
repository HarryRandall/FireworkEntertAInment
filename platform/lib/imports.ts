import { z } from "zod";
import type {
  FireworkAudioSyncEvent,
  FireworkRenderSection,
  FireworkRenderSpec,
  ReplayCue,
} from "@/lib/shows";
import {
  effectSpecV2ToLegacyRenderSpec,
  legacyFireworkRenderSpecToEffectSpecV2,
} from "@/lib/fireworks/legacy-adapter";
import {
  FireworkEffectSpecV2Schema,
  VideoInferenceObservationSchema,
  type FireworkEffectSpecV2,
  type VideoInferenceObservation,
} from "@/lib/fireworks/spec-v2";
import {
  FireworkEffectSpecV3Schema,
  fireworkEffectSpecV3ToV2,
} from "@/lib/fireworks/spec-v3";

export const IMPORT_VIDEO_BUCKET = "import-videos";
export const MAX_IMPORT_VIDEO_SECONDS = 60;

export const OPENROUTER_MODEL_OPTIONS = [
  {
    value: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    description: "Lowest-cost default for first-pass video/frame analysis.",
  },
  {
    value: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Stronger visual reasoning when the cheap pass is uncertain.",
  },
  {
    value: "openai/gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    description: "Alternative compact multimodal model via OpenRouter.",
  },
] as const;

export const DEFAULT_OPENROUTER_MODEL = OPENROUTER_MODEL_OPTIONS[0].value;

const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a full hex colour such as #A8FF8F.");

const AudioSyncEventSchema = z.object({
  timeSeconds: z.coerce.number().min(0).max(MAX_IMPORT_VIDEO_SECONDS),
  kind: z.enum(["launch", "burst", "crackle", "fade"]),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

const RenderSectionSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    phase: z.enum(["launch", "burst", "afterglow", "secondary"]),
    startTimeSeconds: z.coerce.number().min(0).max(MAX_IMPORT_VIDEO_SECONDS),
    endTimeSeconds: z.coerce.number().min(0).max(MAX_IMPORT_VIDEO_SECONDS),
    burstTimeSeconds: z.coerce.number().min(0).max(MAX_IMPORT_VIDEO_SECONDS),
    colors: z.array(HexColorSchema).min(1).max(8),
    particleCount: z.coerce.number().int().min(40).max(900).default(220),
    spread: z.coerce.number().min(0.4).max(8).default(2.6),
    launchHeight: z.coerce.number().min(0.5).max(8).default(3),
    burstDuration: z.coerce.number().min(0.25).max(8).default(2.4),
    gravity: z.coerce.number().min(-6).max(1).default(-1.5),
    drag: z.coerce.number().min(0.05).max(0.99).default(0.86),
    sparkSize: z.coerce.number().min(0.015).max(0.22).default(0.075),
    trailLength: z.coerce.number().min(0).max(2.5).default(0.65),
    secondaryBursts: z.coerce.number().int().min(0).max(4).optional(),
    confidence: z.coerce.number().min(0).max(1).optional(),
  })
  .refine((section) => section.endTimeSeconds >= section.startTimeSeconds, {
    message: "Section end must be after section start.",
    path: ["endTimeSeconds"],
  });

const RenderSpecSchema = z.object({
  particleCount: z.coerce.number().int().min(40).max(900).default(220),
  burstDuration: z.coerce.number().min(0.25).max(8).default(2.4),
  colors: z.array(HexColorSchema).min(1).max(8).default(["#00E5FF"]),
  spread: z.coerce.number().min(0.4).max(8).default(2.6),
  launchHeight: z.coerce.number().min(0.5).max(8).default(3),
  gravity: z.coerce.number().min(-6).max(1).default(-1.5),
  drag: z.coerce.number().min(0.05).max(0.99).default(0.86),
  sparkSize: z.coerce.number().min(0.015).max(0.22).default(0.075),
  trailLength: z.coerce.number().min(0).max(2.5).default(0.65),
  secondaryBursts: z.coerce.number().int().min(0).max(4).optional(),
  sections: z.array(RenderSectionSchema).min(1).max(24),
  audioSync: z.array(AudioSyncEventSchema).max(80).default([]),
});

export const ImportedFireworkSpecSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    description: z.string().trim().max(1200).optional().nullable(),
    durationSeconds: z.coerce.number().min(0.1).max(MAX_IMPORT_VIDEO_SECONDS),
    confidence: z.coerce.number().min(0).max(1).default(0.5),
    renderSpec: RenderSpecSchema.optional(),
    effectSpec: z.union([FireworkEffectSpecV3Schema, FireworkEffectSpecV2Schema]).optional(),
    observations: VideoInferenceObservationSchema.optional(),
    fieldConfidence: z.record(z.string(), z.number().min(0).max(1)).optional(),
  })
  .refine((value) => value.renderSpec || value.effectSpec, {
    message: "Provide effectSpec v2 or a legacy renderSpec.",
    path: ["effectSpec"],
  })
  .transform((value) => {
    const effectSpec =
      value.effectSpec ??
      legacyFireworkRenderSpecToEffectSpecV2(value.renderSpec as FireworkRenderSpec, {
        name: value.name,
        description: value.description ?? null,
        source: "video_inferred",
      });
    const renderSpec =
      value.renderSpec ??
      effectSpecV2ToLegacyRenderSpec(
        effectSpec.version === 3 ? fireworkEffectSpecV3ToV2(effectSpec) : effectSpec,
      );
    return {
      ...value,
      renderSpec,
      effectSpec,
      effectSpecWasProvided: Boolean(value.effectSpec),
      observations: value.observations,
    };
  });

export type ImportedFireworkSpec = z.infer<typeof ImportedFireworkSpecSchema>;

export function parseImportedFireworkSpec(
  value: unknown,
): ImportedFireworkSpec | null {
  const parsed = ImportedFireworkSpecSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  const fallback = buildFallbackImportedSpec(value);
  if (!fallback) return null;
  const reparsed = ImportedFireworkSpecSchema.safeParse(fallback);
  if (reparsed.success) return reparsed.data;

  console.error("[imports] parseImportedFireworkSpec failed", {
    primaryIssues: parsed.error.issues.slice(0, 3).map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
    fallbackIssues: reparsed.error.issues.slice(0, 3).map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
  return null;
}

function buildFallbackImportedSpec(value: unknown): unknown | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;

  const durationRaw = Number(input.durationSeconds);
  const durationSeconds = Number.isFinite(durationRaw)
    ? Math.min(MAX_IMPORT_VIDEO_SECONDS, Math.max(0.1, durationRaw))
    : 10;

  const confidenceRaw = Number(input.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0.5;

  const nameRaw = input.name;
  const name =
    typeof nameRaw === "string" && nameRaw.trim().length > 0
      ? nameRaw.trim()
      : "Imported firework";

  const descriptionRaw = input.description;
  const description =
    typeof descriptionRaw === "string" ? descriptionRaw : null;

  const effectSpecCandidate =
    input.effectSpec && typeof input.effectSpec === "object"
      ? (input.effectSpec as Record<string, unknown>)
      : null;

  const paletteRaw = effectSpecCandidate?.colorPalette;
  const palette = Array.isArray(paletteRaw)
    ? paletteRaw
        .filter((item): item is string => typeof item === "string")
        .filter((item) => /^#[0-9a-fA-F]{6}$/.test(item))
        .slice(0, 8)
    : [];
  const colors = palette.length > 0 ? palette : ["#FFD36A"];

  const burstTimeSeconds = Math.min(durationSeconds, 1.15);
  const section = {
    id: "imported-main-burst",
    label: name,
    phase: "burst" as const,
    startTimeSeconds: 0,
    endTimeSeconds: durationSeconds,
    burstTimeSeconds,
    colors,
    particleCount: 220,
    spread: 2.6,
    launchHeight: 3,
    burstDuration: 2.4,
    gravity: -1.5,
    drag: 0.86,
    sparkSize: 0.075,
    trailLength: 0.65,
    secondaryBursts: 0,
    confidence,
  };

  const fallback = {
    name,
    description,
    durationSeconds,
    confidence,
    renderSpec: {
      particleCount: 220,
      burstDuration: 2.4,
      colors,
      spread: 2.6,
      launchHeight: 3,
      gravity: -1.5,
      drag: 0.86,
      sparkSize: 0.075,
      trailLength: 0.65,
      secondaryBursts: 0,
      sections: [section],
      audioSync: [],
    },
  } as Record<string, unknown>;

  // Keep fallback renderSpec-only to avoid
  // malformed v2 nested fields nulling the entire imported preview.
  return fallback;
}

export function deriveLegacyRenderSpec(
  imported: ImportedFireworkSpec,
): FireworkRenderSpec {
  const section =
    (imported.renderSpec.sections ?? []).find((item) => item.phase === "burst") ??
    imported.renderSpec.sections?.[0];

  return {
    particleCount: section?.particleCount ?? imported.renderSpec.particleCount,
    burstDuration: section?.burstDuration ?? imported.renderSpec.burstDuration,
    colors: section?.colors ?? imported.renderSpec.colors,
    spread: section?.spread ?? imported.renderSpec.spread,
    launchHeight: section?.launchHeight ?? imported.renderSpec.launchHeight,
    gravity: section?.gravity ?? imported.renderSpec.gravity,
    drag: section?.drag ?? imported.renderSpec.drag,
    sparkSize: section?.sparkSize ?? imported.renderSpec.sparkSize,
    trailLength: section?.trailLength ?? imported.renderSpec.trailLength,
    secondaryBursts:
      section?.secondaryBursts ?? imported.renderSpec.secondaryBursts,
    sections: imported.renderSpec.sections as FireworkRenderSection[],
    audioSync: imported.renderSpec.audioSync as FireworkAudioSyncEvent[],
  };
}

export function observationsToEffectSpecV2(
  observations: VideoInferenceObservation,
  options: {
    name: string;
    description?: string | null;
    durationSeconds: number;
    seed?: number;
  },
): FireworkEffectSpecV2 {
  const launchEvents = observations.observedEvents.filter(
    (event) => event.type === "launch",
  );
  const breakEvents = observations.observedEvents.filter(
    (event) => event.type === "break" || event.type === "secondary_break",
  );
  const colors = Array.from(
    new Set(
      observations.observedEvents
        .map((event) => event.color)
        .filter((color): color is string => Boolean(color)),
    ),
  ).slice(0, 6);
  const palette = colors.length > 0 ? colors : ["#FFD36A", "#FFFFFF"];
  const shotCount = Math.max(1, launchEvents.length || breakEvents.length || 1);
  const inferredHeight =
    breakEvents.find((event) => event.estimatedHeight)?.estimatedHeight ?? 80;
  const layer =
    observations.inferredEffectLayers[0] ??
    legacyFireworkRenderSpecToEffectSpecV2(
      {
        particleCount: 520,
        burstDuration: 2.8,
        colors: palette,
        spread: 2.8,
        launchHeight: inferredHeight / 28,
        gravity: -1.45,
        drag: 0.84,
        sparkSize: 0.075,
        trailLength: observations.observedEvents.some(
          (event) =>
            /willow|brocade|trail|comet/i.test(event.description ?? ""),
        )
          ? 1.1
          : 0.45,
      },
      {
        name: options.name,
        description: options.description ?? null,
        source: "video_inferred",
        seed: options.seed ?? 1,
      },
    ).effectLayers[0];

  return FireworkEffectSpecV2Schema.parse({
    version: 2,
    name: options.name,
    description: options.description ?? null,
    source: "video_inferred",
    confidence: observations.confidence,
    seed: options.seed ?? 1,
    type: shotCount > 1 ? "cake" : "shell",
    globalScale: 0.045,
    durationSeconds: options.durationSeconds,
    prefireSeconds: 0,
    heightMeters: inferredHeight,
    colorPalette: palette,
    renderProfile: {
      quality: "high",
      maxParticles: 120_000,
      maxTrailSegments: 240_000,
      useGPUShaders: true,
      useBloom: true,
      useHDR: true,
      useSmoke: true,
      usePostFX: true,
      pixelRatioLimit: 2,
      lodDistanceScale: 1,
      deterministic: true,
      debugMode: false,
    },
    launch: {
      enabled: true,
      liftTimeSeconds: 1.15,
      startPosition: { x: 0, y: 0, z: 0 },
      endHeightMeters: inferredHeight,
      launchVelocity: inferredHeight / 1.15,
      arcAmount: 0.04,
      gravity: -9.8,
      drag: 0.96,
      tracerColor: palette[0],
      tracerSize: 4,
      tracerLifetime: 0.65,
      tracerTrailLength: 0.45,
      tracerSparkRate: 28,
      tracerSparkSize: 2.5,
      tracerSmokeAmount: 0.15,
      liftFlashSize: 8,
      liftFlashColor: "#FFE8A3",
      randomWobble: 0.04,
      windInfluence: 0.16,
    },
    shotSequence: observations.inferredShotSequence ?? {
      shotCount,
      durationSeconds: Math.max(0, options.durationSeconds - 1.5),
      cadenceMode: shotCount > 1 ? "custom" : "even",
      firingPattern: "STR",
      rowCount: 1,
      tubesPerRow: shotCount,
      rowSpacing: 0,
      tubeSpacing: 0.25,
      angleRangeDegrees: 0,
      fanAngles: [],
      volleyGroups: [],
      timingJitterSeconds: 0.02,
      symmetryJitter: 0.05,
      manufacturingVariation: 0.08,
      shots: Array.from({ length: shotCount }, (_, index) => {
        const launchTime =
          launchEvents[index]?.timeSeconds ??
          (index / Math.max(1, shotCount)) * Math.max(0, options.durationSeconds - 2);
        const breakTime =
          breakEvents[index]?.timeSeconds ??
          Math.min(options.durationSeconds, launchTime + 1.15);
        return {
          index,
          timeOffsetSeconds: launchTime,
          launchPositionOffset: { x: 0, y: 0, z: 0 },
          panDegrees: 0,
          tiltDegrees: 90,
          rollDegrees: 0,
          launchHeightMeters: inferredHeight,
          liftTimeSeconds: Math.max(0.35, breakTime - launchTime),
          breakSpec: {
            enabled: true,
            timeOffsetSeconds: Math.max(0.35, breakTime - launchTime),
            burstType: observations.observedEvents.some((event) =>
              /willow/i.test(event.description ?? ""),
            )
              ? "willow"
              : "peony",
            shape: "sphere",
            layers: [layer],
            flash: {
              enabled: true,
              color: palette[0],
              intensity: 3,
              size: 12,
              duration: 0.08,
              bloomMultiplier: 1.7,
            },
            smoke: {
              enabled: true,
              amount: 0.25,
              particleCount: 26,
              color: "#6B665D",
              opacity: 0.14,
              size: 11,
              riseSpeed: 0.7,
              expansion: 1.5,
              windScale: 0.8,
              turbulence: 0.45,
              lifetime: 5,
              fadeIn: 0.45,
              fadeOut: 2.6,
              texture: "smoke_puff",
              depthSoftening: 0.5,
            },
            subBreaks: [],
            scale: 1,
          },
          seedOffset: index * 101,
          colorOverride: breakEvents[index]?.color ? [breakEvents[index].color] : undefined,
          confidence: breakEvents[index]?.confidence ?? observations.confidence,
        };
      }),
    },
    effectLayers: observations.inferredEffectLayers.length
      ? observations.inferredEffectLayers
      : [layer],
    audio: {
      events: observations.observedEvents.map((event) => ({
        timeSeconds: event.timeSeconds,
        kind: event.type === "secondary_break" ? "burst" : event.type === "report" ? "report" : "burst",
        confidence: event.confidence,
      })),
      gain: 1,
    },
    cameraHints: { source: "video_observation" },
    metadata: {
      inferredFromVideo: true,
      unknowns: observations.unknowns,
      suggestedManualReviewFields: observations.suggestedManualReviewFields,
    },
  });
}

export function importedSpecToReplayCues(
  imported: ImportedFireworkSpec,
): ReplayCue[] {
  if (imported.effectSpecWasProvided) {
    return [
      {
        id: imported.effectSpec.id ?? "imported-effect-v2",
        position: 1,
        timeSeconds: 0,
        description: imported.effectSpec.description ?? imported.effectSpec.name,
        fireworkSpecificationId: imported.effectSpec.id ?? "imported-effect-v2",
        renderParams: null,
        firework: {
          id: imported.effectSpec.id ?? "imported-effect-v2",
          slug: imported.effectSpec.type,
          name: imported.effectSpec.name,
          description: imported.effectSpec.description ?? null,
          sortOrder: 1,
          spec: imported.effectSpec,
        },
      },
    ];
  }

  const allSections = imported.renderSpec.sections ?? [
    {
      id: "imported-main-burst",
      label: imported.name,
      phase: "burst" as const,
      startTimeSeconds: 0,
      endTimeSeconds: imported.durationSeconds,
      burstTimeSeconds: 1.15,
      colors: imported.renderSpec.colors,
      particleCount: imported.renderSpec.particleCount,
      spread: imported.renderSpec.spread,
      launchHeight: imported.renderSpec.launchHeight,
      burstDuration: imported.renderSpec.burstDuration,
      gravity: imported.renderSpec.gravity,
      drag: imported.renderSpec.drag,
      sparkSize: imported.renderSpec.sparkSize,
      trailLength: imported.renderSpec.trailLength,
      secondaryBursts: imported.renderSpec.secondaryBursts,
      confidence: imported.confidence,
    },
  ];
  const burstLike = allSections.filter(
    (section) =>
      section.phase === "burst" || section.phase === "secondary",
  );
  const sections =
    burstLike.length > 0 ? burstLike : allSections;

  return sections.map((section, index) => {
    const fireworkSpec: FireworkRenderSpec = {
      particleCount: section.particleCount,
      burstDuration: section.burstDuration,
      colors: section.colors,
      spread: section.spread,
      launchHeight: section.launchHeight,
      gravity: section.gravity,
      drag: section.drag,
      sparkSize: section.sparkSize,
      trailLength: section.trailLength,
      secondaryBursts: section.secondaryBursts,
    };
    return {
      id: section.id,
      position: index + 1,
      timeSeconds: section.burstTimeSeconds,
      description: section.label,
      fireworkSpecificationId: `import-${section.id}`,
      renderParams: null,
      firework: {
        id: `import-${section.id}`,
        slug: section.phase,
        name: section.label,
        description: imported.description ?? null,
        sortOrder: index + 1,
        spec: fireworkSpec,
      },
    };
  });
}

export function latestImportedSpecFromOutputs(
  outputs: { outputType: string; payload: unknown }[],
): ImportedFireworkSpec | null {
  for (const output of [...outputs].reverse()) {
    if (
      output.outputType !== "draft_spec" &&
      output.outputType !== "generated_spec" &&
      output.outputType !== "refinement"
    ) {
      continue;
    }
    const candidate =
      typeof output.payload === "object" &&
      output.payload !== null &&
      "spec" in output.payload
        ? (output.payload as { spec?: unknown }).spec
        : output.payload;
    const parsed = parseImportedFireworkSpec(candidate);
    if (parsed) return parsed;
    if (output.outputType === "generated_spec" || output.outputType === "draft_spec") {
      const candidateKeys =
        candidate && typeof candidate === "object"
          ? Object.keys(candidate as Record<string, unknown>).slice(0, 20)
          : [];
      console.error("[imports] dropped import spec candidate", {
        outputType: output.outputType,
        candidateKeys,
      });
    }
  }
  return null;
}
