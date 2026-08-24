/**
 * Read helpers for retailer-owned assortments (FIR-166). Ownership is
 * enforced by RLS (assortments_select_own) *and* an explicit created_by
 * filter here: the table also carries a public "is_active" browse policy, so
 * an unfiltered select would otherwise fold every other retailer's live
 * assortments into this account's list.
 */
import 'server-only';

import { requirePermission } from '@/lib/admin/current-user.server';
import { getServerClient } from '@/lib/admin/supabase';

type AssortmentRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_active: boolean;
  updated_at: string;
  assortment_items: {
    id: string;
    catalogue_item_id: string;
    quantity: number;
    sort_order: number;
    catalogue_items: { name: string; part_number: string } | null;
  }[];
};

export type RetailerAssortmentItem = {
  id: string;
  catalogueItemId: string;
  productName: string;
  partNumber: string;
  quantity: number;
  sortOrder: number;
};

export type RetailerAssortment = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  isActive: boolean;
  updatedAt: string;
  items: RetailerAssortmentItem[];
};

export async function listRetailerAssortments(): Promise<RetailerAssortment[]> {
  const profile = await requirePermission('retailer.manage_assortments');
  if (!profile) return [];

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('assortments')
    .select(
      'id, slug, name, description, price_cents, is_active, updated_at, assortment_items(id, catalogue_item_id, quantity, sort_order, catalogue_items(name, part_number))',
    )
    .eq('created_by', profile.id)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[retailer-admin.assortments] listRetailerAssortments failed:', error);
    throw new Error('Assortments could not be loaded.', { cause: error });
  }

  return ((data ?? []) as unknown as AssortmentRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    items: [...row.assortment_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        catalogueItemId: item.catalogue_item_id,
        productName: item.catalogue_items?.name ?? 'Unknown product',
        partNumber: item.catalogue_items?.part_number ?? '',
        quantity: item.quantity,
        sortOrder: item.sort_order,
      })),
  }));
}
