"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { invalidateShowCacheForUser } from "@/lib/shows.server";

export type CueActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const AddCueSchema = z.object({
  showId: z.string().uuid(),
  showSlug: z.string().min(1),
  fireworkSpecificationId: z.string().uuid(),
  timeSeconds: z.coerce.number().min(0).max(60 * 60),
  description: z.string().trim().min(1).max(180),
});

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
    fireworkSpecificationId: formData.get("fireworkSpecificationId"),
    timeSeconds: formData.get("timeSeconds"),
    description: formData.get("description"),
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
    firework_specification_id: parsed.data.fireworkSpecificationId,
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
