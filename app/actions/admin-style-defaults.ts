'use server';

/** Admin actions for reusable live firework renderer style defaults. */

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
import type { AdminEditorVersion, CurrentProfile } from '@/lib/admin.types';
import {
  makeStyleDefaultEditorSnapshot,
  parseStyleDefaultEditorSnapshot,
} from '@/lib/admin/editor-snapshots';
import { isMissingEditorVersionSchemaError } from '@/lib/admin/style-default-schema';
import type { Database, Json } from '@/lib/database.types';
import { fireworkDesignFragmentError } from '@/lib/fireworks/design';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  INITIAL_STYLE_DEFAULT_JSON,
  styleDefaultKindLabel,
} from '@/lib/fireworks/style-defaults';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';
import type { AdminStyleDefaultOption } from '@/lib/admin.types';
import { isSupabaseTransientNetworkError } from '@/utils/supabase/errors';

type CreateResult =
  | { ok: true; id: string; styleDefault: AdminStyleDefaultOption }
  | { ok: false; error: string };
type StyleDefaultRow = Database['public']['Tables']['firework_style_defaults']['Row'];
type StyleDefaultMutationRow = Pick<
  StyleDefaultRow,
  | 'id'
  | 'name'
  | 'description'
  | 'kind'
  | 'sort_order'
  | 'is_archived'
  | 'defaults_json'
  | 'updated_at'
>;
type SavedStyleDefault = {
  id: string;
  name: string;
  description: string | null;
  kind: (typeof FIREWORK_STYLE_DEFAULT_KINDS)[number];
  sortOrder: number;
  isArchived: boolean;
  defaultsJson: Json;
  updatedAt: string;
};
type UpdateResult =
  | {
      ok: true;
      saved: SavedStyleDefault;
      updatedAt: string;
      historyVersion: AdminEditorVersion;
      historyRecorded: boolean;
    }
  | { ok: false; error: string };
type ActionSupabase = ReturnType<typeof createClient>;

const STYLE_DEFAULT_MUTATION_SELECT =
  'id, name, description, kind, sort_order, is_archived, defaults_json, updated_at';

const StyleDefaultKindSchema = z.enum(FIREWORK_STYLE_DEFAULT_KINDS);

const CreateStyleDefaultSchema = z.object({
  kind: StyleDefaultKindSchema,
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  defaultsJson: z.string().trim().min(2).max(100_000),
});

const UpdateStyleDefaultSchema = CreateStyleDefaultSchema.extend({
  id: z.string().uuid(),
  historyVersionId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  isArchived: z.boolean(),
});

const ArchiveStyleDefaultSchema = z.object({
  id: z.string().uuid(),
  historyVersionId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().trim().min(1),
});

const RestoreStyleDefaultVersionSchema = z.object({
  styleDefaultId: z.string().uuid(),
  versionId: z.string().uuid(),
  historyVersionId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().trim().min(1),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function parseJsonObject(text: string): { ok: true; value: Json } | { ok: false; error: string } {
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

function mapSavedStyleDefault(row: StyleDefaultMutationRow): SavedStyleDefault {
  const kind = FIREWORK_STYLE_DEFAULT_KINDS.find((candidate) => candidate === row.kind) ?? 'star';
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind,
    sortOrder: row.sort_order,
    isArchived: row.is_archived,
    defaultsJson: row.defaults_json ?? {},
    updatedAt: row.updated_at,
  };
}

function adminLabel(profile: CurrentProfile): string {
  return profile.fullName || profile.email || 'Platform admin';
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

function summariseStyleDefaultChanges(changesJson: Json): string {
  const labels: Record<string, string> = {
    name: 'name',
    description: 'description',
    styleKind: 'kind',
    sortOrder: 'sort order',
    isArchived: 'archive status',
    defaultsJson: 'defaults JSON',
  };
  const fields = Object.keys(readSnapshotRecord(changesJson));
  if (fields.length === 0) return 'Saved without visible field changes';
  const visible = fields.slice(0, 3).map((field) => labels[field] ?? field);
  const extra = fields.length > visible.length ? ` +${fields.length - visible.length}` : '';
  return `Updated ${visible.join(', ')}${extra}`;
}

function makeStyleDefaultSnapshot(saved: SavedStyleDefault): Json {
  return makeStyleDefaultEditorSnapshot({
    kind: 'style_default',
    id: saved.id,
    name: saved.name,
    description: saved.description,
    styleKind: saved.kind,
    sortOrder: saved.sortOrder,
    isArchived: saved.isArchived,
    defaultsJson: saved.defaultsJson,
    updatedAt: saved.updatedAt,
  });
}

async function loadStyleDefaultEditorSnapshot(
  supabase: ActionSupabase,
  styleDefaultId: string,
): Promise<{ ok: true; snapshot: Json | null } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('firework_style_defaults')
    .select(STYLE_DEFAULT_MUTATION_SELECT)
    .eq('id', styleDefaultId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, snapshot: null };
  return {
    ok: true,
    snapshot: makeStyleDefaultSnapshot(mapSavedStyleDefault(data as StyleDefaultMutationRow)),
  };
}

async function recordStyleDefaultVersion(
  supabase: ActionSupabase,
  version: AdminEditorVersion,
): Promise<boolean> {
  const styleDefaultId = version.fireworkStyleDefaultId;
  if (!styleDefaultId) return false;

  const row = {
    id: version.id,
    target_kind: 'style_default',
    firework_style_default_id: styleDefaultId,
    action: version.action,
    summary: version.summary,
    snapshot_json: version.snapshotJson,
    previous_snapshot_json: version.previousSnapshotJson,
    changes_json: version.changesJson,
    created_by: version.createdBy,
    created_by_label: version.createdByLabel,
    created_at: version.createdAt,
  } as const;

  async function isRecorded(targetStyleDefaultId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('firework_editor_versions')
      .select('id')
      .eq('id', version.id)
      .eq('target_kind', 'style_default')
      .eq('firework_style_default_id', targetStyleDefaultId)
      .maybeSingle();
    if (error && !isMissingEditorVersionSchemaError(error)) {
      console.error('[recordStyleDefaultVersion] history confirmation failed:', error);
    }
    return Boolean(data);
  }

  const first = await supabase.from('firework_editor_versions').insert(row);
  if (!first.error) return true;
  if (isMissingEditorVersionSchemaError(first.error)) return false;
  if (await isRecorded(styleDefaultId)) return true;

  if (isSupabaseTransientNetworkError(first.error)) {
    const retry = await supabase.from('firework_editor_versions').insert(row);
    if (!retry.error || (await isRecorded(styleDefaultId))) return true;
    if (!isMissingEditorVersionSchemaError(retry.error)) {
      console.error('[recordStyleDefaultVersion] history retry failed:', retry.error);
    }
    return false;
  }

  console.error('[recordStyleDefaultVersion] history insert failed:', first.error);
  return false;
}

function makeStyleDefaultVersion(input: {
  styleDefaultId: string;
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
    targetKind: 'style_default',
    fireworkId: null,
    fireworkEffectId: null,
    fireworkStyleDefaultId: input.styleDefaultId,
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

async function refresh(defaultId?: string) {
  await Promise.all([
    invalidateAdminStyleDefaultsCache(defaultId),
    invalidateAdminEffectsCache(),
    invalidateAdminFireworksCache(),
    invalidateFireworkCatalogueCaches(),
  ]);
  revalidatePath('/admin/effects');
  if (defaultId) revalidatePath(`/admin/effects/defaults/${defaultId}`);
  revalidatePath('/admin/fireworks');
}

export async function createStyleDefault(
  input: z.infer<typeof CreateStyleDefaultSchema>,
): Promise<CreateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = CreateStyleDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const defaults = parseJsonObject(parsed.data.defaultsJson);
  if (!defaults.ok) return { ok: false, error: defaults.error };

  const supabase = createClient(await cookies());
  const baseSlug = slugify(parsed.data.name) || `${parsed.data.kind}-style`;
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('firework_style_defaults')
    .insert({
      slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      defaults_json: defaults.value,
      sort_order: 9000,
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not create style default.' };

  await refresh(data.id);
  return {
    ok: true,
    id: data.id,
    styleDefault: {
      id: data.id,
      kind: parsed.data.kind,
      name: parsed.data.name,
      description: parsed.data.description || null,
      defaultsJson: defaults.value,
    },
  };
}

export async function createStyleDefaultFromKind(formData: FormData): Promise<void> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    redirect('/admin/effects?view=star');
  }

  const kind = StyleDefaultKindSchema.safeParse(formData.get('kind'));
  const parsedKind = kind.success ? kind.data : 'star';
  const result = await createStyleDefault({
    kind: parsedKind,
    name: `New ${styleDefaultKindLabel(parsedKind).toLowerCase()} style`,
    description: '',
    defaultsJson: JSON.stringify(INITIAL_STYLE_DEFAULT_JSON[parsedKind], null, 2),
  });

  if (!result.ok) throw new Error(result.error);
  redirect(`/admin/effects/defaults/${result.id}?view=${parsedKind}`);
}

export async function updateStyleDefault(
  input: z.infer<typeof UpdateStyleDefaultSchema>,
): Promise<UpdateResult> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = UpdateStyleDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const defaults = parseJsonObject(parsed.data.defaultsJson);
  if (!defaults.ok) return { ok: false, error: defaults.error };

  const supabase = createClient(await cookies());
  const previousSnapshot = await loadStyleDefaultEditorSnapshot(supabase, parsed.data.id);
  if (!previousSnapshot.ok) return previousSnapshot;

  const { data, error } = await supabase
    .from('firework_style_defaults')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      defaults_json: defaults.value,
      sort_order: parsed.data.sortOrder,
      is_archived: parsed.data.isArchived,
    })
    .eq('id', parsed.data.id)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select(STYLE_DEFAULT_MUTATION_SELECT)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This style default changed in another session. Refresh before saving again.',
    };
  }

  const saved = mapSavedStyleDefault(data as StyleDefaultMutationRow);
  const snapshotJson = makeStyleDefaultSnapshot(saved);
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'styleKind',
    'sortOrder',
    'isArchived',
    'defaultsJson',
  ]);
  const historyVersion = makeStyleDefaultVersion({
    styleDefaultId: saved.id,
    action: 'update',
    summary: summariseStyleDefaultChanges(changesJson),
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.historyVersionId,
  });
  const historyRecorded = await recordStyleDefaultVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[updateStyleDefault] version history failed:', historyError);
      return false;
    },
  );
  await refresh(parsed.data.id);
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}

export async function archiveStyleDefault(
  input: z.infer<typeof ArchiveStyleDefaultSchema>,
): Promise<UpdateResult> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) {
    return { ok: false, error: 'Not permitted.' };
  }

  const parsed = ArchiveStyleDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const previousSnapshot = await loadStyleDefaultEditorSnapshot(supabase, parsed.data.id);
  if (!previousSnapshot.ok) return previousSnapshot;

  const { data, error } = await supabase
    .from('firework_style_defaults')
    .update({ is_archived: true })
    .eq('id', parsed.data.id)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select(STYLE_DEFAULT_MUTATION_SELECT)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This style default changed in another session. Refresh before archiving.',
    };
  }
  const saved = mapSavedStyleDefault(data as StyleDefaultMutationRow);
  const snapshotJson = makeStyleDefaultSnapshot(saved);
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'styleKind',
    'sortOrder',
    'isArchived',
    'defaultsJson',
  ]);
  const historyVersion = makeStyleDefaultVersion({
    styleDefaultId: saved.id,
    action: 'update',
    summary: 'Archived style default',
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.historyVersionId,
  });
  const historyRecorded = await recordStyleDefaultVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[archiveStyleDefault] version history failed:', historyError);
      return false;
    },
  );
  await refresh(parsed.data.id);
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}

export async function restoreStyleDefaultEditorVersion(
  input: z.infer<typeof RestoreStyleDefaultVersionSchema>,
): Promise<UpdateResult> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) return { ok: false, error: 'Not permitted.' };

  const parsed = RestoreStyleDefaultVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data: version, error: versionError } = await supabase
    .from('firework_editor_versions')
    .select('id, snapshot_json, created_by_label, created_at')
    .eq('id', parsed.data.versionId)
    .eq('target_kind', 'style_default')
    .eq('firework_style_default_id', parsed.data.styleDefaultId)
    .maybeSingle();
  if (versionError) {
    if (isMissingEditorVersionSchemaError(versionError)) {
      return { ok: false, error: 'Version history is not available yet.' };
    }
    return { ok: false, error: versionError.message };
  }
  if (!version) return { ok: false, error: 'That version could not be found.' };

  const snapshot = parseStyleDefaultEditorSnapshot(version.snapshot_json);
  if (!snapshot || snapshot.id !== parsed.data.styleDefaultId) {
    return { ok: false, error: 'That version cannot be restored.' };
  }

  const rendererError = fireworkDesignFragmentError(snapshot.defaultsJson);
  if (rendererError) {
    return { ok: false, error: `That version has invalid renderer settings: ${rendererError}` };
  }

  const previousSnapshot = await loadStyleDefaultEditorSnapshot(
    supabase,
    parsed.data.styleDefaultId,
  );
  if (!previousSnapshot.ok) return previousSnapshot;

  const { data, error } = await supabase
    .from('firework_style_defaults')
    .update({
      name: snapshot.name,
      description: snapshot.description,
      kind: snapshot.styleKind,
      defaults_json: snapshot.defaultsJson,
      sort_order: snapshot.sortOrder,
      is_archived: snapshot.isArchived,
    })
    .eq('id', parsed.data.styleDefaultId)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select(STYLE_DEFAULT_MUTATION_SELECT)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This style default changed in another session. Refresh before restoring.',
    };
  }

  const saved = mapSavedStyleDefault(data as StyleDefaultMutationRow);
  const snapshotJson = makeStyleDefaultSnapshot(saved);
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'styleKind',
    'sortOrder',
    'isArchived',
    'defaultsJson',
  ]);
  const historyVersion = makeStyleDefaultVersion({
    styleDefaultId: saved.id,
    action: 'restore',
    summary: `Restored version from ${version.created_by_label}`,
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.historyVersionId,
  });
  const historyRecorded = await recordStyleDefaultVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[restoreStyleDefaultEditorVersion] version history failed:', historyError);
      return false;
    },
  );

  await refresh(parsed.data.styleDefaultId);
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}
