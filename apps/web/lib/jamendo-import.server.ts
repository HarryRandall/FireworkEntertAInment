/** Shared ownership and storage checks for Jamendo analysis reuse. */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type AppSupabaseClient = SupabaseClient<Database>;

export type ReusableJamendoAnalysis = {
  id: string;
  audio_path: string;
  original_filename: string | null;
  content_type: string;
  size_bytes: number;
  source_track_id: string;
  source_title: string;
  source_artist: string;
  source_url: string;
  source_licence_name: string;
  source_licence_url: string;
};

export function jamendoImportFilename(title: string, artist: string): string {
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
  const relativePath = params.audioPath.slice(prefix.length);
  const segments = relativePath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  const fileName = segments.at(-1);
  const directory = [params.userId, ...segments.slice(0, -1)].join('/');
  if (!fileName) return false;

  const { data, error } = await params.supabase.storage.from('audio').list(directory, {
    limit: 2,
    search: fileName,
  });
  if (error) {
    console.error('[jamendo-import] reusable audio lookup failed:', error);
    return false;
  }
  return (data ?? []).some((object) => object.name === fileName);
}

/**
 * Reuse stays scoped to the funding user and to analyses already consumed by
 * one of their shows. The private audio object must still exist.
 */
export async function findReusableJamendoAnalysis(params: {
  supabase: AppSupabaseClient;
  userId: string;
  trackId: string;
}): Promise<ReusableJamendoAnalysis | null> {
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
    console.error('[jamendo-import] reusable analysis lookup failed:', candidateError);
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
    console.error('[jamendo-import] reusable analysis reference lookup failed:', linkedShowsError);
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
      return candidate as ReusableJamendoAnalysis;
    }
  }

  return null;
}
