/** Authenticated Jamendo search and private soundtrack import. */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentProfile } from '@/lib/admin/current-user.server';
import {
  browseJamendoTracks,
  downloadJamendoTrack,
  getJamendoTrackForImport,
  JamendoConfigurationError,
  JamendoRequestError,
  JamendoTrackUnavailableError,
  searchJamendoTracks,
} from '@/lib/jamendo.server';
import { findReusableJamendoAnalysis, jamendoImportFilename } from '@/lib/jamendo-import.server';
import { isJamendoGenre } from '@/lib/music-library.types';
import { consumeFixedWindowRateLimits } from '@/lib/server-cache';
import { startMusicAnalysisForStoredAudio } from '@/lib/start-music-analysis.server';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 60;

const SearchSchema = z.string().trim().min(2).max(80);
const ImportSchema = z.object({
  trackId: z.string().regex(/^[0-9]{1,24}$/),
});

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' } as const;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function requireActiveProfile() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, response: response({ ok: false }, 401) };
  if (profile.status !== 'active') {
    return { ok: false as const, response: response({ ok: false }, 403) };
  }
  return { ok: true as const, profile };
}

async function consumeJamendoLimit(userId: string, operation: 'search' | 'import') {
  const result = await consumeFixedWindowRateLimits([
    {
      key: `showcrafter:rate:jamendo:${operation}:${userId}`,
      limit: operation === 'search' ? 20 : 5,
      windowSeconds: 60,
    },
  ]);
  if (!result.available) {
    return response({ ok: false, error: 'Song search is temporarily unavailable.' }, 503);
  }
  if (!result.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many Jamendo requests. Try again shortly.' },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          'Retry-After': String(result.retryAfterSeconds),
        },
      },
    );
  }
  return null;
}

function jamendoReadError(error: unknown, context: 'search' | 'browse') {
  if (error instanceof JamendoConfigurationError) {
    return response({ ok: false, error: error.message, configured: false }, 503);
  }
  if (error instanceof JamendoRequestError) {
    console.error(`[api/jamendo] ${context} failed:`, error);
    return response({ ok: false, error: 'Jamendo is temporarily unavailable.' }, 502);
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireActiveProfile();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;

  if (searchParams.get('mode') === 'browse') {
    const genreParam = searchParams.get('genre')?.trim().toLowerCase() ?? '';
    if (genreParam && !isJamendoGenre(genreParam)) {
      return response({ ok: false, error: 'Unknown genre.' }, 400);
    }
    const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10);
    const count = Number.parseInt(searchParams.get('count') ?? '', 10);
    const limited = await consumeJamendoLimit(auth.profile.id, 'search');
    if (limited) return limited;

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
      throw error;
    }
  }

  const parsedQuery = SearchSchema.safeParse(searchParams.get('q'));
  if (!parsedQuery.success) {
    return response(
      { ok: false, error: 'Enter at least two characters to search for a song.' },
      400,
    );
  }
  const limited = await consumeJamendoLimit(auth.profile.id, 'search');
  if (limited) return limited;

  try {
    const tracks = await searchJamendoTracks(parsedQuery.data);
    return response({ ok: true, tracks });
  } catch (error) {
    const handled = jamendoReadError(error, 'search');
    if (handled) return handled;
    throw error;
  }
}

export async function POST(request: Request) {
  const authPromise = requireActiveProfile();
  const cookieStorePromise = cookies();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return response({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  const parsed = ImportSchema.safeParse(json);
  if (!parsed.success) {
    return response({ ok: false, error: 'The selected Jamendo track is invalid.' }, 400);
  }

  const [auth, cookieStore] = await Promise.all([authPromise, cookieStorePromise]);
  if (!auth.ok) return auth.response;
  const limited = await consumeJamendoLimit(auth.profile.id, 'import');
  if (limited) return limited;

  const supabase = createClient(cookieStore);
  let audioPath: string | null = null;
  try {
    const track = await getJamendoTrackForImport(parsed.data.trackId);
    const reusableAnalysis = await findReusableJamendoAnalysis({
      supabase,
      userId: auth.profile.id,
      trackId: track.trackId,
    });
    if (reusableAnalysis) {
      return response({
        ok: true,
        uploadedAudio: {
          audioPath: reusableAnalysis.audio_path,
          musicAnalysisId: reusableAnalysis.id,
          originalName:
            reusableAnalysis.original_filename ?? jamendoImportFilename(track.title, track.artist),
          sizeBytes: reusableAnalysis.size_bytes,
          contentType: reusableAnalysis.content_type,
          durationSeconds: track.durationSeconds,
          reusedAnalysis: true,
          source: {
            provider: 'jamendo',
            trackId: reusableAnalysis.source_track_id,
            title: reusableAnalysis.source_title,
            artist: reusableAnalysis.source_artist,
            sourceUrl: reusableAnalysis.source_url,
            licenceName: reusableAnalysis.source_licence_name,
            licenceUrl: reusableAnalysis.source_licence_url,
            imageUrl: track.imageUrl,
          },
        },
      });
    }

    const audio = await downloadJamendoTrack(track);
    const originalFilename = jamendoImportFilename(track.title, track.artist);
    audioPath = `${auth.profile.id}/${crypto.randomUUID()}-${originalFilename}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(audioPath, Buffer.from(audio.bytes), {
        contentType: audio.contentType,
        upsert: false,
        metadata: {
          sourceProvider: track.provider,
          sourceTrackId: track.trackId,
        },
      });
    if (uploadError) {
      console.error('[api/jamendo] private audio upload failed:', uploadError);
      return response({ ok: false, error: 'The selected song could not be saved.' }, 500);
    }

    const analysis = await startMusicAnalysisForStoredAudio({
      supabase,
      userId: auth.profile.id,
      audioPath,
      originalFilename,
      contentType: audio.contentType,
      sizeBytes: audio.sizeBytes,
      source: track,
    });
    if (!analysis.ok) {
      const { error: cleanupError } = await supabase.storage.from('audio').remove([audioPath]);
      if (cleanupError) {
        console.error('[api/jamendo] failed import cleanup failed:', cleanupError);
      }
      return response({ ok: false, error: analysis.error }, analysis.status);
    }

    return response({
      ok: true,
      uploadedAudio: {
        audioPath,
        musicAnalysisId: analysis.musicAnalysisId,
        originalName: originalFilename,
        sizeBytes: audio.sizeBytes,
        contentType: audio.contentType,
        durationSeconds: track.durationSeconds,
        source: {
          provider: track.provider,
          trackId: track.trackId,
          title: track.title,
          artist: track.artist,
          sourceUrl: track.sourceUrl,
          licenceName: track.licenceName,
          licenceUrl: track.licenceUrl,
          imageUrl: track.imageUrl,
        },
      },
    });
  } catch (error) {
    if (audioPath) {
      const { error: cleanupError } = await supabase.storage.from('audio').remove([audioPath]);
      if (cleanupError) console.error('[api/jamendo] exception cleanup failed:', cleanupError);
    }
    if (error instanceof JamendoConfigurationError) {
      return response({ ok: false, error: error.message, configured: false }, 503);
    }
    if (error instanceof JamendoTrackUnavailableError) {
      return response({ ok: false, error: error.message, unavailable: true }, 422);
    }
    if (error instanceof JamendoRequestError) {
      console.error('[api/jamendo] import failed:', error);
      return response({ ok: false, error: 'Jamendo is temporarily unavailable.' }, 502);
    }
    throw error;
  }
}
