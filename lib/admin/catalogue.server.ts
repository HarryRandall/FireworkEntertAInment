/**
 * Read helpers for the supplier-facing product catalogue.
 *
 * Capped at 100 results because the admin page paginates client-side and we
 * don't want to ship megabyte payloads. Bump the limit when proper server
 * pagination lands.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { CatalogueProductSummary } from '@/lib/admin.types';
import { ADMIN_CACHE_TTL_SECONDS, getAdminCatalogueCacheKey } from './cache-keys';
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';

type CatalogueItemRow = {
  id: string;
  part_number: string;
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
  const { data, error } = await supabase
    .from('catalogue_items')
    .select(
      'id, part_number, name, manufacturer, firework_type, catalogue_item_kind, firework_id, multishot_id, duration_seconds, updated_at',
    )
    .order('name', { ascending: true })
    .limit(1000);
  if (error) {
    throwCatalogueReadError('listCatalogueProducts', error);
  }
  const mapped = ((data ?? []) as CatalogueItemRow[]).map((row) => ({
    id: row.id,
    partNumber: row.part_number,
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
