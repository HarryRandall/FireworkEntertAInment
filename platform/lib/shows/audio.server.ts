/**
 * Audio-asset helpers for the shows module.
 *
 * The `audio` Supabase Storage bucket is private, so playback requires a
 * short-lived signed URL. Callers should mint a fresh URL per page load —
 * don't store these in the cache layer.
 */
import 'server-only';

import type { SoundtrackAttribution } from '@/lib/music-library.types';
import { getServerClient } from './supabase';

/**
 * Mint a private signed URL for the user's audio asset.
 *
 * @param audioPath        The storage path (e.g. `users/<id>/<slug>.mp3`); a `null`/empty value short-circuits to `null`.
 * @param expiresInSeconds Lifetime for the signed URL, default 30 minutes.
 */
export async function getAudioSignedUrl(
  audioPath: string | null,
  expiresInSeconds = 60 * 30,
): Promise<string | null> {
  if (!audioPath) return null;
  const supabase = await getServerClient();
  const { data, error } = await supabase.storage
    .from('audio')
    .createSignedUrl(audioPath, expiresInSeconds);
  if (error) {
    console.error('[shows.server] getAudioSignedUrl failed:', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Resolve persisted provider attribution for the soundtrack linked to a show. */
export async function getSoundtrackAttribution(
  musicAnalysisId: string | null,
): Promise<SoundtrackAttribution | null> {
  if (!musicAnalysisId) return null;
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('song_analyses')
    .select(
      'source_provider, source_track_id, source_title, source_artist, source_url, source_licence_name, source_licence_url',
    )
    .eq('id', musicAnalysisId)
    .maybeSingle();
  if (error) {
    console.error('[shows.server] getSoundtrackAttribution failed:', error);
    throw new Error('Soundtrack attribution could not be loaded.', { cause: error });
  }
  if (
    data?.source_provider !== 'jamendo' ||
    !data.source_track_id ||
    !data.source_title ||
    !data.source_artist ||
    !data.source_url ||
    !data.source_licence_name ||
    !data.source_licence_url
  ) {
    return null;
  }
  return {
    provider: 'jamendo',
    trackId: data.source_track_id,
    title: data.source_title,
    artist: data.source_artist,
    sourceUrl: data.source_url,
    licenceName: data.source_licence_name,
    licenceUrl: data.source_licence_url,
  };
}
