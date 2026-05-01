import { z } from "zod";
import type {
  FireworkAudioSyncEvent,
  FireworkRenderSection,
  FireworkRenderSpec,
  ReplayCue,
} from "@/lib/shows";

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

export const ImportedFireworkSpecSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  durationSeconds: z.coerce.number().min(0.1).max(MAX_IMPORT_VIDEO_SECONDS),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
  renderSpec: RenderSpecSchema,
});

export type ImportedFireworkSpec = z.infer<typeof ImportedFireworkSpecSchema>;

export function parseImportedFireworkSpec(
  value: unknown,
): ImportedFireworkSpec | null {
  const parsed = ImportedFireworkSpecSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function deriveLegacyRenderSpec(
  imported: ImportedFireworkSpec,
): FireworkRenderSpec {
  const section =
    imported.renderSpec.sections.find((item) => item.phase === "burst") ??
    imported.renderSpec.sections[0];

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

export function importedSpecToReplayCues(
  imported: ImportedFireworkSpec,
): ReplayCue[] {
  const burstLike = imported.renderSpec.sections.filter(
    (section) =>
      section.phase === "burst" || section.phase === "secondary",
  );
  const sections =
    burstLike.length > 0 ? burstLike : imported.renderSpec.sections;

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
  }
  return null;
}
