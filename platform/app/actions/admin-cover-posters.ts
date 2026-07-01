'use server';

/**
 * Admin cover-poster backfill action. The browser renders each preset's saved
 * shader cover to a PNG (via renderCoverToPng) and posts the data URL here; the
 * server uploads it to the public `covers` bucket under `presets/<id>.png` and
 * records the path on the preset row. Writes use the service role because
 * `show_presets` is admin-managed and the `presets/` storage prefix has no
 * client write policy by design.
 */
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/admin.server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

export type BackfillPresetCoverResult = { ok: true; path: string } | { ok: false; error: string };

function decodeDataUrl(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match?.[1]) return null;
  return Buffer.from(match[1], 'base64');
}

export async function backfillPresetCoverPoster(
  presetId: string,
  dataUrl: string,
): Promise<BackfillPresetCoverResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not authorised' };
  }
  if (!presetId) return { ok: false, error: 'Missing preset id' };

  const buffer = decodeDataUrl(dataUrl);
  if (!buffer) return { ok: false, error: 'Invalid PNG data URL' };

  const supabase = createServiceRoleSupabase();
  if (!supabase) return { ok: false, error: 'Service role not configured' };

  const path = `presets/${presetId}.png`;
  const { error: uploadError } = await supabase.storage.from('covers').upload(path, buffer, {
    contentType: 'image/png',
    cacheControl: 'public, max-age=31536000, immutable',
    upsert: true,
  });
  if (uploadError) {
    console.error('[cover-posters] upload failed:', uploadError);
    return { ok: false, error: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from('show_presets')
    .update({ cover_image_path: path })
    .eq('id', presetId);
  if (updateError) {
    console.error('[cover-posters] row update failed:', updateError);
    return { ok: false, error: updateError.message };
  }

  revalidatePath('/library');
  revalidatePath('/home');
  return { ok: true, path };
}
