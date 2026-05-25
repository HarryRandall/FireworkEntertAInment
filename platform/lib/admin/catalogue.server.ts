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
import type { ProductRow } from './mappers';
import { getServerClient } from './supabase';

/** Returns up to 100 catalogue products by recency, or `[]` when unauthorised. */
export async function listCatalogueProducts(): Promise<CatalogueProductSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];
  const cacheKey = getAdminCatalogueCacheKey();
  const cached = await getCachedJson<CatalogueProductSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, part_number, name, manufacturer, subtype, duration_seconds, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[admin.server] listCatalogueProducts failed:', error);
    return [];
  }
  const mapped = (
    (data ?? []) as Pick<
      ProductRow,
      'id' | 'part_number' | 'name' | 'manufacturer' | 'subtype' | 'duration_seconds' | 'updated_at'
    >[]
  ).map((row) => ({
    id: row.id,
    partNumber: row.part_number,
    name: row.name,
    manufacturer: row.manufacturer,
    category: null,
    fireworkType: row.subtype,
    fireworkSpecificationId: null,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    updatedAt: row.updated_at,
  }));
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
