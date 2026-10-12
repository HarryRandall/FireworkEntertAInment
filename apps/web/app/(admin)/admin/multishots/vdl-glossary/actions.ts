'use server';

/** Saves admin overrides and additions to the Finale VDL word list. */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { effectTemplates } from '@showcrafter/renderer';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/access/current-profile.server';
import { glossaryPhrase, vdlTermSchema } from '@/lib/finale/vdl/glossary';
import type { Json } from '@/lib/database.types';

const MAX_PHRASE_LENGTH = 80; // vdl_glossary_terms phrase limit, characters.
const MAX_NOTES_LENGTH = 500; // vdl_glossary_terms notes limit, characters.
const PAGE = '/admin/multishots/vdl-glossary';

const SaveInput = z.object({
  id: z.string().uuid().nullable(),
  phrase: z.string().trim().min(1).max(MAX_PHRASE_LENGTH),
  definition: z.string().max(10_000),
  notes: z.string().trim().max(MAX_NOTES_LENGTH),
});
type Result = { ok: true } | { ok: false; error: string };

/** Validates the meaning as the importer will read it before storing it. */
export async function saveVdlWord(input: z.infer<typeof SaveInput>): Promise<Result> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) return { ok: false, error: 'Not permitted.' };
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a word of up to 80 characters.' };
  let raw: unknown;
  try {
    raw = JSON.parse(parsed.data.definition);
  } catch {
    return { ok: false, error: 'The meaning must be valid JSON.' };
  }
  const definition = vdlTermSchema.safeParse(raw);
  if (!definition.success)
    return {
      ok: false,
      error: `The meaning is not valid: ${definition.error.issues[0]?.message ?? 'unknown field'}.`,
    };
  const term = definition.data;
  if (term.type === 'effect' && !effectTemplates.some((item) => item.key === term.template))
    return { ok: false, error: 'That base effect does not exist.' };
  const supabase = createClient(await cookies());
  const row = {
    phrase: glossaryPhrase(parsed.data.phrase),
    definition: JSON.parse(JSON.stringify(definition.data)) as Json,
    notes: parsed.data.notes || null,
    updated_by: profile.id,
  };
  const { error } = parsed.data.id
    ? await supabase.from('vdl_glossary_terms').update(row).eq('id', parsed.data.id)
    : await supabase.from('vdl_glossary_terms').upsert(row, { onConflict: 'phrase' });
  if (error) return { ok: false, error: 'The word could not be saved.' };
  revalidatePath(PAGE);
  return { ok: true };
}

/** Removes a saved word; a built-in word goes back to its built-in meaning. */
export async function deleteVdlWord(id: string): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue')))
    return { ok: false, error: 'Not permitted.' };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid word.' };
  const supabase = createClient(await cookies());
  const { error } = await supabase.from('vdl_glossary_terms').delete().eq('id', id);
  if (error) return { ok: false, error: 'The word could not be removed.' };
  revalidatePath(PAGE);
  return { ok: true };
}
