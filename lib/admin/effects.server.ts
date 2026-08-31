import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { AdminEffectDetail, AdminEffectSummary } from '@/lib/admin.types';
import type { Database, Json } from '@/lib/database.types';
import {
  resolveFireworkPreviewImage,
  type FireworkPreviewImageRelation,
} from '@/lib/firework-preview-image';
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
type CachedAdminEffectDetail = Omit<AdminEffectDetail, 'history'>;

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
  firework_preview_images?: FireworkPreviewImageRelation;
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
    ...resolveFireworkPreviewImage(row.firework_preview_images),
    updatedAt: row.updated_at,
  };
}

function mapBaseEffectDetail(row: BaseEffectRow): CachedAdminEffectDetail {
  return {
    ...mapBaseEffectSummary(row),
    modelJson: row.model_json as Json,
    starStyleDefault: null,
    trailStyleDefault: null,
    styleDefaultLinks: {},
    styleDefaultIds: emptyStyleDefaultIdMap(),
    styleDefaults: {
      geometry: [],
      star: [],
      trail: [],
      launch: [],
      smoke: [],
      strobe: [],
      crackle: [],
      split: [],
      sound: [],
    },
  };
}

const BASE_EFFECT_SELECT =
  'id, slug, name, description, pattern_key, model_json, sort_order, source, updated_at, fireworks(id), firework_preview_images(source_revision, renderer_version, storage_path)';
const LEGACY_BASE_EFFECT_SELECT =
  'id, slug, name, description, pattern_key, model_json, sort_order, source, updated_at, fireworks(id), firework_preview_images(source_revision, renderer_version, storage_path)';

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
  const supabase = await getServerClient();
  const cached = await getCachedJson<CachedAdminEffectDetail>(cacheKey);
  if (cached) {
    return {
      ...cached,
      history: await listEffectEditorVersions(supabase, effectId),
    };
  }

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
  const mapped: CachedAdminEffectDetail = {
    ...mapBaseEffectDetail(row),
    styleDefaults,
  };
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return { ...mapped, history };
}
