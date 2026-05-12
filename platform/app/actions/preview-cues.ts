"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { invalidateShowCacheForUser } from "@/lib/shows.server";
import type { Database } from "@/lib/database.types";

export type CueActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const AddCueSchema = z.object({
  showId: z.string().uuid(),
  showSlug: z.string().min(1),
  productId: z.string().uuid(),
  timeSeconds: z.coerce.number().min(0).max(60 * 60),
  description: z.string().trim().min(1).max(180),
  launchPositionIndex: z.coerce.number().int().min(0).max(2).default(0),
});

const MIN_PRODUCT_DURATION_SECONDS = 0.5;

// Compute the total airtime a product occupies on a tube. Prefer the
// pre-aggregated `products.duration_seconds`; fall back to the largest
// `time_offset_seconds + effect_specs.duration_seconds` from `product_shots`.
async function getProductDurationSeconds(
  supabase: SupabaseClient<Database>,
  productId: string,
): Promise<number | null> {
  const { data: product } = await supabase
    .from("products")
    .select("duration_seconds")
    .eq("id", productId)
    .maybeSingle();
  if (product?.duration_seconds != null) return Number(product.duration_seconds);

  const { data: shots } = await supabase
    .from("product_shots")
    .select("time_offset_seconds, effect_specs!inner(duration_seconds)")
    .eq("product_id", productId);
  if (!shots || shots.length === 0) return null;
  let max = 0;
  for (const shot of shots as Array<{
    time_offset_seconds: number;
    effect_specs: { duration_seconds: number } | null;
  }>) {
    const end =
      Number(shot.time_offset_seconds ?? 0) +
      Number(shot.effect_specs?.duration_seconds ?? 0);
    if (end > max) max = end;
  }
  return max;
}

function formatSeconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

const DeleteCueSchema = z.object({
  cueId: z.string().uuid(),
  showSlug: z.string().min(1),
});

export async function addPreviewCueAction(
  formData: FormData,
): Promise<CueActionResult> {
  const parsed = AddCueSchema.safeParse({
    showId: formData.get("showId"),
    showSlug: formData.get("showSlug"),
    productId: formData.get("productId"),
    timeSeconds: formData.get("timeSeconds"),
    description: formData.get("description"),
    launchPositionIndex: formData.get("launchPositionIndex") ?? 0,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the cue details.",
    };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const newDuration =
    (await getProductDurationSeconds(supabase, parsed.data.productId)) ??
    MIN_PRODUCT_DURATION_SECONDS;
  const newStart = parsed.data.timeSeconds;
  const newEnd = newStart + newDuration;

  // Tube-busy check: a tube is "busy" from cue.timeSeconds to
  // cue.timeSeconds + the product's full airtime. Reject if the new cue's
  // window overlaps an existing cue on the same launch_position_index.
  const { data: existingCues } = await supabase
    .from("show_cues")
    .select("id, time_seconds, product_id, description")
    .eq("show_id", parsed.data.showId)
    .eq("launch_position_index", parsed.data.launchPositionIndex);

  for (const cue of existingCues ?? []) {
    if (cue.time_seconds == null) continue;
    const otherDuration =
      (await getProductDurationSeconds(supabase, cue.product_id)) ??
      MIN_PRODUCT_DURATION_SECONDS;
    const otherStart = Number(cue.time_seconds);
    const otherEnd = otherStart + otherDuration;
    if (newStart < otherEnd && otherStart < newEnd) {
      return {
        ok: false,
        error: `Tube ${parsed.data.launchPositionIndex + 1} is busy from ${formatSeconds(otherStart)} to ${formatSeconds(otherEnd)} (${cue.description}). Pick a different time or tube.`,
      };
    }
  }

  const { data: lastCue } = await supabase
    .from("show_cues")
    .select("position")
    .eq("show_id", parsed.data.showId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("show_cues").insert({
    show_id: parsed.data.showId,
    position: (lastCue?.position ?? 0) + 1,
    time_seconds: parsed.data.timeSeconds,
    description: parsed.data.description,
    product_id: parsed.data.productId,
    launch_position_index: parsed.data.launchPositionIndex,
  });

  if (error) {
    console.error("[addPreviewCueAction] insert failed:", error);
    return { ok: false, error: "Could not add that firework cue." };
  }

  if (user) {
    await invalidateShowCacheForUser(user.id, {
      showId: parsed.data.showId,
      showSlug: parsed.data.showSlug,
    });
  }
  revalidatePath(`/shows/${parsed.data.showSlug}/preview`);
  return { ok: true, message: "Cue added." };
}

export async function deletePreviewCueAction(
  formData: FormData,
): Promise<CueActionResult> {
  const parsed = DeleteCueSchema.safeParse({
    cueId: formData.get("cueId"),
    showSlug: formData.get("showSlug"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Could not identify that cue." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: deletedCue, error } = await supabase
    .from("show_cues")
    .delete()
    .eq("id", parsed.data.cueId)
    .select("show_id")
    .maybeSingle();

  if (error) {
    console.error("[deletePreviewCueAction] delete failed:", error);
    return { ok: false, error: "Could not remove that firework cue." };
  }

  if (user && deletedCue?.show_id) {
    await invalidateShowCacheForUser(user.id, {
      showId: deletedCue.show_id,
      showSlug: parsed.data.showSlug,
    });
  }
  revalidatePath(`/shows/${parsed.data.showSlug}/preview`);
  return { ok: true, message: "Cue removed." };
}
