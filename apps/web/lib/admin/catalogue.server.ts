/** Complete admin catalogue reads for metadata editing and mapping counts. */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { CatalogueProductSummary } from '@/lib/admin.types';
import { ADMIN_CACHE_TTL_SECONDS, getAdminCatalogueCacheKey } from './cache-keys';
import { requirePermission } from '@/lib/access/current-profile.server';
import { getServerClient } from './supabase';

const CATALOGUE_PAGE_SIZE = 500; // PostgREST read batch, rows; below the default server limit.

type CatalogueItemRow = {
  id: string;
  part_number: string;
  finale_product_id: string | null;
  finale_effect_name: string | null;
  name: string;
  manufacturer: string | null;
  firework_type: string | null;
  catalogue_item_kind: string;
  firework_id: string | null;
  multishot_id: string | null;
  duration_seconds: number | null;
  updated_at: string;
};

function throwCatalogueReadError(operation: string, error: unknown): never {
  console.error(`[admin.catalogue] ${operation} failed:`, error);
  throw new Error('Catalogue products could not be loaded.', { cause: error });
}

/**
 * Returns the full catalogue (every firework and multishot in stock) ordered by
 * name. Each row reports its kind and whether it is linked to a firework or
 * multishot; linked rows cannot be deleted.
 */
export async function listCatalogueProducts(): Promise<CatalogueProductSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];
  const cacheKey = getAdminCatalogueCacheKey();
  const cached = await getCachedJson<CatalogueProductSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const rows: CatalogueItemRow[] = [];
  for (let offset = 0; ; offset += CATALOGUE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('catalogue_items')
      .select(
        'id, part_number, finale_product_id, finale_effect_name, name, manufacturer, firework_type, catalogue_item_kind, firework_id, multishot_id, duration_seconds, updated_at',
      )
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + CATALOGUE_PAGE_SIZE - 1);
    if (error) {
      throwCatalogueReadError('listCatalogueProducts', error);
    }
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < CATALOGUE_PAGE_SIZE) break;
  }
  const mapped = rows.map((row) => ({
    id: row.id,
    partNumber: row.part_number,
    finaleProductId: row.finale_product_id,
    finaleEffectName: row.finale_effect_name,
    name: row.name,
    manufacturer: row.manufacturer,
    category: null,
    fireworkType: row.firework_type,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    kind: row.catalogue_item_kind,
    linked: row.firework_id != null || row.multishot_id != null,
    updatedAt: row.updated_at,
  }));
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
