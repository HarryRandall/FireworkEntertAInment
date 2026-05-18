"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { invalidateShowCacheForUser } from "@/lib/shows.server";
import {
  generateCuePlanFromPrompt,
  listCuePlannerProducts,
  type GeneratedCue,
  type ProductCandidate,
} from "@/lib/music-analysis-show";

export type RefineShowResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

const RefineShowSchema = z.object({
  showId: z.string().uuid(),
  showSlug: z.string().min(1),
  instruction: z.string().trim().min(8, "Describe the change you want.").max(1200),
});

type ExistingCue = {
  id: string;
  position: number;
  time_seconds: number | null;
  description: string;
  product_id: string;
  launch_position_index: number;
};

function textForProduct(product: ProductCandidate): string {
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

function pickProduct(
  products: ProductCandidate[],
  role: "accent" | "texture" | "climax",
): ProductCandidate {
  const ranked = [...products].sort((a, b) => {
    const aText = textForProduct(a);
    const bText = textForProduct(b);
    const score = (product: ProductCandidate, text: string) => {
      let value = (product.heightMeters ?? 20) / 25 + product.durationSeconds / 5;
      if (role === "texture" && /crackle|strobe|willow|comet|mine/.test(text)) value += 8;
      if (role === "accent" && /palm|peony|brocade|comet|mine/.test(text)) value += 8;
      if (role === "climax" && /cake|finale|barrage|brocade|chrys|peony/.test(text)) value += 10;
      return value;
    };
    return score(b, bText) - score(a, aText);
  });
  return ranked[0] ?? products[0];
}

function productById(
  products: ProductCandidate[],
  productId: string | null | undefined,
): ProductCandidate | null {
  if (!productId) return null;
  return products.find((product) => product.id === productId) ?? null;
}

function conciseCueDescription(
  cue: GeneratedCue,
  products: ProductCandidate[],
  fallback: string,
): string {
  const product = productById(products, cue.productId);
  const current = cue.description.trim();
  if (!current) return product?.name ?? fallback;
  if (current.length > 70 || /^refined\s+(can|please|make|add|remove|change)\b/i.test(current)) {
    return product?.name ?? fallback;
  }
  return current;
}

function applyInstructionRules(params: {
  instruction: string;
  cues: GeneratedCue[];
  products: ProductCandidate[];
  existingCues: ExistingCue[];
  durationSeconds: number;
}): GeneratedCue[] {
  const lower = params.instruction.toLowerCase();
  const wantsSameEffect =
    lower.includes("same effect") ||
    lower.includes("same firework") ||
    lower.includes("same product") ||
    lower.includes("everything the same");
  const wantsStartCue =
    lower.includes("at the start") ||
    lower.includes("at start") ||
    lower.includes("beginning") ||
    lower.includes("0:00") ||
    lower.includes("zero");

  const firstExistingProduct =
    productById(params.products, params.existingCues.find((cue) => cue.product_id)?.product_id) ??
    null;
  const targetProduct = firstExistingProduct ?? pickProduct(params.products, "accent");

  let cues = params.cues.map((cue) => ({
    ...cue,
    description: conciseCueDescription(cue, params.products, "Refined cue"),
  }));

  if (wantsSameEffect) {
    cues = cues.map((cue) => ({
      ...cue,
      productId: targetProduct.id,
      description: targetProduct.name,
    }));
  }

  if (wantsStartCue && !cues.some((cue) => cue.timeSeconds <= 0.25)) {
    cues.unshift({
      timeSeconds: 0,
      productId: targetProduct.id,
      description: wantsSameEffect ? targetProduct.name : "Opening hit",
      launchPositionIndex: 0,
    });
  }

  const seen = new Set<string>();
  return cues
    .sort((a, b) => a.timeSeconds - b.timeSeconds)
    .filter((cue) => {
      const boundedTime = cue.timeSeconds >= 0 && cue.timeSeconds <= params.durationSeconds;
      const key = `${cue.timeSeconds.toFixed(2)}:${cue.productId}:${cue.launchPositionIndex}`;
      if (!boundedTime || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 140);
}

function fallbackRefinePlan(params: {
  instruction: string;
  existingCues: ExistingCue[];
  products: ProductCandidate[];
  durationSeconds: number;
}): GeneratedCue[] {
  const lower = params.instruction.toLowerCase();
  const wantsDefaultChange =
    !/(sparse|less|minimal|more|intense|bigger|finale|ending|climax|crackle|sparkle|texture|same effect|same firework|same product|everything the same|start|beginning|0:00|zero)/.test(
      lower,
    );
  let cues = params.existingCues
    .filter((cue) => cue.time_seconds != null)
    .map((cue) => ({
      timeSeconds: Number(cue.time_seconds),
      productId: cue.product_id,
      description: cue.description,
      launchPositionIndex: cue.launch_position_index,
    }));

  if (cues.length === 0) {
    const accent = pickProduct(params.products, "accent");
    const climax = pickProduct(params.products, "climax");
    const count = Math.max(6, Math.min(18, Math.floor(params.durationSeconds / 12)));
    for (let i = 0; i < count; i++) {
      const progress = count === 1 ? 0 : i / (count - 1);
      cues.push({
        timeSeconds: Number((progress * Math.max(1, params.durationSeconds - 2)).toFixed(3)),
        productId: progress > 0.8 ? climax.id : accent.id,
        description: progress > 0.8 ? "Generated finale accent" : "Generated show accent",
        launchPositionIndex: i % 3,
      });
    }
  }

  if (lower.includes("sparse") || lower.includes("less") || lower.includes("minimal")) {
    cues = cues.filter((_, index) => index % 2 === 0);
  }

  if (lower.includes("more") || lower.includes("intense") || lower.includes("bigger")) {
    const accent = pickProduct(params.products, "accent");
    const start = Math.max(0, params.durationSeconds * 0.35);
    const end = Math.max(start + 1, params.durationSeconds * 0.82);
    const step = Math.max(6, (end - start) / 8);
    for (let time = start; time < end; time += step) {
      cues.push({
        timeSeconds: Number(time.toFixed(3)),
        productId: accent.id,
        description: "Refined intensity accent",
        launchPositionIndex: cues.length % 3,
      });
    }
  }

  if (lower.includes("finale") || lower.includes("ending") || lower.includes("climax")) {
    const climax = pickProduct(params.products, "climax");
    const finaleStart = Math.max(0, params.durationSeconds - 12);
    for (let i = 0; i < 4; i++) {
      cues.push({
        timeSeconds: Number((finaleStart + i * 2.5).toFixed(3)),
        productId: climax.id,
        description: "Refined finale hit",
        launchPositionIndex: i % 3,
      });
    }
  }

  if (lower.includes("crackle") || lower.includes("sparkle") || lower.includes("texture")) {
    const texture = pickProduct(params.products, "texture");
    const time = Math.max(0, params.durationSeconds * 0.65);
    cues.push({
      timeSeconds: Number(time.toFixed(3)),
      productId: texture.id,
      description: "Refined texture layer",
      launchPositionIndex: 1,
    });
  }

  if (wantsDefaultChange && cues.length > 0) {
    const accent = pickProduct(params.products, "accent");
    const midpoint = Math.max(1, params.durationSeconds * 0.5);
    cues = cues.map((cue, index) =>
      index % 3 === 0
        ? {
            ...cue,
            productId: accent.id,
            description: "Refined accent",
          }
        : cue,
    );
    cues.push({
      timeSeconds: Number(midpoint.toFixed(3)),
      productId: accent.id,
      description: "Refined accent",
      launchPositionIndex: cues.length % 3,
    });
  }

  const seen = new Set<string>();
  return cues
    .sort((a, b) => a.timeSeconds - b.timeSeconds)
    .filter((cue) => {
      const key = `${cue.timeSeconds.toFixed(1)}:${cue.productId}:${cue.launchPositionIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return cue.timeSeconds >= 0 && cue.timeSeconds <= params.durationSeconds;
    })
    .slice(0, 140);
}

export async function refineShowDesignAction(
  formData: FormData,
): Promise<RefineShowResult> {
  const parsed = RefineShowSchema.safeParse({
    showId: formData.get("showId"),
    showSlug: formData.get("showSlug"),
    instruction: formData.get("instruction"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Could not refine this show.",
    };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to refine a show." };
  }

  const { data: show, error: showError } = await supabase
    .from("shows")
    .select("id, slug, title, description, duration_seconds, mood_tags")
    .eq("id", parsed.data.showId)
    .eq("slug", parsed.data.showSlug)
    .eq("user_id", user.id)
    .maybeSingle();

  if (showError || !show) {
    console.error("[refineShowDesignAction] show load failed:", showError);
    return { ok: false, error: "Could not load this show." };
  }

  const { data: existingCueRows, error: cueError } = await supabase
    .from("show_cues")
    .select("id, position, time_seconds, description, product_id, launch_position_index")
    .eq("show_id", show.id)
    .order("time_seconds", { ascending: true });

  if (cueError) {
    console.error("[refineShowDesignAction] cue load failed:", cueError);
    return { ok: false, error: "Could not load the current cue plan." };
  }

  const existingCues = (existingCueRows ?? []) as ExistingCue[];
  const products = await listCuePlannerProducts(supabase);
  if (!products.length) {
    return { ok: false, error: "No firework catalogue products are available." };
  }

  const durationSeconds =
    Number(show.duration_seconds) ||
    Math.max(60, ...existingCues.map((cue) => Number(cue.time_seconds ?? 0)));
  const productSummaries = products.slice(0, 80).map((product) => ({
    id: product.id,
    name: product.name,
    partNumber: product.partNumber,
    subtype: product.subtype,
    description: product.description,
    durationSeconds: product.durationSeconds,
    heightMeters: product.heightMeters,
    effectNames: product.effectNames,
  }));

  const modelCues = await generateCuePlanFromPrompt({
    products,
    durationSeconds,
    prompt:
      "You are ShowCrafter's fireworks show refinement planner. Rewrite the cue list to satisfy the user's request.\n" +
      "Use only product IDs from the catalogue. Return JSON only: {\"cues\":[{\"timeSeconds\":number,\"productId\":uuid,\"description\":string,\"launchPositionIndex\":0|1|2}]}.\n" +
      "Keep strong existing timing ideas unless the user asks to change them. Avoid overlapping products on the same launchPositionIndex.\n" +
      "Descriptions must be short cue labels, never the user's full request. If the user asks for the same effect, use one productId for every cue. If the user asks for a firework at the start, include a cue at timeSeconds 0.\n" +
      `Show: ${JSON.stringify({
        title: show.title,
        description: show.description,
        durationSeconds,
        moodTags: show.mood_tags ?? [],
      })}\n` +
      `User refinement request: ${parsed.data.instruction}\n` +
      `Existing cues: ${JSON.stringify(existingCues.slice(0, 160))}\n` +
      `Available products: ${JSON.stringify(productSummaries)}`,
  });

  const plannedCues =
    modelCues?.length
      ? modelCues
      : fallbackRefinePlan({
          instruction: parsed.data.instruction,
          existingCues,
          products,
          durationSeconds,
        });
  const nextCues = applyInstructionRules({
    instruction: parsed.data.instruction,
    cues: plannedCues,
    products,
    existingCues,
    durationSeconds,
  });

  if (!nextCues.length) {
    return { ok: false, error: "No usable refined cues were generated." };
  }

  const { error: deleteError } = await supabase
    .from("show_cues")
    .delete()
    .eq("show_id", show.id);
  if (deleteError) {
    console.error("[refineShowDesignAction] cue delete failed:", deleteError);
    return { ok: false, error: "Could not replace the current cues." };
  }

  const { error: insertError } = await supabase.from("show_cues").insert(
    nextCues.map((cue, index) => ({
      show_id: show.id,
      position: index + 1,
      time_seconds: cue.timeSeconds,
      description: cue.description,
      product_id: cue.productId,
      launch_position_index: cue.launchPositionIndex,
    })),
  );

  if (insertError) {
    console.error("[refineShowDesignAction] cue insert failed:", insertError);
    return { ok: false, error: "Could not save the refined cues." };
  }

  await supabase
    .from("shows")
    .update({
      effects_count: nextCues.length,
      sync_percent: modelCues?.length ? 90 : 76,
      description:
        show.description ??
        `Refined from prompt: ${parsed.data.instruction.slice(0, 160)}`,
    })
    .eq("id", show.id);

  await invalidateShowCacheForUser(user.id, {
    showId: show.id,
    showSlug: show.slug,
  });
  revalidatePath(`/shows/${show.slug}`);
  revalidatePath(`/shows/${show.slug}/preview`);
  return { ok: true, redirectTo: `/shows/${show.slug}/preview` };
}
