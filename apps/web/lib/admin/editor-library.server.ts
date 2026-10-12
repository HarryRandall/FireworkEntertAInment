/** Saved editor parts are read under the current catalogue editor and validated before reaching the editor. */
import 'server-only';

import { savedPartSchema, type SavedPart } from '@/lib/renderer-editor/library';
import { describeSupabaseError } from './style-default-schema';
import { getServerClient } from './supabase';

/** Loads shared parts newest first. Read failures stay failures; rows that no longer validate are skipped. */
export async function listEditorLibraryParts(): Promise<SavedPart[]> {
  const client = await getServerClient();
  const result = await client
    .from('editor_library_parts')
    .select('id,name,category,design')
    .order('created_at', { ascending: false })
    .order('id');
  if (result.error)
    throw new Error(`Could not load saved parts: ${describeSupabaseError(result.error)}`);
  return result.data.flatMap((row) => {
    const parsed = savedPartSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
