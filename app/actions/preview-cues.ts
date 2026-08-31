'use server';

/**
 * Server actions for the show preview cue editor: add and remove
 * cues on a show. The guarded database mutation serialises each show and
 * rejects overlaps across every launch position occupied by a product.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { syncShowDerivedFieldsForUser } from '@/lib/shows.server';
import {
  invalidateSidebarAiUsageCache,
  refundAiCreditReservation,
  reserveAiCredits,
  showRefinementReservationKey,
} from '@/lib/ai-credits.server';
import { addShowTimelineItem, deleteShowTimelineItem } from '@/lib/show-timeline-mutations.server';

export type CueActionResult = { ok: true; message?: string } | { ok: false; error: string };

const AddCueSchema = z.object({
  showId: z.string().uuid(),
  showSlug: z.string().min(1),
  productId: z.string().uuid(),
  timeSeconds: z.coerce
    .number()
    .min(0)
    .max(60 * 60),
  description: z.string().trim().max(180).optional(),
  launchPositionIndex: z.coerce.number().int().min(0).max(2).default(0),
  emphasis: z.enum(['normal', 'accent', 'peak']).default('normal'),
  aiCreditAction: z.enum(['show_refinement']).optional(),
  aiCreditReferenceId: z.string().uuid().optional(),
  refinementPrompt: z.string().trim().max(1000).optional(),
});

const DeleteCueSchema = z.object({
  cueId: z.string().uuid(),
  showSlug: z.string().min(1),
});

/** Add a new cue through the atomic, overlap-safe database mutation. */
export async function addPreviewCueAction(formData: FormData): Promise<CueActionResult> {
  const parsed = AddCueSchema.safeParse({
    showId: formData.get('showId'),
    showSlug: formData.get('showSlug'),
    productId: formData.get('productId'),
    timeSeconds: formData.get('timeSeconds'),
    description: formData.get('description') || undefined,
    launchPositionIndex: formData.get('launchPositionIndex') ?? 0,
    emphasis: formData.get('emphasis') ?? 'normal',
    aiCreditAction: formData.get('aiCreditAction') || undefined,
    aiCreditReferenceId: formData.get('aiCreditReferenceId') || undefined,
    refinementPrompt: formData.get('refinementPrompt') || undefined,
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
  const { data: productRow, error: productError } = await supabase
    .from('catalogue_items')
    .select('name')
    .eq('id', parsed.data.productId)
    .maybeSingle();
  if (productError || !productRow?.name) {
    console.error('[addPreviewCueAction] product lookup failed:', productError);
    return { ok: false, error: 'Could not find that firework.' };
  }
  const cueDescription = productRow.name.trim();

  const isAiRefinement = parsed.data.aiCreditAction === 'show_refinement';
  let refinementReservationKey: string | null = null;
  if (isAiRefinement) {
    if (!user) return { ok: false, error: 'Sign in to refine this show.' };
    if (!parsed.data.aiCreditReferenceId) {
      return { ok: false, error: 'Could not identify this refinement.' };
    }

    refinementReservationKey = showRefinementReservationKey(parsed.data.aiCreditReferenceId);
    const reservation = await reserveAiCredits(supabase, {
      userId: user.id,
      actionKey: 'show_refinement',
      referenceType: 'show_refinements',
      referenceId: parsed.data.aiCreditReferenceId,
      reservationKey: refinementReservationKey,
      metadata: {
        description: cueDescription,
        productId: parsed.data.productId,
        prompt: parsed.data.refinementPrompt ?? null,
        showId: parsed.data.showId,
        showSlug: parsed.data.showSlug,
        timeSeconds: parsed.data.timeSeconds,
      },
    });

    if (!reservation.ok) {
      return {
        ok: false,
        error: reservation.error ?? 'You do not have enough AI credits to refine this show.',
      };
    }
  }

  if (refinementReservationKey && user && parsed.data.aiCreditReferenceId) {
    const { data: cueId, error: refinementError } = await supabase.rpc(
      'add_refinement_cue_and_settle_credits',
      {
        p_catalogue_item_id: parsed.data.productId,
        p_emphasis: parsed.data.emphasis,
        p_launch_position_index: parsed.data.launchPositionIndex,
        p_metadata: {
          cueDescription,
          productId: parsed.data.productId,
          showId: parsed.data.showId,
          showSlug: parsed.data.showSlug,
        },
        // The RPC keeps this legacy argument for compatibility, while the
        // locked database schedule allocates the authoritative position.
        p_position: 1,
        p_refinement_id: parsed.data.aiCreditReferenceId,
        p_show_id: parsed.data.showId,
        p_time_seconds: parsed.data.timeSeconds,
      },
    );

    let committedAfterResponseError = false;
    if (refinementError) {
      // A lost response can arrive after PostgreSQL committed. The deterministic
      // cue UUID and debit key let us confirm both halves before compensation.
      const [cueConfirmation, debitConfirmation] = await Promise.all([
        supabase
          .from('show_timeline_items')
          .select('id, show_id, catalogue_item_id')
          .eq('id', parsed.data.aiCreditReferenceId)
          .eq('show_id', parsed.data.showId)
          .eq('catalogue_item_id', parsed.data.productId)
          .maybeSingle(),
        supabase
          .from('ai_credit_transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('idempotency_key', `${refinementReservationKey}:debit`)
          .eq('transaction_type', 'debit')
          .eq('status', 'applied')
          .maybeSingle(),
      ]);
      committedAfterResponseError =
        !cueConfirmation.error &&
        cueConfirmation.data != null &&
        !debitConfirmation.error &&
        debitConfirmation.data != null;
      if (cueConfirmation.error || debitConfirmation.error) {
        console.error('[addPreviewCueAction] refinement confirmation failed:', {
          cueError: cueConfirmation.error,
          debitError: debitConfirmation.error,
        });
      }
    }

    const refinementCommitted =
      cueId === parsed.data.aiCreditReferenceId ||
      (refinementError != null && committedAfterResponseError);
    if (!refinementCommitted) {
      console.error('[addPreviewCueAction] atomic refinement failed:', refinementError);
      const refunded = await refundAiCreditReservation(supabase, {
        userId: user.id,
        reservationKey: refinementReservationKey,
        metadata: {
          reason: 'refinement_cue_failed',
          showId: parsed.data.showId,
          showSlug: parsed.data.showSlug,
        },
      });
      if (!refunded.ok) {
        console.error('[addPreviewCueAction] refinement refund failed:', refunded.error);
      }
      if (refinementError?.code === '23514') {
        return {
          ok: false,
          error: 'That launch position became busy. Pick a different time or tube and try again.',
        };
      }
      return { ok: false, error: 'Could not add that firework cue.' };
    }

    await invalidateSidebarAiUsageCache(user.id);
  } else {
    const { data: insertedCueId, error } = await addShowTimelineItem(supabase, {
      p_catalogue_item_id: parsed.data.productId,
      p_emphasis: parsed.data.emphasis,
      p_launch_position_index: parsed.data.launchPositionIndex,
      p_show_id: parsed.data.showId,
      p_time_seconds: parsed.data.timeSeconds,
    });

    if (error?.code === '23514') {
      return {
        ok: false,
        error: 'That launch position became busy. Pick a different time or tube and try again.',
      };
    }
    if (error || !insertedCueId) {
      console.error('[addPreviewCueAction] insert failed:', error);
      return { ok: false, error: 'Could not add that firework cue.' };
    }
  }

  if (user) {
    try {
      await syncShowDerivedFieldsForUser(user.id, {
        showId: parsed.data.showId,
        showSlug: parsed.data.showSlug,
      });
    } catch (error) {
      console.error('[addPreviewCueAction] derived-field sync failed:', error);
      return {
        ok: false,
        error: 'The cue was added, but show totals could not refresh. Reload before retrying.',
      };
    }
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
  const { data: deletedShowId, error } = await deleteShowTimelineItem(supabase, parsed.data.cueId);

  if (error) {
    console.error('[deletePreviewCueAction] delete failed:', error);
    return { ok: false, error: 'Could not remove that firework cue.' };
  }

  // No show ID means the guarded mutation did not confirm a deleted row.
  if (!deletedShowId) {
    return { ok: false, error: 'Could not find that cue to remove.' };
  }

  if (user) {
    try {
      await syncShowDerivedFieldsForUser(user.id, {
        showId: deletedShowId,
        showSlug: parsed.data.showSlug,
      });
    } catch (error) {
      console.error('[deletePreviewCueAction] derived-field sync failed:', error);
      return {
        ok: false,
        error: 'The cue was removed, but show totals could not refresh. Reload before retrying.',
      };
    }
  }
  revalidatePath(`/shows/${parsed.data.showSlug}/preview`);
  return { ok: true, message: 'Cue removed.' };
}
