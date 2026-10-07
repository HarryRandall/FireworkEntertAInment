'use server';

/**
 * Server actions for the show preview cue editor: add and remove
 * cues on a show. The guarded database mutation serialises each show and
 * rejects overlaps across every launch position occupied by a product.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { syncShowDerivedFieldsForUser } from '@/lib/shows/mutations.server';
import {
  invalidateSidebarAiUsageCache,
  refundAiCreditReservation,
  reserveAiCredits,
  showRefinementReservationKey,
} from '@/lib/ai-credits.server';
import { addShowTimelineItem, deleteShowTimelineItem } from '@/lib/show-timeline-mutations.server';
import { getOpenRouterClient, DEFAULT_CUE_MODEL } from '@/lib/openrouter.server';
import { listFireworkProducts } from '@/lib/shows/queries.server';
import { invalidateShowCacheForUser } from '@/lib/shows/cache-keys';
import {
  parseRefinementIntent,
  parseRefinementModelReply,
  parseRefinementTime,
  validateRefinementProposal,
} from '@/lib/shows/refinement';

/**
 * Cue mutation outcome. `committed` marks a failure reported after the cue write
 * (and any credit settlement) succeeded, so callers must not refund or retry.
 */
export type CueActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; committed?: boolean };

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

const RefineShowSchema = z.object({
  showId: z.string().uuid(),
  showSlug: z.string().min(1).max(160),
  prompt: z.string().trim().min(1, 'Describe the firework cue you want.').max(1000),
});

const REFINEMENT_MODEL_TIMEOUT_MS = 20_000;

/** Ask the model to choose one listed product, then add it through the guarded cue transaction. */
export async function refineShowAction(formData: FormData): Promise<CueActionResult> {
  const parsed = RefineShowSchema.safeParse({
    showId: formData.get('showId'),
    showSlug: formData.get('showSlug'),
    prompt: formData.get('prompt'),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the request.' };

  const intent = parseRefinementIntent(parsed.data.prompt);
  if (intent !== 'add') {
    return {
      ok: false,
      error:
        'Refinement currently adds one cue. Removing, replacing and moving cues are not supported yet.',
    };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to refine this show.' };
  const { data: show, error: showError } = await supabase
    .from('shows')
    .select('id, slug, duration_seconds')
    .eq('id', parsed.data.showId)
    .eq('slug', parsed.data.showSlug)
    .eq('user_id', user.id)
    .maybeSingle();
  if (showError || !show) return { ok: false, error: 'This show is no longer available.' };

  const products = await listFireworkProducts();
  if (products.length === 0)
    return { ok: false, error: 'No listed fireworks are available for refinement.' };
  const refinementId = crypto.randomUUID();
  const reservationKey = showRefinementReservationKey(refinementId);
  const reservation = await reserveAiCredits(supabase, {
    userId: user.id,
    actionKey: 'show_refinement',
    referenceType: 'show_refinements',
    referenceId: refinementId,
    reservationKey,
    metadata: { prompt: parsed.data.prompt, showId: show.id, showSlug: show.slug },
  });
  if (!reservation.ok)
    return {
      ok: false,
      error: reservation.error ?? 'You do not have enough AI credits to refine this show.',
    };

  try {
    const requestedTime = parseRefinementTime(parsed.data.prompt, show.duration_seconds);
    const completion = await getOpenRouterClient().chat.completions.create(
      {
        model: DEFAULT_CUE_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return JSON only: {"intent":"add","productId":"UUID","timeSeconds":number,"launchPositionIndex":0|1|2,"emphasis":"normal"|"accent"|"peak"}. Select exactly one supplied product. This operation can only add a cue.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              request: parsed.data.prompt,
              requestedTime,
              durationSeconds: show.duration_seconds,
              products: products.map((product) => ({
                id: product.id,
                name: product.name,
                description: product.description,
              })),
            }),
          },
        ],
      },
      { timeout: REFINEMENT_MODEL_TIMEOUT_MS, maxRetries: 1 },
    );
    const raw = completion.choices[0]?.message.content;
    if (!raw) throw new Error('The model returned no refinement.');
    const proposal = validateRefinementProposal(
      parseRefinementModelReply(raw),
      new Set(products.map((product) => product.id)),
      show.duration_seconds,
    );
    if (!proposal) throw new Error('The model returned an invalid refinement.');

    const cueForm = new FormData();
    cueForm.set('showId', show.id);
    cueForm.set('showSlug', show.slug);
    cueForm.set('productId', proposal.productId);
    cueForm.set('timeSeconds', String(requestedTime ?? proposal.timeSeconds));
    cueForm.set('launchPositionIndex', String(proposal.launchPositionIndex));
    cueForm.set('emphasis', proposal.emphasis);
    cueForm.set('aiCreditAction', 'show_refinement');
    cueForm.set('aiCreditReferenceId', refinementId);
    cueForm.set('refinementPrompt', parsed.data.prompt);
    const result = await addPreviewCueAction(cueForm);
    if (!result.ok && result.committed) return result;
    if (!result.ok) {
      // The cue RPC settles credits only when the cue commits, so a rejected
      // placement (for example a busy tube) must release the reservation here.
      const refunded = await refundAiCreditReservation(supabase, {
        userId: user.id,
        reservationKey,
        metadata: { reason: 'refinement_cue_rejected', showId: show.id },
      });
      if (!refunded.ok) console.error('[refineShowAction] refund failed:', refunded.error);
      return { ok: false, error: `${result.error} Your AI credits were refunded.` };
    }
    const product = products.find((item) => item.id === proposal.productId);
    return {
      ok: true,
      message: `Added ${product?.name ?? 'a firework'} at ${Math.floor((requestedTime ?? proposal.timeSeconds) / 60)}:${String(Math.round((requestedTime ?? proposal.timeSeconds) % 60)).padStart(2, '0')}.`,
    };
  } catch (error) {
    const refunded = await refundAiCreditReservation(supabase, {
      userId: user.id,
      reservationKey,
      metadata: { reason: 'refinement_model_or_validation_failed', showId: show.id },
    });
    if (!refunded.ok) console.error('[refineShowAction] refund failed:', refunded.error);
    console.error('[refineShowAction] failed:', error);
    return {
      ok: false,
      error: 'Could not turn that request into a safe cue. Your AI credits were refunded.',
    };
  }
}

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
      // The cue committed but the totals did not; report the failure rather than
      // a false success, and tell the user to reload rather than retry the add.
      await invalidateShowCacheForUser(user.id, parsed.data);
      revalidateShowViews(parsed.data.showSlug);
      return {
        ok: false,
        error: 'The cue was added, but show totals could not refresh. Reload before retrying.',
        committed: true,
      };
    }
    await invalidateShowCacheForUser(user.id, parsed.data);
  }
  revalidateShowViews(parsed.data.showSlug);
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
      await invalidateShowCacheForUser(user.id, {
        showId: deletedShowId,
        showSlug: parsed.data.showSlug,
      });
      revalidateShowViews(parsed.data.showSlug);
      return {
        ok: false,
        error: 'The cue was removed, but show totals could not refresh. Reload before retrying.',
        committed: true,
      };
    }
    await invalidateShowCacheForUser(user.id, {
      showId: deletedShowId,
      showSlug: parsed.data.showSlug,
    });
  }
  revalidateShowViews(parsed.data.showSlug);
  return { ok: true, message: 'Cue removed.' };
}

/** Refresh each route that renders cue scheduling, shopping or derived totals. */
function revalidateShowViews(showSlug: string): void {
  revalidatePath(`/shows/${showSlug}`);
  revalidatePath(`/shows/${showSlug}/preview`);
  revalidatePath(`/shows/${showSlug}/timeline`);
  revalidatePath(`/shows/${showSlug}/shopping-list`);
}
