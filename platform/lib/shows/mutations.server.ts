/**
 * Mutation helpers for shows.
 *
 * Today this is just {@link syncShowDerivedFieldsForUser}, which recomputes the
 * cached `shows.total_cents` and `shows.effects_count` after any mutation that
 * could affect them. Heavier mutations (create/update show) live in server
 * actions under `app/actions/*` since they belong to the auth-gated request
 * boundary, not the shared data layer.
 */
import 'server-only';

import { invalidateShowCacheForUser } from './cache-keys';
import { computeShoppingListForShow } from './shopping.server';
import { getServerClient } from './supabase';

/**
 * Recomputes the shopping-list total and effects count for a single show and
 * writes them back. Invalidates the per-show cache only after the database
 * confirms the intended show row was updated.
 */
export async function syncShowDerivedFieldsForUser(
  userId: string,
  params: { showId: string; showSlug?: string | null },
): Promise<void> {
  const supabase = await getServerClient();
  const computed = await computeShoppingListForShow(supabase, params.showId);
  if (!computed) {
    throw new Error('Could not compute show totals.');
  }

  const totalCents = computed.items.reduce((sum, item) => sum + item.qty * item.priceCents, 0);
  const { data: updatedShow, error } = await supabase
    .from('shows')
    .update({
      total_cents: totalCents,
      effects_count: computed.effectsCount,
    })
    .eq('id', params.showId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error || !updatedShow) {
    console.error('[shows.server] syncShowDerivedFieldsForUser update failed:', error);
    throw new Error('Could not save show totals.', { cause: error ?? undefined });
  }
  await invalidateShowCacheForUser(userId, params);
}
