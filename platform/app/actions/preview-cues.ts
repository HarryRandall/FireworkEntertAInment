'use server';

/**
 * Server actions for the show preview cue editor: add and remove
 * cues on a show. Adds reject overlapping cues on the same launch
 * position based on each product's airtime (see `cue-overlap`).
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { syncShowDerivedFieldsForUser } from '@/lib/shows.server';
import {
  MIN_PRODUCT_DURATION_SECONDS,
  findTubeOverlap,
  getProductDurationSeconds,
} from '@/lib/cue-overlap.server';

export type CueActionResult = { ok: true; message?: string } | { ok: false; error: string };

const AddCueSchema = z.object({
  showId: z.string().uuid(),
  showSlug: z.string().min(1),
  productId: z.string().uuid(),
  timeSeconds: z.coerce
    .number()
    .min(0)
    .max(60 * 60),
  description: z.string().trim().min(1).max(180),
  launchPositionIndex: z.coerce.number().int().min(0).max(2).default(0),
});

function formatSeconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

const DeleteCueSchema = z.object({
  cueId: z.string().uuid(),
  showSlug: z.string().min(1),
});

/** Add a new cue to a show after checking it does not overlap an existing cue on the same launch position. */
export async function addPreviewCueAction(formData: FormData): Promise<CueActionResult> {
  const parsed = AddCueSchema.safeParse({
    showId: formData.get('showId'),
    showSlug: formData.get('showSlug'),
    productId: formData.get('productId'),
    timeSeconds: formData.get('timeSeconds'),
    description: formData.get('description'),
    launchPositionIndex: formData.get('launchPositionIndex') ?? 0,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Check the cue details.',
    };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const newDuration =
    (await getProductDurationSeconds(supabase, parsed.data.productId)) ??
    MIN_PRODUCT_DURATION_SECONDS;

  const { data: existingCues } = await supabase
    .from('show_timeline_items')
    .select('id, time_seconds, catalogue_item_id, description')
    .eq('show_id', parsed.data.showId)
    .eq('launch_position_index', parsed.data.launchPositionIndex);

  const existingWindows: Array<{
    timeSeconds: number;
    durationSeconds: number;
    launchPositionIndex: number;
    description: string;
  }> = [];
  for (const cue of existingCues ?? []) {
    if (cue.time_seconds == null) continue;
    const otherDuration =
      (await getProductDurationSeconds(supabase, cue.catalogue_item_id)) ??
      MIN_PRODUCT_DURATION_SECONDS;
    existingWindows.push({
      timeSeconds: Number(cue.time_seconds),
      durationSeconds: otherDuration,
      launchPositionIndex: parsed.data.launchPositionIndex,
      description: cue.description,
    });
  }

  const conflict = findTubeOverlap(
    {
      timeSeconds: parsed.data.timeSeconds,
      durationSeconds: newDuration,
      launchPositionIndex: parsed.data.launchPositionIndex,
    },
    existingWindows,
  );
  if (conflict) {
    const otherEnd = conflict.timeSeconds + conflict.durationSeconds;
    return {
      ok: false,
      error: `Tube ${parsed.data.launchPositionIndex + 1} is busy from ${formatSeconds(conflict.timeSeconds)} to ${formatSeconds(otherEnd)} (${conflict.description}). Pick a different time or tube.`,
    };
  }

  const { data: lastCue } = await supabase
    .from('show_timeline_items')
    .select('position')
    .eq('show_id', parsed.data.showId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('show_timeline_items').insert({
    show_id: parsed.data.showId,
    position: (lastCue?.position ?? 0) + 1,
    time_seconds: parsed.data.timeSeconds,
    description: parsed.data.description,
    catalogue_item_id: parsed.data.productId,
    launch_position_index: parsed.data.launchPositionIndex,
  });

  if (error) {
    console.error('[addPreviewCueAction] insert failed:', error);
    return { ok: false, error: 'Could not add that firework cue.' };
  }

  if (user) {
    await syncShowDerivedFieldsForUser(user.id, {
      showId: parsed.data.showId,
      showSlug: parsed.data.showSlug,
    });
  }
  revalidatePath(`/shows/${parsed.data.showSlug}/preview`);
  return { ok: true, message: 'Cue added.' };
}

/** Delete a cue by id from a show and re-sync the show's derived fields. */
export async function deletePreviewCueAction(formData: FormData): Promise<CueActionResult> {
  const parsed = DeleteCueSchema.safeParse({
    cueId: formData.get('cueId'),
    showSlug: formData.get('showSlug'),
  });

  if (!parsed.success) {
    return { ok: false, error: 'Could not identify that cue.' };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: deletedCue, error } = await supabase
    .from('show_timeline_items')
    .delete()
    .eq('id', parsed.data.cueId)
    .select('show_id')
    .maybeSingle();

  if (error) {
    console.error('[deletePreviewCueAction] delete failed:', error);
    return { ok: false, error: 'Could not remove that firework cue.' };
  }

  // No row came back means nothing matched (wrong id or blocked by RLS); don't
  // tell the user it was removed when it wasn't.
  if (!deletedCue) {
    return { ok: false, error: 'Could not find that cue to remove.' };
  }

  if (user && deletedCue?.show_id) {
    await syncShowDerivedFieldsForUser(user.id, {
      showId: deletedCue.show_id,
      showSlug: parsed.data.showSlug,
    });
  }
  revalidatePath(`/shows/${parsed.data.showSlug}/preview`);
  return { ok: true, message: 'Cue removed.' };
}
