/** GET handler that exports a show as a downloadable file (e.g. Finale3D / JSON); requires the caller to own the show. */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Json } from '@/lib/database.types';
import { createClient } from '@/utils/supabase/server';
import { getShowBySlug } from '@/lib/shows.server';
import { buildFinale3dCsv } from '@/lib/finale3d';

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) return new NextResponse('Not found', { status: 404 });

  const supabase = createClient(await cookies());

  const { data: cues, error: cuesError } = await supabase
    .from('show_timeline_items')
    .select('time_seconds, catalogue_item_id, launch_position_index')
    .eq('show_id', show.id)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true });

  if (cuesError || !cues?.length) {
    return new NextResponse('No cues found', { status: 404 });
  }

  const catalogueItemIds = [...new Set(cues.map((c) => c.catalogue_item_id))];

  const { data: catalogueItems, error: catalogueError } = await supabase
    .from('catalogue_items')
    .select(
      `id, part_number, name, manufacturer, firework_type, duration_seconds, description,
       fireworks (caliber),
       multishots (multishot_fireworks (sequence_index, caliber))`,
    )
    .in('id', catalogueItemIds);

  if (catalogueError) {
    return new NextResponse('Failed to fetch catalogue items', { status: 500 });
  }

  const catalogueItemById = new Map((catalogueItems ?? []).map((item) => [item.id, item]));
  const firstCaliberForItem = (item: NonNullable<typeof catalogueItems>[number]) => {
    const directFirework = Array.isArray(item.fireworks) ? item.fireworks[0] : item.fireworks;
    if (directFirework?.caliber) return directFirework.caliber;
    const multishot = Array.isArray(item.multishots) ? item.multishots[0] : item.multishots;
    const shots = [...(multishot?.multishot_fireworks ?? [])].sort(
      (a, b) => a.sequence_index - b.sequence_index,
    );
    return shots.find((shot) => shot.caliber)?.caliber ?? null;
  };

  const csvCues = cues
    .filter((c) => catalogueItemById.has(c.catalogue_item_id))
    .map((c) => {
      const catalogueItem = catalogueItemById.get(c.catalogue_item_id)!;
      return {
        timeSeconds: Number(c.time_seconds),
        effectName: catalogueItem.name,
        launchPositionIndex: c.launch_position_index ?? 0,
        sourcePayload: productToSourcePayload({
          ...catalogueItem,
          caliber: firstCaliberForItem(catalogueItem),
        }),
      };
    });

  if (!csvCues.length) {
    return new NextResponse('No matched catalogue items found for this show', { status: 404 });
  }

  const csv = buildFinale3dCsv(csvCues);
  const filename = `${show.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-finale3d.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
