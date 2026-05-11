"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { slugifyTitle } from "@/lib/show-domain";
import { invalidateShowsCacheForUser } from "@/lib/shows.server";
import { getShowTemplateBySlug } from "@/lib/admin.server";

export async function cloneShowTemplateAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const template = await getShowTemplateBySlug(slug);
  if (!template) return;

  const baseSlug = slugifyTitle(template.title);
  const showSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: show, error: showError } = await supabase
    .from("shows")
    .insert({
      user_id: user.id,
      slug: showSlug,
      title: `${template.title} copy`,
      description: template.description,
      duration_seconds: template.durationSeconds,
      budget_cents: template.budgetCents,
      total_cents: template.totalCents,
      effects_count: template.effectsCount,
      time_of_day: template.timeOfDay,
      mood_tags: template.moodTags,
      status: "draft",
    })
    .select("id, slug")
    .single();

  if (showError || !show) {
    console.error("[cloneShowTemplateAction] show insert failed:", showError);
    return;
  }

  if (template.previewCues.length > 0) {
    // Map every effect_spec slug to a product whose first product_shot
    // references that effect_spec. After the schema restructure, every
    // legacy effect_spec has at least an `auto-<slug>` wrapper product, so
    // the lookup is total for any slug the templates use.
    type ProductShotRow = {
      product_id: string;
      shot_index: number;
      effect_specs: { slug: string } | null;
    };
    const { data: shots } = await supabase
      .from("product_shots")
      .select("product_id, shot_index, effect_specs ( slug )")
      .eq("shot_index", 1);
    const productByEffectSlug = new Map<string, string>();
    for (const shot of ((shots ?? []) as ProductShotRow[])) {
      const slug = shot.effect_specs?.slug;
      if (!slug || productByEffectSlug.has(slug)) continue;
      productByEffectSlug.set(slug, shot.product_id);
    }
    const cueRows = template.previewCues
      .map((cue, index) => {
        const productId = productByEffectSlug.get(cue.fireworkSlug);
        if (!productId) return null;
        return {
          show_id: show.id,
          position: index + 1,
          time_seconds: cue.timeSeconds,
          description: cue.description,
          product_id: productId,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
    if (cueRows.length > 0) {
      const { error: cuesError } = await supabase.from("show_cues").insert(cueRows);
      if (cuesError) {
        console.error("[cloneShowTemplateAction] cue insert failed:", cuesError);
      }
    }
  }

  await invalidateShowsCacheForUser(user.id);
  revalidatePath("/dashboard");
  redirect(`/shows/${show.slug}`);
}
