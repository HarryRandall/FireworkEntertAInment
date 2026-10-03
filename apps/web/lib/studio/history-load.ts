/** Studio history combines complete caller-RLS versions with actual catalogue usage. */
import 'server-only';
import { needsPosters } from './poster-specs';
import { designSchema } from '@showcrafter/fireworks';
import { getServerClient } from '@/lib/supabase/server-client';
import { readRows } from '@/lib/catalogue/read';
import { loadEffectDetail } from '@/lib/catalogue/details';
import type { Design } from '@showcrafter/fireworks';

/** Serialisable version snapshot, newest first in the history panel. */
export interface StudioVersion {
  id: string;
  number: number;
  status: string;
  note: string | null;
  created: string;
  author: string;
  document: Design;
}
/** Reads every version and resolves author names; unknown author reads remain visible failures. */
export async function loadStudioHistory(effectId: string) {
  const client = await getServerClient();
  const rows = await readRows((a, b) =>
    client
      .from('effect_versions')
      .select(
        'id,number,status,change_note,created_at,author_id,design,profiles!effect_versions_author_id_fkey(display_name)',
      )
      .eq('effect_id', effectId)
      .order('number', { ascending: false })
      .range(a, b),
  );
  const versions: StudioVersion[] = rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    note: row.change_note,
    created: row.created_at,
    author: row.profiles?.display_name ?? 'Unknown author',
    document: designSchema.parse(row.design),
  }));
  const detail = await loadEffectDetail(effectId);
  if (!detail) throw new Error('Studio firework disappeared while loading history.');
  const posters = await client
    .from('poster_renders')
    .select('renderer,framing,status')
    .eq(
      'effect_version_id',
      detail.parent.current_version_id ?? '00000000-0000-0000-0000-000000000000',
    );
  if (posters.error) throw posters.error;
  return {
    versions,
    usage: detail.usage,
    missingPosters: detail.parent.current_version_id !== null && needsPosters(posters.data),
  };
}
