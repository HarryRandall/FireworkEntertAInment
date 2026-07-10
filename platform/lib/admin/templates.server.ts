/**
 * Show-template reads.
 *
 * Templates are public (no permission gate), they're the curated examples
 * the marketing site and "create show" wizard show off. The list TTL is
 * longer ({@link SHOW_TEMPLATES_TTL_SECONDS}) since templates change rarely.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  AdminShowPresetDetail,
  AdminShowPresetImportShow,
  AdminShowPresetSummary,
  ShowTemplate,
  ShowTemplateCue,
} from '@/lib/admin.types';
import { mergeSeededLibraryTemplates } from '@/lib/library-seed-templates';
import { listFireworkProducts } from '@/lib/shows.server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import { isSupabaseTransientNetworkError } from '@/utils/supabase/errors';
import { getShowTemplatesCacheKey, SHOW_TEMPLATES_TTL_SECONDS } from './cache-keys';
import { requirePermission } from './current-user.server';
import { mapShowTemplate, type ShowTemplateRow } from './mappers';
import { describeSupabaseError } from './style-default-schema';
import { getServerClient } from './supabase';

const SHOW_TEMPLATES_BASE_SELECT =
  'id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, is_published, published_at, sort_order, created_at, updated_at';
const SHOW_TEMPLATES_LEGACY_SELECT = SHOW_TEMPLATES_BASE_SELECT.replace(
  ', is_published, published_at',
  '',
);
const SHOW_TEMPLATES_SELECT = `${SHOW_TEMPLATES_BASE_SELECT}, cover_shader, cover_image_path`;

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' ? (error as { code?: string }).code : undefined;
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object'
    ? String((error as { message?: string | null }).message ?? '')
    : '';
}

function isMissingCoverShaderError(error: unknown): boolean {
  const message = errorMessage(error);
  return Boolean(error && (errorCode(error) === '42703' || message.includes('cover_shader')));
}

function isMissingPublicationColumnsError(error: unknown): boolean {
  const message = errorMessage(error);
  return Boolean(
    error &&
    (errorCode(error) === '42703' ||
      errorCode(error) === 'PGRST204' ||
      message.includes('is_published') ||
      message.includes('published_at')),
  );
}

async function selectShowPresetsForAdmin(supabase: Awaited<ReturnType<typeof getServerClient>>) {
  const primary = await supabase
    .from('show_presets')
    .select(SHOW_TEMPLATES_SELECT)
    .order('is_published', { ascending: false })
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  if (!primary.error) return primary;

  if (
    isMissingCoverShaderError(primary.error) &&
    !isMissingPublicationColumnsError(primary.error)
  ) {
    return supabase
      .from('show_presets')
      .select(SHOW_TEMPLATES_BASE_SELECT)
      .order('is_published', { ascending: false })
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true });
  }

  if (isMissingPublicationColumnsError(primary.error)) {
    return supabase
      .from('show_presets')
      .select(SHOW_TEMPLATES_LEGACY_SELECT)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true });
  }

  return primary;
}

async function selectShowPresetByIdForAdmin(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  presetId: string,
) {
  const primary = await supabase
    .from('show_presets')
    .select(SHOW_TEMPLATES_SELECT)
    .eq('id', presetId)
    .maybeSingle();
  if (!primary.error) return primary;

  if (
    isMissingCoverShaderError(primary.error) &&
    !isMissingPublicationColumnsError(primary.error)
  ) {
    return supabase
      .from('show_presets')
      .select(SHOW_TEMPLATES_BASE_SELECT)
      .eq('id', presetId)
      .maybeSingle();
  }

  if (isMissingPublicationColumnsError(primary.error)) {
    return supabase
      .from('show_presets')
      .select(SHOW_TEMPLATES_LEGACY_SELECT)
      .eq('id', presetId)
      .maybeSingle();
  }

  return primary;
}

function cueResolutionKeys(cue: ShowTemplateCue): string[] {
  return [cue.catalogueItemId ?? '', cue.catalogueItemSlug ?? '', cue.fireworkSlug ?? ''].filter(
    Boolean,
  );
}

async function resolvableCueCount(cues: ShowTemplateCue[]): Promise<number> {
  const products = await listFireworkProducts({ lightweight: true });
  const keys = new Set<string>();
  for (const product of products) {
    keys.add(product.id);
    keys.add(product.slug);
  }
  return cues.filter((cue) => cueResolutionKeys(cue).some((key) => keys.has(key))).length;
}

async function mapAdminSummary(row: ShowTemplateRow): Promise<AdminShowPresetSummary> {
  const template = mapShowTemplate(row);
  return {
    ...template,
    cueCount: template.previewCues.length,
    resolvableCueCount: await resolvableCueCount(template.previewCues),
  };
}

export async function listAdminShowPresetImportShows(): Promise<AdminShowPresetImportShow[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const service = createServiceRoleSupabase();
  if (!service) return [];

  const { data: shows, error } = await service
    .from('shows')
    .select(
      'id, user_id, slug, title, duration_seconds, effects_count, total_cents, generation_status, updated_at',
    )
    .eq('generation_status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[admin.templates] listImportableGeneratedShows failed:', error);
    return [];
  }

  const userIds = Array.from(new Set((shows ?? []).map((show) => show.user_id).filter(Boolean)));
  const { data: users } = userIds.length
    ? await service.from('users').select('id, email').in('id', userIds)
    : { data: [] };
  const emailByUserId = new Map((users ?? []).map((user) => [user.id, user.email]));

  return (shows ?? []).map((show) => ({
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

/** Returns all show templates, featured first then by sort order. Cached. */
export async function listShowTemplates(): Promise<ShowTemplate[]> {
  const cacheKey = getShowTemplatesCacheKey();
  const cached = await getCachedJson<ShowTemplate[]>(cacheKey);
  if (cached) return mergeSeededLibraryTemplates(cached);

  const supabase = await getServerClient();
  const primary = await supabase
    .from('show_presets')
    .select(SHOW_TEMPLATES_SELECT)
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  let data: unknown[] | null = primary.data;
  let error: unknown = primary.error;
  if (
    isMissingCoverShaderError(primary.error) &&
    !isMissingPublicationColumnsError(primary.error)
  ) {
    const fallback = await supabase
      .from('show_presets')
      .select(SHOW_TEMPLATES_BASE_SELECT)
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true });
    data = fallback.data as unknown[] | null;
    error = fallback.error;
  } else if (isMissingPublicationColumnsError(primary.error)) {
    const fallback = await supabase
      .from('show_presets')
      .select(SHOW_TEMPLATES_LEGACY_SELECT)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true });
    data = fallback.data as unknown[] | null;
    error = fallback.error;
  }
  if (error) {
    if (!isSupabaseTransientNetworkError(error)) {
      console.error('[admin.server] listShowTemplates failed:', error);
    }
    return mergeSeededLibraryTemplates([]);
  }
  const mapped = mergeSeededLibraryTemplates(
    ((data ?? []) as ShowTemplateRow[]).map(mapShowTemplate),
  );
  await setCachedJson(cacheKey, mapped, SHOW_TEMPLATES_TTL_SECONDS);
  return mapped;
}

/** Admin list: includes drafts and does not merge non-editable fallback seeds. */
export async function listAdminShowPresets(): Promise<AdminShowPresetSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const supabase = await getServerClient();
  const { data, error } = await selectShowPresetsForAdmin(supabase);

  if (error) {
    console.error('[admin.templates] listAdminShowPresets failed:', describeSupabaseError(error));
    return [];
  }

  return Promise.all(((data ?? []) as ShowTemplateRow[]).map(mapAdminSummary));
}

/** Admin detail: one preset plus catalogue and import source data for the editor. */
export async function getAdminShowPresetById(
  presetId: string,
): Promise<AdminShowPresetDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const supabase = await getServerClient();
  const { data, error } = await selectShowPresetByIdForAdmin(supabase, presetId);
  if (error) {
    console.error('[admin.templates] getAdminShowPresetById failed:', describeSupabaseError(error));
    return null;
  }
  if (!data) return null;

  const [summary, products, importableShows] = await Promise.all([
    mapAdminSummary(data as ShowTemplateRow),
    listFireworkProducts(),
    listAdminShowPresetImportShows(),
  ]);

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
 * Returns a template by slug. Tries the cached list first, falls back to a
 * direct DB lookup so deep-links work even if the list cache is cold.
 */
export async function getShowTemplateBySlug(slug: string): Promise<ShowTemplate | null> {
  const cachedTemplates = await listShowTemplates();
  const cached = cachedTemplates.find((template) => template.slug === slug);
  if (cached) return cached;

  const supabase = await getServerClient();
  const primary = await supabase
    .from('show_presets')
    .select(SHOW_TEMPLATES_SELECT)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  let data: unknown = primary.data;
  let error: unknown = primary.error;
  if (
    isMissingCoverShaderError(primary.error) &&
    !isMissingPublicationColumnsError(primary.error)
  ) {
    const fallback = await supabase
      .from('show_presets')
      .select(SHOW_TEMPLATES_BASE_SELECT)
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  } else if (isMissingPublicationColumnsError(primary.error)) {
    const fallback = await supabase
      .from('show_presets')
      .select(SHOW_TEMPLATES_LEGACY_SELECT)
      .eq('slug', slug)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    if (!isSupabaseTransientNetworkError(error)) {
      console.error('[admin.server] getShowTemplateBySlug failed:', error);
    }
    return null;
  }
  return data ? mapShowTemplate(data as ShowTemplateRow) : null;
}
