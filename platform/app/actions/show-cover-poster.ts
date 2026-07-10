'use server';

/**
 * Persists the storage path of a pre-rendered cover poster for a show. The file
 * itself is uploaded browser-side from the generating screen (which already
 * mounts the live shader); this action just records the path on the show row
 * after verifying the caller owns the show. RLS on `shows` also enforces
 * ownership, but the explicit check keeps the failure mode quiet for guests.
 */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseCover } from '@/lib/cover';
import type { Json } from '@/lib/database.types';
import { invalidateShowCacheForUser } from '@/lib/shows.server';
import { createClient } from '@/utils/supabase/server';

export async function setShowCoverImagePath(
  showId: string,
  path: string,
  coverShader?: unknown,
): Promise<{ ok: boolean }> {
  if (!showId || !path) return { ok: false };
  const parsedCover = coverShader === undefined ? null : parseCover(coverShader);
  if (coverShader !== undefined && !parsedCover) return { ok: false };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // RLS scopes this select to the caller's own shows; a missing row means the
  // show does not exist or is not theirs.
  const { data: show } = await supabase
    .from('shows')
    .select('id, slug')
    .eq('id', showId)
    .maybeSingle();
  if (!show) return { ok: false };

  const update: { cover_image_path: string; cover_shader?: Json } = { cover_image_path: path };
  if (parsedCover) update.cover_shader = parsedCover as Json;

  const { error } = await supabase.from('shows').update(update).eq('id', showId);
  if (error) {
    console.error('[setShowCoverImagePath] update failed:', error);
    return { ok: false };
  }
  await invalidateShowCacheForUser(user.id, { showId, showSlug: show.slug });
  revalidatePath('/shows');
  revalidatePath('/home');
  revalidatePath(`/shows/${show.slug}`);
  return { ok: true };
}
