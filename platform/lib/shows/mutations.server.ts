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
 * writes them back. Always invalidates the per-show cache afterward so the
 * next read sees the fresh derived values.
 */
export async function syncShowDerivedFieldsForUser(
  userId: string,
  params: { showId: string; showSlug?: string | null },
): Promise<void> {
  const supabase = await getServerClient();
  const computed = await computeShoppingListForShow(supabase, params.showId);
  if (!computed) return;

  const totalCents = computed.items.reduce((sum, item) => sum + item.qty * item.priceCents, 0);
  await supabase
    .from('shows')
    .update({
      total_cents: totalCents,
      effects_count: computed.effectsCount,
    })
    .eq('id', params.showId)
    .eq('user_id', userId);
  await invalidateShowCacheForUser(userId, params);
}
