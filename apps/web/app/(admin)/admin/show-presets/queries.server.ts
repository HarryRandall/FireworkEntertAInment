/** Permission-gated show-preset management reads. */
import 'server-only';

import type {
  AdminShowPresetDetail,
  AdminShowPresetImportShow,
  AdminShowPresetSummary,
} from '@/lib/admin.types';
import { requirePermission } from '@/lib/access/current-profile.server';
import type { ShowTemplateCue } from '@/lib/show-templates/types';
import {
  isOptionalShowPresetSchemaError,
  SHOW_TEMPLATES_BASE_SELECT,
  SHOW_TEMPLATES_CORE_SELECT,
} from '@/lib/show-templates/schema';
import { mapShowTemplate, type ShowTemplateRow } from '@/lib/show-templates/mappers';
import { listFireworkProducts } from '@/lib/shows/queries.server';
import { createServiceRoleSupabase } from '@/lib/supabase/service-role';
import { describeSupabaseError } from '@/lib/admin/style-default-schema';
import { getServerClient } from '@/lib/supabase/server-client';

const SHOW_PRESETS_WITH_COVERS_SELECT = `${SHOW_TEMPLATES_BASE_SELECT}, cover_shader, cover_image_path`;
const SHOW_PRESETS_CORE_WITH_COVERS_SELECT = `${SHOW_TEMPLATES_CORE_SELECT}, cover_shader, cover_image_path`;
const SHOW_PRESETS_SELECT = `${SHOW_TEMPLATES_BASE_SELECT}, cover_shader, cover_image_path, show_preset_like_counts(like_count)`;
const SHOW_PRESETS_FALLBACK_SELECTS = [
  SHOW_PRESETS_WITH_COVERS_SELECT,
  SHOW_PRESETS_CORE_WITH_COVERS_SELECT,
  SHOW_TEMPLATES_CORE_SELECT,
] as const;

function throwAdminShowPresetReadError(operation: string, error: unknown): never {
  console.error(`[admin.show-presets] ${operation} failed:`, describeSupabaseError(error));
  throw new Error('Admin show preset data could not be loaded.', { cause: error });
}

async function selectShowPresetsForAdmin(supabase: Awaited<ReturnType<typeof getServerClient>>) {
  let result: { data: unknown[] | null; error: unknown } = await supabase
    .from('show_presets')
    .select(SHOW_PRESETS_SELECT)
    .order('is_published', { ascending: false })
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  for (const select of SHOW_PRESETS_FALLBACK_SELECTS) {
    if (!result.error || !isOptionalShowPresetSchemaError(result.error)) return result;
    result = await supabase
      .from('show_presets')
      .select(select)
      .order('is_published', { ascending: false })
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true });
  }
  return result;
}

async function selectShowPresetByIdForAdmin(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  presetId: string,
) {
  let result: { data: unknown | null; error: unknown } = await supabase
    .from('show_presets')
    .select(SHOW_PRESETS_SELECT)
    .eq('id', presetId)
    .maybeSingle();
  for (const select of SHOW_PRESETS_FALLBACK_SELECTS) {
    if (!result.error || !isOptionalShowPresetSchemaError(result.error)) return result;
    result = await supabase.from('show_presets').select(select).eq('id', presetId).maybeSingle();
  }
  return result;
}

function cueResolutionKeys(cue: ShowTemplateCue): string[] {
  return [cue.catalogueItemId ?? '', cue.catalogueItemSlug ?? '', cue.fireworkSlug ?? ''].filter(
    Boolean,
  );
}

function catalogueResolutionKeys(
  products: Awaited<ReturnType<typeof listFireworkProducts>>,
): Set<string> {
  const keys = new Set<string>();
  for (const product of products) {
    keys.add(product.id);
    keys.add(product.slug);
  }
  return keys;
}

function resolvableCueCount(cues: ShowTemplateCue[], keys: ReadonlySet<string>): number {
  return cues.filter((cue) => cueResolutionKeys(cue).some((key) => keys.has(key))).length;
}

function mapAdminSummary(
  row: ShowTemplateRow,
  resolutionKeys: ReadonlySet<string>,
): AdminShowPresetSummary {
  const preset = mapShowTemplate(row);
  return {
    ...preset,
    sourceShowId: row.source_show_id ?? null,
    cueCount: preset.previewCues.length,
    resolvableCueCount: resolvableCueCount(preset.previewCues, resolutionKeys),
  };
}

export async function listAdminShowPresetImportShows(): Promise<AdminShowPresetImportShow[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const service = createServiceRoleSupabase();
  if (!service) return [];

  const [{ data: shows, error }, { data: importedPresets, error: importedPresetsError }] =
    await Promise.all([
      service
        .from('shows')
        .select(
          'id, user_id, slug, title, duration_seconds, effects_count, total_cents, generation_status, updated_at',
        )
        .eq('generation_status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(100),
      service.from('show_presets').select('source_show_id').not('source_show_id', 'is', null),
    ]);
  const sourceFailures = [
    { source: 'completed shows', error },
    { source: 'imported preset sources', error: importedPresetsError },
  ].filter((failure) => failure.error !== null);
  if (sourceFailures.length > 0) {
    throwAdminShowPresetReadError('listAdminShowPresetImportShows sources', sourceFailures);
  }

  const importedShowIds = new Set(
    (importedPresets ?? []).map((preset) => preset.source_show_id).filter(Boolean),
  );
  const importableShows = (shows ?? []).filter((show) => !importedShowIds.has(show.id));

  const userIds = Array.from(new Set(importableShows.map((show) => show.user_id).filter(Boolean)));
  const { data: users, error: usersError } = userIds.length
    ? await service.from('users').select('id, email').in('id', userIds)
    : { data: [], error: null };
  if (usersError) {
    throwAdminShowPresetReadError('listAdminShowPresetImportShows owners', usersError);
  }
  const emailByUserId = new Map((users ?? []).map((user) => [user.id, user.email]));

  return importableShows.map((show) => ({
    id: show.id,
    slug: show.slug,
    title: show.title,
    ownerEmail: emailByUserId.get(show.user_id) ?? null,
    durationSeconds: show.duration_seconds,
    effectsCount: show.effects_count,
    totalCents: show.total_cents,
    updatedAt: show.updated_at,
  }));
}

/** Admin list: includes drafts and does not merge non-editable fallback seeds. */
export async function listAdminShowPresets(): Promise<AdminShowPresetSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const supabase = await getServerClient();
  const [{ data, error }, products] = await Promise.all([
    selectShowPresetsForAdmin(supabase),
    listFireworkProducts({ lightweight: true }),
  ]);

  if (error) {
    throwAdminShowPresetReadError('listAdminShowPresets', error);
  }

  const resolutionKeys = catalogueResolutionKeys(products);
  return ((data ?? []) as ShowTemplateRow[]).map((row) => mapAdminSummary(row, resolutionKeys));
}

/** Admin detail: one preset plus catalogue and import source data for the editor. */
export async function getAdminShowPresetById(
  presetId: string,
): Promise<AdminShowPresetDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const supabase = await getServerClient();
  const { data, error } = await selectShowPresetByIdForAdmin(supabase, presetId);
  if (error) {
    throwAdminShowPresetReadError('getAdminShowPresetById', error);
  }
  if (!data) return null;

  const [products, importableShows] = await Promise.all([
    listFireworkProducts(),
    listAdminShowPresetImportShows(),
  ]);
  const summary = mapAdminSummary(data as ShowTemplateRow, catalogueResolutionKeys(products));

  return {
    ...summary,
    catalogueItems: products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      durationSeconds: product.durationSeconds,
      shotCount: product.shotCount,
      kind: (product.shotCount ?? 1) > 1 ? 'multishot' : 'firework',
      primaryColor: product.variant?.primaryColor ?? product.variant?.colorPalette[0] ?? null,
      secondaryColor:
        product.variant?.secondaryColor ??
        product.variant?.colorPalette.find((color) => color !== product.variant?.primaryColor) ??
        null,
      colorPalette: product.variant?.colorPalette ?? [],
      effectName: product.baseEffect?.name ?? null,
    })),
    importableShows,
  };
}
