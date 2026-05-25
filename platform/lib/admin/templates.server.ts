/**
 * Show-template reads.
 *
 * Templates are public (no permission gate) — they're the curated examples
 * the marketing site and "create show" wizard show off. The list TTL is
 * longer ({@link SHOW_TEMPLATES_TTL_SECONDS}) since templates change rarely.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { ShowTemplate } from '@/lib/admin.types';
import { PLATFORM_CACHE_PREFIX, SHOW_TEMPLATES_TTL_SECONDS } from './cache-keys';
import { mapShowTemplate, type ShowTemplateRow } from './mappers';
import { getServerClient } from './supabase';

const SHOW_TEMPLATES_CACHE_KEY = `${PLATFORM_CACHE_PREFIX}:show-templates`;
const SHOW_TEMPLATES_SELECT =
  'id, slug, title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, sort_order, created_at, updated_at';

/** Returns all show templates, featured first then by sort order. Cached. */
export async function listShowTemplates(): Promise<ShowTemplate[]> {
  const cached = await getCachedJson<ShowTemplate[]>(SHOW_TEMPLATES_CACHE_KEY);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('show_templates')
    .select(SHOW_TEMPLATES_SELECT)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[admin.server] listShowTemplates failed:', error);
    return [];
  }
  const mapped = ((data ?? []) as ShowTemplateRow[]).map(mapShowTemplate);
  await setCachedJson(SHOW_TEMPLATES_CACHE_KEY, mapped, SHOW_TEMPLATES_TTL_SECONDS);
  return mapped;
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
  const { data, error } = await supabase
    .from('show_templates')
    .select(SHOW_TEMPLATES_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('[admin.server] getShowTemplateBySlug failed:', error);
    return null;
  }
  return data ? mapShowTemplate(data as ShowTemplateRow) : null;
}
