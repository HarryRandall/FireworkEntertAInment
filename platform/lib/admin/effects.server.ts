import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { AdminEffectDetail, AdminEffectSummary } from '@/lib/admin.types';
import type { Database, Json } from '@/lib/database.types';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminEffectCacheKey,
  getAdminEffectsCacheKey,
} from './cache-keys';
import { listEffectEditorVersions } from './editor-versions.server';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { describeSupabaseError, isMissingStyleDefaultSchemaError } from './style-default-schema';
import {
  legacyStyleDefaultLinks,
  listAdminStyleDefaultOptions,
  loadEffectStyleDefaultLinkMap,
  mapStyleDefaultOption,
  styleDefaultIdMapFromLinks,
} from './style-defaults.server';
import { getServerClient } from './supabase';

type ServerClient = Awaited<ReturnType<typeof getServerClient>>;

type StyleDefaultLinkRow = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  defaults_json: Json;
  is_archived: boolean;
};

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
  | 'star_style_default_id'
  | 'trail_style_default_id'
  | 'updated_at'
> & {
  fireworks?: Array<{ id: string }> | null;
  star_style_default?: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null;
  trail_style_default?: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null;
};

function firstStyleDefault(
  value: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null | undefined,
): StyleDefaultLinkRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapBaseEffectSummary(row: BaseEffectRow): AdminEffectSummary {
  const starStyleDefault = mapStyleDefaultOption(firstStyleDefault(row.star_style_default));
  const trailStyleDefault = mapStyleDefaultOption(firstStyleDefault(row.trail_style_default));
  const styleDefaultLinks = legacyStyleDefaultLinks({
    star: starStyleDefault,
    trail: trailStyleDefault,
  });
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
    starStyleDefaultId: row.star_style_default_id ?? null,
    trailStyleDefaultId: row.trail_style_default_id ?? null,
    styleDefaultIds: styleDefaultIdMapFromLinks(styleDefaultLinks),
    preview: buildEffectPreview(row.model_json, {
      type: row.pattern_key,
      name: row.name,
    }),
    updatedAt: row.updated_at,
  };
}

function mapBaseEffectDetail(row: BaseEffectRow): AdminEffectDetail {
  const starStyleDefault = mapStyleDefaultOption(firstStyleDefault(row.star_style_default));
  const trailStyleDefault = mapStyleDefaultOption(firstStyleDefault(row.trail_style_default));
  const styleDefaultLinks = legacyStyleDefaultLinks({
    star: starStyleDefault,
    trail: trailStyleDefault,
  });
  return {
    ...mapBaseEffectSummary(row),
    modelJson: row.model_json as Json,
    starStyleDefault,
    trailStyleDefault,
    styleDefaultLinks,
    styleDefaultIds: styleDefaultIdMapFromLinks(styleDefaultLinks),
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
  'id, slug, name, description, family, pattern_key, model_json, sort_order, source, star_style_default_id, trail_style_default_id, updated_at, fireworks(id), star_style_default:firework_style_defaults!firework_effects_star_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived), trail_style_default:firework_style_defaults!firework_effects_trail_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived)';
const LEGACY_BASE_EFFECT_SELECT =
  'id, slug, name, description, family, pattern_key, model_json, sort_order, source, updated_at, fireworks(id)';

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
  const linkMap = await loadEffectStyleDefaultLinkMap(
    supabase,
    rows.map((row) => row.id),
  );
  const mapped = rows.map((row) => {
    const legacyLinks = legacyStyleDefaultLinks({
      star: mapStyleDefaultOption(firstStyleDefault(row.star_style_default)),
      trail: mapStyleDefaultOption(firstStyleDefault(row.trail_style_default)),
    });
    const styleDefaultLinks = { ...legacyLinks, ...(linkMap[row.id] ?? {}) };
    return {
      ...mapBaseEffectSummary(row),
      starStyleDefaultId: styleDefaultLinks.star?.id ?? row.star_style_default_id ?? null,
      trailStyleDefaultId: styleDefaultLinks.trail?.id ?? row.trail_style_default_id ?? null,
      styleDefaultIds: styleDefaultIdMapFromLinks(styleDefaultLinks),
    };
  });
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
  const legacyLinks = legacyStyleDefaultLinks({
    star: mapStyleDefaultOption(firstStyleDefault(row.star_style_default)),
    trail: mapStyleDefaultOption(firstStyleDefault(row.trail_style_default)),
  });
  const linkMap = await loadEffectStyleDefaultLinkMap(supabase, [row.id]);
  const styleDefaultLinks = { ...legacyLinks, ...(linkMap[row.id] ?? {}) };
  const [styleDefaults, history] = await Promise.all([
    listAdminStyleDefaultOptions(),
    listEffectEditorVersions(supabase, row.id),
  ]);
  const mapped = {
    ...mapBaseEffectDetail(row),
    starStyleDefault: styleDefaultLinks.star ?? null,
    trailStyleDefault: styleDefaultLinks.trail ?? null,
    starStyleDefaultId: styleDefaultLinks.star?.id ?? row.star_style_default_id ?? null,
    trailStyleDefaultId: styleDefaultLinks.trail?.id ?? row.trail_style_default_id ?? null,
    styleDefaultLinks,
    styleDefaultIds: styleDefaultIdMapFromLinks(styleDefaultLinks),
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
 * which keys effects by their catalogue slug and needs the live `updated_at`
 * plus existing style-default assignments so saves do not clobber links.
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
  const legacyLinks = legacyStyleDefaultLinks({
    star: mapStyleDefaultOption(firstStyleDefault(row.star_style_default)),
    trail: mapStyleDefaultOption(firstStyleDefault(row.trail_style_default)),
  });
  const linkMap = await loadEffectStyleDefaultLinkMap(supabase, [row.id]);
  const styleDefaultLinks = { ...legacyLinks, ...(linkMap[row.id] ?? {}) };
  const [styleDefaults, history] = await Promise.all([
    listAdminStyleDefaultOptions(),
    listEffectEditorVersions(supabase, row.id),
  ]);
  const mapped = {
    ...mapBaseEffectDetail(row),
    starStyleDefault: styleDefaultLinks.star ?? null,
    trailStyleDefault: styleDefaultLinks.trail ?? null,
    starStyleDefaultId: styleDefaultLinks.star?.id ?? row.star_style_default_id ?? null,
    trailStyleDefaultId: styleDefaultLinks.trail?.id ?? row.trail_style_default_id ?? null,
    styleDefaultLinks,
    styleDefaultIds: styleDefaultIdMapFromLinks(styleDefaultLinks),
    styleDefaults,
    history,
  };
  await setCachedJson(getAdminEffectCacheKey(row.id), mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
