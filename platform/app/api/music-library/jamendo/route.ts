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

type AppSupabaseClient = ReturnType<typeof createClient>;

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

function importFilename(title: string, artist: string): string {
  const base = `${title} - ${artist}`
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return `${base || 'jamendo-track'}.mp3`;
}

async function storedAudioExists(params: {
  supabase: AppSupabaseClient;
  userId: string;
  audioPath: string;
}): Promise<boolean> {
  const prefix = `${params.userId}/`;
  if (!params.audioPath.startsWith(prefix)) return false;
  const fileName = params.audioPath.slice(prefix.length);
  if (!fileName || fileName.includes('/')) return false;

  const { data, error } = await params.supabase.storage.from('audio').list(params.userId, {
    limit: 2,
    search: fileName,
  });
  if (error) {
    console.error('[api/jamendo] reusable audio lookup failed:', error);
    return false;
  }
  return (data ?? []).some((object) => object.name === fileName);
}

async function findReusableJamendoAnalysis(params: {
  supabase: AppSupabaseClient;
  userId: string;
  trackId: string;
}) {
  const { data: candidates, error: candidateError } = await params.supabase
    .from('song_analyses')
    .select(
      'id, audio_path, original_filename, content_type, size_bytes, source_track_id, source_title, source_artist, source_url, source_licence_name, source_licence_url',
    )
    .eq('user_id', params.userId)
    .eq('source_provider', 'jamendo')
    .eq('source_track_id', params.trackId)
    .eq('status', 'completed')
    .not('analysis_json', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5);

  if (candidateError) {
    console.error('[api/jamendo] reusable analysis lookup failed:', candidateError);
    return null;
  }
  if (!candidates?.length) return null;

  const { data: linkedShows, error: linkedShowsError } = await params.supabase
    .from('shows')
    .select('music_analysis_id')
    .eq('user_id', params.userId)
    .in(
      'music_analysis_id',
      candidates.map((candidate) => candidate.id),
    );

  if (linkedShowsError) {
    console.error('[api/jamendo] reusable analysis reference lookup failed:', linkedShowsError);
    return null;
  }

  const linkedAnalysisIds = new Set(
    (linkedShows ?? [])
      .map((show) => show.music_analysis_id)
      .filter((id): id is string => typeof id === 'string'),
  );

  for (const candidate of candidates) {
    if (
      !linkedAnalysisIds.has(candidate.id) ||
      !candidate.content_type ||
      !candidate.size_bytes ||
      !candidate.source_track_id ||
      !candidate.source_title ||
      !candidate.source_artist ||
      !candidate.source_url ||
      !candidate.source_licence_name ||
      !candidate.source_licence_url
    ) {
      continue;
    }
    if (
      await storedAudioExists({
        supabase: params.supabase,
        userId: params.userId,
        audioPath: candidate.audio_path,
      })
    ) {
      return candidate;
    }
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
            reusableAnalysis.original_filename ?? importFilename(track.title, track.artist),
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
    const originalFilename = importFilename(track.title, track.artist);
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
