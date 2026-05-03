import { z } from "zod";
import type { ReplayCue } from "@/lib/shows";
import {
  FireworkSpecSchema,
  type FireworkSpec,
} from "@/lib/fireworks/spec";

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

export const ImportedFireworkSpecSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  durationSeconds: z.coerce.number().min(0.1).max(MAX_IMPORT_VIDEO_SECONDS),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
  spec: FireworkSpecSchema,
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)).optional(),
});

export type ImportedFireworkSpec = z.infer<typeof ImportedFireworkSpecSchema>;

export function parseImportedFireworkSpec(
  value: unknown,
): ImportedFireworkSpec | null {
  const parsed = ImportedFireworkSpecSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  console.error(
    "[imports] parseImportedFireworkSpec failed",
    parsed.error.issues.slice(0, 3).map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
  return null;
}

export function importedSpecToReplayCues(
  imported: ImportedFireworkSpec,
): ReplayCue[] {
  const id = "imported-spec";
  const spec: FireworkSpec = imported.spec;
  return [
    {
      id,
      position: 1,
      timeSeconds: 0,
      description: imported.description ?? imported.name,
      effectSpecId: id,
      positionMeters: { x: 0, y: 0, z: 0 },
      rotation: { pan: 0, tilt: 90, roll: 0 },
      scale: 1,
      overrides: {},
      seedOverride: null,
      firework: {
        id,
        slug: spec.shellType,
        name: imported.name,
        description: imported.description ?? null,
        sortOrder: 1,
        spec,
      },
    },
  ];
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
