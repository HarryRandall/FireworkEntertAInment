/** Capability-scoped Jamendo browse, search and private soundtrack import. */

import { after } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createAssortmentJamendoSelection,
  getAssortmentServiceClient,
  getPublicAssortmentByToken,
} from '@/lib/assortments/public.server';
import { consumeAssortmentPublicRateLimit } from '@/lib/assortments/request-security.server';
import { findReusableJamendoAnalysis } from '@/lib/jamendo-import.server';
import {
  browseJamendoTracks,
  downloadJamendoTrack,
  getJamendoTrackForImport,
  JamendoConfigurationError,
  JamendoRequestError,
  JamendoTrackUnavailableError,
  searchJamendoTracks,
} from '@/lib/jamendo.server';
import { isJamendoGenre } from '@/lib/music-library.types';
import { runAssortmentSongAnalysisLifecycle } from '@/lib/music-analysis-lifecycle.server';

export const maxDuration = 300;

const SearchSchema = z.string().trim().min(2).max(80);
const ImportSchema = z.object({ trackId: z.string().regex(/^[0-9]{1,24}$/) }).strict();
const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' } as const;

function response(body: unknown, status = 200, retryAfterSeconds?: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      ...(retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {}),
    },
  });
}

function jamendoReadError(error: unknown, context: 'search' | 'browse') {
  if (error instanceof JamendoConfigurationError) {
    return response({ ok: false, error: error.message, configured: false }, 503);
  }
  if (error instanceof JamendoRequestError) {
    console.error(`[assortment-qr/jamendo] ${context} failed:`, error);
    return response({ ok: false, error: 'Jamendo is temporarily unavailable.' }, 502);
  }
  return null;
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const assortment = await getPublicAssortmentByToken(token);
  if (!assortment) return response({ ok: false, error: 'Assortment unavailable.' }, 404);

  const limit = await consumeAssortmentPublicRateLimit({
    request,
    assortmentId: assortment.id,
    operation: 'jamendo-read',
  });
  if (!limit.productionReady) {
    return response({ ok: false, error: 'Music browsing is temporarily unavailable.' }, 503);
  }
  if (!limit.allowed) {
    return response(
      { ok: false, error: 'Too many music requests. Try again shortly.' },
      429,
      limit.retryAfterSeconds,
    );
  }

  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get('mode') === 'browse') {
    const genreParam = searchParams.get('genre')?.trim().toLowerCase() ?? '';
    if (genreParam && !isJamendoGenre(genreParam)) {
      return response({ ok: false, error: 'Unknown genre.' }, 400);
    }
    const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10);
    const count = Number.parseInt(searchParams.get('count') ?? '', 10);
    try {
      const page = await browseJamendoTracks(
        genreParam || null,
        Number.isFinite(offset) ? offset : 0,
        Number.isFinite(count) ? count : 20,
      );
      return response({ ok: true, ...page });
    } catch (error) {
      const handled = jamendoReadError(error, 'browse');
      if (handled) return handled;
      console.error('[assortment-qr/jamendo] unexpected browse failure:', error);
      return response({ ok: false, error: 'Music browsing is temporarily unavailable.' }, 500);
    }
  }

  const parsedQuery = SearchSchema.safeParse(searchParams.get('q'));
  if (!parsedQuery.success) {
    return response(
      { ok: false, error: 'Enter at least two characters to search for a song.' },
      400,
    );
  }
  try {
    const tracks = await searchJamendoTracks(parsedQuery.data);
    return response({ ok: true, tracks });
  } catch (error) {
    const handled = jamendoReadError(error, 'search');
    if (handled) return handled;
    console.error('[assortment-qr/jamendo] unexpected search failure:', error);
    return response({ ok: false, error: 'Song search is temporarily unavailable.' }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const assortment = await getPublicAssortmentByToken(token);
  if (!assortment) return response({ ok: false, error: 'Assortment unavailable.' }, 404);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return response({ ok: false, error: 'Invalid request.' }, 400);
  }
  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) {
    return response({ ok: false, error: 'The selected Jamendo track is invalid.' }, 400);
  }

  const limit = await consumeAssortmentPublicRateLimit({
    request,
    assortmentId: assortment.id,
    operation: 'jamendo-import',
  });
  if (!limit.productionReady) {
    return response({ ok: false, error: 'Song selection is temporarily unavailable.' }, 503);
  }
  if (!limit.allowed) {
    return response(
      { ok: false, error: 'Too many song requests. Try again shortly.' },
      429,
      limit.retryAfterSeconds,
    );
  }

  try {
    const track = await getJamendoTrackForImport(parsed.data.trackId);
    const reusableAnalysis = await findReusableJamendoAnalysis({
      supabase: getAssortmentServiceClient(),
      userId: assortment.fundingUserId,
      trackId: track.trackId,
    });
    const audio = reusableAnalysis ? null : await downloadJamendoTrack(track);
    const selection = await createAssortmentJamendoSelection({
      assortment,
      track,
      audio,
      reusableAnalysis,
    });

    if (!selection.reusedAnalysis) {
      after(async () => {
        await runAssortmentSongAnalysisLifecycle({
          supabase: selection.supabase,
          userId: selection.fundingUserId,
          musicAnalysisId: selection.analysisId,
        });
      });
    }

    return response({
      ok: true,
      selectionToken: selection.selectionToken,
      reusedAnalysis: selection.reusedAnalysis,
      track: {
        provider: track.provider,
        trackId: track.trackId,
        title: track.title,
        artist: track.artist,
        durationSeconds: track.durationSeconds,
        sourceUrl: track.sourceUrl,
        licenceName: track.licenceName,
        licenceUrl: track.licenceUrl,
        imageUrl: track.imageUrl,
      },
    });
  } catch (error) {
    if (error instanceof JamendoConfigurationError) {
      return response({ ok: false, error: error.message, configured: false }, 503);
    }
    if (error instanceof JamendoTrackUnavailableError) {
      return response({ ok: false, error: error.message, unavailable: true }, 422);
    }
    if (error instanceof JamendoRequestError) {
      console.error('[assortment-qr/jamendo] import failed:', error);
      return response({ ok: false, error: 'Jamendo is temporarily unavailable.' }, 502);
    }
    if (error instanceof Error) {
      if (error.message === 'Assortment unavailable.') {
        return response({ ok: false, error: error.message }, 404);
      }
      if (error.message === 'This retailer has temporarily reached its generation limit.') {
        return response({ ok: false, error: error.message }, 402);
      }
      if (error.message === 'The selected song is no longer available.') {
        return response({ ok: false, error: error.message, unavailable: true }, 422);
      }
      if (
        error.message === 'The selected song could not be saved.' ||
        error.message === 'The selected song could not be prepared.'
      ) {
        return response({ ok: false, error: error.message }, 500);
      }
    }
    console.error('[assortment-qr/jamendo] unexpected import failure:', error);
    return response({ ok: false, error: 'The selected song could not be prepared.' }, 500);
  }
}
