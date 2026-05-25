/**
 * Audio-asset helpers for the shows module.
 *
 * The `audio` Supabase Storage bucket is private, so playback requires a
 * short-lived signed URL. Callers should mint a fresh URL per page load —
 * don't store these in the cache layer.
 */
import 'server-only';

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
