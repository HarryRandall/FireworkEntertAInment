'use server';

/**
 * Admin cover-poster backfill action. The browser renders each preset's saved
 * cover to an image data URL (via renderCoverToPng) and posts it here; the
 * server uploads it to the public `covers` bucket under `presets/<id>-v2.*` and
 * records the path on the preset row. Writes use the service role because
 * `show_presets` is admin-managed and the `presets/` storage prefix has no
 * client write policy by design.
 */
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/admin.server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

export type BackfillPresetCoverResult = { ok: true; path: string } | { ok: false; error: string };

const COVER_POSTER_VERSION = 'v2';

function decodeDataUrl(
  dataUrl: string,
): { buffer: Buffer; contentType: string; extension: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return {
    buffer: Buffer.from(match[2], 'base64'),
    contentType: match[1],
    extension: match[1] === 'image/jpeg' ? 'jpg' : 'png',
  };
}

export async function backfillPresetCoverPoster(
  presetId: string,
  dataUrl: string,
): Promise<BackfillPresetCoverResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not authorised' };
  }
  if (!presetId) return { ok: false, error: 'Missing preset id' };

  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return { ok: false, error: 'Invalid image data URL' };

  const supabase = createServiceRoleSupabase();
  if (!supabase) return { ok: false, error: 'Service role not configured' };

  const path = `presets/${presetId}-${COVER_POSTER_VERSION}.${decoded.extension}`;
  const { error: uploadError } = await supabase.storage
    .from('covers')
    .upload(path, decoded.buffer, {
      contentType: decoded.contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      upsert: true,
    });
  if (uploadError) {
    console.error('[cover-posters] upload failed:', uploadError);
    return { ok: false, error: uploadError.message };
  }

  const { data: updatedPreset, error: updateError } = await supabase
    .from('show_presets')
    .update({ cover_image_path: path })
    .eq('id', presetId)
    .select('cover_image_path')
    .maybeSingle();
  if (updateError) {
    console.error('[cover-posters] row update failed:', updateError);
    return { ok: false, error: updateError.message };
  }
  if (!updatedPreset?.cover_image_path) {
    return { ok: false, error: 'Preset not found. Refresh the page and try again.' };
  }

  revalidatePath('/library');
  revalidatePath('/home');
  return { ok: true, path: updatedPreset.cover_image_path };
}
