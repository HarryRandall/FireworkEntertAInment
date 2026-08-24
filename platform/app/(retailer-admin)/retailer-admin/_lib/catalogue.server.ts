/**
 * Read-only catalogue query for the retailer console, gated on `retailer.view`
 * instead of `admin.manage_catalogue` (see lib/admin/catalogue.server.ts).
 * Retailer accounts never hold an `admin.*` permission, so this is the only
 * path that lets them see real catalogue data. Shares the admin catalogue
 * cache key: it's the same underlying rows, just a different caller check.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { CatalogueProductSummary } from '@/lib/admin.types';
import { ADMIN_CACHE_TTL_SECONDS, getAdminCatalogueCacheKey } from '@/lib/admin/cache-keys';
import { requirePermission } from '@/lib/admin/current-user.server';
import { getServerClient } from '@/lib/admin/supabase';

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

export async function listRetailerCatalogueProducts(): Promise<CatalogueProductSummary[]> {
  if (!(await requirePermission('retailer.view'))) return [];

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
    console.error('[retailer-admin.catalogue] listRetailerCatalogueProducts failed:', error);
    throw new Error('Catalogue products could not be loaded.', { cause: error });
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
