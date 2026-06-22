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
import type { CurrentProfile } from '@/lib/admin.types';
import { makeEffectEditorSnapshot, parseEffectEditorSnapshot } from '@/lib/admin/editor-snapshots';
import {
  isMissingEditorVersionSchemaError,
  isMissingStyleDefaultSchemaError,
} from '@/lib/admin/style-default-schema';
import {
  filterValidStyleDefaultAssignments,
  normaliseStyleDefaultAssignments,
  replaceEffectStyleDefaultLinks,
  validateStyleDefaultAssignments,
  type StyleDefaultAssignmentMap,
} from '@/lib/admin/style-default-assignments';
import type { Json } from '@/lib/database.types';
import { canonicaliseEffectModelJson } from '@/lib/fireworks/design';
import { FIREWORK_STYLE_DEFAULT_KINDS } from '@/lib/fireworks/style-defaults';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type Result = { ok: true; updatedAt: string } | { ok: false; error: string };
type ActionSupabase = ReturnType<typeof createClient>;

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

const RestoreEffectVersionSchema = z.object({
  effectId: z.string().uuid(),
  versionId: z.string().uuid(),
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

  return { ok: true, value: parsed as Json };
}

function adminLabel(profile: CurrentProfile): string {
  return profile.fullName || profile.email || 'Platform admin';
}

function assignmentsFromRows(
  base: StyleDefaultAssignmentMap,
  rows: Array<{ kind: string; style_default_id: string | null }>,
): StyleDefaultAssignmentMap {
  const assignments = { ...base };
  for (const row of rows) {
    if (
      FIREWORK_STYLE_DEFAULT_KINDS.includes(
        row.kind as (typeof FIREWORK_STYLE_DEFAULT_KINDS)[number],
      )
    ) {
      assignments[row.kind as keyof StyleDefaultAssignmentMap] = row.style_default_id;
    }
  }
  return assignments;
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
    family: 'family',
    patternKey: 'pattern',
    sortOrder: 'sort order',
    styleDefaultIds: 'style defaults',
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
    .select(
      'id, name, description, family, pattern_key, sort_order, model_json, star_style_default_id, trail_style_default_id, updated_at',
    )
    .eq('id', effectId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, snapshot: null };

  let assignments = normaliseStyleDefaultAssignments({
    starStyleDefaultId: data.star_style_default_id,
    trailStyleDefaultId: data.trail_style_default_id,
  });
  const linkResult = await supabase
    .from('firework_effect_style_default_links')
    .select('kind, style_default_id')
    .eq('firework_effect_id', effectId);
  if (linkResult.error) {
    if (!isMissingStyleDefaultSchemaError(linkResult.error)) {
      return { ok: false, error: linkResult.error.message };
    }
  } else {
    assignments = assignmentsFromRows(assignments, linkResult.data ?? []);
  }

  return {
    ok: true,
    snapshot: makeEffectEditorSnapshot({
      kind: 'effect',
      id: data.id,
      name: data.name,
      description: data.description,
      family: data.family,
      patternKey: data.pattern_key,
      sortOrder: data.sort_order,
      styleDefaultIds: assignments,
      modelJson: data.model_json ?? {},
      updatedAt: data.updated_at,
    }),
  };
}

async function recordEffectVersion(
  supabase: ActionSupabase,
  input: {
    effectId: string;
    action: 'update' | 'restore';
    summary: string;
    snapshotJson: Json;
    previousSnapshotJson: Json | null;
    changesJson: Json;
    profile: CurrentProfile;
  },
): Promise<Result | null> {
  const { error } = await supabase.from('firework_editor_versions').insert({
    target_kind: 'effect',
    firework_effect_id: input.effectId,
    action: input.action,
    summary: input.summary,
    snapshot_json: input.snapshotJson,
    previous_snapshot_json: input.previousSnapshotJson,
    changes_json: input.changesJson,
    created_by: input.profile.id,
    created_by_label: adminLabel(input.profile),
  });
  if (error) {
    if (isMissingEditorVersionSchemaError(error)) return null;
    return { ok: false, error: error.message };
  }
  return null;
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
  const assignments = normaliseStyleDefaultAssignments({
    styleDefaultIds: parsed.data.styleDefaultIds,
    starStyleDefaultId: parsed.data.starStyleDefaultId,
    trailStyleDefaultId: parsed.data.trailStyleDefaultId,
  });
  const validatedAssignments = await validateStyleDefaultAssignments(supabase, assignments);
  if (!validatedAssignments.ok) return validatedAssignments;
  const previousSnapshot = await loadEffectEditorSnapshot(supabase, parsed.data.id);
  if (!previousSnapshot.ok) return previousSnapshot;

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

  const snapshotJson = makeEffectEditorSnapshot({
    kind: 'effect',
    id: parsed.data.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    family: parsed.data.family,
    patternKey: parsed.data.patternKey,
    sortOrder: parsed.data.sortOrder,
    styleDefaultIds: assignments,
    modelJson: model.value,
    updatedAt: data.updated_at,
  });
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'family',
    'patternKey',
    'sortOrder',
    'styleDefaultIds',
    'modelJson',
  ]);
  const versionResult = await recordEffectVersion(supabase, {
    effectId: parsed.data.id,
    action: 'update',
    summary: summariseEffectChanges(changesJson),
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
  });
  if (versionResult) return versionResult;

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

  const previousSnapshot = await loadEffectEditorSnapshot(supabase, parsed.data.effectId);
  if (!previousSnapshot.ok) return previousSnapshot;

  let assignments: StyleDefaultAssignmentMap;
  try {
    assignments = await filterValidStyleDefaultAssignments(
      supabase,
      normaliseStyleDefaultAssignments({ styleDefaultIds: snapshot.styleDefaultIds }),
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not validate style defaults.',
    };
  }

  const patch = {
    name: snapshot.name,
    description: snapshot.description,
    family: snapshot.family,
    pattern_key: snapshot.patternKey,
    sort_order: snapshot.sortOrder,
    star_style_default_id: assignments.star,
    trail_style_default_id: assignments.trail,
    model_json: snapshot.modelJson,
  };
  const fallbackPatch = {
    name: snapshot.name,
    description: snapshot.description,
    family: snapshot.family,
    pattern_key: snapshot.patternKey,
    sort_order: snapshot.sortOrder,
    model_json: snapshot.modelJson,
  };
  let result = await supabase
    .from('firework_effects')
    .update(patch)
    .eq('id', parsed.data.effectId)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select('updated_at')
    .maybeSingle();

  if (isMissingStyleDefaultSchemaError(result.error)) {
    result = await supabase
      .from('firework_effects')
      .update(fallbackPatch)
      .eq('id', parsed.data.effectId)
      .eq('updated_at', parsed.data.expectedUpdatedAt)
      .select('updated_at')
      .maybeSingle();
  }

  const { data, error } = result;
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This effect changed in another session. Refresh before restoring.',
    };
  }

  const linksResult = await replaceEffectStyleDefaultLinks(
    supabase,
    parsed.data.effectId,
    assignments,
  );
  if (!linksResult.ok) return { ok: false, error: linksResult.error };

  const snapshotJson = makeEffectEditorSnapshot({
    ...snapshot,
    styleDefaultIds: assignments,
    updatedAt: data.updated_at,
  });
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'family',
    'patternKey',
    'sortOrder',
    'styleDefaultIds',
    'modelJson',
  ]);
  const versionResult = await recordEffectVersion(supabase, {
    effectId: parsed.data.effectId,
    action: 'restore',
    summary: `Restored version from ${version.created_by_label}`,
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
  });
  if (versionResult) return versionResult;

  await invalidateAdminEffectsCache(parsed.data.effectId);
  await invalidateAdminFireworksCache();
  await invalidateAdminStyleDefaultsCache();
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/effects');
  revalidatePath(`/admin/effects/${parsed.data.effectId}`);
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
