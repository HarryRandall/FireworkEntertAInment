/** Detail loaders combine immutable history with current catalogue and show dependencies. */
import 'server-only';
import { getServerClient } from '@/lib/supabase/server-client';
import { loadCatalogue, previewProductVersion } from './loaders';
import { effectPreview } from './preview';
import { readRows } from './read';
import { dependentProductIds } from './usage';
import type { CatalogueUsage, CatalogueVersion } from './types';

type Catalogue = Awaited<ReturnType<typeof loadCatalogue>>;
async function loadUsage(
  data: Catalogue,
  kind: 'effect' | 'product',
  id: string,
): Promise<CatalogueUsage[]> {
  const ids = dependentProductIds(data, kind, id);
  const client = await getServerClient();
  const [shows, needed] = await Promise.all([
    readRows((a, b) =>
      client.from('shows').select('id,name,status,current_version_id').order('id').range(a, b),
    ),
    readRows((a, b) =>
      client
        .from('show_version_products')
        .select('show_version_id,product_id')
        .order('show_version_id')
        .order('product_id')
        .range(a, b),
    ),
  ]);
  const products = data.products
    .filter((row) => ids.has(row.id) && row.id !== id)
    .map((row) => ({
      id: row.id,
      name: row.name,
      href: `/admin/products/${row.id}`,
      detail: `${row.kind} · ${row.status}`,
    }));
  const usedShows = shows
    .filter((show) =>
      needed.some(
        (row) => row.show_version_id === show.current_version_id && ids.has(row.product_id),
      ),
    )
    .map((show) => ({ id: show.id, name: show.name, detail: `Show · ${show.status}` }));
  return [...products, ...usedShows];
}
/** Reads one effect's status, complete descending history and current usage, or returns missing. */
export async function loadEffectDetail(id: string) {
  const data = await loadCatalogue();
  const parent = data.effects.find((row) => row.id === id);
  if (!parent) return null;
  const versions: CatalogueVersion[] = data.effectVersions
    .filter((row) => row.effect_id === id)
    .sort((a, b) => b.number - a.number)
    .map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      note: row.change_note,
      created: row.created_at,
      published: row.published_at,
      preview: effectPreview(row.design),
    }));
  return { parent, versions, usage: await loadUsage(data, 'effect', id) };
}
/** Reads product composition history, pack contents and current usage without exposing editing. */
export async function loadProductDetail(id: string) {
  const data = await loadCatalogue();
  const parent = data.products.find((row) => row.id === id);
  if (!parent) return null;
  const versions: CatalogueVersion[] = data.productVersions
    .filter((row) => row.product_id === id)
    .sort((a, b) => b.number - a.number)
    .map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      note: row.change_note,
      created: row.created_at,
      published: row.published_at,
      preview: previewProductVersion(data, row),
    }));
  const contents = data.packs
    .filter((row) => row.pack_id === id)
    .map((row) => {
      const product = data.products.find((item) => item.id === row.item_id);
      if (!product) throw new Error('Pack item is missing');
      return {
        id: product.id,
        name: product.name,
        href: `/admin/products/${product.id}`,
        detail: `${String(row.quantity)} items`,
      };
    });
  return { parent, versions, contents, usage: await loadUsage(data, 'product', id) };
}
