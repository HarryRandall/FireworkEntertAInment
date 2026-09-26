'use server';

/** Admin actions for reusable live firework renderer style defaults. */

import { saveEditorRecord } from '@/lib/admin/editor-persistence.server';
import { requirePermission } from '@/lib/access/current-profile.server';
import type { AdminEditorVersion, AdminStyleDefaultOption } from '@/lib/admin.types';
import {
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  invalidateAdminStyleDefaultsCache,
} from '@/lib/admin/cache-keys';
import { parseStyleDefaultEditorSnapshot } from '@/lib/admin/editor-snapshots';
import { isMissingEditorVersionSchemaError } from '@/lib/admin/style-default-schema';
import type { Database, Json } from '@/lib/database.types';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows/cache-keys';
import { createClient } from '@/lib/supabase/server';
import { fireworkDesignFragmentError } from '@showcrafter/fireworks/design';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  INITIAL_STYLE_DEFAULT_JSON,
  styleDefaultKindLabel,
} from '@showcrafter/fireworks/style-defaults';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

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
  const patch = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    kind: parsed.data.kind,
    defaults_json: defaults.value,
    sort_order: parsed.data.sortOrder,
    is_archived: parsed.data.isArchived,
  };
  const result = await saveEditorRecord(supabase, {
    kind: 'style_default',
    id: parsed.data.id,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    patch,
    historyVersionId: parsed.data.historyVersionId,
  });
  if (!result.ok) return result;
  const saved = mapSavedStyleDefault(result.saved);
  const historyVersion = result.historyVersion;
  const historyRecorded = true;

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
  const patch = { is_archived: true };
  const result = await saveEditorRecord(supabase, {
    kind: 'style_default',
    id: parsed.data.id,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    patch,
    historyVersionId: parsed.data.historyVersionId,
  });
  if (!result.ok) return result;
  const saved = mapSavedStyleDefault(result.saved);
  const historyVersion = result.historyVersion;
  const historyRecorded = true;

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

  const patch = {
    name: snapshot.name,
    description: snapshot.description,
    kind: snapshot.styleKind,
    defaults_json: snapshot.defaultsJson,
    sort_order: snapshot.sortOrder,
    is_archived: snapshot.isArchived,
  };
  const result = await saveEditorRecord(supabase, {
    kind: 'style_default',
    id: parsed.data.styleDefaultId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    patch,
    historyVersionId: parsed.data.historyVersionId,
    restoreVersionId: parsed.data.versionId,
  });
  if (!result.ok) return result;
  const saved = mapSavedStyleDefault(result.saved);
  const historyVersion = result.historyVersion;
  const historyRecorded = true;

  await refresh(parsed.data.styleDefaultId);
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}
