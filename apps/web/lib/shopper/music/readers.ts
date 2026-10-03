/** Owned soundtrack reads sign private audio only after the session ownership RPC. */
import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleSupabase } from '@/lib/supabase/service-role';
import { soundtrackSchema } from './contracts';

const AUDIO_URL_LIFETIME_SECONDS = 3600; // One-hour playback link, matching the maximum track duration.
/** Reads exact pinned features, or available current features for a candidate awaiting analysis. */
export async function readSoundtrack(session: string) {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('plan_soundtrack', { p_session: session });
  if (error) throw error;
  return playbackSoundtrack(data);
}
/** Reads pinned music only for a show already visible through the store playback boundary. */
export async function readShowSoundtrack(store: string, show: string) {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('show_soundtrack', { p_store: store, p_show: show });
  if (error) throw error;
  return playbackSoundtrack(data);
}
async function playbackSoundtrack(data: unknown) {
  if (data === null) return null;
  const soundtrack = soundtrackSchema.omit({ playback_url: true }).parse(data);
  let playback = soundtrack.pinned_analysis_id === null ? soundtrack.source_audio_url : null;
  if (soundtrack.audio_media_id !== null) {
    const service = createServiceRoleSupabase();
    if (!service) throw new Error('Music service credentials missing');
    const media = await service
      .from('media')
      .select('bucket,path')
      .eq('id', soundtrack.audio_media_id)
      .single();
    if (media.error) throw media.error;
    if (media.data.bucket !== 'audio') throw new Error('Music audio bucket mismatch');
    const signed = await service.storage
      .from('audio')
      .createSignedUrl(media.data.path, AUDIO_URL_LIFETIME_SECONDS);
    if (signed.error) throw signed.error;
    playback = signed.data.signedUrl;
  }
  return { ...soundtrack, playback_url: playback };
}
