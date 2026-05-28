'use server';

/** Admin base-effect actions. Base effects are colourless shared firework patterns. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  requirePermission,
} from '@/lib/admin.server';
import type { Json } from '@/lib/database.types';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type Result = { ok: true; updatedAt: string } | { ok: false; error: string };

const BaseEffectFamilySchema = z.enum(['aerial_burst', 'ascending', 'ground', 'noise', 'compound']);

const EffectPatchSchema = z.object({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().trim().min(1),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  family: BaseEffectFamilySchema,
  patternKey: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  modelJson: z.string().trim().min(2).max(100_000),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function parseModelJson(text: string): { ok: true; value: Json } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Model JSON is invalid.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Model JSON must be an object.' };
  }

  return { ok: true, value: parsed as Json };
}

/** Persist one base effect with optimistic conflict detection. */
export async function updateEffect(input: z.infer<typeof EffectPatchSchema>): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = EffectPatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const model = parseModelJson(parsed.data.modelJson);
  if (!model.ok) return { ok: false, error: model.error };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('firework_effects')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      family: parsed.data.family,
      pattern_key: parsed.data.patternKey,
      sort_order: parsed.data.sortOrder,
      model_json: model.value,
    })
    .eq('id', parsed.data.id)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select('updated_at')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This effect changed in another session. Refresh before saving again.',
    };
  }

  await invalidateAdminEffectsCache(parsed.data.id);
  await invalidateAdminFireworksCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/effects');
  revalidatePath(`/admin/effects/${parsed.data.id}`);
  revalidatePath('/admin/fireworks');
  return { ok: true, updatedAt: data.updated_at };
}
