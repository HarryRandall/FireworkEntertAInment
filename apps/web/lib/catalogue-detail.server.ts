/** Read-side helpers for the public catalogue product page. */
import 'server-only';

import { getCatalogueReadClient } from '@/lib/supabase/server-client';
import { listFireworkProducts } from '@/lib/shows/queries.server';
import { ShowsNetworkError } from '@/lib/shows/read-errors';
import { isSupabaseTransientNetworkError } from '@/lib/supabase/errors';
import type { FireworkSpecification } from '@/lib/show-domain';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CatalogueShot = {
  sequenceIndex: number;
  timeOffsetSeconds: number;
  caliber: string | null;
  name: string;
  effectName: string | null;
  heightMeters: number | null;
  colours: string[];
};

/** One listed product plus the full catalogue it sits in, for related items. */
export async function getCatalogueProduct(id: string): Promise<{
  product: FireworkSpecification;
  catalogue: FireworkSpecification[];
} | null> {
  if (!UUID.test(id)) return null;
  const catalogue = await listFireworkProducts({ lightweight: true });
  const product = catalogue.find((candidate) => candidate.id === id);
  return product ? { product, catalogue } : null;
}

type ShotFireworkRow = {
  name: string;
  height_meters: number | null;
  primary_color: string | null;
  secondary_color: string | null;
  color_palette: string[] | null;
  firework_effects: { name: string } | { name: string }[] | null;
};

type ShotRow = {
  sequence_index: number;
  time_offset_seconds: number;
  caliber: string | null;
  fireworks: ShotFireworkRow | ShotFireworkRow[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Every shot in a multishot, in firing order. Read failures surface to the caller. */
export async function listCatalogueShots(catalogueItemId: string): Promise<CatalogueShot[]> {
  const supabase = await getCatalogueReadClient();
  const { data, error } = await supabase
    .from('catalogue_items')
    .select(
      `multishots (
         multishot_fireworks (
           sequence_index,
           time_offset_seconds,
           caliber,
           fireworks (name, height_meters, primary_color, secondary_color, color_palette, firework_effects (name))
         )
       )`,
    )
    .eq('id', catalogueItemId)
    .maybeSingle();
  if (error) {
    if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
    throw new Error(`Could not read multishot sequence: ${error.message}`);
  }

  const multishot = first(
    (
      data as {
        multishots:
          | { multishot_fireworks: ShotRow[] }
          | { multishot_fireworks: ShotRow[] }[]
          | null;
      } | null
    )?.multishots,
  );
  const rows = [...(multishot?.multishot_fireworks ?? [])].sort(
    (a, b) => a.sequence_index - b.sequence_index,
  );
  return rows.flatMap((row) => {
    const firework = first(row.fireworks);
    if (!firework) return [];
    const colours = [
      firework.primary_color,
      firework.secondary_color,
      ...(firework.color_palette ?? []),
    ]
      .filter((colour): colour is string => Boolean(colour))
      .filter((colour, index, all) => all.indexOf(colour) === index)
      .slice(0, 4);
    return [
      {
        sequenceIndex: row.sequence_index,
        timeOffsetSeconds: row.time_offset_seconds,
        caliber: row.caliber,
        name: firework.name,
        effectName: first(firework.firework_effects)?.name ?? null,
        heightMeters: firework.height_meters,
        colours,
      },
    ];
  });
}
