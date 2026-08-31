'use server';

/** Admin firework actions: create and edit atomic fireworks (effect + colours
 *  + renderer overrides). Multishot composition lives in `admin-multishots`. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  invalidateAdminCatalogueCache,
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
import {
  makeFireworkEditorSnapshot,
  parseFireworkEditorSnapshot,
} from '@/lib/admin/editor-snapshots';
import { isMissingEditorVersionSchemaError } from '@/lib/admin/style-default-schema';
import type { Database, Json } from '@/lib/database.types';
import { fireworkDesignFragmentError } from '@/lib/fireworks/design';
import {
  emptyStyleDefaultIdMap,
  FIREWORK_STYLE_DEFAULT_KINDS,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';
import { isSupabaseTransientNetworkError } from '@/utils/supabase/errors';

type FireworkRow = Database['public']['Tables']['fireworks']['Row'];
type StyleDefaultRow = Database['public']['Tables']['firework_style_defaults']['Row'];
type FireworkMutationRow = Pick<
  FireworkRow,
  | 'id'
  | 'name'
  | 'description'
  | 'firework_effect_id'
  | 'caliber'
  | 'duration_seconds'
  | 'height_meters'
  | 'primary_color'
  | 'secondary_color'
  | 'color_palette'
  | 'render_overrides_json'
  | 'updated_at'
>;
type StyleDefaultMutationRow = Pick<
  StyleDefaultRow,
  'id' | 'name' | 'description' | 'kind' | 'defaults_json'
>;
type SavedFirework = {
  id: string;
  name: string;
  description: string | null;
  fireworkEffectId: string;
  caliber: string | null;
  durationSeconds: number | null;
  heightMeters: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
  renderOverridesJson: Json;
  updatedAt: string;
};
type Result =
  | {
      ok: true;
      saved: SavedFirework;
      updatedAt: string;
      historyVersion: AdminEditorVersion;
      historyRecorded: boolean;
    }
  | { ok: false; error: string };
type CreateStyleDefaultAndUpdateFireworkResult =
  | (Extract<Result, { ok: true }> & { styleDefault: AdminStyleDefaultOption })
  | Extract<Result, { ok: false }>;
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type ActionSupabase = ReturnType<typeof createClient>;

const FIREWORK_MUTATION_SELECT =
  'id, name, description, firework_effect_id, caliber, duration_seconds, height_meters, primary_color, secondary_color, color_palette, render_overrides_json, updated_at';

const HexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Colours must be 6-digit hex like #ff0043.')
  .transform((value) => value.toLowerCase());
const StyleDefaultKindSchema = z.enum(FIREWORK_STYLE_DEFAULT_KINDS);
const StyleDefaultAssignmentsSchema = z.partialRecord(
  StyleDefaultKindSchema,
  z.string().uuid().nullable(),
);

const CreateFireworkSchema = z.object({
  name: z.string().trim().min(1).max(180),
  effectId: z.string().uuid(),
});

const UpdateFireworkSchema = z.object({
  id: z.string().uuid(),
  historyVersionId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().trim().min(1),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  fireworkEffectId: z.string().uuid(),
  caliber: z.string().trim().max(40).optional().nullable(),
  durationSeconds: z.coerce.number().min(0).max(3600).optional().nullable(),
  heightMeters: z.coerce.number().min(0).max(400).optional().nullable(),
  primaryColor: HexColor.optional().nullable(),
  secondaryColor: HexColor.optional().nullable(),
  colorPalette: z.array(HexColor).max(12).optional(),
  starStyleDefaultId: z.string().uuid().optional().nullable(),
  trailStyleDefaultId: z.string().uuid().optional().nullable(),
  styleDefaultIds: StyleDefaultAssignmentsSchema.optional().nullable(),
  renderOverridesJson: z.string().trim().min(2).max(100_000),
});

const InlineStyleDefaultSchema = z.object({
  kind: StyleDefaultKindSchema,
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  defaultsJson: z.string().trim().min(2).max(100_000),
});

const CreateStyleDefaultAndUpdateFireworkSchema = z.object({
  firework: UpdateFireworkSchema,
  styleDefault: InlineStyleDefaultSchema,
});

const RestoreFireworkVersionSchema = z.object({
  fireworkId: z.string().uuid(),
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
    return { ok: false, error: 'Renderer overrides JSON is invalid.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Renderer overrides must be a JSON object.' };
  }
  const rendererError = fireworkDesignFragmentError(parsed);
  if (rendererError) {
    return { ok: false, error: `Renderer overrides are invalid: ${rendererError}` };
  }
  return { ok: true, value: parsed as Json };
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

function mapSavedFirework(row: FireworkMutationRow): SavedFirework {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fireworkEffectId: row.firework_effect_id,
    caliber: row.caliber,
    durationSeconds: row.duration_seconds,
    heightMeters: row.height_meters,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    colorPalette: Array.isArray(row.color_palette)
      ? row.color_palette.filter((colour): colour is string => typeof colour === 'string')
      : [],
    renderOverridesJson: row.render_overrides_json ?? {},
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

function summariseFireworkChanges(changesJson: Json): string {
  const labels: Record<string, string> = {
    name: 'name',
    description: 'description',
    fireworkEffectId: 'base effect',
    caliber: 'calibre',
    durationSeconds: 'duration',
    heightMeters: 'height',
    primaryColor: 'primary colour',
    secondaryColor: 'secondary colour',
    colorPalette: 'palette',
    renderOverridesJson: 'renderer overrides',
  };
  const fields = Object.keys(readSnapshotRecord(changesJson));
  if (fields.length === 0) return 'Saved without visible field changes';
  const visible = fields.slice(0, 3).map((field) => labels[field] ?? field);
  const extra = fields.length > visible.length ? ` +${fields.length - visible.length}` : '';
  return `Updated ${visible.join(', ')}${extra}`;
}

async function loadFireworkEditorSnapshot(
  supabase: ActionSupabase,
  fireworkId: string,
): Promise<{ ok: true; snapshot: Json | null } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('fireworks')
    .select(
      'id, name, description, firework_effect_id, caliber, duration_seconds, height_meters, primary_color, secondary_color, color_palette, render_overrides_json, updated_at',
    )
    .eq('id', fireworkId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, snapshot: null };

  return {
    ok: true,
    snapshot: makeFireworkEditorSnapshot({
      kind: 'firework',
      id: data.id,
      name: data.name,
      description: data.description,
      fireworkEffectId: data.firework_effect_id,
      caliber: data.caliber,
      durationSeconds: data.duration_seconds,
      heightMeters: data.height_meters,
      primaryColor: data.primary_color,
      secondaryColor: data.secondary_color,
      colorPalette: Array.isArray(data.color_palette) ? data.color_palette : [],
      styleDefaultIds: emptyStyleDefaultIdMap(),
      renderOverridesJson: data.render_overrides_json ?? {},
      updatedAt: data.updated_at,
    }),
  };
}

async function recordFireworkVersion(
  supabase: ActionSupabase,
  version: AdminEditorVersion,
): Promise<boolean> {
  const fireworkId = version.fireworkId;
  if (!fireworkId) return false;

  const row = {
    id: version.id,
    target_kind: 'firework',
    firework_id: fireworkId,
    action: version.action,
    summary: version.summary,
    snapshot_json: version.snapshotJson,
    previous_snapshot_json: version.previousSnapshotJson,
    changes_json: version.changesJson,
    created_by: version.createdBy,
    created_by_label: version.createdByLabel,
    created_at: version.createdAt,
  } as const;

  async function isRecorded(targetFireworkId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('firework_editor_versions')
      .select('id')
      .eq('id', version.id)
      .eq('target_kind', 'firework')
      .eq('firework_id', targetFireworkId)
      .maybeSingle();
    if (error && !isMissingEditorVersionSchemaError(error)) {
      console.error('[recordFireworkVersion] history confirmation failed:', error);
    }
    return Boolean(data);
  }

  const first = await supabase.from('firework_editor_versions').insert(row);
  if (!first.error) return true;
  if (isMissingEditorVersionSchemaError(first.error)) return false;
  if (await isRecorded(fireworkId)) return true;

  if (isSupabaseTransientNetworkError(first.error)) {
    const retry = await supabase.from('firework_editor_versions').insert(row);
    if (!retry.error || (await isRecorded(fireworkId))) return true;
    if (!isMissingEditorVersionSchemaError(retry.error)) {
      console.error('[recordFireworkVersion] history retry failed:', retry.error);
    }
    return false;
  }

  console.error('[recordFireworkVersion] history insert failed:', first.error);
  return false;
}

function makeFireworkVersion(input: {
  fireworkId: string;
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
    targetKind: 'firework',
    fireworkId: input.fireworkId,
    fireworkEffectId: null,
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

async function refresh(fireworkId?: string) {
  await Promise.all([
    invalidateAdminFireworksCache(fireworkId),
    invalidateAdminMultishotsCache(),
    invalidateAdminCatalogueCache(),
    invalidateAdminStyleDefaultsCache(),
    invalidateFireworkCatalogueCaches(),
  ]);
  revalidatePath('/admin/fireworks');
  if (fireworkId) revalidatePath(`/admin/fireworks/${fireworkId}`);
  revalidatePath('/admin/multishots');
  revalidatePath('/admin/catalogue');
}

/** Create a blank firework on a base effect; a catalogue row is auto-created. */
export async function createFirework(
  input: z.infer<typeof CreateFireworkSchema>,
): Promise<CreateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = CreateFireworkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const baseSlug = slugify(parsed.data.name) || 'firework';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from('fireworks')
    .insert({
      firework_effect_id: parsed.data.effectId,
      slug,
      name: parsed.data.name,
      render_overrides_json: {},
      color_palette: [],
      source: 'manual',
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not create firework.' };
  await refresh(data.id);
  return { ok: true, id: data.id };
}

/** Persist all firework-level fields, including colours and renderer overrides. */
export async function updateFirework(input: z.infer<typeof UpdateFireworkSchema>): Promise<Result> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = UpdateFireworkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const overrides = parseJsonObject(parsed.data.renderOverridesJson);
  if (!overrides.ok) return { ok: false, error: overrides.error };

  const supabase = createClient(await cookies());
  const previousSnapshot = await loadFireworkEditorSnapshot(supabase, parsed.data.id);
  if (!previousSnapshot.ok) return previousSnapshot;

  const patch = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    firework_effect_id: parsed.data.fireworkEffectId,
    caliber: parsed.data.caliber || null,
    duration_seconds: parsed.data.durationSeconds ?? null,
    height_meters: parsed.data.heightMeters ?? null,
    primary_color: parsed.data.primaryColor || null,
    secondary_color: parsed.data.secondaryColor || null,
    color_palette: parsed.data.colorPalette ?? [],
    render_overrides_json: overrides.value,
    updated_at: new Date().toISOString(),
  };
  const result = await supabase
    .from('fireworks')
    .update(patch)
    .eq('id', parsed.data.id)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select(FIREWORK_MUTATION_SELECT)
    .maybeSingle();

  const { data, error } = result;
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This firework changed in another session. Refresh before saving again.',
    };
  }
  const saved = mapSavedFirework(data as FireworkMutationRow);
  const snapshotJson = makeFireworkEditorSnapshot({
    kind: 'firework',
    id: saved.id,
    name: saved.name,
    description: saved.description,
    fireworkEffectId: saved.fireworkEffectId,
    caliber: saved.caliber,
    durationSeconds: saved.durationSeconds,
    heightMeters: saved.heightMeters,
    primaryColor: saved.primaryColor,
    secondaryColor: saved.secondaryColor,
    colorPalette: saved.colorPalette,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    renderOverridesJson: saved.renderOverridesJson,
    updatedAt: saved.updatedAt,
  });
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'fireworkEffectId',
    'caliber',
    'durationSeconds',
    'heightMeters',
    'primaryColor',
    'secondaryColor',
    'colorPalette',
    'renderOverridesJson',
  ]);
  const historyVersion = makeFireworkVersion({
    fireworkId: saved.id,
    action: 'update',
    summary: summariseFireworkChanges(changesJson),
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.historyVersionId,
  });
  const historyRecorded = await recordFireworkVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[updateFirework] version history failed:', historyError);
      return false;
    },
  );

  await refresh(parsed.data.id);
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}

/** Create an inline style default and save its source firework in one database transaction. */
export async function createStyleDefaultAndUpdateFirework(
  input: z.infer<typeof CreateStyleDefaultAndUpdateFireworkSchema>,
): Promise<CreateStyleDefaultAndUpdateFireworkResult> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) return { ok: false, error: 'Not permitted.' };

  const parsed = CreateStyleDefaultAndUpdateFireworkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const overrides = parseJsonObject(parsed.data.firework.renderOverridesJson);
  if (!overrides.ok) return { ok: false, error: overrides.error };
  const defaults = parseStyleDefaultJson(parsed.data.styleDefault.defaultsJson);
  if (!defaults.ok) return { ok: false, error: defaults.error };

  const supabase = createClient(await cookies());
  const previousSnapshot = await loadFireworkEditorSnapshot(supabase, parsed.data.firework.id);
  if (!previousSnapshot.ok) return previousSnapshot;

  // The generated types mark these plpgsql arguments non-null because the
  // function declares no defaults, but the function body writes them straight
  // into nullable fireworks columns and accepts SQL NULL. Keep passing null for
  // cleared optional fields and assert past the stricter arg types.
  const { data, error } = await supabase.rpc('create_style_default_and_update_firework', {
    p_firework_id: parsed.data.firework.id,
    p_expected_updated_at: parsed.data.firework.expectedUpdatedAt,
    p_firework_name: parsed.data.firework.name,
    p_firework_description: (parsed.data.firework.description || null) as string,
    p_firework_effect_id: parsed.data.firework.fireworkEffectId,
    p_caliber: (parsed.data.firework.caliber || null) as string,
    p_duration_seconds: (parsed.data.firework.durationSeconds ?? null) as number,
    p_height_meters: (parsed.data.firework.heightMeters ?? null) as number,
    p_primary_color: (parsed.data.firework.primaryColor || null) as string,
    p_secondary_color: (parsed.data.firework.secondaryColor || null) as string,
    p_color_palette: parsed.data.firework.colorPalette ?? [],
    p_render_overrides_json: overrides.value,
    p_style_slug: styleDefaultSlug(parsed.data.styleDefault.name, parsed.data.styleDefault.kind),
    p_style_name: parsed.data.styleDefault.name,
    p_style_description: (parsed.data.styleDefault.description || null) as string,
    p_style_kind: parsed.data.styleDefault.kind,
    p_style_defaults_json: defaults.value,
  });

  if (error) return { ok: false, error: error.message };
  const payload = readSnapshotRecord(data as Json | null);
  if (payload.ok !== true) {
    if (payload.code === 'conflict') {
      return {
        ok: false,
        error: 'This firework changed in another session. Refresh before saving again.',
      };
    }
    return { ok: false, error: 'Could not create the style default and save the firework.' };
  }

  const saved = mapSavedFirework(payload.firework as unknown as FireworkMutationRow);
  const styleDefault = mapCreatedStyleDefault(
    payload.styleDefault as unknown as StyleDefaultMutationRow,
  );
  const snapshotJson = makeFireworkEditorSnapshot({
    kind: 'firework',
    id: saved.id,
    name: saved.name,
    description: saved.description,
    fireworkEffectId: saved.fireworkEffectId,
    caliber: saved.caliber,
    durationSeconds: saved.durationSeconds,
    heightMeters: saved.heightMeters,
    primaryColor: saved.primaryColor,
    secondaryColor: saved.secondaryColor,
    colorPalette: saved.colorPalette,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    renderOverridesJson: saved.renderOverridesJson,
    updatedAt: saved.updatedAt,
  });
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'fireworkEffectId',
    'caliber',
    'durationSeconds',
    'heightMeters',
    'primaryColor',
    'secondaryColor',
    'colorPalette',
    'renderOverridesJson',
  ]);
  const historyVersion = makeFireworkVersion({
    fireworkId: saved.id,
    action: 'update',
    summary: summariseFireworkChanges(changesJson),
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.firework.historyVersionId,
  });
  const historyRecorded = await recordFireworkVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[createStyleDefaultAndUpdateFirework] version history failed:', historyError);
      return false;
    },
  );

  await refresh(saved.id);
  return {
    ok: true,
    saved,
    updatedAt: saved.updatedAt,
    styleDefault,
    historyVersion,
    historyRecorded,
  };
}

export async function restoreFireworkEditorVersion(
  input: z.infer<typeof RestoreFireworkVersionSchema>,
): Promise<Result> {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) return { ok: false, error: 'Not permitted.' };

  const parsed = RestoreFireworkVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data: version, error: versionError } = await supabase
    .from('firework_editor_versions')
    .select('id, snapshot_json, created_by_label, created_at')
    .eq('id', parsed.data.versionId)
    .eq('target_kind', 'firework')
    .eq('firework_id', parsed.data.fireworkId)
    .maybeSingle();
  if (versionError) {
    if (isMissingEditorVersionSchemaError(versionError)) {
      return { ok: false, error: 'Version history is not available yet.' };
    }
    return { ok: false, error: versionError.message };
  }
  if (!version) return { ok: false, error: 'That version could not be found.' };

  const snapshot = parseFireworkEditorSnapshot(version.snapshot_json);
  if (!snapshot || snapshot.id !== parsed.data.fireworkId) {
    return { ok: false, error: 'That version cannot be restored.' };
  }

  const rendererError = fireworkDesignFragmentError(snapshot.renderOverridesJson);
  if (rendererError) {
    return { ok: false, error: `That version has invalid renderer settings: ${rendererError}` };
  }

  const previousSnapshot = await loadFireworkEditorSnapshot(supabase, parsed.data.fireworkId);
  if (!previousSnapshot.ok) return previousSnapshot;

  const updatedAt = new Date().toISOString();
  const patch = {
    name: snapshot.name,
    description: snapshot.description,
    firework_effect_id: snapshot.fireworkEffectId,
    caliber: snapshot.caliber,
    duration_seconds: snapshot.durationSeconds,
    height_meters: snapshot.heightMeters,
    primary_color: snapshot.primaryColor,
    secondary_color: snapshot.secondaryColor,
    color_palette: snapshot.colorPalette,
    render_overrides_json: snapshot.renderOverridesJson,
    updated_at: updatedAt,
  };
  const result = await supabase
    .from('fireworks')
    .update(patch)
    .eq('id', parsed.data.fireworkId)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select(FIREWORK_MUTATION_SELECT)
    .maybeSingle();

  const { data, error } = result;
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This firework changed in another session. Refresh before restoring.',
    };
  }

  const saved = mapSavedFirework(data as FireworkMutationRow);
  const snapshotJson = makeFireworkEditorSnapshot({
    kind: 'firework',
    id: saved.id,
    name: saved.name,
    description: saved.description,
    fireworkEffectId: saved.fireworkEffectId,
    caliber: saved.caliber,
    durationSeconds: saved.durationSeconds,
    heightMeters: saved.heightMeters,
    primaryColor: saved.primaryColor,
    secondaryColor: saved.secondaryColor,
    colorPalette: saved.colorPalette,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    renderOverridesJson: saved.renderOverridesJson,
    updatedAt: saved.updatedAt,
  });
  const changesJson = fieldChanges(previousSnapshot.snapshot, snapshotJson, [
    'name',
    'description',
    'fireworkEffectId',
    'caliber',
    'durationSeconds',
    'heightMeters',
    'primaryColor',
    'secondaryColor',
    'colorPalette',
    'renderOverridesJson',
  ]);
  const historyVersion = makeFireworkVersion({
    fireworkId: saved.id,
    action: 'restore',
    summary: `Restored version from ${version.created_by_label}`,
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
    historyVersionId: parsed.data.historyVersionId,
  });
  const historyRecorded = await recordFireworkVersion(supabase, historyVersion).catch(
    (historyError: unknown) => {
      console.error('[restoreFireworkEditorVersion] version history failed:', historyError);
      return false;
    },
  );

  await refresh(parsed.data.fireworkId);
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}
