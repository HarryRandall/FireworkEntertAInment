import { after } from 'next/server';
import { NextResponse } from 'next/server';
import {
  getAssortmentServiceClient,
  getPublicAssortmentByToken,
  resolvePublicAssortmentShow,
} from '@/lib/assortments/public.server';
import { consumeAssortmentPublicRateLimit } from '@/lib/assortments/request-security.server';
import { recoverPublicAssortmentShowGeneration } from '@/lib/music-analysis-lifecycle.server';

export const maxDuration = 300;

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' } as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string; showToken: string }> },
) {
  const { token, showToken } = await context.params;
  const assortment = await getPublicAssortmentByToken(token);
  if (!assortment) {
    return NextResponse.json(
      { ok: false, error: 'Assortment unavailable.' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }
  const limit = await consumeAssortmentPublicRateLimit({
    request,
    assortmentId: assortment.id,
    operation: 'status',
  });
  if (!limit.productionReady) {
    return NextResponse.json(
      { ok: false, error: 'Show status is temporarily unavailable.' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many status requests.' },
      {
        status: 429,
        headers: { ...NO_STORE_HEADERS, 'Retry-After': String(limit.retryAfterSeconds) },
      },
    );
  }

  const show = await resolvePublicAssortmentShow({
    assortmentId: assortment.id,
    showAccessToken: showToken,
  });
  if (!show) {
    return NextResponse.json(
      { ok: false, error: 'Show unavailable.' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  if (show.generationStatus === 'running') {
    const supabase = getAssortmentServiceClient();
    after(async () => {
      try {
        await recoverPublicAssortmentShowGeneration({
          supabase,
          userId: show.fundingUserId,
          showId: show.id,
          musicAnalysisId: show.musicAnalysisId,
        });
      } catch (error) {
        console.error('[assortment-qr] public show recovery crashed:', error);
      }
    });
  }

  return NextResponse.json(
    {
      ok: true,
      status: show.generationStatus,
      error: show.generationStatus === 'failed' ? show.generationError : null,
    },
    { headers: NO_STORE_HEADERS },
  );
}
