import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { FireworkSpecification } from '@/lib/show-domain';
import { buildProductTimingProfile } from '@/lib/fireworks/timing-profile';
import { fetchShotsByCatalogueItem } from '@/lib/shows/queries.server';
import type { ProductTimingProfiles } from './music-product-matching';

/** Reuse replay's resolved child designs once per generation, never once per cue. */
export async function loadProductTimingProfiles(
  supabase: SupabaseClient<Database>,
  products: readonly FireworkSpecification[],
): Promise<ProductTimingProfiles> {
  const ids = products.filter((product) => (product.shotCount ?? 1) > 1).map(({ id }) => id);
  // Bound the PostgREST URL size even when the catalogue contains many cakes.
  const batches: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += 100)
    batches.push(ids.slice(offset, offset + 100));
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
      const children =
        (product.shotCount ?? 1) > 1 ? (childrenByProduct.get(product.id) ?? []) : undefined;
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
