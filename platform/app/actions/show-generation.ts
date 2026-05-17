"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { invalidateShowCacheForUser } from "@/lib/shows.server";
import type { Database, Json } from "@/lib/database.types";
import type { AnalyzerResult } from "@/lib/show-analysis.types";
import {
  planMusicAnalysisCues,
  type CompactPayload,
  type MusicCueProductInput,
  type MusicCueProductShot,
} from "@/lib/music-cue-planner";

export type GenerateCuesActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  generatedCount?: number;
};

type AppSupabaseClient = SupabaseClient<Database>;

type ShowForGeneration = {
  id: string;
  slug: string;
  title: string;
  user_id: string;
  duration_seconds: number | null;
  budget_cents: number | null;
};

type AnalysisRow = {
  id: string;
  analysis_json: Json | null;
  analysis_storage_path: string | null;
  compact_payload: Json | null;
  schema_version: string | null;
};

type EffectSpecJoin = {
  name: string | null;
  type: string | null;
  description: string | null;
  duration_seconds: number | null;
  height_meters: number | null;
  spec_json: Json | null;
};

type ProductShotJoin = {
  product_id: string;
  shot_index: number | null;
  time_offset_seconds: number | null;
  effect_specs: EffectSpecJoin | EffectSpecJoin[] | null;
};

type CuePositionRow = {
  id: string;
  time_seconds: number | null;
  position: number;
};

const GENERATED_TRACK = "music-analysis";
const GENERATED_LAYER = "generated";

const GenerateCuesSchema = z.object({
  showId: z.string().uuid(),
  showSlug: z.string().min(1),
  brief: z.string().trim().max(1000).optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asAnalysis(value: Json | null): AnalyzerResult | null {
  if (!isRecord(value)) return null;
  if (typeof value.schema_version !== "string") return null;
  if (!Array.isArray(value.sections)) return null;
  if (!Array.isArray(value.key_moments)) return null;
  if (!Array.isArray(value.buildups)) return null;
  return value as unknown as AnalyzerResult;
}

function normalizeCompactPayload(value: Json | null): CompactPayload | null {
  return isRecord(value) ? (value as CompactPayload) : null;
}

async function loadStoredAnalysis(
  supabase: AppSupabaseClient,
  row: AnalysisRow,
): Promise<AnalyzerResult | null> {
  const inline = asAnalysis(row.analysis_json);
  if (inline) return inline;
  if (!row.analysis_storage_path) return null;

  const { data, error } = await supabase.storage
    .from("audio")
    .download(row.analysis_storage_path);
  if (error || !data) {
    console.error("[show-generation] analysis download failed:", error);
    return null;
  }
  try {
    return asAnalysis(JSON.parse(await data.text()) as Json);
  } catch (error) {
    console.error("[show-generation] analysis JSON parse failed:", error);
    return null;
  }
}

function firstEffectSpec(value: ProductShotJoin["effect_specs"]): EffectSpecJoin | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function loadProductsForGeneration(
  supabase: AppSupabaseClient,
): Promise<MusicCueProductInput[]> {
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, part_number, subtype, description, duration_seconds")
    .order("name", { ascending: true });
  if (productsError) {
    throw new Error(`Could not load firework products: ${productsError.message}`);
  }

  const productMap = new Map<string, MusicCueProductInput>();
  for (const product of products ?? []) {
    productMap.set(product.id, {
      id: product.id,
      name: product.name,
      partNumber: product.part_number,
      subtype: product.subtype,
      description: product.description,
      durationSeconds: product.duration_seconds,
      priceCents: null,
      quantityOnHand: null,
      shots: [],
    });
  }

  if (productMap.size === 0) return [];

  const productIds = [...productMap.keys()];
  const { data: shots, error: shotsError } = await supabase
    .from("product_shots")
    .select(
      `product_id, shot_index, time_offset_seconds,
       effect_specs ( name, type, description, duration_seconds, height_meters, spec_json )`,
    )
    .in("product_id", productIds)
    .order("shot_index", { ascending: true });
  if (shotsError) {
    throw new Error(`Could not load product shots: ${shotsError.message}`);
  }

  for (const row of (shots ?? []) as unknown as ProductShotJoin[]) {
    const product = productMap.get(row.product_id);
    const spec = firstEffectSpec(row.effect_specs);
    if (!product || !spec) continue;
    const shot: MusicCueProductShot = {
      shotIndex: row.shot_index ?? product.shots.length + 1,
      timeOffsetSeconds: Number(row.time_offset_seconds ?? 0),
      effectName: spec.name,
      effectType: spec.type,
      effectDescription: spec.description,
      effectDurationSeconds: spec.duration_seconds,
      heightMeters: spec.height_meters,
      specJson: spec.spec_json,
    };
    product.shots.push(shot);
  }

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from("supplier_inventory_items")
    .select("product_id, price_cents, quantity_on_hand, available")
    .in("product_id", productIds)
    .eq("available", true);
  if (inventoryError) {
    console.error("[show-generation] inventory lookup failed:", inventoryError);
  }

  for (const inventory of inventoryRows ?? []) {
    if (!inventory.product_id) continue;
    const product = productMap.get(inventory.product_id);
    if (!product) continue;
    if (inventory.price_cents != null) {
      product.priceCents =
        product.priceCents == null
          ? inventory.price_cents
          : Math.min(product.priceCents, inventory.price_cents);
    }
    if (inventory.quantity_on_hand != null) {
      product.quantityOnHand =
        (product.quantityOnHand ?? 0) + inventory.quantity_on_hand;
    }
  }

  return [...productMap.values()].filter((product) => product.shots.length > 0);
}

async function countShowCues(
  supabase: AppSupabaseClient,
  showId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("show_cues")
    .select("id", { count: "exact", head: true })
    .eq("show_id", showId);
  if (error) {
    console.error("[show-generation] countShowCues failed:", error);
    return null;
  }
  return count;
}

async function reindexShowCuesByTimeline(
  supabase: AppSupabaseClient,
  showId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("show_cues")
    .select("id, time_seconds, position")
    .eq("show_id", showId);
  if (error) {
    console.error("[show-generation] cue timeline lookup failed:", error);
    return null;
  }

  const rows = ((data ?? []) as CuePositionRow[]).sort((a, b) => {
    const aTime = a.time_seconds == null ? Number.POSITIVE_INFINITY : a.time_seconds;
    const bTime = b.time_seconds == null ? Number.POSITIVE_INFINITY : b.time_seconds;
    if (aTime !== bTime) return aTime - bTime;
    if (a.position !== b.position) return a.position - b.position;
    return a.id.localeCompare(b.id);
  });

  const updateErrors = await Promise.all(
    rows.map(async (row, index) => {
      const nextPosition = index + 1;
      if (row.position === nextPosition) return null;
      const { error: updateError } = await supabase
        .from("show_cues")
        .update({ position: nextPosition })
        .eq("id", row.id);
      return updateError?.message ?? null;
    }),
  );
  const failedUpdates = updateErrors.filter((message): message is string => message != null);
  if (failedUpdates.length > 0) {
    console.error("[show-generation] cue timeline reindex failed:", failedUpdates);
    return null;
  }

  return rows.length;
}

function revalidateShowPaths(showSlug: string) {
  revalidatePath(`/shows/${showSlug}`);
  revalidatePath(`/shows/${showSlug}/preview`);
  revalidatePath(`/shows/${showSlug}/shopping-list`);
  revalidatePath(`/shows/${showSlug}/show-guide`);
  revalidatePath("/dashboard");
}

export async function generateCuesFromAnalysisAction(
  _prev: GenerateCuesActionState,
  formData: FormData,
): Promise<GenerateCuesActionState> {
  const parsed = GenerateCuesSchema.safeParse({
    showId: formData.get("showId"),
    showSlug: formData.get("showSlug"),
    brief: formData.get("brief") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the generation request.",
    };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { status: "error", message: "You must be signed in to generate cues." };
  }

  const { data: show, error: showError } = await supabase
    .from("shows")
    .select("id, slug, title, user_id, duration_seconds, budget_cents")
    .eq("id", parsed.data.showId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (showError) {
    console.error("[show-generation] show lookup failed:", showError);
    return { status: "error", message: "Could not load this show." };
  }
  if (!show) return { status: "error", message: "Show not found." };

  const typedShow = show as ShowForGeneration;
  if (typedShow.slug !== parsed.data.showSlug) {
    return { status: "error", message: "Show URL no longer matches this show." };
  }

  const { data: analysisRow, error: analysisError } = await supabase
    .from("show_analyses")
    .select("id, analysis_json, analysis_storage_path, compact_payload, schema_version")
    .eq("show_id", typedShow.id)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (analysisError) {
    console.error("[show-generation] analysis lookup failed:", analysisError);
    return { status: "error", message: "Could not load the latest audio analysis." };
  }
  if (!analysisRow) {
    return {
      status: "error",
      message: "Run audio analysis before generating cues.",
    };
  }

  const typedAnalysisRow = analysisRow as AnalysisRow;
  const analysis = await loadStoredAnalysis(supabase, typedAnalysisRow);
  if (!analysis) {
    return {
      status: "error",
      message: "The latest analysis is missing its JSON output. Re-run analysis first.",
    };
  }

  let products: MusicCueProductInput[];
  try {
    products = await loadProductsForGeneration(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }

  const plan = planMusicAnalysisCues({
    analysis,
    compactPayload: normalizeCompactPayload(typedAnalysisRow.compact_payload),
    products,
    budgetCents: typedShow.budget_cents,
    durationSeconds: typedShow.duration_seconds,
    brief: parsed.data.brief,
  });
  if (plan.cues.length === 0) {
    return {
      status: "error",
      message: plan.skippedReason ?? "Could not map the analysis to available products.",
    };
  }

  const { error: deleteError } = await supabase
    .from("show_cues")
    .delete()
    .eq("show_id", typedShow.id)
    .eq("track", GENERATED_TRACK)
    .eq("locked", false);
  if (deleteError) {
    console.error("[show-generation] generated cue cleanup failed:", deleteError);
    return { status: "error", message: "Could not clear the previous generated cues." };
  }

  const cueRows: Database["public"]["Tables"]["show_cues"]["Insert"][] =
    plan.cues.map((cue, index) => ({
      show_id: typedShow.id,
      position: index + 1,
      time_seconds: cue.timeSeconds,
      description: cue.description,
      product_id: cue.productId,
      launch_position_index: cue.launchPositionIndex,
      seed_override: cue.seedOverride,
      label: `analysis:${typedAnalysisRow.id}`,
      track: GENERATED_TRACK,
      layer: GENERATED_LAYER,
      locked: false,
    }));

  const { error: insertError } = await supabase.from("show_cues").insert(cueRows);
  if (insertError) {
    console.error("[show-generation] cue insert failed:", insertError);
    return { status: "error", message: "Could not save generated cues." };
  }

  const reindexedCueCount = await reindexShowCuesByTimeline(supabase, typedShow.id);
  const cueCount =
    reindexedCueCount ?? (await countShowCues(supabase, typedShow.id)) ?? plan.cues.length;
  const { error: showUpdateError } = await supabase
    .from("shows")
    .update({
      effects_count: cueCount,
      sync_percent: Math.max(
        70,
        Math.min(98, Math.round((plan.cues.length / plan.targetCount) * 100)),
      ),
      status: "draft",
    })
    .eq("id", typedShow.id);
  if (showUpdateError) {
    console.error("[show-generation] show summary update failed:", showUpdateError);
  }

  await invalidateShowCacheForUser(user.id, {
    showId: typedShow.id,
    showSlug: typedShow.slug,
  });
  revalidateShowPaths(typedShow.slug);

  return {
    status: "success",
    generatedCount: plan.cues.length,
    message: `Generated ${plan.cues.length} cues from the latest analysis.`,
  };
}
