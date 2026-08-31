import 'server-only';

/**
 * Admin cover-poster backfill reads. Lists show presets with their saved
 * shader cover and current poster path so the backfill UI can render missing
 * posters client-side and record the resulting storage path.
 */
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';
import { parseCover, type ShowCover } from '@/lib/cover';

export type CoverBackfillPreset = {
  id: string;
  slug: string;
  title: string;
  cover: ShowCover | null;
  coverImagePath: string | null;
};

type PresetRow = {
  id: string;
  slug: string;
  title: string;
  cover_shader: unknown;
  cover_image_path: string | null;
};

/** Returns all show presets for the backfill UI, or null when unauthorised. */
export async function listShowPresetsForCoverBackfill(): Promise<CoverBackfillPreset[] | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('show_presets')
    .select('id, slug, title, cover_shader, cover_image_path')
    .order('title', { ascending: true });

  if (error) {
    console.error('[cover-posters] listShowPresetsForCoverBackfill failed:', error);
    return null;
  }

  return (
    (data as PresetRow[] | null)?.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      cover: parseCover(row.cover_shader),
      coverImagePath: row.cover_image_path ?? null,
    })) ?? []
  );
}
