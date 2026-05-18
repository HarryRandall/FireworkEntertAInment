import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const MAX_LLM_PRODUCTS = 80;
const MAX_LLM_BEATS = 96;
const MAX_LLM_ONSETS = 120;
const CUE_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cues"],
  properties: {
    cues: {
      type: "array",
      minItems: 1,
      maxItems: 180,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "timeSeconds",
          "productId",
          "description",
          "launchPositionIndex",
        ],
        properties: {
          timeSeconds: { type: "number", minimum: 0, maximum: 60 * 60 },
          productId: { type: "string" },
          description: { type: "string", minLength: 1, maxLength: 180 },
          launchPositionIndex: { type: "integer", minimum: 0, maximum: 2 },
        },
      },
    },
  },
} as const;

const SectionSchema = z.object({
  start: z.coerce.number().min(0),
  end: z.coerce.number().min(0),
  duration: z.coerce.number().min(0).optional(),
  avg_energy: z.coerce.number().min(0).max(1).optional(),
  peak_energy: z.coerce.number().min(0).max(1).optional(),
  intensity: z.string().optional(),
  label: z.string().optional(),
});

const MomentSchema = z.object({
  time: z.coerce.number().min(0),
  energy: z.coerce.number().min(0).max(1).optional(),
  prominence: z.coerce.number().min(0).max(1).optional(),
  type: z.string().optional(),
});

const BuildupSchema = z.object({
  start: z.coerce.number().min(0),
  peak: z.coerce.number().min(0),
  duration: z.coerce.number().min(0).optional(),
  energy_rise: z.coerce.number().min(0).max(1).optional(),
});

const EnergyPointSchema = z.object({
  time: z.coerce.number().min(0),
  energy: z.coerce.number().min(0).max(1),
});

export const MusicAnalysisSchema = z.object({
  schema_version: z.string().optional(),
  file: z.string().optional(),
  duration_seconds: z.coerce.number().min(1).max(60 * 60),
  tempo_bpm: z.coerce.number().min(1).max(400).optional(),
  beat_times: z.array(z.coerce.number().min(0)).default([]),
  onset_times: z.array(z.coerce.number().min(0)).default([]),
  energy_timeline: z.array(EnergyPointSchema).default([]),
  sections: z.array(SectionSchema).default([]),
  key_moments: z.array(MomentSchema).default([]),
  buildups: z.array(BuildupSchema).default([]),
  music_profile: z.unknown().optional(),
  show_personality: z.unknown().optional(),
});

export type MusicAnalysis = z.infer<typeof MusicAnalysisSchema>;

export type ProductCandidate = {
  id: string;
  name: string;
  partNumber: string;
  manufacturer: string | null;
  subtype: string | null;
  description: string | null;
  durationSeconds: number;
  heightMeters: number | null;
  effectNames: string[];
};

export type GeneratedCue = {
  timeSeconds: number;
  productId: string;
  description: string;
  launchPositionIndex: number;
};

const CuePlanSchema = z.object({
  cues: z
    .array(
      z.object({
        timeSeconds: z.coerce.number().min(0).max(60 * 60),
        productId: z.string().uuid(),
        description: z.string().trim().min(1).max(180),
        launchPositionIndex: z.coerce.number().int().min(0).max(2).default(0),
      }),
    )
    .min(1)
    .max(180),
});

type ProductRow = {
  id: string;
  name: string;
  part_number: string;
  manufacturer: string | null;
  subtype: string | null;
  description: string | null;
  duration_seconds: number | null;
  product_shots: Array<{
    effect_specs: {
      name: string;
      type: string;
      description: string | null;
      duration_seconds: number;
      height_meters: number | null;
    } | null;
  }>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function sampleNumbers(values: number[], limit: number): number[] {
  if (values.length <= limit) return values;
  const result: number[] = [];
  const step = (values.length - 1) / Math.max(1, limit - 1);
  for (let i = 0; i < limit; i++) {
    result.push(values[Math.round(i * step)]);
  }
  return result;
}

function sampleItems<T>(values: T[], limit: number): T[] {
  if (values.length <= limit) return values;
  const result: T[] = [];
  const step = (values.length - 1) / Math.max(1, limit - 1);
  for (let i = 0; i < limit; i++) {
    result.push(values[Math.round(i * step)]);
  }
  return result;
}

function productText(product: ProductCandidate): string {
  return [
    product.name,
    product.partNumber,
    product.subtype,
    product.description,
    ...product.effectNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreProduct(product: ProductCandidate, role: "low" | "accent" | "buildup" | "climax"): number {
  const text = productText(product);
  const duration = product.durationSeconds;
  const height = product.heightMeters ?? 25;
  let score = 0;

  if (role === "low") {
    if (text.includes("comet") || text.includes("mine") || text.includes("candle")) score += 5;
    if (height <= 35) score += 3;
    if (duration <= 4) score += 2;
  }

  if (role === "accent") {
    if (text.includes("palm") || text.includes("peony") || text.includes("brocade")) score += 5;
    if (text.includes("comet") || text.includes("mine")) score += 2;
    if (height >= 25 && height <= 70) score += 3;
  }

  if (role === "buildup") {
    if (text.includes("crackle") || text.includes("strobe") || text.includes("willow")) score += 6;
    if (duration >= 2) score += 2;
    if (duration <= 10) score += 2;
  }

  if (role === "climax") {
    if (text.includes("cake") || text.includes("finale") || text.includes("barrage")) score += 5;
    if (text.includes("brocade") || text.includes("chrys") || text.includes("peony")) score += 4;
    if (height >= 35) score += 3;
    if (duration >= 2) score += 2;
  }

  return score + Math.min(4, height / 30) + Math.min(3, duration / 5);
}

function bestProduct(
  products: ProductCandidate[],
  role: "low" | "accent" | "buildup" | "climax",
  salt = 0,
): ProductCandidate {
  const ranked = [...products].sort((a, b) => scoreProduct(b, role) - scoreProduct(a, role));
  return ranked[salt % Math.min(5, ranked.length)] ?? products[0];
}

function nearestBeat(time: number, beats: number[], duration: number): number {
  if (!beats.length) return clamp(time, 0, duration);
  let best = beats[0];
  let distance = Math.abs(best - time);
  for (const beat of beats) {
    const nextDistance = Math.abs(beat - time);
    if (nextDistance >= distance) continue;
    best = beat;
    distance = nextDistance;
  }
  return clamp(best, 0, duration);
}

function makeCue(
  timeSeconds: number,
  product: ProductCandidate,
  description: string,
  launchPositionIndex: number,
): GeneratedCue {
  return {
    timeSeconds: Number(timeSeconds.toFixed(3)),
    productId: product.id,
    description: description.slice(0, 180),
    launchPositionIndex,
  };
}

function dedupeAndFitCues(
  cues: GeneratedCue[],
  products: ProductCandidate[],
  durationSeconds: number,
): GeneratedCue[] {
  const productDuration = new Map(products.map((p) => [p.id, Math.max(0.5, p.durationSeconds)]));
  const tubeBusyUntil = [0, 0, 0];
  const sorted = [...cues].sort((a, b) => a.timeSeconds - b.timeSeconds);
  const fitted: GeneratedCue[] = [];
  const seen = new Set<string>();

  for (const cue of sorted) {
    const productSeconds = productDuration.get(cue.productId) ?? 1;
    let tube = cue.launchPositionIndex;
    if (tubeBusyUntil[tube] > cue.timeSeconds) {
      const available = tubeBusyUntil
        .map((busyUntil, index) => ({ busyUntil, index }))
        .sort((a, b) => a.busyUntil - b.busyUntil)[0];
      tube = available.index;
    }

    if (tubeBusyUntil[tube] > cue.timeSeconds) continue;
    const key = `${cue.productId}:${cue.timeSeconds.toFixed(1)}:${tube}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tubeBusyUntil[tube] = cue.timeSeconds + productSeconds;
    fitted.push({
      ...cue,
      timeSeconds: clamp(cue.timeSeconds, 0, durationSeconds),
      launchPositionIndex: tube,
    });
  }

  return fitted.slice(0, 140);
}

function fallbackCuePlan(analysis: MusicAnalysis, products: ProductCandidate[]): GeneratedCue[] {
  const duration = analysis.duration_seconds;
  const beats = analysis.beat_times.filter((time) => time <= duration);
  const cues: GeneratedCue[] = [];

  for (const buildup of analysis.buildups) {
    const product = bestProduct(products, "buildup", cues.length);
    cues.push(makeCue(buildup.start, product, "Buildup texture", cues.length % 3));
  }

  for (const moment of analysis.key_moments) {
    const isClimax = (moment.type ?? "").toLowerCase().includes("climax") || (moment.energy ?? 0) > 0.85;
    const role = isClimax ? "climax" : "accent";
    const product = bestProduct(products, role, cues.length);
    cues.push(
      makeCue(
        nearestBeat(moment.time, beats, duration),
        product,
        isClimax ? "Climax hit" : "Featured musical accent",
        cues.length % 3,
      ),
    );
  }

  for (const section of analysis.sections) {
    const intensity = (section.intensity ?? "").toLowerCase();
    const energy = section.peak_energy ?? section.avg_energy ?? 0;
    const spacing = intensity === "high" || energy > 0.6 ? 4 : intensity === "medium" || energy > 0.18 ? 8 : 14;
    const role = intensity === "high" || energy > 0.6 ? "accent" : energy > 0.12 ? "low" : "low";
    const start = Math.max(section.start + Math.min(2, spacing / 2), 0);
    for (let time = start; time < section.end - 0.75; time += spacing) {
      if (energy < 0.08 && time !== start) continue;
      const product = bestProduct(products, role, cues.length);
      cues.push(
        makeCue(
          nearestBeat(time, beats, duration),
          product,
          `${section.label ?? "Section"} ${role === "low" ? "spark" : "accent"}`,
          cues.length % 3,
        ),
      );
    }
  }

  if (!cues.length) {
    const product = bestProduct(products, "accent");
    for (const time of sampleNumbers(beats, 12)) {
      cues.push(makeCue(time, product, "Beat accent", cues.length % 3));
    }
  }

  return dedupeAndFitCues(cues, products, duration);
}

function compactAnalysisForPrompt(analysis: MusicAnalysis) {
  return {
    duration_seconds: analysis.duration_seconds,
    tempo_bpm: analysis.tempo_bpm,
    beat_times: sampleNumbers(analysis.beat_times, MAX_LLM_BEATS),
    onset_times: sampleNumbers(analysis.onset_times, MAX_LLM_ONSETS),
    sections: analysis.sections,
    key_moments: analysis.key_moments,
    buildups: analysis.buildups,
    energy_timeline: sampleItems(analysis.energy_timeline, 80),
    music_profile: analysis.music_profile,
    show_personality: analysis.show_personality,
  };
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return JSON.");
    return JSON.parse(match[0]);
  }
}

function buildCataloguePrompt(products: ProductCandidate[]): string {
  const productList = products.slice(0, MAX_LLM_PRODUCTS).map((product) => ({
    id: product.id,
    name: product.name,
    partNumber: product.partNumber,
    subtype: product.subtype,
    description: product.description,
    durationSeconds: product.durationSeconds,
    heightMeters: product.heightMeters,
    effectNames: product.effectNames,
  }));
  return `Available products: ${JSON.stringify(productList)}`;
}

async function callOpenAiCuePlanner(prompt: string): Promise<unknown | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_SHOW_PLANNER_MODEL?.trim() || "gpt-5.2";

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "cue_plan",
            strict: true,
            schema: CUE_PLAN_JSON_SCHEMA,
          },
        },
      }),
    });
  } catch (error) {
    console.error("[music-analysis-show] OpenAI request failed:", error);
    return null;
  }

  if (!response.ok) {
    console.error("[music-analysis-show] OpenAI failed:", response.status, await response.text());
    return null;
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const content =
    data.output_text ??
    data.output?.flatMap((item) => item.content ?? []).find((item) => item.text)
      ?.text;
  if (!content) return null;

  try {
    return parseJsonObject(content);
  } catch (error) {
    console.error("[music-analysis-show] OpenAI JSON parse failed:", error);
    return null;
  }
}

async function callOpenRouterCuePlanner(prompt: string): Promise<unknown | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.DEFAULT_OPENROUTER_MODEL?.trim() || "openai/gpt-4.1";

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "ShowCrafter",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    console.error("[music-analysis-show] OpenRouter request failed:", error);
    return null;
  }

  if (!response.ok) {
    console.error("[music-analysis-show] OpenRouter failed:", response.status, await response.text());
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return parseJsonObject(content);
  } catch (error) {
    console.error("[music-analysis-show] model JSON parse failed:", error);
    return null;
  }
}

export async function generateCuePlanFromPrompt(params: {
  prompt: string;
  products: ProductCandidate[];
  durationSeconds: number;
}): Promise<GeneratedCue[] | null> {
  const rawPlan =
    (await callOpenAiCuePlanner(params.prompt)) ??
    (await callOpenRouterCuePlanner(params.prompt));
  if (!rawPlan) return null;

  const parsed = CuePlanSchema.safeParse(rawPlan);
  if (!parsed.success) {
    console.error("[music-analysis-show] cue plan validation failed:", parsed.error.issues.slice(0, 3));
    return null;
  }

  const validIds = new Set(products.map((product) => product.id));
  const valid = parsed.data.cues.filter((cue) => validIds.has(cue.productId));
  return dedupeAndFitCues(valid, products, params.durationSeconds);
}

async function llmCuePlan(
  analysis: MusicAnalysis,
  products: ProductCandidate[],
  brief: string,
): Promise<GeneratedCue[] | null> {
  return generateCuePlanFromPrompt({
    products,
    durationSeconds: analysis.duration_seconds,
    prompt:
      "You are ShowCrafter's fireworks choreography planner. Generate a safe draft show from music-analysis JSON.\n" +
      "Use only product IDs from the catalogue. Return JSON only: {\"cues\":[{\"timeSeconds\":number,\"productId\":uuid,\"description\":string,\"launchPositionIndex\":0|1|2}]}.\n" +
      "Prefer sparse elegant cues for low sections, accents on strong beats/key moments, buildup textures over buildup starts, and large products at climaxes. Keep each tube from overlapping product duration.\n" +
      `Creative brief: ${brief || "none"}\n` +
      `Music analysis summary: ${JSON.stringify(compactAnalysisForPrompt(analysis))}\n` +
      buildCataloguePrompt(products),
  });
}

export async function listCuePlannerProducts(
  supabase: SupabaseClient<Database>,
): Promise<ProductCandidate[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, part_number, manufacturer, subtype, description, duration_seconds,
       product_shots (
         effect_specs (name, type, description, duration_seconds, height_meters)
       )`,
    )
    .order("name", { ascending: true });

  if (error) {
    console.error("[music-analysis-show] product load failed:", error);
    return [];
  }

  return ((data ?? []) as ProductRow[])
    .map((row) => {
      const effectNames = uniq(
        (row.product_shots ?? [])
          .flatMap((shot) => [
            shot.effect_specs?.name,
            shot.effect_specs?.type,
            shot.effect_specs?.description ?? undefined,
          ])
          .filter((value): value is string => Boolean(value)),
      );
      const heights = (row.product_shots ?? [])
        .map((shot) => shot.effect_specs?.height_meters)
        .filter((value): value is number => typeof value === "number");
      const durations = (row.product_shots ?? [])
        .map((shot) => shot.effect_specs?.duration_seconds)
        .filter((value): value is number => typeof value === "number");

      return {
        id: row.id,
        name: row.name,
        partNumber: row.part_number,
        manufacturer: row.manufacturer,
        subtype: row.subtype,
        description: row.description,
        durationSeconds:
          row.duration_seconds ??
          Math.max(0.5, ...durations, 0.5),
        heightMeters: heights.length ? Math.max(...heights) : null,
        effectNames,
      };
    })
    .filter((product) => product.durationSeconds > 0);
}

export async function generateCuePlanFromAnalysis(params: {
  analysis: MusicAnalysis;
  products: ProductCandidate[];
  brief: string;
}): Promise<{ cues: GeneratedCue[]; source: "llm" | "fallback" }> {
  const llmCues = await llmCuePlan(params.analysis, params.products, params.brief);
  if (llmCues?.length) return { cues: llmCues, source: "llm" };
  return {
    cues: fallbackCuePlan(params.analysis, params.products),
    source: "fallback",
  };
}
