'use server';
/** Saving a reusable part is separate from saving the record and rechecks catalogue access. */

import { requirePermission } from '@/lib/access/current-profile.server';
import { designJson } from '@/lib/renderer-editor/validation';
import { savedPartSchema, type SavedPart } from '@/lib/renderer-editor/library';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

const saveSchema = savedPartSchema.omit({ id: true }).strict();
const deleteSchema = z.object({ id: z.string().uuid() }).strict();

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validates the part design and saves an immutable copy for every catalogue editor. */
export async function saveEditorLibraryPart(input: unknown): Promise<Result<SavedPart>> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a name and choose a valid part.' };
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) return { ok: false, error: 'Not permitted.' };
  const supabase = createClient(await cookies());
  const result = await supabase
    .from('editor_library_parts')
    .insert({
      name: parsed.data.name,
      category: parsed.data.category,
      design: designJson(parsed.data.design),
    })
    .select('id')
    .single();
  if (result.error) {
    console.error('Editor library save failed', result.error);
    return { ok: false, error: 'The part could not be saved. Try again.' };
  }
  return { ok: true, value: { ...parsed.data, id: result.data.id } };
}

/** Removes one saved part; built-in template parts cannot be deleted. */
export async function deleteEditorLibraryPart(input: unknown): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Choose a saved part.' };
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) return { ok: false, error: 'Not permitted.' };
  const supabase = createClient(await cookies());
  const result = await supabase.from('editor_library_parts').delete().eq('id', parsed.data.id);
  if (result.error) {
    console.error('Editor library delete failed', result.error);
    return { ok: false, error: 'The part could not be removed. Try again.' };
  }
  return { ok: true, value: null };
}
