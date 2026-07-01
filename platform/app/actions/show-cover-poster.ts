'use server';

/**
 * Persists the storage path of a pre-rendered cover poster for a show. The PNG
 * itself is uploaded browser-side from the generating screen (which already
 * mounts the live shader); this action just records the path on the show row
 * after verifying the caller owns the show. RLS on `shows` also enforces
 * ownership, but the explicit check keeps the failure mode quiet for guests.
 */
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function setShowCoverImagePath(
  showId: string,
  path: string,
): Promise<{ ok: boolean }> {
  if (!showId || !path) return { ok: false };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // RLS scopes this select to the caller's own shows; a missing row means the
  // show does not exist or is not theirs.
  const { data: show } = await supabase.from('shows').select('id').eq('id', showId).maybeSingle();
  if (!show) return { ok: false };

  const { error } = await supabase
    .from('shows')
    .update({ cover_image_path: path })
    .eq('id', showId);
  if (error) {
    console.error('[setShowCoverImagePath] update failed:', error);
    return { ok: false };
  }
  return { ok: true };
}
