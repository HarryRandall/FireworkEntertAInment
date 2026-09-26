'use server';

/** Admin base-effect actions. Base effects are colourless shared firework patterns. */

import { saveEditorRecord } from '@/lib/admin/editor-persistence.server';
import { requirePermission } from '@/lib/access/current-profile.server';
import type { AdminEditorVersion, AdminStyleDefaultOption } from '@/lib/admin.types';
import {
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  invalidateAdminMultishotsCache,
  invalidateAdminStyleDefaultsCache,
} from '@/lib/admin/cache-keys';
import { parseEffectEditorSnapshot } from '@/lib/admin/editor-snapshots';
import { isMissingEditorVersionSchemaError } from '@/lib/admin/style-default-schema';
import type { Database, Json } from '@/lib/database.types';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows/cache-keys';
import { supabaseFetchLong } from '@/lib/supabase/fetch';
import { createClient } from '@/lib/supabase/server';
import {
  canonicaliseEffectModelJson,
  fireworkDesignFragmentError,
} from '@showcrafter/fireworks/design';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  type FireworkStyleDefaultKind,
} from '@showcrafter/fireworks/style-defaults';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

type EffectRow = Database['public']['Tables']['firework_effects']['Row'];
type StyleDefaultRow = Database['public']['Tables']['firework_style_defaults']['Row'];
type EffectMutationRow = Pick<
  EffectRow,
  'id' | 'name' | 'description' | 'pattern_key' | 'sort_order' | 'model_json' | 'updated_at'
>;
type StyleDefaultMutationRow = Pick<
  StyleDefaultRow,
  'id' | 'name' | 'description' | 'kind' | 'defaults_json'
>;
type SavedEffect = {
  id: string;
  name: string;
  description: string | null;
  patternKey: string;
  sortOrder: number;
  modelJson: Json;
  updatedAt: string;
};
type Result =
  | {
      ok: true;
      saved: SavedEffect;
      updatedAt: string;
      historyVersion: AdminEditorVersion;
      historyRecorded: boolean;
    }
  | { ok: false; error: string };
type CreateStyleDefaultAndUpdateEffectResult =
  | (Extract<Result, { ok: true }> & { styleDefault: AdminStyleDefaultOption })
  | Extract<Result, { ok: false }>;

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
          swirlLoopCount: 0,
          swirlLoopLength: 100,
          swirlLoopHeight: 0,
          swirlRate: 4,
        },
      },
    },
  },
}) as Json;

const EffectPatchSchema = z.object({
  id: z.string().uuid(),
  historyVersionId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().trim().min(1),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  patternKey: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  starStyleDefaultId: z.string().uuid().optional().nullable(),
  trailStyleDefaultId: z.string().uuid().optional().nullable(),
  styleDefaultIds: StyleDefaultAssignmentsSchema.optional().nullable(),
  modelJson: z.string().trim().min(2).max(100_000),
});

const InlineStyleDefaultSchema = z.object({
  kind: StyleDefaultKindSchema,
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  defaultsJson: z.string().trim().min(2).max(100_000),
});

const CreateStyleDefaultAndUpdateEffectSchema = z.object({
  effect: EffectPatchSchema,
  styleDefault: InlineStyleDefaultSchema,
});

const RestoreEffectVersionSchema = z.object({
  effectId: z.string().uuid(),
  versionId: z.string().uuid(),
  historyVersionId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().trim().min(1),
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

  const canonical = canonicaliseEffectModelJson(parsed);
  const rendererError = fireworkDesignFragmentError(canonical.renderDefaults);
  if (rendererError) {
    return { ok: false, error: `Renderer settings are invalid: ${rendererError}` };
  }

  return { ok: true, value: canonical as Json };
}

function parseStyleDefaultJson(
  text: string,
): { ok: true; value: Json } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Default JSON is invalid.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Default JSON must be an object.' };
  }
  const rendererError = fireworkDesignFragmentError(parsed);
  if (rendererError) {
    return { ok: false, error: `Default renderer settings are invalid: ${rendererError}` };
  }
  return { ok: true, value: parsed as Json };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function styleDefaultSlug(name: string, kind: FireworkStyleDefaultKind): string {
  const base = slugify(name) || `${kind}-style`;
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function mapSavedEffect(row: EffectMutationRow): SavedEffect {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    patternKey: row.pattern_key,
    sortOrder: row.sort_order,
    modelJson: row.model_json ?? {},
    updatedAt: row.updated_at,
  };
}

function mapCreatedStyleDefault(row: StyleDefaultMutationRow): AdminStyleDefaultOption {
  return {
    id: row.id,
    kind: row.kind as FireworkStyleDefaultKind,
    name: row.name,
    description: row.description,
    defaultsJson: row.defaults_json ?? {},
  };
}

/** Persist one base effect with optimistic conflict detection. */
export async function updateEffect(input: z.infer<typeof EffectPatchSchema>): Promise<Result> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = EffectPatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const model = parseModelJson(parsed.data.modelJson);
  if (!model.ok) return { ok: false, error: model.error };

  const supabase = createClient(await cookies(), supabaseFetchLong);
  const patch = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    pattern_key: parsed.data.patternKey,
    sort_order: parsed.data.sortOrder,
    model_json: model.value,
  };
  const result = await saveEditorRecord(supabase, {
    kind: 'effect',
    id: parsed.data.id,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    patch,
    historyVersionId: parsed.data.historyVersionId,
  });
  if (!result.ok) return result;
  const saved = mapSavedEffect(result.saved);
  const historyVersion = result.historyVersion;
  const historyRecorded = true;

  await Promise.all([
    invalidateAdminEffectsCache(parsed.data.id),
    invalidateAdminFireworksCache(),
    invalidateAdminMultishotsCache(),
    invalidateAdminStyleDefaultsCache(),
    invalidateFireworkCatalogueCaches(),
  ]);
  revalidatePath('/admin/effects');
  revalidatePath(`/admin/effects/${parsed.data.id}`);
  revalidatePath('/admin/fireworks');
  revalidatePath('/admin/multishots');
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}

/** Create an inline style default and save its source effect in one database transaction. */
export async function createStyleDefaultAndUpdateEffect(
  input: z.infer<typeof CreateStyleDefaultAndUpdateEffectSchema>,
): Promise<CreateStyleDefaultAndUpdateEffectResult> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) return { ok: false, error: 'Not permitted.' };

  const parsed = CreateStyleDefaultAndUpdateEffectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const model = parseModelJson(parsed.data.effect.modelJson);
  if (!model.ok) return { ok: false, error: model.error };
  const defaults = parseStyleDefaultJson(parsed.data.styleDefault.defaultsJson);
  if (!defaults.ok) return { ok: false, error: defaults.error };

  const supabase = createClient(await cookies(), supabaseFetchLong);
  const result = await saveEditorRecord(supabase, {
    kind: 'effect',
    id: parsed.data.effect.id,
    expectedUpdatedAt: parsed.data.effect.expectedUpdatedAt,
    patch: {
      name: parsed.data.effect.name,
      description: parsed.data.effect.description || null,
      pattern_key: parsed.data.effect.patternKey,
      sort_order: parsed.data.effect.sortOrder,
      model_json: model.value,
    },
    historyVersionId: parsed.data.effect.historyVersionId,
    inlineStyle: {
      slug: styleDefaultSlug(parsed.data.styleDefault.name, parsed.data.styleDefault.kind),
      name: parsed.data.styleDefault.name,
      description: parsed.data.styleDefault.description || null,
      kind: parsed.data.styleDefault.kind,
      defaults_json: defaults.value,
    },
  });
  if (!result.ok) return result;
  if (!result.styleDefault)
    return { ok: false, error: 'Could not confirm the saved preset. Refresh before retrying.' };
  const saved = mapSavedEffect(result.saved);
  const styleDefault = mapCreatedStyleDefault(result.styleDefault);
  const historyVersion = result.historyVersion;
  const historyRecorded = true;

  await Promise.all([
    invalidateAdminEffectsCache(saved.id),
    invalidateAdminFireworksCache(),
    invalidateAdminMultishotsCache(),
    invalidateAdminStyleDefaultsCache(styleDefault.id),
    invalidateFireworkCatalogueCaches(),
  ]);
  revalidatePath('/admin/effects');
  revalidatePath(`/admin/effects/${saved.id}`);
  revalidatePath('/admin/fireworks');
  revalidatePath('/admin/multishots');
  return {
    ok: true,
    saved,
    updatedAt: saved.updatedAt,
    styleDefault,
    historyVersion,
    historyRecorded,
  };
}

export async function restoreEffectEditorVersion(
  input: z.infer<typeof RestoreEffectVersionSchema>,
): Promise<Result> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) return { ok: false, error: 'Not permitted.' };

  const parsed = RestoreEffectVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies(), supabaseFetchLong);
  const { data: version, error: versionError } = await supabase
    .from('firework_editor_versions')
    .select('id, snapshot_json, created_by_label, created_at')
    .eq('id', parsed.data.versionId)
    .eq('target_kind', 'effect')
    .eq('firework_effect_id', parsed.data.effectId)
    .maybeSingle();
  if (versionError) {
    if (isMissingEditorVersionSchemaError(versionError)) {
      return { ok: false, error: 'Version history is not available yet.' };
    }
    return { ok: false, error: versionError.message };
  }
  if (!version) return { ok: false, error: 'That version could not be found.' };

  const snapshot = parseEffectEditorSnapshot(version.snapshot_json);
  if (!snapshot || snapshot.id !== parsed.data.effectId) {
    return { ok: false, error: 'That version cannot be restored.' };
  }

  const restoredModel = canonicaliseEffectModelJson(snapshot.modelJson);
  const rendererError = fireworkDesignFragmentError(restoredModel.renderDefaults);
  if (rendererError) {
    return { ok: false, error: `That version has invalid renderer settings: ${rendererError}` };
  }

  const patch = {
    name: snapshot.name,
    description: snapshot.description,
    pattern_key: snapshot.patternKey,
    sort_order: snapshot.sortOrder,
    model_json: restoredModel as Json,
  };
  const result = await saveEditorRecord(supabase, {
    kind: 'effect',
    id: parsed.data.effectId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    patch,
    historyVersionId: parsed.data.historyVersionId,
    restoreVersionId: parsed.data.versionId,
  });
  if (!result.ok) return result;
  const saved = mapSavedEffect(result.saved);
  const historyVersion = result.historyVersion;
  const historyRecorded = true;

  await Promise.all([
    invalidateAdminEffectsCache(parsed.data.effectId),
    invalidateAdminFireworksCache(),
    invalidateAdminMultishotsCache(),
    invalidateAdminStyleDefaultsCache(),
    invalidateFireworkCatalogueCaches(),
  ]);
  revalidatePath('/admin/effects');
  revalidatePath(`/admin/effects/${parsed.data.effectId}`);
  revalidatePath('/admin/fireworks');
  revalidatePath('/admin/multishots');
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}

/** Create a manual, editable one-star base effect and open it in the editor. */
export async function createCustomStarEffect(formData?: FormData): Promise<void> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    redirect('/admin/effects');
  }

  const nameInput = formData?.get('name');
  const name =
    typeof nameInput === 'string' && nameInput.trim()
      ? nameInput.trim().slice(0, 180)
      : 'Custom Star';

  const supabase = createClient(await cookies(), supabaseFetchLong);
  const slug = `custom-star-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('firework_effects')
    .insert({
      slug,
      name,
      description: 'Manual custom star effect.',
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

  await Promise.all([
    invalidateAdminEffectsCache(data.id),
    invalidateAdminFireworksCache(),
    invalidateFireworkCatalogueCaches(),
  ]);
  revalidatePath('/admin/effects');
  revalidatePath('/admin/fireworks');
  redirect(`/admin/effects/${data.id}`);
}
