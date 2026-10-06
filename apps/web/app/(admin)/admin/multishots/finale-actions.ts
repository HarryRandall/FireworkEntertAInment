'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { CompositionDatabase } from '@/lib/finale/database';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/access/current-profile.server';
import {
  invalidateAdminCatalogueCache,
  invalidateAdminMultishotsCache,
} from '@/lib/admin/cache-keys';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows/cache-keys';
import { previewCakeImport, type FinaleImportResult } from '@/lib/finale/import';
import { importedMultishotShots } from '@/lib/finale/multishot';
import { readFinaleCakeEffects } from '@/lib/finale/catalogue.server';

const MAX_IMPORT_TEXT_CHARACTERS = 1_000_000; // Finale parser input budget, characters.
const ImportInput = z.object({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  text: z.string().max(MAX_IMPORT_TEXT_CHARACTERS),
});
type ImportPreview = Extract<FinaleImportResult, { kind: 'preview' }> & {
  expectedUpdatedAt: string;
};
type PreviewResult = ImportPreview | Extract<FinaleImportResult, { kind: 'error' }>;
const SavedShot = z.object({
  id: z.string().uuid(),
  firework_id: z.string().uuid(),
  sequence_index: z.number().int(),
  timeline_track_index: z.number().int(),
  time_offset_seconds: z.coerce.number(),
  pan_degrees: z.number(),
  tilt_degrees: z.number(),
  caliber: z.string().nullable(),
  notes: z.string().nullable(),
});
export type SavedCompositionShot = z.infer<typeof SavedShot>;
const SavedComposition = z.object({
  ok: z.literal(true),
  shots: z.array(SavedShot),
  durationSeconds: z.coerce.number().nullable(),
});
type SaveResult =
  | { ok: true; shots: SavedCompositionShot[]; durationSeconds: number | null }
  | { ok: false; error: string };

/** Previews exact syntax against current catalogue names without changing any shots. */
export async function previewMultishotFinaleImport(
  text: string,
  id: string,
): Promise<PreviewResult> {
  const parsed = z.string().max(MAX_IMPORT_TEXT_CHARACTERS).safeParse(text);
  if (!parsed.success) return { kind: 'error', message: 'The import text is too large.' };
  const catalogue = await readFinaleCakeEffects();
  if (!catalogue.ok) return { kind: 'error', message: catalogue.error };
  const preview = previewCakeImport(parsed.data, catalogue.effects);
  if (preview.kind === 'error') return preview;
  if (!z.string().uuid().safeParse(id).success)
    return { kind: 'error', message: 'Invalid multishot.' };
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('multishots')
    .select('updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return { kind: 'error', message: 'The multishot could not be read.' };
  return { ...preview, expectedUpdatedAt: data.updated_at };
}

/** Re-resolves names and eligibility on the server, then atomically replaces shots and records history. */
export async function importMultishotFinale(
  input: z.infer<typeof ImportInput>,
): Promise<SaveResult> {
  if (!(await requirePermission('admin.manage_catalogue')))
    return { ok: false, error: 'Not permitted.' };
  const parsed = ImportInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid import request.' };
  const catalogue = await readFinaleCakeEffects();
  if (!catalogue.ok) return catalogue;
  const preview = previewCakeImport(parsed.data.text, catalogue.effects);
  if (preview.kind === 'error') return { ok: false, error: preview.message };
  const converted = importedMultishotShots(preview.tubes);
  if (converted.kind === 'error') return { ok: false, error: converted.message };
  const supabase = createClient<CompositionDatabase>(await cookies());
  const { data, error } = await supabase.rpc('save_multishot_composition', {
    p_id: parsed.data.id,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
    p_shots: converted.shots,
  });
  if (error) return { ok: false, error: 'The composition could not be saved.' };
  if (typeof data !== 'object' || data === null || Array.isArray(data) || data.ok !== true)
    return {
      ok: false,
      error:
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        typeof data.error === 'string'
          ? data.error
          : 'The composition could not be saved.',
    };
  const saved = SavedComposition.safeParse(data);
  if (!saved.success)
    return { ok: false, error: 'The saved composition could not be read. Refresh the editor.' };
  await invalidateAdminMultishotsCache(parsed.data.id);
  await invalidateAdminCatalogueCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath(`/admin/multishots/${parsed.data.id}`);
  revalidatePath('/admin/multishots');
  revalidatePath('/admin/catalogue');
  return saved.data;
}

const HISTORY_PAGE_SIZE = 5; // Import history preview budget, snapshots per request.
const HistoryShot = z.object({
  firework_id: z.string().uuid(),
  time_offset_seconds: z.coerce.number(),
  pan_degrees: z.number(),
  tilt_degrees: z.number(),
});
export type CompositionHistoryEntry = {
  id: string;
  createdAt: string;
  before: z.infer<typeof HistoryShot>[];
  after: z.infer<typeof HistoryShot>[];
};

/** Reads recent import snapshots for catalogue administrators, without exposing a write path. */
export async function readMultishotFinaleHistory(
  id: string,
): Promise<{ ok: true; entries: CompositionHistoryEntry[] } | { ok: false; error: string }> {
  if (!(await requirePermission('admin.manage_catalogue')))
    return { ok: false, error: 'Not permitted.' };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid multishot.' };
  const supabase = createClient<CompositionDatabase>(await cookies());
  const { data, error } = await supabase
    .from('multishot_composition_versions')
    .select('id, created_at, before_shots, after_shots')
    .eq('multishot_id', id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_PAGE_SIZE);
  if (error) return { ok: false, error: 'Import history could not be loaded.' };
  const entries: CompositionHistoryEntry[] = [];
  for (const row of data ?? []) {
    const before = z.array(HistoryShot).safeParse(row.before_shots);
    const after = z.array(HistoryShot).safeParse(row.after_shots);
    if (!before.success || !after.success)
      return { ok: false, error: 'Import history could not be read.' };
    entries.push({ id: row.id, createdAt: row.created_at, before: before.data, after: after.data });
  }
  return { ok: true, entries };
}
