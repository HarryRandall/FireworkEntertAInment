/**
 * Shopping list computation.
 *
 * For a given show we count occurrences of each catalogue item across
 * `show_timeline_items`, then look up the cheapest available
 * `supplier_inventory_items.price_cents`
 * to estimate cost. The result feeds both the shopping-list UI and the
 * cached `shows.total_cents` derived field.
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { ShoppingListItem } from '@/lib/show-domain';
import { SHOW_CUES_WITH_PRODUCT_SELECT, type ShoppingListComputation } from './types';

/**
 * Walks a show's cues and joined catalogue items, then merges in the cheapest
 * available supplier price per item. Returns `null` only on a hard DB
 * failure — an empty show is `{ items: [], effectsCount: 0 }`.
 */
export async function computeShoppingListForShow(
  supabase: SupabaseClient<Database>,
  showId: string,
): Promise<ShoppingListComputation | null> {
  const { data: cueRows, error: cueError } = await supabase
    .from('show_timeline_items')
    .select(SHOW_CUES_WITH_PRODUCT_SELECT)
    .eq('show_id', showId);
  if (cueError) {
    console.error('[shows.server] computeShoppingListForShow cues failed:', cueError);
    return null;
  }
  const effectsCount = cueRows?.length ?? 0;

  // Aggregate qty per catalogue item (each cue = one ignition of that item).
  const byCatalogueItem = new Map<
    string,
    { name: string; partNumber: string; manufacturer: string | null; qty: number }
  >();
  for (const row of cueRows ?? []) {
    const item = row.catalogue_items as {
      id: string;
      name: string;
      part_number: string;
      manufacturer: string | null;
    } | null;
    if (!item) continue;
    const existing = byCatalogueItem.get(item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      byCatalogueItem.set(item.id, {
        name: item.name,
        partNumber: item.part_number,
        manufacturer: item.manufacturer,
        qty: 1,
      });
    }
  }

  if (byCatalogueItem.size === 0) {
    return { items: [], effectsCount };
  }

  // Cheapest available price per catalogue item across all supplier inventories.
  const catalogueItemIds = Array.from(byCatalogueItem.keys());
  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('supplier_inventory_items')
    .select('catalogue_item_id, price_cents')
    .in('catalogue_item_id', catalogueItemIds)
    .eq('available', true)
    .not('price_cents', 'is', null);
  if (inventoryError) {
    console.error('[shows.server] computeShoppingListForShow inventory failed:', inventoryError);
    return null;
  }

  const cheapestPrice = new Map<string, number>();
  for (const inv of inventoryRows ?? []) {
    if (inv.catalogue_item_id == null || inv.price_cents == null) continue;
    const current = cheapestPrice.get(inv.catalogue_item_id);
    if (current == null || inv.price_cents < current) {
      cheapestPrice.set(inv.catalogue_item_id, inv.price_cents);
    }
  }

  const items: ShoppingListItem[] = Array.from(byCatalogueItem.entries())
    .map(([id, item]) => ({
      id,
      name: item.name,
      qty: item.qty,
      priceCents: cheapestPrice.get(id) ?? 0,
      partNumber: item.partNumber,
      manufacturer: item.manufacturer,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { items, effectsCount };
}
