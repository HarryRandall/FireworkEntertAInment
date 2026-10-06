'use server';
import { validateEditorDesign, designJson } from '@/lib/renderer-editor/validation';
import { validateRenderSnapshot } from '@/lib/admin/render-snapshot.server';

/** Admin firework actions: create and edit atomic fireworks (effect + colours
 *  + renderer overrides). Multishot composition lives in `admin-multishots`. */

import { saveEditorRecord } from '@/lib/admin/editor-persistence.server';
import { requirePermission } from '@/lib/access/current-profile.server';
import type { AdminEditorVersion } from '@/lib/admin.types';
import {
  invalidateAdminCatalogueCache,
  invalidateAdminFireworksCache,
  invalidateAdminMultishotsCache,
  invalidateAdminStyleDefaultsCache,
} from '@/lib/admin/cache-keys';
import { parseFireworkEditorSnapshot } from '@/lib/admin/editor-snapshots';
import { isMissingEditorVersionSchemaError } from '@/lib/admin/style-default-schema';
import type { Database, Json } from '@/lib/database.types';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows/cache-keys';
import { createClient } from '@/lib/supabase/server';
import { fireworkDesignFragmentError } from '@showcrafter/fireworks/design';
import { FIREWORK_STYLE_DEFAULT_KINDS } from '@showcrafter/fireworks/style-defaults';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';

type FireworkRow = Database['public']['Tables']['fireworks']['Row'];
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
  | 'design'
  | 'updated_at'
>;
type SavedFirework = {
  design: Json | null;
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

const UpdateFireworkSchema = z.object({
  design: z.unknown().optional(),
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

function mapSavedFirework(row: FireworkMutationRow): SavedFirework {
  return {
    design: row.design,
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

  const design = parsed.data.design === undefined ? null : validateEditorDesign(parsed.data.design);
  if (design && !design.ok) return { ok: false, error: design.error };
  const supabase = createClient(await cookies());
  const resolved = validateRenderSnapshot(overrides.value, parsed.data.id);
  if (!resolved.ok) return resolved;
  const patch = {
    ...(design?.ok ? { design: designJson(design.value) } : {}),
    name: parsed.data.name,
    description: parsed.data.description || null,
    firework_effect_id: parsed.data.fireworkEffectId,
    caliber: parsed.data.caliber || null,
    duration_seconds: parsed.data.durationSeconds ?? null,
    height_meters: parsed.data.heightMeters ?? null,
    primary_color: parsed.data.primaryColor || null,
    secondary_color: parsed.data.secondaryColor || null,
    color_palette: parsed.data.colorPalette ?? [],
    render_overrides_json: resolved.value,
  };
  const result = await saveEditorRecord(supabase, {
    kind: 'firework',
    id: parsed.data.id,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    patch,
    historyVersionId: parsed.data.historyVersionId,
  });
  if (!result.ok) return result;
  const saved = mapSavedFirework(result.saved);
  const historyVersion = result.historyVersion;
  const historyRecorded = true;

  await refresh(parsed.data.id);
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}

/** Restores a saved design and record through the existing atomic editor transaction. */
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

  const resolved = validateRenderSnapshot(snapshot.renderOverridesJson, snapshot.id);
  if (!resolved.ok) return resolved;
  const design = snapshot.design == null ? null : validateEditorDesign(snapshot.design);
  if (design && !design.ok) return { ok: false, error: design.error };
  const patch = {
    ...(design?.ok ? { design: designJson(design.value) } : {}),
    name: snapshot.name,
    description: snapshot.description,
    firework_effect_id: snapshot.fireworkEffectId,
    caliber: snapshot.caliber,
    duration_seconds: snapshot.durationSeconds,
    height_meters: snapshot.heightMeters,
    primary_color: snapshot.primaryColor,
    secondary_color: snapshot.secondaryColor,
    color_palette: snapshot.colorPalette,
    render_overrides_json: resolved.value,
  };
  const result = await saveEditorRecord(supabase, {
    kind: 'firework',
    id: parsed.data.fireworkId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    patch,
    historyVersionId: parsed.data.historyVersionId,
    restoreVersionId: parsed.data.versionId,
  });
  if (!result.ok) return result;
  const saved = mapSavedFirework(result.saved);
  const historyVersion = result.historyVersion;
  const historyRecorded = true;

  await refresh(parsed.data.fireworkId);
  return { ok: true, saved, updatedAt: saved.updatedAt, historyVersion, historyRecorded };
}
