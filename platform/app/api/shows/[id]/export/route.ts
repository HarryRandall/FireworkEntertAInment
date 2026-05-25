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
  subtype: string | null;
  duration_seconds: number | null;
  description: string | null;
  caliber?: string | null;
}): Json {
  return {
    partNumber: row.part_number,
    manufacturerPartNumber: row.manufacturer ?? undefined,
    size: row.caliber ?? undefined,
    category: row.subtype ?? undefined,
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
    .from('show_cues')
    .select('time_seconds, product_id')
    .eq('show_id', show.id)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true });

  if (cuesError || !cues?.length) {
    return new NextResponse('No cues found', { status: 404 });
  }

  const productIds = [...new Set(cues.map((c) => c.product_id))];

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, part_number, name, manufacturer, subtype, duration_seconds, description')
    .in('id', productIds);

  if (productsError) {
    return new NextResponse('Failed to fetch products', { status: 500 });
  }

  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  // Fetch the first shot's caliber for each product (shot_index=0 = smallest bore)
  const { data: shots } = await supabase
    .from('product_shots')
    .select('product_id, caliber')
    .in('product_id', productIds)
    .order('shot_index', { ascending: true });

  const caliberByProduct = new Map<string, string | null>();
  for (const shot of shots ?? []) {
    if (!caliberByProduct.has(shot.product_id)) {
      caliberByProduct.set(shot.product_id, shot.caliber ?? null);
    }
  }

  const csvCues = cues
    .filter((c) => productById.has(c.product_id))
    .map((c) => {
      const product = productById.get(c.product_id)!;
      return {
        timeSeconds: Number(c.time_seconds),
        effectName: product.name,
        sourcePayload: productToSourcePayload({
          ...product,
          caliber: caliberByProduct.get(c.product_id) ?? null,
        }),
      };
    });

  if (!csvCues.length) {
    return new NextResponse('No matched products found for this show', { status: 404 });
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
