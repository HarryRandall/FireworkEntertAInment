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
  invalidateAdminMultishotsCache,
  invalidateAdminStyleDefaultsCache,
  requirePermission,
} from '@/lib/admin.server';
import type {
  AdminEditorVersion,
  AdminStyleDefaultOption,
  CurrentProfile,
} from '@/lib/admin.types';
import { makeEffectEditorSnapshot, parseEffectEditorSnapshot } from '@/lib/admin/editor-snapshots';
import { isMissingEditorVersionSchemaError } from '@/lib/admin/style-default-schema';
import type { Database, Json } from '@/lib/database.types';
import { canonicaliseEffectModelJson, fireworkDesignFragmentError } from '@/lib/fireworks/design';
import {
  emptyStyleDefaultIdMap,
  FIREWORK_STYLE_DEFAULT_KINDS,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';
import { isSupabaseTransientNetworkError } from '@/utils/supabase/errors';

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
type ActionSupabase = ReturnType<typeof createClient>;

const EFFECT_MUTATION_SELECT =
  'id, name, description, pattern_key, sort_order, model_json, updated_at';

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

function adminLabel(profile: CurrentProfile): string {
  return profile.fullName || profile.email || 'Platform admin';
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

function readSnapshotRecord(value: Json | null): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fieldChanges(previousSnapshot: Json | null, nextSnapshot: Json, fields: string[]): Json {
  const previous = readSnapshotRecord(previousSnapshot);
  const next = readSnapshotRecord(nextSnapshot);
  const changes: Record<string, Json> = {};
  for (const field of fields) {
    const before = previous[field];
    const after = next[field];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    changes[field] = { before: (before ?? null) as Json, after: (after ?? null) as Json };
  }
  return changes;
}

function summariseEffectChanges(changesJson: Json): string {
  const labels: Record<string, string> = {
    name: 'name',
    description: 'description',
    patternKey: 'pattern',
    sortOrder: 'sort order',
    modelJson: 'model JSON',
  };
  const fields = Object.keys(readSnapshotRecord(changesJson));
  if (fields.length === 0) return 'Saved without visible field changes';
  const visible = fields.slice(0, 3).map((field) => labels[field] ?? field);
  const extra = fields.length > visible.length ? ` +${fields.length - visible.length}` : '';
  return `Updated ${visible.join(', ')}${extra}`;
}

async function loadEffectEditorSnapshot(
  supabase: ActionSupabase,
  effectId: string,
): Promise<{ ok: true; snapshot: Json | null } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('firework_effects')
    .select('id, name, description, pattern_key, sort_order, model_json, updated_at')
    .eq('id', effectId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, snapshot: null };

  return {
    ok: true,
    snapshot: makeEffectEditorSnapshot({
      kind: 'effect',
      id: data.id,
      name: data.name,
      description: data.description,
      patternKey: data.pattern_key,
      sortOrder: data.sort_order,
      styleDefaultIds: emptyStyleDefaultIdMap(),
      modelJson: data.model_json ?? {},
      updatedAt: data.updated_at,
    }),
  };
}

async function recordEffectVersion(
  supabase: ActionSupabase,
  version: AdminEditorVersion,
): Promise<boolean> {
  const effectId = version.fireworkEffectId;
  if (!effectId) return false;

  const row = {
    id: version.id,
    target_kind: 'effect',
    firework_effect_id: effectId,
    action: version.action,
    summary: version.summary,
    snapshot_json: version.snapshotJson,
    previous_snapshot_json: version.previousSnapshotJson,
    changes_json: version.changesJson,
    created_by: version.createdBy,
    created_by_label: version.createdByLabel,
    created_at: version.createdAt,
  } as const;

  async function isRecorded(targetEffectId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('firework_editor_versions')
      .select('id')
      .eq('id', version.id)
      .eq('target_kind', 'effect')
      .eq('firework_effect_id', targetEffectId)
      .maybeSingle();
    if (error && !isMissingEditorVersionSchemaError(error)) {
      console.error('[recordEffectVersion] history confirmation failed:', error);
    }
    return Boolean(data);
  }

  const first = await supabase.from('firework_editor_versions').insert(row);
  if (!first.error) return true;
  if (isMissingEditorVersionSchemaError(first.error)) return false;
  if (await isRecorded(effectId)) return true;

  if (isSupabaseTransientNetworkError(first.error)) {
    const retry = await supabase.from('firework_editor_versions').insert(row);
    if (!retry.error || (await isRecorded(effectId))) return true;
    if (!isMissingEditorVersionSchemaError(retry.error)) {
      console.error('[recordEffectVersion] history retry failed:', retry.error);
    }
    return false;
  }

  console.error('[recordEffectVersion] history insert failed:', first.error);
  return false;
}

function makeEffectVersion(input: {
  effectId: string;
  action: 'update' | 'restore';
  summary: string;
  snapshotJson: Json;
  previousSnapshotJson: Json | null;
  changesJson: Json;
  profile: CurrentProfile;
  historyVersionId?: string;
}): AdminEditorVersion {
  return {
    id: input.historyVersionId ?? crypto.randomUUID(),
    targetKind: 'effect',
    fireworkId: null,
    fireworkEffectId: input.effectId,
    fireworkStyleDefaultId: null,
    action: input.action,
    summary: input.summary,
    snapshotJson: input.snapshotJson,
    previousSnapshotJson: input.previousSnapshotJson,
    changesJson: input.changesJson,
    createdBy: input.profile.id,
    createdByLabel: adminLabel(input.profile),
    createdAt: new Date().toISOString(),
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

  const supabase = createClient(await cookies());
  const previousSnapshot = await loadEffectEditorSnapshot(supabase, parsed.data.id);
  if (!previousSnapshot.ok) return previousSnapshot;

  const patch = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    pattern_key: parsed.data.patternKey,
    sort_order: parsed.data.sortOrder,
    model_json: model.value,
  };
  const result = await supabase
    .from('firework_effects')
    .update(patch)
    .eq('id', parsed.data.id)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select(EFFECT_MUTATION_SELECT)
    .maybeSingle();

  const { data, error } = result;
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This effect changed in another session. Refresh before saving again.',
    };
  }

  const saved = mapSavedEffect(data as EffectMutationRow);
  const snapshotJson = makeEffectEditorSnapshot({
    kind: 'effect',
    id: saved.id,
    name: saved.name,
    description: saved.description,
    patternKey: saved.patternKey,
    sortOrder: saved.sortOrder,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    modelJson: saved.modelJson,
    updatedAt: saved.updatedAt,
  });
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'patternKey',
    'sortOrder',
    'modelJson',
  ]);
  const historyVersion = makeEffectVersion({
    effectId: saved.id,
    action: 'update',
    summary: summariseEffectChanges(changesJson),
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.historyVersionId,
  });
  const historyRecorded = await recordEffectVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[updateEffect] version history failed:', historyError);
      return false;
    },
  );

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

  const supabase = createClient(await cookies());
  const previousSnapshot = await loadEffectEditorSnapshot(supabase, parsed.data.effect.id);
  if (!previousSnapshot.ok) return previousSnapshot;

  const { data, error } = await supabase.rpc('create_style_default_and_update_effect', {
    p_effect_id: parsed.data.effect.id,
    p_expected_updated_at: parsed.data.effect.expectedUpdatedAt,
    p_effect_name: parsed.data.effect.name,
    p_effect_description: parsed.data.effect.description || '',
    p_pattern_key: parsed.data.effect.patternKey,
    p_sort_order: parsed.data.effect.sortOrder,
    p_model_json: model.value,
    p_style_slug: styleDefaultSlug(parsed.data.styleDefault.name, parsed.data.styleDefault.kind),
    p_style_name: parsed.data.styleDefault.name,
    p_style_description: parsed.data.styleDefault.description || '',
    p_style_kind: parsed.data.styleDefault.kind,
    p_style_defaults_json: defaults.value,
  });

  if (error) return { ok: false, error: error.message };
  const payload = readSnapshotRecord(data as Json | null);
  if (payload.ok !== true) {
    if (payload.code === 'conflict') {
      return {
        ok: false,
        error: 'This effect changed in another session. Refresh before saving again.',
      };
    }
    return { ok: false, error: 'Could not create the style default and save the effect.' };
  }

  const saved = mapSavedEffect(payload.effect as unknown as EffectMutationRow);
  const styleDefault = mapCreatedStyleDefault(
    payload.styleDefault as unknown as StyleDefaultMutationRow,
  );
  const snapshotJson = makeEffectEditorSnapshot({
    kind: 'effect',
    id: saved.id,
    name: saved.name,
    description: saved.description,
    patternKey: saved.patternKey,
    sortOrder: saved.sortOrder,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    modelJson: saved.modelJson,
    updatedAt: saved.updatedAt,
  });
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'patternKey',
    'sortOrder',
    'modelJson',
  ]);
  const historyVersion = makeEffectVersion({
    effectId: saved.id,
    action: 'update',
    summary: summariseEffectChanges(changesJson),
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.effect.historyVersionId,
  });
  const historyRecorded = await recordEffectVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[createStyleDefaultAndUpdateEffect] version history failed:', historyError);
      return false;
    },
  );

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

  const supabase = createClient(await cookies());
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

  const previousSnapshot = await loadEffectEditorSnapshot(supabase, parsed.data.effectId);
  if (!previousSnapshot.ok) return previousSnapshot;

  const patch = {
    name: snapshot.name,
    description: snapshot.description,
    pattern_key: snapshot.patternKey,
    sort_order: snapshot.sortOrder,
    model_json: restoredModel as Json,
  };
  const result = await supabase
    .from('firework_effects')
    .update(patch)
    .eq('id', parsed.data.effectId)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select(EFFECT_MUTATION_SELECT)
    .maybeSingle();

  const { data, error } = result;
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This effect changed in another session. Refresh before restoring.',
    };
  }

  const saved = mapSavedEffect(data as EffectMutationRow);
  const snapshotJson = makeEffectEditorSnapshot({
    kind: 'effect',
    id: saved.id,
    name: saved.name,
    description: saved.description,
    patternKey: saved.patternKey,
    sortOrder: saved.sortOrder,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    modelJson: saved.modelJson,
    updatedAt: saved.updatedAt,
  });
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'patternKey',
    'sortOrder',
    'modelJson',
  ]);
  const historyVersion = makeEffectVersion({
    effectId: saved.id,
    action: 'restore',
    summary: `Restored version from ${version.created_by_label}`,
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.historyVersionId,
  });
  const historyRecorded = await recordEffectVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[restoreEffectEditorVersion] version history failed:', historyError);
      return false;
    },
  );

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

  const supabase = createClient(await cookies());
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

  await invalidateAdminEffectsCache(data.id);
  await invalidateAdminFireworksCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/effects');
  revalidatePath('/admin/fireworks');
  redirect(`/admin/effects/${data.id}`);
}
