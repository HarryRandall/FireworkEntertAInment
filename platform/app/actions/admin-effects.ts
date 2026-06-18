'use server';

/** Admin base-effect actions. Base effects are colourless shared firework patterns. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  invalidateAdminStyleDefaultsCache,
  requirePermission,
} from '@/lib/admin.server';
import { isMissingStyleDefaultSchemaError } from '@/lib/admin/style-default-schema';
import {
  normaliseStyleDefaultAssignments,
  replaceEffectStyleDefaultLinks,
  validateStyleDefaultAssignments,
} from '@/lib/admin/style-default-assignments';
import type { Json } from '@/lib/database.types';
import { canonicaliseEffectModelJson } from '@/lib/fireworks/design';
import { FIREWORK_STYLE_DEFAULT_KINDS } from '@/lib/fireworks/style-defaults';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type Result = { ok: true; updatedAt: string } | { ok: false; error: string };

const BaseEffectFamilySchema = z.enum(['aerial_burst', 'ascending', 'ground', 'noise', 'compound']);
const StyleDefaultKindSchema = z.enum(FIREWORK_STYLE_DEFAULT_KINDS);
const StyleDefaultAssignmentsSchema = z.partialRecord(
  StyleDefaultKindSchema,
  z.string().uuid().nullable(),
);

const CUSTOM_STAR_EFFECT_MODEL = canonicaliseEffectModelJson({
  geometry: 'sphere',
  trailProfile: 'none',
  renderDefaults: {
    pattern: 'fibonacci',
    geometry: 'sphere',
    trailProfile: 'none',
    colour: { enabled: true },
    color: { r: 1, g: 0.82, b: 0.42 },
    stars: {
      outer: {
        enabled: true,
        count: 1,
        burst: {
          speed: [1.2, 1.2],
          gravity: [-0.04, -0.04],
          life: [2.4, 2.4],
          flairColorMode: 'mixed',
        },
        burstTrail: {
          enabled: false,
          preset: 'none',
          particlesPerStar: 0,
        },
      },
      core: { enabled: false },
    },
    launch: {
      liftParticles: {
        enabled: true,
        amount: 100,
        spacing: { pathSamples: 5 },
        motion: {
          swirlStrength: 0,
          swirlRadius: 0,
          swirlRate: 4,
        },
      },
    },
  },
}) as Json;

const EffectPatchSchema = z.object({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().trim().min(1),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  family: BaseEffectFamilySchema,
  patternKey: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  starStyleDefaultId: z.string().uuid().optional().nullable(),
  trailStyleDefaultId: z.string().uuid().optional().nullable(),
  styleDefaultIds: StyleDefaultAssignmentsSchema.optional().nullable(),
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
  const assignments = normaliseStyleDefaultAssignments({
    styleDefaultIds: parsed.data.styleDefaultIds,
    starStyleDefaultId: parsed.data.starStyleDefaultId,
    trailStyleDefaultId: parsed.data.trailStyleDefaultId,
  });
  const validatedAssignments = await validateStyleDefaultAssignments(supabase, assignments);
  if (!validatedAssignments.ok) return validatedAssignments;

  const patch = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    family: parsed.data.family,
    pattern_key: parsed.data.patternKey,
    sort_order: parsed.data.sortOrder,
    star_style_default_id: assignments.star,
    trail_style_default_id: assignments.trail,
    model_json: model.value,
  };
  const fallbackPatch = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    family: parsed.data.family,
    pattern_key: parsed.data.patternKey,
    sort_order: parsed.data.sortOrder,
    model_json: model.value,
  };
  let result = await supabase
    .from('firework_effects')
    .update(patch)
    .eq('id', parsed.data.id)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select('updated_at')
    .maybeSingle();

  if (isMissingStyleDefaultSchemaError(result.error)) {
    result = await supabase
      .from('firework_effects')
      .update(fallbackPatch)
      .eq('id', parsed.data.id)
      .eq('updated_at', parsed.data.expectedUpdatedAt)
      .select('updated_at')
      .maybeSingle();
  }

  const { data, error } = result;
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This effect changed in another session. Refresh before saving again.',
    };
  }

  const linksResult = await replaceEffectStyleDefaultLinks(supabase, parsed.data.id, assignments);
  if (!linksResult.ok) return { ok: false, error: linksResult.error };

  await invalidateAdminEffectsCache(parsed.data.id);
  await invalidateAdminFireworksCache();
  await invalidateAdminStyleDefaultsCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/effects');
  revalidatePath(`/admin/effects/${parsed.data.id}`);
  revalidatePath('/admin/effects?tab=defaults');
  revalidatePath('/admin/fireworks');
  return { ok: true, updatedAt: data.updated_at };
}

/** Create a manual, editable one-star base effect and open it in the editor. */
export async function createCustomStarEffect(formData?: FormData): Promise<void> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    redirect('/admin/effects');
  }

  const familyInput = formData?.get('family');
  const family = BaseEffectFamilySchema.catch('aerial_burst').parse(
    typeof familyInput === 'string' ? familyInput : 'aerial_burst',
  );
  const nameInput = formData?.get('name');
  const name =
    typeof nameInput === 'string' && nameInput.trim()
      ? nameInput.trim().slice(0, 180)
      : 'Custom Star';

  const supabase = createClient(await cookies());
  const slug = `custom-star-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('firework_effects')
    .insert({
      slug,
      name,
      description: 'Manual custom star effect.',
      family,
      pattern_key: 'custom-star',
      source: 'manual',
      sort_order: 9000,
      model_json: CUSTOM_STAR_EFFECT_MODEL,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create custom effect.');
  }

  await invalidateAdminEffectsCache(data.id);
  await invalidateAdminFireworksCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/effects');
  revalidatePath('/admin/fireworks');
  redirect(`/admin/effects/${data.id}`);
}
