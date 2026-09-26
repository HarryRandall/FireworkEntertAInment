import { validateFireworkDesign } from '@showcrafter/fireworks/design';
import { isRecord } from '@showcrafter/fireworks/model/records';
import type { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/database.types';

/** Resolve once at a write boundary. Readers only consume the copied snapshot. */
export async function resolveRenderSnapshot(
  supabase: ReturnType<typeof createClient>,
  effectId: string,
  overrides: unknown,
  primaryColor?: string | null,
  colorPalette?: string[] | null,
): Promise<{ ok: true; value: Json } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('firework_effects')
    .select('model_json')
    .eq('id', effectId)
    .maybeSingle();
  if (error || !data)
    return { ok: false, error: error?.message ?? 'The selected effect could not be loaded.' };
  const result = validateFireworkDesign({
    baseModel: data.model_json,
    variantOverrides: overrides,
    primaryColor,
    colorPalette,
  });
  if (!result.ok)
    return {
      ok: false,
      error: result.diagnostics
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    };
  return {
    ok: true,
    value: {
      ...result.design,
      ...(isRecord(overrides) && isRecord(overrides.presetSources)
        ? { presetSources: overrides.presetSources as Json }
        : {}),
    } as Json,
  };
}
