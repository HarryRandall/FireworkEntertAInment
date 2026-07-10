import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { AdminEffectDetail, AdminEffectSummary } from '@/lib/admin.types';
import type { Database, Json } from '@/lib/database.types';
import { emptyStyleDefaultIdMap } from '@/lib/fireworks/style-defaults';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminEffectCacheKey,
  getAdminEffectsCacheKey,
} from './cache-keys';
import { listEffectEditorVersions } from './editor-versions.server';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { describeSupabaseError, isMissingStyleDefaultSchemaError } from './style-default-schema';
import { listAdminStyleDefaultOptions } from './style-defaults.server';
import { getServerClient } from './supabase';

type ServerClient = Awaited<ReturnType<typeof getServerClient>>;

type BaseEffectRow = Pick<
  Database['public']['Tables']['firework_effects']['Row'],
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
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
    patternKey: row.pattern_key,
    source: row.source,
    sortOrder: row.sort_order,
    variantCount: row.fireworks?.length ?? 0,
    starStyleDefaultId: null,
    trailStyleDefaultId: null,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    preview: buildEffectPreview(row.model_json, {
      pattern: row.pattern_key,
      name: row.name,
    }),
    updatedAt: row.updated_at,
  };
}

function mapBaseEffectDetail(row: BaseEffectRow): AdminEffectDetail {
  return {
    ...mapBaseEffectSummary(row),
    modelJson: row.model_json as Json,
    starStyleDefault: null,
    trailStyleDefault: null,
    styleDefaultLinks: {},
    styleDefaultIds: emptyStyleDefaultIdMap(),
    styleDefaults: {
      star: [],
      trail: [],
      launch: [],
      smoke: [],
      strobe: [],
      crackle: [],
      split: [],
      sound: [],
    },
    history: [],
  };
}

const BASE_EFFECT_SELECT =
  'id, slug, name, description, pattern_key, model_json, sort_order, source, updated_at, fireworks(id)';
const LEGACY_BASE_EFFECT_SELECT =
  'id, slug, name, description, pattern_key, model_json, sort_order, source, updated_at, fireworks(id)';

async function selectBaseEffects(supabase: ServerClient) {
  const result = await supabase
    .from('firework_effects')
    .select(BASE_EFFECT_SELECT)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!isMissingStyleDefaultSchemaError(result.error)) return result;

  return supabase
    .from('firework_effects')
    .select(LEGACY_BASE_EFFECT_SELECT)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
}

async function selectBaseEffectById(supabase: ServerClient, effectId: string) {
  const result = await supabase
    .from('firework_effects')
    .select(BASE_EFFECT_SELECT)
    .eq('id', effectId)
    .maybeSingle();

  if (!isMissingStyleDefaultSchemaError(result.error)) return result;

  return supabase
    .from('firework_effects')
    .select(LEGACY_BASE_EFFECT_SELECT)
    .eq('id', effectId)
    .maybeSingle();
}

/** Returns every colourless base effect for the admin effects browser. */
export async function listAdminEffects(): Promise<AdminEffectSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminEffectsCacheKey();
  const cached = await getCachedJson<AdminEffectSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await selectBaseEffects(supabase);

  if (error) {
    console.error('[admin.effects] listAdminEffects failed:', describeSupabaseError(error));
    return [];
  }

  const rows = (data ?? []) as BaseEffectRow[];
  const mapped = rows.map(mapBaseEffectSummary);
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
  const { data, error } = await selectBaseEffectById(supabase, effectId);

  if (error) {
    console.error('[admin.effects] getAdminEffectById failed:', describeSupabaseError(error));
    return null;
  }
  if (!data) return null;

  const row = data as BaseEffectRow;
  const [styleDefaults, history] = await Promise.all([
    listAdminStyleDefaultOptions(),
    listEffectEditorVersions(supabase, row.id),
  ]);
  const mapped = {
    ...mapBaseEffectDetail(row),
    styleDefaults,
    history,
  };
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

async function selectBaseEffectBySlug(supabase: ServerClient, slug: string) {
  const result = await supabase
    .from('firework_effects')
    .select(BASE_EFFECT_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (!isMissingStyleDefaultSchemaError(result.error)) return result;

  return supabase
    .from('firework_effects')
    .select(LEGACY_BASE_EFFECT_SELECT)
    .eq('slug', slug)
    .maybeSingle();
}

/**
 * Returns one colourless base effect by slug. Used by the dev firework lab,
 * which keys effects by their catalogue slug and needs the live `updated_at`.
 */
export async function getAdminEffectBySlug(slug: string): Promise<AdminEffectDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const supabase = await getServerClient();
  const { data, error } = await selectBaseEffectBySlug(supabase, slug);

  if (error) {
    console.error('[admin.effects] getAdminEffectBySlug failed:', describeSupabaseError(error));
    return null;
  }
  if (!data) return null;

  const row = data as BaseEffectRow;
  const [styleDefaults, history] = await Promise.all([
    listAdminStyleDefaultOptions(),
    listEffectEditorVersions(supabase, row.id),
  ]);
  const mapped = {
    ...mapBaseEffectDetail(row),
    styleDefaults,
    history,
  };
  await setCachedJson(getAdminEffectCacheKey(row.id), mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
