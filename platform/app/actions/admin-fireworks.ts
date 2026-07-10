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
import type { CurrentProfile } from '@/lib/admin.types';
import {
  makeFireworkEditorSnapshot,
  parseFireworkEditorSnapshot,
} from '@/lib/admin/editor-snapshots';
import { isMissingEditorVersionSchemaError } from '@/lib/admin/style-default-schema';
import type { Json } from '@/lib/database.types';
import {
  emptyStyleDefaultIdMap,
  FIREWORK_STYLE_DEFAULT_KINDS,
} from '@/lib/fireworks/style-defaults';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';

type Result = { ok: true; updatedAt: string } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type ActionSupabase = ReturnType<typeof createClient>;

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

const RestoreFireworkVersionSchema = z.object({
  fireworkId: z.string().uuid(),
  versionId: z.string().uuid(),
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
  return { ok: true, value: parsed as Json };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
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
  input: {
    fireworkId: string;
    action: 'update' | 'restore';
    summary: string;
    snapshotJson: Json;
    previousSnapshotJson: Json | null;
    changesJson: Json;
    profile: CurrentProfile;
  },
): Promise<Result | null> {
  const { error } = await supabase.from('firework_editor_versions').insert({
    target_kind: 'firework',
    firework_id: input.fireworkId,
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

async function refresh(fireworkId?: string) {
  await invalidateAdminFireworksCache(fireworkId);
  await invalidateAdminMultishotsCache();
  await invalidateAdminCatalogueCache();
  await invalidateAdminStyleDefaultsCache();
  await invalidateFireworkCatalogueCaches();
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
    .select('updated_at')
    .maybeSingle();

  const { data, error } = result;
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This firework changed in another session. Refresh before saving again.',
    };
  }
  const snapshotJson = makeFireworkEditorSnapshot({
    kind: 'firework',
    id: parsed.data.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    fireworkEffectId: parsed.data.fireworkEffectId,
    caliber: parsed.data.caliber || null,
    durationSeconds: parsed.data.durationSeconds ?? null,
    heightMeters: parsed.data.heightMeters ?? null,
    primaryColor: parsed.data.primaryColor || null,
    secondaryColor: parsed.data.secondaryColor || null,
    colorPalette: parsed.data.colorPalette ?? [],
    styleDefaultIds: emptyStyleDefaultIdMap(),
    renderOverridesJson: overrides.value,
    updatedAt: data.updated_at,
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
  const versionError = await recordFireworkVersion(supabase, {
    fireworkId: parsed.data.id,
    action: 'update',
    summary: summariseFireworkChanges(changesJson),
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
  });
  if (versionError) return versionError;

  await refresh(parsed.data.id);
  return { ok: true, updatedAt: data.updated_at };
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
    .select('updated_at')
    .maybeSingle();

  const { data, error } = result;
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'This firework changed in another session. Refresh before restoring.',
    };
  }

  const snapshotJson = makeFireworkEditorSnapshot({
    ...snapshot,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    updatedAt: data.updated_at,
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
  const versionResult = await recordFireworkVersion(supabase, {
    fireworkId: parsed.data.fireworkId,
    action: 'restore',
    summary: `Restored version from ${version.created_by_label}`,
    snapshotJson,
    previousSnapshotJson: previousSnapshot.snapshot,
    changesJson,
    profile,
  });
  if (versionResult) return versionResult;

  await refresh(parsed.data.fireworkId);
  return { ok: true, updatedAt: data.updated_at };
}
