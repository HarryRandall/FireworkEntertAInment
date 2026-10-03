/** Saving a reusable part is independent of draft autosave and rechecks staff authority. */
'use server';
import { requireArea } from '@/lib/auth/server';
import { getServerClient } from '@/lib/supabase/server-client';
import { savedPartSchema, type SavedPart } from './library';

const inputSchema = savedPartSchema.omit({ id: true }).strict();
/** Expected validation refusals preserve the save form; unexpected database errors stay visible. */
export type LibrarySaveResult =
  | { kind: 'saved'; part: SavedPart }
  | { kind: 'error'; message: string };
/** Validates the part envelope and saves an immutable copy through the editor-fenced RPC. */
export async function saveLibraryPart(input: unknown): Promise<LibrarySaveResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { kind: 'error', message: 'Enter a name and choose a valid part.' };
  const identity = await requireArea('admin');
  if (!['super_admin', 'catalogue_editor'].includes(identity.access.staffRole ?? ''))
    return { kind: 'error', message: 'Catalogue editor access is required.' };
  const client = await getServerClient();
  const result = await client.rpc('save_studio_library_part', {
    p_name: parsed.data.name,
    p_category: parsed.data.category,
    p_design: parsed.data.design,
  });
  if (result.error) {
    if (['23514', '22023', '42501'].includes(result.error.code))
      return { kind: 'error', message: result.error.message };
    console.error('Studio library save failed', result.error);
    throw new Error('The library could not be saved.', { cause: result.error });
  }
  return { kind: 'saved', part: { ...parsed.data, id: result.data } };
}
