/** Admin-only reads that feed the VDL importer: saved glossary rows and same-named fireworks. */
import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { vdlGlossary, vdlTermSchema, type VdlGlossary, type VdlTerm } from './glossary';
import { previewVdlCake, type VdlExistingFirework, type VdlPreviewResult } from './preview';

const NAME_BATCH_SIZE = 100; // PostgREST `in` filter batch, names.

export interface VdlGlossaryRow {
  id: string;
  phrase: string;
  definition: VdlTerm;
  notes: string | null;
  updatedAt: string;
}

/** Reads saved words. A row whose meaning no longer validates is reported rather than silently used. */
export async function readVdlGlossaryRows(): Promise<
  { ok: true; rows: VdlGlossaryRow[]; invalid: string[] } | { ok: false; error: string }
> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('vdl_glossary_terms')
    .select('id, phrase, definition, notes, updated_at')
    .order('phrase');
  if (error) return { ok: false, error: 'The VDL word list could not be read.' };
  const rows: VdlGlossaryRow[] = [];
  const invalid: string[] = [];
  for (const row of data ?? []) {
    const definition = vdlTermSchema.safeParse(row.definition);
    if (!definition.success) {
      invalid.push(row.phrase);
      continue;
    }
    rows.push({
      id: row.id,
      phrase: row.phrase,
      definition: definition.data,
      notes: row.notes,
      updatedAt: row.updated_at,
    });
  }
  return { ok: true, rows, invalid };
}

async function readFireworksNamed(
  names: string[],
): Promise<{ ok: true; fireworks: VdlExistingFirework[] } | { ok: false; error: string }> {
  const supabase = createClient(await cookies());
  const fireworks: VdlExistingFirework[] = [];
  const unique = [...new Set(names)];
  for (let start = 0; start < unique.length; start += NAME_BATCH_SIZE) {
    const { data, error } = await supabase
      .from('fireworks')
      .select('id, name')
      .in('name', unique.slice(start, start + NAME_BATCH_SIZE))
      .order('created_at');
    if (error) return { ok: false, error: 'The firework catalogue could not be read.' };
    fireworks.push(...(data ?? []));
  }
  return { ok: true, fireworks };
}

/** Builds the preview twice: once to learn the names, then with matching existing fireworks bound. */
export async function previewVdlLine(
  text: string,
): Promise<
  | { ok: true; result: VdlPreviewResult; glossary: VdlGlossary; invalidWords: string[] }
  | { ok: false; error: string }
> {
  const rows = await readVdlGlossaryRows();
  if (!rows.ok) return rows;
  const glossary = vdlGlossary(rows.rows);
  const first = previewVdlCake(text, { glossary, existing: [] });
  if (first.kind === 'error')
    return { ok: true, result: first, glossary, invalidWords: rows.invalid };
  const names = Object.values(first.preview.fireworks).map((firework) => firework.name);
  const existing = await readFireworksNamed(names);
  if (!existing.ok) return existing;
  return {
    ok: true,
    result: previewVdlCake(text, { glossary, existing: existing.fireworks }),
    glossary,
    invalidWords: rows.invalid,
  };
}
