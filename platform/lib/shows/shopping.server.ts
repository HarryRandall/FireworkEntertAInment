/**
 * Shopping list computation.
 *
 * For a given show we count occurrences of each product across `show_cues`,
 * then look up the cheapest available `supplier_inventory_items.price_cents`
 * to estimate cost. The result feeds both the shopping-list UI and the
 * cached `shows.total_cents` derived field.
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { ShoppingListItem } from '@/lib/show-domain';
import { SHOW_CUES_WITH_PRODUCT_SELECT, type ShoppingListComputation } from './types';

/**
 * Walks a show's cues and joined products, then merges in the cheapest
 * available supplier price per product. Returns `null` only on a hard DB
 * failure — an empty show is `{ items: [], effectsCount: 0 }`.
 */
export async function computeShoppingListForShow(
  supabase: SupabaseClient<Database>,
  showId: string,
): Promise<ShoppingListComputation | null> {
  const { data: cueRows, error: cueError } = await supabase
    .from('show_cues')
    .select(SHOW_CUES_WITH_PRODUCT_SELECT)
    .eq('show_id', showId);
  if (cueError) {
    console.error('[shows.server] computeShoppingListForShow cues failed:', cueError);
    return null;
  }
  const effectsCount = cueRows?.length ?? 0;

  // Aggregate qty per product (each cue = one shot of that product).
  const byProduct = new Map<
    string,
    { name: string; partNumber: string; manufacturer: string | null; qty: number }
  >();
  for (const row of cueRows ?? []) {
    const p = row.products as {
      id: string;
      name: string;
      part_number: string;
      manufacturer: string | null;
    } | null;
    if (!p) continue;
    const existing = byProduct.get(p.id);
    if (existing) {
      existing.qty += 1;
    } else {
      byProduct.set(p.id, {
        name: p.name,
        partNumber: p.part_number,
        manufacturer: p.manufacturer,
        qty: 1,
      });
    }
  }

  if (byProduct.size === 0) {
    return { items: [], effectsCount };
  }

  // Cheapest available price per product across all supplier inventories.
  const productIds = Array.from(byProduct.keys());
  const { data: inventoryRows } = await supabase
    .from('supplier_inventory_items')
    .select('product_id, price_cents')
    .in('product_id', productIds)
    .eq('available', true)
    .not('price_cents', 'is', null);

  const cheapestPrice = new Map<string, number>();
  for (const inv of inventoryRows ?? []) {
    if (inv.product_id == null || inv.price_cents == null) continue;
    const current = cheapestPrice.get(inv.product_id);
    if (current == null || inv.price_cents < current) {
      cheapestPrice.set(inv.product_id, inv.price_cents);
    }
  }

  const items: ShoppingListItem[] = Array.from(byProduct.entries())
    .map(([id, p]) => ({
      id,
      name: p.name,
      qty: p.qty,
      priceCents: cheapestPrice.get(id) ?? 0,
      partNumber: p.partNumber,
      manufacturer: p.manufacturer,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { items, effectsCount };
}
