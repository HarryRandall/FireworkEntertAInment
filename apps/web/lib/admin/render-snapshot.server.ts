import type { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/database.types';
import { validateCatalogueRender } from './renderer-validation';

type SnapshotResult = { ok: true; value: Json } | { ok: false; error: string };

/** Existing documents own their appearance, including disabled settings and provenance. */
export function validateRenderSnapshot(settings: unknown, recordId: string): SnapshotResult {
  const result = validateCatalogueRender({ kind: 'firework', settings, recordId });
  if (!result.ok)
    return {
      ok: false,
      error: result.diagnostics
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    };
  return { ok: true, value: settings as Json };
}

/** Only creation copies settings from the selected effect. Later saves validate the copy. */
export async function createRenderSnapshot(
  supabase: ReturnType<typeof createClient>,
  effectId: string,
): Promise<SnapshotResult> {
  const { data, error } = await supabase
    .from('firework_effects')
    .select('model_json')
    .eq('id', effectId)
    .maybeSingle();
  if (error || !data)
    return { ok: false, error: error?.message ?? 'The selected effect could not be loaded.' };
  const result = validateCatalogueRender({
    kind: 'effect',
    settings: data.model_json,
    recordId: effectId,
  });
  if (!result.ok)
    return {
      ok: false,
      error: result.diagnostics
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    };
  return { ok: true, value: result.design as Json };
}
