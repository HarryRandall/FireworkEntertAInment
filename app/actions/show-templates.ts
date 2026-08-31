'use server';

/**
 * Server action for cloning a curated show template into a new
 * user-owned show, copying preview cues and derived fields.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/utils/supabase/server';
import type { Json } from '@/lib/database.types';
import type { FireworkSpecification } from '@/lib/show-domain';
import { slugifyTitle } from '@/lib/show-domain';
import { validatePresetTimeline } from '@/lib/show-preset-timing.server';
import { listFireworkProducts, syncShowDerivedFieldsForUser } from '@/lib/shows.server';
import { getShowTemplateBySlug } from '@/lib/admin.server';
import { randomCover } from '@/lib/cover';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INCOMPLETE_CLONE_GRACE_MS = 30_000;
const FIREWORK_SLUG_ALIASES: Record<string, string> = {
  chrysanthemum: 'gold-chrysanthemum',
  comet: 'comet-gold',
  finale_barrage: 'white-strobe',
  peony: 'gold-chrysanthemum',
  willow: 'willow-gold',
};

function redirectToCloneError(slug: string): never {
  redirect(`/library/${encodeURIComponent(slug)}?cloneError=1`);
}

function productLookup(products: FireworkSpecification[]): Map<string, FireworkSpecification> {
  const lookup = new Map<string, FireworkSpecification>();
  for (const product of products) {
    const keys = [
      product.id,
      product.slug,
      product.variant?.id,
      product.variant?.slug,
      product.baseEffect?.id,
      product.baseEffect?.slug,
    ].filter((key): key is string => Boolean(key));
    for (const key of keys) if (!lookup.has(key)) lookup.set(key, product);
  }
  return lookup;
}

async function cloneCueCount(
  supabase: ReturnType<typeof createClient>,
  showId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from('show_timeline_items')
    .select('id', { count: 'exact', head: true })
    .eq('show_id', showId);
  if (error) {
    console.error('[cloneShowTemplateAction] cue count failed:', error);
    return null;
  }
  return count ?? 0;
}

async function removeIncompleteClone(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  showId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('shows')
    .delete()
    .eq('id', showId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    console.error('[cloneShowTemplateAction] incomplete clone cleanup failed:', error);
    return false;
  }
  return true;
}

/** Clone a curated show template into a new user-owned show, copying preview cues, and redirect to it. */
export async function cloneShowTemplateAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  if (!slug) return;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Guests can browse templates but cloning creates a user-owned show, so
    // send them to login and bring them back to the template afterwards.
    redirect(`/login?next=${encodeURIComponent(`/library/${slug}`)}`);
  }

  const template = await getShowTemplateBySlug(slug);
  if (!template) return;

  const products = await listFireworkProducts({ lightweight: true });
  const productsByKey = productLookup(products);
  const resolvedCues = template.previewCues.flatMap((cue, index) => {
    const alias = cue.fireworkSlug ? FIREWORK_SLUG_ALIASES[cue.fireworkSlug] : undefined;
    const keys = [cue.catalogueItemId, cue.catalogueItemSlug, cue.fireworkSlug, alias].filter(
      (key): key is string => Boolean(key),
    );
    const product = keys.map((key) => productsByKey.get(key)).find(Boolean);
    if (!product) return [];
    return [
      {
        position: index + 1,
        timeSeconds: cue.timeSeconds,
        description: cue.description || product.name,
        catalogueItemId: product.id,
        launchPositionIndex: cue.launchPositionIndex,
        emphasis: cue.emphasis,
      },
    ];
  });
  if (resolvedCues.length !== template.previewCues.length) {
    console.error('[cloneShowTemplateAction] template contains unresolved catalogue cues:', slug);
    redirectToCloneError(slug);
  }
  const timingValidation = validatePresetTimeline(
    resolvedCues,
    new Map(products.map((product) => [product.id, product])),
    template.durationSeconds,
  );
  if (!timingValidation.ok) {
    console.error('[cloneShowTemplateAction] template timeline is unsafe:', timingValidation.error);
    redirectToCloneError(slug);
  }

  const baseSlug = slugifyTitle(template.title);
  const requestedCloneToken = String(formData.get('cloneToken') ?? '');
  const cloneToken = UUID_PATTERN.test(requestedCloneToken) ? requestedCloneToken : randomUUID();
  const showSlug = `${baseSlug}-${cloneToken.replaceAll('-', '').slice(0, 10)}`;
  const { data: existingShow } = await supabase
    .from('shows')
    .select('id, slug, created_at')
    .eq('user_id', user.id)
    .eq('slug', showSlug)
    .maybeSingle();
  if (existingShow) {
    const existingCueCount = await cloneCueCount(supabase, existingShow.id);
    if (existingCueCount === resolvedCues.length) {
      redirect(`/shows/${existingShow.slug}/preview`);
    }
    const cloneAgeMs = Date.now() - Date.parse(existingShow.created_at);
    if (
      existingCueCount == null ||
      !Number.isFinite(cloneAgeMs) ||
      cloneAgeMs < INCOMPLETE_CLONE_GRACE_MS ||
      !(await removeIncompleteClone(supabase, user.id, existingShow.id))
    ) {
      redirectToCloneError(slug);
    }
  }

  const { data: show, error: showError } = await supabase
    .from('shows')
    .insert({
      user_id: user.id,
      slug: showSlug,
      title: `${template.title} copy`,
      description: template.description,
      duration_seconds: template.durationSeconds,
      budget_cents: template.budgetCents,
      cover_shader: template.coverShader ?? randomCover(),
      cover_image_path: template.coverImagePath ?? null,
      total_cents: template.totalCents,
      effects_count: template.effectsCount,
      time_of_day: template.timeOfDay,
      mood_tags: template.moodTags,
      status: 'draft',
    })
    .select('id, slug')
    .single();

  if (showError || !show) {
    if (showError?.code === '23505') {
      const { data: concurrentShow } = await supabase
        .from('shows')
        .select('id, slug')
        .eq('user_id', user.id)
        .eq('slug', showSlug)
        .maybeSingle();
      if (
        concurrentShow &&
        (await cloneCueCount(supabase, concurrentShow.id)) === resolvedCues.length
      ) {
        redirect(`/shows/${concurrentShow.slug}/preview`);
      }
    }
    console.error('[cloneShowTemplateAction] show insert failed:', showError);
    redirectToCloneError(slug);
  }

  if (resolvedCues.length > 0) {
    const timelineItems = resolvedCues.map((cue) => ({
      position: cue.position,
      time_seconds: cue.timeSeconds,
      description: cue.description,
      catalogue_item_id: cue.catalogueItemId,
      launch_position_index: cue.launchPositionIndex,
      emphasis: cue.emphasis,
    }));
    const { data: replacedCount, error: cuesError } = await supabase.rpc(
      'replace_show_timeline_items',
      {
        p_show_id: show.id,
        p_user_id: user.id,
        p_items: timelineItems as Json,
      },
    );
    if (cuesError || replacedCount !== timelineItems.length) {
      const removed = await removeIncompleteClone(supabase, user.id, show.id);
      console.error('[cloneShowTemplateAction] cue replacement failed:', cuesError, {
        expectedCount: timelineItems.length,
        replacedCount,
        cleanupSucceeded: removed,
      });
      redirectToCloneError(slug);
    }
  }

  try {
    await syncShowDerivedFieldsForUser(user.id, {
      showId: show.id,
      showSlug: show.slug,
    });
  } catch (error) {
    const removed = await removeIncompleteClone(supabase, user.id, show.id);
    console.error('[cloneShowTemplateAction] derived-field sync failed:', error, {
      cleanupSucceeded: removed,
    });
    redirectToCloneError(slug);
  }
  revalidatePath('/home');
  redirect(`/shows/${show.slug}/preview`);
}
