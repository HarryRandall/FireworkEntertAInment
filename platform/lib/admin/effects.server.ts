import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { AdminEffectDetail, AdminEffectSummary } from '@/lib/admin.types';
import type { Database, Json } from '@/lib/database.types';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminEffectCacheKey,
  getAdminEffectsCacheKey,
} from './cache-keys';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';

type BaseEffectRow = Pick<
  Database['public']['Tables']['firework_effects']['Row'],
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'family'
  | 'pattern_key'
  | 'model_json'
  | 'sort_order'
  | 'source'
  | 'updated_at'
> & {
  fireworks?: Array<{ id: string }> | null;
};

function mapBaseEffectSummary(row: BaseEffectRow): AdminEffectSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    family: row.family,
    patternKey: row.pattern_key,
    source: row.source,
    sortOrder: row.sort_order,
    variantCount: row.fireworks?.length ?? 0,
    preview: buildEffectPreview(row.model_json, {
      type: row.pattern_key,
      name: row.name,
    }),
    updatedAt: row.updated_at,
  };
}

function mapBaseEffectDetail(row: BaseEffectRow): AdminEffectDetail {
  return {
    ...mapBaseEffectSummary(row),
    modelJson: row.model_json as Json,
  };
}

/** Returns every colourless base effect for the admin effects browser. */
export async function listAdminEffects(): Promise<AdminEffectSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminEffectsCacheKey();
  const cached = await getCachedJson<AdminEffectSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('firework_effects')
    .select(
      'id, slug, name, description, family, pattern_key, model_json, sort_order, source, updated_at, fireworks(id)',
    )
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[admin.effects] listAdminEffects failed:', error);
    return [];
  }

  const mapped = ((data ?? []) as BaseEffectRow[]).map(mapBaseEffectSummary);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/** Returns one colourless base effect for editing its shared model. */
export async function getAdminEffectById(effectId: string): Promise<AdminEffectDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const cacheKey = getAdminEffectCacheKey(effectId);
  const cached = await getCachedJson<AdminEffectDetail>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('firework_effects')
    .select(
      'id, slug, name, description, family, pattern_key, model_json, sort_order, source, updated_at, fireworks(id)',
    )
    .eq('id', effectId)
    .maybeSingle();

  if (error) {
    console.error('[admin.effects] getAdminEffectById failed:', error);
    return null;
  }
  if (!data) return null;

  const mapped = mapBaseEffectDetail(data as BaseEffectRow);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
