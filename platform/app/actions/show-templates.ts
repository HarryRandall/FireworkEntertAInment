'use server';

/**
 * Server action for cloning a curated show template into a new
 * user-owned show, copying preview cues and derived fields.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { slugifyTitle } from '@/lib/show-domain';
import { syncShowDerivedFieldsForUser } from '@/lib/shows.server';
import { getShowTemplateBySlug } from '@/lib/admin.server';

/** Clone a curated show template into a new user-owned show, copying preview cues, and redirect to it. */
export async function cloneShowTemplateAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
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
    .from('shows')
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
      status: 'draft',
    })
    .select('id, slug')
    .single();

  if (showError || !show) {
    console.error('[cloneShowTemplateAction] show insert failed:', showError);
    return;
  }

  if (template.previewCues.length > 0) {
    type FireworkSlugJoin = { slug: string } | { slug: string }[] | null;
    type CatalogueItemRow = {
      id: string;
      part_number: string;
      fireworks: FireworkSlugJoin;
      multishots: {
        multishot_fireworks: Array<{
          sequence_index: number;
          fireworks: FireworkSlugJoin;
        }>;
      } | null;
    };
    const { data: catalogueItems } = await supabase.from('catalogue_items').select(
      `id, part_number,
         fireworks (slug),
         multishots (
           multishot_fireworks (
             sequence_index,
             fireworks (slug)
           )
         )`,
    );
    const firstSlug = (value: FireworkSlugJoin): string | null => {
      if (!value) return null;
      const row = Array.isArray(value) ? (value[0] ?? null) : value;
      return row?.slug ?? null;
    };
    const catalogueItemBySlug = new Map<string, string>();
    for (const item of (catalogueItems ?? []) as CatalogueItemRow[]) {
      if (!catalogueItemBySlug.has(item.part_number)) {
        catalogueItemBySlug.set(item.part_number, item.id);
      }
      const directSlug = firstSlug(item.fireworks);
      if (directSlug && !catalogueItemBySlug.has(directSlug)) {
        catalogueItemBySlug.set(directSlug, item.id);
      }
      const firstMultishot = [...(item.multishots?.multishot_fireworks ?? [])].sort(
        (a, b) => a.sequence_index - b.sequence_index,
      )[0];
      const multishotSlug = firstSlug(firstMultishot?.fireworks ?? null);
      if (multishotSlug && !catalogueItemBySlug.has(multishotSlug)) {
        catalogueItemBySlug.set(multishotSlug, item.id);
      }
    }
    const cueRows = template.previewCues
      .map((cue, index) => {
        const catalogueItemId = catalogueItemBySlug.get(cue.fireworkSlug);
        if (!catalogueItemId) return null;
        return {
          show_id: show.id,
          position: index + 1,
          time_seconds: cue.timeSeconds,
          description: cue.description,
          catalogue_item_id: catalogueItemId,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
    if (cueRows.length > 0) {
      const { error: cuesError } = await supabase.from('show_timeline_items').insert(cueRows);
      if (cuesError) {
        console.error('[cloneShowTemplateAction] cue insert failed:', cuesError);
      }
    }
  }

  await syncShowDerivedFieldsForUser(user.id, {
    showId: show.id,
    showSlug: show.slug,
  });
  revalidatePath('/dashboard');
  redirect(`/shows/${show.slug}/preview`);
}
