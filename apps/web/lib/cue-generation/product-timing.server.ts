import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { FireworkSpecification } from '@/lib/show-domain';
import { buildProductTimingProfile } from '@/lib/fireworks/timing-profile';
import { fetchShotsByCatalogueItem } from '@/lib/shows/queries.server';
import type { ProductTimingProfiles } from './music-product-matching';

/** Load each product's renderer-derived profile once per generation. */
export async function loadProductTimingProfiles(
  supabase: SupabaseClient<Database>,
  products: readonly FireworkSpecification[],
): Promise<ProductTimingProfiles> {
  // Read every selected item so a catalogue multishot with one child row is
  // not mistaken for a direct product merely because its declared count is 1.
  const ids = products.map(({ id }) => id);
  const batches: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    batches.push(ids.slice(offset, offset + 100));
  }
  const resolved = await Promise.all(
    batches.map((batch) =>
      fetchShotsByCatalogueItem(supabase, batch, {
        failOnError: true,
        preserveUnknownTiming: true,
      }),
    ),
  );
  const childrenByProduct = new Map(resolved.flatMap((batch) => [...batch]));
  return new Map(
    products.map((product) => {
      const resolvedChildren = childrenByProduct.get(product.id);
      const multishotChildren = resolvedChildren?.filter((child) => child.kind === 'multishot');
      const children =
        (product.shotCount ?? 1) > 1 || (multishotChildren?.length ?? 0) > 0
          ? (multishotChildren ?? [])
          : undefined;
      return [
        product.id,
        {
          normal: buildProductTimingProfile({ product, emphasis: 'normal', children }),
          accent: buildProductTimingProfile({ product, emphasis: 'accent', children }),
          peak: buildProductTimingProfile({ product, emphasis: 'peak', children }),
        },
      ];
    }),
  );
}
