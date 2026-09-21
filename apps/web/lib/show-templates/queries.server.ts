/** Public and signed-in reads for published show templates. */
import 'server-only';

import { getCurrentUserId } from '@/lib/auth/current-user.server';
import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { ShowTemplateSummary } from '@/lib/show-template-summary';
import { isSupabaseTransientNetworkError } from '@/lib/supabase/errors';
import { getServerClient } from '@/lib/supabase/server-client';
import { getShowTemplatesCacheKey, SHOW_TEMPLATES_TTL_SECONDS } from './cache.server';
import {
  mapShowTemplate,
  mapShowTemplateSummary,
  type ShowTemplateRow,
  type ShowTemplateSummaryRow,
} from './mappers';
import {
  isOptionalShowPresetSchemaError,
  SHOW_TEMPLATE_SUMMARIES_CORE_SELECT,
  SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT,
  SHOW_TEMPLATES_CORE_SELECT,
} from './schema';
import type { ShowTemplate } from './types';

const SHOW_TEMPLATES_CORE_WITH_COVERS_SELECT = `${SHOW_TEMPLATES_CORE_SELECT}, cover_shader, cover_image_path`;
const PUBLIC_SHOW_TEMPLATES_SELECT = `${SHOW_TEMPLATES_CORE_SELECT}, cover_shader, cover_image_path, show_preset_like_counts(like_count)`;
const PUBLIC_SHOW_TEMPLATE_SUMMARIES_SELECT = `${SHOW_TEMPLATE_SUMMARIES_CORE_SELECT}, cover_shader, cover_image_path, show_preset_like_counts(like_count)`;
const PUBLIC_SHOW_TEMPLATES_FALLBACK_SELECTS = [
  SHOW_TEMPLATES_CORE_WITH_COVERS_SELECT,
  SHOW_TEMPLATES_CORE_SELECT,
] as const;
const PUBLIC_SHOW_TEMPLATE_SUMMARIES_FALLBACK_SELECTS = [
  `${SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT}, cover_shader, cover_image_path, show_preset_like_counts(like_count)`,
  `${SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT}, cover_shader, cover_image_path`,
  SHOW_TEMPLATE_SUMMARIES_LEGACY_CORE_SELECT,
] as const;

/** Returns cue-free public summaries, featured first then by sort order. */
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
  if (result.error) {
    const transient = isSupabaseTransientNetworkError(result.error);
    console.error('[show-templates] listShowTemplates failed:', {
      transient,
      error: result.error,
    });
    throw new Error('Explore shows could not be loaded.');
  }
  const mapped = ((result.data ?? []) as ShowTemplateSummaryRow[]).map(mapShowTemplateSummary);
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
    console.error('[show-templates] get current preset like failed:', error);
    throw new Error('Saved-show state could not be loaded.');
  }
  return Boolean(data);
}

/** Returns one published cue-bearing template for preview, detail or cloning. */
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
  if (result.error) {
    const transient = isSupabaseTransientNetworkError(result.error);
    console.error('[show-templates] getShowTemplateBySlug failed:', {
      transient,
      error: result.error,
    });
    throw new Error('This Explore show could not be loaded.');
  }
  return result.data ? mapShowTemplate(result.data as ShowTemplateRow) : null;
}
