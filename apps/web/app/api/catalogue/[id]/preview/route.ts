import { NextResponse } from 'next/server';
import {
  FireworkCardPreviewReadError,
  loadCatalogueFireworkCardPreview,
} from '@/lib/firework-card-preview.server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!UUID.test(id)) return response({ error: 'not_found' }, 404);

  try {
    const preview = await loadCatalogueFireworkCardPreview(id);
    if (!preview) return response({ error: 'not_found' }, 404);
    return response(preview);
  } catch (error) {
    if (error instanceof FireworkCardPreviewReadError) {
      console.error(`[firework-card-preview] catalogue ${id} read failed:`, error);
      return response({ error: 'temporarily_unavailable' }, 503);
    }
    throw error;
  }
}
