/**
 * Show-template reads.
 *
 * Templates are public (no permission gate), they're the curated examples
 * the marketing site and "create show" wizard show off. The list TTL is
 * longer ({@link SHOW_TEMPLATES_TTL_SECONDS}) since templates change rarely.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import { getCurrentUserId } from '@/lib/current-user.server';
import type {
  AdminShowPresetDetail,
  AdminShowPresetImportShow,
  AdminShowPresetSummary,
  ShowTemplate,
  ShowTemplateCue,
} from '@/lib/admin.types';
import type { ShowTemplateSummary } from '@/lib/show-template-summary';
import { listFireworkProducts } from '@/lib/shows.server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import { isSupabaseTransientNetworkError } from '@/utils/supabase/errors';
import { getShowTemplatesCacheKey, SHOW_TEMPLATES_TTL_SECONDS } from './cache-keys';
import { requirePermission } from './current-user.server';
import {
  mapShowTemplate,
  mapShowTemplateSummary,
  type ShowTemplateRow,
  type ShowTemplateSummaryRow,
} from './mappers';
import { describeSupabaseError } from './style-default-schema';
import { getServerClient } from './supabase';

const SHOW_TEMPLATES_BASE_SELECT =
  'id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, is_published, published_at, source_show_id, sort_order, created_at, updated_at';
const SHOW_TEMPLATES_CORE_SELECT = SHOW_TEMPLATES_BASE_SELECT.replace(', source_show_id', '');
const SHOW_TEMPLATE_SUMMARIES_CORE_SELECT =
  'id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, composition_signature, time_of_day, mood_tags, is_featured, is_published, published_at, sort_order, created_at, updated_at';
const SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT =
  'id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, is_published, published_at, sort_order, created_at, updated_at';
const SHOW_TEMPLATES_WITH_COVERS_SELECT = `${SHOW_TEMPLATES_BASE_SELECT}, cover_shader, cover_image_path`;
const SHOW_TEMPLATES_CORE_WITH_COVERS_SELECT = `${SHOW_TEMPLATES_CORE_SELECT}, cover_shader, cover_image_path`;
const SHOW_TEMPLATES_SELECT = `${SHOW_TEMPLATES_BASE_SELECT}, cover_shader, cover_image_path, show_preset_like_counts(like_count)`;
const PUBLIC_SHOW_TEMPLATES_SELECT = `${SHOW_TEMPLATES_CORE_SELECT}, cover_shader, cover_image_path, show_preset_like_counts(like_count)`;
const PUBLIC_SHOW_TEMPLATE_SUMMARIES_SELECT = `${SHOW_TEMPLATE_SUMMARIES_CORE_SELECT}, cover_shader, cover_image_path, show_preset_like_counts(like_count)`;
const SHOW_TEMPLATES_FALLBACK_SELECTS = [
  SHOW_TEMPLATES_WITH_COVERS_SELECT,
  SHOW_TEMPLATES_CORE_WITH_COVERS_SELECT,
  SHOW_TEMPLATES_CORE_SELECT,
] as const;
const PUBLIC_SHOW_TEMPLATES_FALLBACK_SELECTS = [
  SHOW_TEMPLATES_CORE_WITH_COVERS_SELECT,
  SHOW_TEMPLATES_CORE_SELECT,
] as const;
const PUBLIC_SHOW_TEMPLATE_SUMMARIES_FALLBACK_SELECTS = [
  `${SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT}, cover_shader, cover_image_path, show_preset_like_counts(like_count)`,
  `${SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT}, cover_shader, cover_image_path`,
  SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT,
] as const;

function throwAdminTemplateReadError(operation: string, error: unknown): never {
  console.error(`[admin.templates] ${operation} failed:`, describeSupabaseError(error));
  throw new Error('Admin show preset data could not be loaded.', { cause: error });
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' ? (error as { code?: string }).code : undefined;
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object'
    ? String((error as { message?: string | null }).message ?? '')
    : '';
}

function isOptionalShowPresetSchemaError(error: unknown): boolean {
  const message = errorMessage(error);
  return Boolean(
    error &&
    (errorCode(error) === '42703' ||
      errorCode(error) === '42P01' ||
      errorCode(error) === 'PGRST200' ||
      errorCode(error) === 'PGRST204' ||
      message.includes('show_preset_like_counts') ||
      message.includes('source_show_id') ||
      message.includes('cover_shader') ||
      message.includes('cover_image_path')),
  );
}

async function selectShowPresetsForAdmin(supabase: Awaited<ReturnType<typeof getServerClient>>) {
  let result: { data: unknown[] | null; error: unknown } = await supabase
    .from('show_presets')
    .select(SHOW_TEMPLATES_SELECT)
    .order('is_published', { ascending: false })
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  for (const select of SHOW_TEMPLATES_FALLBACK_SELECTS) {
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
    .select(SHOW_TEMPLATES_SELECT)
    .eq('id', presetId)
    .maybeSingle();
  for (const select of SHOW_TEMPLATES_FALLBACK_SELECTS) {
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
  const template = mapShowTemplate(row);
  return {
    ...template,
    sourceShowId: row.source_show_id ?? null,
    cueCount: template.previewCues.length,
    resolvableCueCount: resolvableCueCount(template.previewCues, resolutionKeys),
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
    throwAdminTemplateReadError('listAdminShowPresetImportShows sources', sourceFailures);
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
    throwAdminTemplateReadError('listAdminShowPresetImportShows owners', usersError);
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

/** Returns cue-free public summaries, featured first then by sort order. Cached. */
export async function listShowTemplates(): Promise<ShowTemplateSummary[]> {
  const cacheKey = getShowTemplatesCacheKey();
  const cached = await getCachedJson<ShowTemplateSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  let result: { data: unknown[] | null; error: unknown } = await supabase
    .from('show_presets')
    .select(PUBLIC_SHOW_TEMPLATE_SUMMARIES_SELECT)
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  for (const select of PUBLIC_SHOW_TEMPLATE_SUMMARIES_FALLBACK_SELECTS) {
    if (!result.error || !isOptionalShowPresetSchemaError(result.error)) break;
    result = await supabase
      .from('show_presets')
      .select(select)
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true });
  }
  const data = result.data;
  const error: unknown = result.error;
  if (error) {
    const transient = isSupabaseTransientNetworkError(error);
    console.error('[admin.server] listShowTemplates failed:', { transient, error });
    throw new Error('Explore shows could not be loaded.');
  }
  const mapped = ((data ?? []) as ShowTemplateSummaryRow[]).map(mapShowTemplateSummary);
  await setCachedJson(cacheKey, mapped, SHOW_TEMPLATES_TTL_SECONDS);
  return mapped;
}

/** Return whether the signed-in user has saved this published Explore show. */
export async function getCurrentShowPresetLikeState(presetId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('show_preset_likes')
    .select('show_preset_id')
    .eq('show_preset_id', presetId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[admin.templates] get current preset like failed:', error);
    throw new Error('Saved-show state could not be loaded.');
  }
  return Boolean(data);
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
    throwAdminTemplateReadError('listAdminShowPresets', error);
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
    throwAdminTemplateReadError('getAdminShowPresetById', error);
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

/**
 * Returns one published cue-bearing template for preview, detail or cloning.
 * This deliberately bypasses the cue-free list cache.
 */
export async function getShowTemplateBySlug(slug: string): Promise<ShowTemplate | null> {
  const supabase = await getServerClient();
  let result: { data: unknown | null; error: unknown } = await supabase
    .from('show_presets')
    .select(PUBLIC_SHOW_TEMPLATES_SELECT)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  for (const select of PUBLIC_SHOW_TEMPLATES_FALLBACK_SELECTS) {
    if (!result.error || !isOptionalShowPresetSchemaError(result.error)) break;
    result = await supabase
      .from('show_presets')
      .select(select)
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
  }
  const data: unknown = result.data;
  const error: unknown = result.error;
  if (error) {
    const transient = isSupabaseTransientNetworkError(error);
    console.error('[admin.server] getShowTemplateBySlug failed:', { transient, error });
    throw new Error('This Explore show could not be loaded.');
  }
  return data ? mapShowTemplate(data as ShowTemplateRow) : null;
}
