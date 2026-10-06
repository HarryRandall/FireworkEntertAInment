/** Export an owned show's complete cue timeline as a Finale 3D-compatible CSV. */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Json } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';
import { getShowBySlug } from '@/lib/shows/queries.server';
import { buildFinale3dCsv, finaleExportWarning } from '@/lib/finale3d';

const EXPORT_READ_PAGE_SIZE = 500; // PostgREST export read batch, rows; below the default server limit.

function productToSourcePayload(row: {
  part_number: string;
  manufacturer: string | null;
  firework_type: string | null;
  duration_seconds: number | null;
  description: string | null;
  caliber?: string | null;
}): Json {
  return {
    partNumber: row.part_number,
    manufacturerPartNumber: row.manufacturer ?? undefined,
    size: row.caliber ?? undefined,
    category: row.firework_type ?? undefined,
    duration: row.duration_seconds != null ? String(row.duration_seconds) : undefined,
    vdl: row.description ?? undefined,
  } as Json;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) return new NextResponse('Not found', { status: 404 });

  const supabase = createClient(await cookies());

  const cues: Array<{
    time_seconds: number | null;
    catalogue_item_id: string;
    launch_position_index: number | null;
  }> = [];
  for (let from = 0; ; from += EXPORT_READ_PAGE_SIZE) {
    const { data: page, error: cuesError } = await supabase
      .from('show_timeline_items')
      .select('time_seconds, catalogue_item_id, launch_position_index')
      .eq('show_id', show.id)
      .not('time_seconds', 'is', null)
      .order('time_seconds', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + EXPORT_READ_PAGE_SIZE - 1);
    if (cuesError) {
      console.error('[show-export] cue read failed:', cuesError);
      return new NextResponse('The show could not be exported.', { status: 500 });
    }
    cues.push(...(page ?? []));
    if ((page?.length ?? 0) < EXPORT_READ_PAGE_SIZE) break;
  }
  if (!cues?.length) {
    return new NextResponse('No cues found', { status: 404 });
  }

  const catalogueItemIds = [...new Set(cues.map((c) => c.catalogue_item_id))];

  const catalogueBatches: string[][] = [];
  for (let from = 0; from < catalogueItemIds.length; from += EXPORT_READ_PAGE_SIZE) {
    catalogueBatches.push(catalogueItemIds.slice(from, from + EXPORT_READ_PAGE_SIZE));
  }
  const cataloguePages = await Promise.all(
    catalogueBatches.map((ids) =>
      supabase
        .from('catalogue_items')
        .select(
          `id, part_number, name, finale_product_id, finale_effect_name, manufacturer, firework_type, duration_seconds, description,
       fireworks (caliber),
       multishots (multishot_fireworks (sequence_index, caliber))`,
        )
        .in('id', ids),
    ),
  );
  const catalogueError = cataloguePages.find((page) => page.error)?.error;
  if (catalogueError) {
    console.error('[show-export] catalogue read failed:', catalogueError);
    return new NextResponse('Failed to fetch catalogue items', { status: 500 });
  }
  const catalogueItems = cataloguePages.flatMap((page) => page.data ?? []);

  const catalogueItemById = new Map((catalogueItems ?? []).map((item) => [item.id, item]));
  const missingCatalogueItemIds = catalogueItemIds.filter(
    (catalogueItemId) => !catalogueItemById.has(catalogueItemId),
  );
  if (missingCatalogueItemIds.length > 0) {
    console.error('[show-export] catalogue references did not resolve:', {
      showId: show.id,
      missingCatalogueItemIds,
    });
    return new NextResponse('The show contains catalogue items that could not be exported.', {
      status: 409,
    });
  }

  const firstCaliberForItem = (item: NonNullable<typeof catalogueItems>[number]) => {
    const directFirework = Array.isArray(item.fireworks) ? item.fireworks[0] : item.fireworks;
    if (directFirework?.caliber) return directFirework.caliber;
    const multishot = Array.isArray(item.multishots) ? item.multishots[0] : item.multishots;
    const shots = [...(multishot?.multishot_fireworks ?? [])].sort(
      (a, b) => a.sequence_index - b.sequence_index,
    );
    return shots.find((shot) => shot.caliber)?.caliber ?? null;
  };

  const csvCues = cues.map((c) => {
    const catalogueItem = catalogueItemById.get(c.catalogue_item_id)!;
    return {
      timeSeconds: Number(c.time_seconds),
      effectName: catalogueItem.name,
      finaleProductId: catalogueItem.finale_product_id,
      finaleEffectName: catalogueItem.finale_effect_name,
      launchPositionIndex: c.launch_position_index ?? 0,
      sourcePayload: productToSourcePayload({
        ...catalogueItem,
        caliber: firstCaliberForItem(catalogueItem),
      }),
    };
  });

  // A multishot cue exports one purchased product, so only its own mapping matters.
  const warning = finaleExportWarning(csvCues);
  if (warning && new URL(req.url).searchParams.get('continue') !== '1') {
    return NextResponse.json(warning, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const csv = buildFinale3dCsv(csvCues);
  const filename = `${show.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-finale3d.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
