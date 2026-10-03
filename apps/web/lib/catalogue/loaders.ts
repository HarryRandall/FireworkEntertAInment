/** Request-cached catalogue documents are read with the admin's ordinary RLS identity. */
import 'server-only';
import { cache } from 'react';
import { requireArea } from '@/lib/auth/server';
import { getServerClient } from '@/lib/supabase/server-client';
import { readRows } from './read';
import { effectPreview, productPreview } from './preview';
import type { CatalogueRow, CataloguePreview } from './types';

/** Loads shared effect/product parents and version documents once per server request. */
export const loadCatalogue = cache(async () => {
  await requireArea('admin');
  const client = await getServerClient();
  const [effects, effectVersions, products, productVersions, bindings, packs] = await Promise.all([
    readRows((a, b) => client.from('effects').select('*').order('id').range(a, b)),
    readRows((a, b) => client.from('effect_versions').select('*').order('id').range(a, b)),
    readRows((a, b) => client.from('products').select('*').order('id').range(a, b)),
    readRows((a, b) => client.from('product_versions').select('*').order('id').range(a, b)),
    readRows((a, b) =>
      client
        .from('product_version_effects')
        .select('*')
        .order('product_version_id')
        .order('letter')
        .range(a, b),
    ),
    readRows((a, b) =>
      client.from('pack_items').select('*').order('pack_id').order('item_id').range(a, b),
    ),
  ]);
  return { effects, effectVersions, products, productVersions, bindings, packs };
});
/** Derives list rows and validates only the version displayed in the catalogue. */
export async function loadEffectRows(): Promise<CatalogueRow[]> {
  const data = await loadCatalogue();
  return data.effects.map((effect) => {
    const version = data.effectVersions.find(
      (row) => row.id === (effect.draft_version_id ?? effect.current_version_id),
    );
    return {
      id: effect.id,
      name: effect.name,
      kind: effect.kind,
      status: effect.status,
      href: `/admin/catalogue/${effect.id}`,
      updated: effect.updated_at,
      description: effect.family + (effect.is_template ? ' · Template' : ''),
      preview: version ? effectPreview(version.design) : null,
    };
  });
}
/** Resolves current effect versions for each product's displayed composition. */
export async function loadProductRows(cakesOnly = false): Promise<CatalogueRow[]> {
  const data = await loadCatalogue();
  return data.products
    .filter((product) => !cakesOnly || product.kind === 'cake')
    .map((product) => {
      const version = data.productVersions.find(
        (row) => row.id === (product.draft_version_id ?? product.current_version_id),
      );
      return {
        id: product.id,
        name: product.name,
        kind: product.kind,
        status: product.status,
        href: `/admin/products/${product.id}`,
        updated: product.updated_at,
        description: product.brand ?? product.description ?? '',
        preview: version ? previewProductVersion(data, version) : null,
      };
    });
}
/** Validates a product version and resolves its letters against current effect designs, falling back to drafts for unpublished effects. */
export function previewProductVersion(
  data: Awaited<ReturnType<typeof loadCatalogue>>,
  version: Awaited<ReturnType<typeof loadCatalogue>>['productVersions'][number],
) {
  const resolved = new Map<string, CataloguePreview>();
  for (const binding of data.bindings.filter((row) => row.product_version_id === version.id)) {
    const effect = data.effects.find((row) => row.id === binding.effect_id);
    const current = data.effectVersions.find(
      (row) => row.id === (effect?.current_version_id ?? effect?.draft_version_id),
    );
    if (current) resolved.set(binding.letter, effectPreview(current.design));
  }
  return productPreview(version.composition, resolved);
}
/** Lists supplier contacts under staff RLS without inventing performance metrics. */
export async function loadSupplierRows(): Promise<CatalogueRow[]> {
  await requireArea('admin');
  const client = await getServerClient();
  const rows = await readRows((a, b) =>
    client.from('suppliers').select('*').order('id').range(a, b),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.country ?? 'No market',
    status: row.status,
    href: '',
    updated: row.updated_at,
    description: row.contact_email ?? '',
    preview: null,
  }));
}
