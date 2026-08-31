/**
 * Supplier list reads.
 *
 * Suppliers are visible to either platform admins (`admin.manage_suppliers`)
 * or the suppliers themselves (`supplier.view`). RLS handles row-level
 * filtering — we only gate at the permission level here.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { SupplierSummary } from '@/lib/admin.types';
import { ADMIN_CACHE_TTL_SECONDS, getAdminSuppliersCacheKey } from './cache-keys';
import { requirePermission } from './current-user.server';
import type { SupplierRow } from './mappers';
import { getServerClient } from './supabase';

function throwSupplierReadError(operation: string, error: unknown): never {
  console.error(`[admin.suppliers] ${operation} failed:`, error);
  throw new Error('Suppliers could not be loaded.', { cause: error });
}

/** Returns the supplier list visible to the caller, or `[]` when unauthorised. */
export async function listSuppliers(): Promise<SupplierSummary[]> {
  if (
    !(await requirePermission('admin.manage_suppliers')) &&
    !(await requirePermission('supplier.view'))
  ) {
    return [];
  }
  const cacheKey = getAdminSuppliersCacheKey();
  const cached = await getCachedJson<SupplierSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('supplier_profiles')
    .select('id, name, slug, status, contact_email, phone, website_url, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    throwSupplierReadError('listSuppliers', error);
  }
  const mapped = (
    (data ?? []) as Pick<
      SupplierRow,
      'id' | 'name' | 'slug' | 'status' | 'contact_email' | 'phone' | 'website_url' | 'updated_at'
    >[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    contactEmail: row.contact_email,
    phone: row.phone,
    websiteUrl: row.website_url,
    updatedAt: row.updated_at,
  }));
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
