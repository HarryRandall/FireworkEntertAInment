import 'server-only';

/** Admin reads for in-store assortments. Gated by admin.manage_assortments, same pattern as lib/admin/multishots.server.ts. */

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { requirePermission } from '@/lib/admin/current-user.server';

export type AdminAssortmentSummary = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  isActive: boolean;
  itemCount: number;
  updatedAt: string;
};

export type AdminAssortmentItemRow = {
  id: string;
  catalogueItemId: string;
  name: string;
  partNumber: string;
  quantity: number;
  sortOrder: number;
  cheapestPriceCents: number | null;
};

export type AdminAssortmentDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  isActive: boolean;
  updatedAt: string;
  publicLink: {
    publicToken: string;
    fundingUserId: string;
    isEnabled: boolean;
  } | null;
  items: AdminAssortmentItemRow[];
};

/** Catalogue item searchable option for the member picker, with its cheapest available supplier price. */
export type AdminCatalogueItemOption = {
  id: string;
  name: string;
  partNumber: string;
  cheapestPriceCents: number | null;
};

export async function listAssortments(): Promise<AdminAssortmentSummary[]> {
  if (!(await requirePermission('admin.manage_assortments'))) return [];
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('assortments')
    .select('id, slug, name, price_cents, is_active, updated_at, assortment_items (id)')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[admin/assortments] listAssortments failed:', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceCents: row.price_cents,
    isActive: row.is_active,
    itemCount: (row.assortment_items ?? []).length,
    updatedAt: row.updated_at,
  }));
}

export async function getAssortmentById(id: string): Promise<AdminAssortmentDetail | null> {
  if (!(await requirePermission('admin.manage_assortments'))) return null;
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('assortments')
    .select(
      `id, slug, name, description, price_cents, is_active, updated_at,
       assortment_public_links (public_token, funding_user_id, is_enabled),
       assortment_items (
         id, quantity, sort_order,
         catalogue_items (
           id, name, part_number,
           supplier_inventory_items (price_cents, available)
         )
       )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[admin/assortments] getAssortmentById failed:', error);
    return null;
  }
  if (!data) return null;

  const rawPublicLink = Array.isArray(data.assortment_public_links)
    ? data.assortment_public_links[0]
    : data.assortment_public_links;

  const items = (data.assortment_items ?? [])
    .filter(
      (row): row is typeof row & { catalogue_items: NonNullable<typeof row.catalogue_items> } =>
        Boolean(row.catalogue_items),
    )
    .map((row) => ({
      id: row.id,
      catalogueItemId: row.catalogue_items.id,
      name: row.catalogue_items.name,
      partNumber: row.catalogue_items.part_number,
      quantity: row.quantity,
      sortOrder: row.sort_order,
      cheapestPriceCents: cheapestAvailablePrice(row.catalogue_items.supplier_inventory_items),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    priceCents: data.price_cents,
    isActive: data.is_active,
    updatedAt: data.updated_at,
    publicLink: rawPublicLink
      ? {
          publicToken: rawPublicLink.public_token,
          fundingUserId: rawPublicLink.funding_user_id,
          isEnabled: rawPublicLink.is_enabled,
        }
      : null,
    items,
  };
}

/** Search catalogue items by name/part number for the member picker. */
export async function searchCatalogueItemOptions(
  query: string,
): Promise<AdminCatalogueItemOption[]> {
  if (!(await requirePermission('admin.manage_assortments'))) return [];
  const supabase = createClient(await cookies());
  let builder = supabase
    .from('catalogue_items')
    .select('id, name, part_number, supplier_inventory_items (price_cents, available)')
    .order('name')
    .limit(30);
  const trimmed = query.trim();
  if (trimmed) {
    builder = builder.or(`name.ilike.%${trimmed}%,part_number.ilike.%${trimmed}%`);
  }
  const { data, error } = await builder;
  if (error) {
    console.error('[admin/assortments] searchCatalogueItemOptions failed:', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    partNumber: row.part_number,
    cheapestPriceCents: cheapestAvailablePrice(row.supplier_inventory_items),
  }));
}

function cheapestAvailablePrice(
  rows: { price_cents: number | null; available: boolean }[] | null | undefined,
): number | null {
  const prices = (rows ?? [])
    .filter((row) => row.available && row.price_cents != null)
    .map((row) => row.price_cents as number);
  return prices.length > 0 ? Math.min(...prices) : null;
}
