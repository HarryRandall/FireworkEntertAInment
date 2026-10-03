/** Saved parts are read under the current staff identity and validated before reaching the editor. */
import 'server-only';
import { getServerClient } from '@/lib/supabase/server-client';
import { savedPartSchema } from './library';

/** Loads shared catalogue-editor parts newest first; read failures remain failures. */
export async function loadLibraryParts() {
  const client = await getServerClient();
  const result = await client
    .from('studio_library_parts')
    .select('id,name,category,design')
    .order('created_at', { ascending: false })
    .order('id');
  if (result.error) throw result.error;
  return result.data.map((row) => savedPartSchema.parse(row));
}
