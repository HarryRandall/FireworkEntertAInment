import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  AdminEffectOption,
  AdminFireworkDetail,
  AdminFireworkSummary,
  AdminStyleDefaultLinkMap,
  AdminStyleDefaultOption,
} from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import { orderedStyleDefaultValues } from '@/lib/fireworks/style-defaults';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminFireworkCacheKey,
  getAdminFireworksCacheKey,
} from './cache-keys';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { describeSupabaseError, isMissingStyleDefaultSchemaError } from './style-default-schema';
import {
  legacyStyleDefaultLinks,
  listAdminStyleDefaultOptions,
  loadEffectStyleDefaultLinkMap,
  loadFireworkStyleDefaultLinkMap,
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
  is_archived?: boolean | null;
};

type FireworkEffectRow = {
  id: string;
  name: string;
  slug: string;
  pattern_key: string;
  family?: string | null;
  model_json?: Json;
  star_style_default_id?: string | null;
  trail_style_default_id?: string | null;
  star_style_default?: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null;
  trail_style_default?: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null;
};

type FireworkRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  color_palette: string[] | null;
  caliber: string | null;
  duration_seconds: number | null;
  height_meters: number | null;
  render_overrides_json: Json;
  star_style_default_id?: string | null;
  trail_style_default_id?: string | null;
  updated_at: string;
  firework_effects: FireworkEffectRow | FireworkEffectRow[] | null;
  star_style_default?: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null;
  trail_style_default?: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null;
};

const FIREWORK_SELECT =
  'id, slug, name, description, primary_color, secondary_color, color_palette, caliber, duration_seconds, height_meters, render_overrides_json, star_style_default_id, trail_style_default_id, updated_at, firework_effects (id, slug, name, pattern_key, family, model_json, star_style_default_id, trail_style_default_id, star_style_default:firework_style_defaults!firework_effects_star_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived), trail_style_default:firework_style_defaults!firework_effects_trail_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived)), star_style_default:firework_style_defaults!fireworks_star_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived), trail_style_default:firework_style_defaults!fireworks_trail_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived)';
const LEGACY_FIREWORK_SELECT =
  'id, slug, name, description, primary_color, secondary_color, color_palette, caliber, duration_seconds, height_meters, render_overrides_json, updated_at, firework_effects (id, slug, name, pattern_key, family, model_json)';
const EFFECT_OPTIONS_SELECT =
  'id, slug, name, pattern_key, family, model_json, star_style_default_id, trail_style_default_id, star_style_default:firework_style_defaults!firework_effects_star_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived), trail_style_default:firework_style_defaults!firework_effects_trail_style_default_id_fkey(id, kind, name, description, defaults_json, is_archived)';
const LEGACY_EFFECT_OPTIONS_SELECT = 'id, slug, name, pattern_key, family, model_json';

function firstEffect(
  effect: FireworkEffectRow | FireworkEffectRow[] | null | undefined,
): FireworkEffectRow | null {
  if (!effect) return null;
  return Array.isArray(effect) ? (effect[0] ?? null) : effect;
}

function firstStyleDefault(
  value: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null | undefined,
): StyleDefaultLinkRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function styleDefaultObject(
  value: StyleDefaultLinkRow | StyleDefaultLinkRow[] | null | undefined,
): Record<string, unknown> {
  const row = firstStyleDefault(value);
  const defaults = row?.defaults_json;
  return typeof defaults === 'object' && defaults !== null && !Array.isArray(defaults)
    ? (defaults as Record<string, unknown>)
    : {};
}

function optionDefaultObject(
  option: AdminStyleDefaultOption | null | undefined,
): Record<string, unknown> {
  const defaults = option?.defaultsJson;
  return typeof defaults === 'object' && defaults !== null && !Array.isArray(defaults)
    ? (defaults as Record<string, unknown>)
    : {};
}

function linkedDefaultObject(links: AdminStyleDefaultLinkMap): Record<string, unknown> {
  return Object.assign({}, ...orderedStyleDefaultValues(links).map(optionDefaultObject));
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function mapSummary(
  row: FireworkRow,
  effectLinkOverrides: AdminStyleDefaultLinkMap = {},
  fireworkLinkOverrides: AdminStyleDefaultLinkMap = {},
): AdminFireworkSummary {
  const effect = firstEffect(row.firework_effects);
  const palette = Array.isArray(row.color_palette) ? row.color_palette : [];
  const legacyEffectLinks = legacyStyleDefaultLinks({
    star: mapStyleDefaultOption(firstStyleDefault(effect?.star_style_default)),
    trail: mapStyleDefaultOption(firstStyleDefault(effect?.trail_style_default)),
  });
  const legacyFireworkLinks = legacyStyleDefaultLinks({
    star: mapStyleDefaultOption(firstStyleDefault(row.star_style_default)),
    trail: mapStyleDefaultOption(firstStyleDefault(row.trail_style_default)),
  });
  const effectStyleDefaultLinks = { ...legacyEffectLinks, ...effectLinkOverrides };
  const fireworkStyleDefaultLinks = { ...legacyFireworkLinks, ...fireworkLinkOverrides };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    caliber: row.caliber,
    durationSeconds: numberOrNull(row.duration_seconds),
    heightMeters: numberOrNull(row.height_meters),
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    colorPalette: palette,
    effectId: effect?.id ?? null,
    effectName: effect?.name ?? null,
    effectSlug: effect?.slug ?? null,
    patternKey: effect?.pattern_key ?? null,
    starStyleDefaultId: fireworkStyleDefaultLinks.star?.id ?? row.star_style_default_id ?? null,
    trailStyleDefaultId: fireworkStyleDefaultLinks.trail?.id ?? row.trail_style_default_id ?? null,
    styleDefaultIds: styleDefaultIdMapFromLinks(fireworkStyleDefaultLinks),
    preview: buildEffectPreview(
      {
        ...styleDefaultObject(effect?.star_style_default),
        ...styleDefaultObject(effect?.trail_style_default),
        ...linkedDefaultObject(effectStyleDefaultLinks),
        ...(typeof effect?.model_json === 'object' && effect?.model_json ? effect.model_json : {}),
        ...styleDefaultObject(row.star_style_default),
        ...styleDefaultObject(row.trail_style_default),
        ...linkedDefaultObject(fireworkStyleDefaultLinks),
        color: row.primary_color ?? undefined,
        colorPalette: palette.length ? palette : undefined,
      } as Json,
      { type: effect?.name ?? null, name: row.name },
    ),
    updatedAt: row.updated_at,
  };
}

async function selectFireworks(supabase: ServerClient) {
  const result = await supabase
    .from('fireworks')
    .select(FIREWORK_SELECT)
    .order('name', { ascending: true })
    .limit(500);

  if (!isMissingStyleDefaultSchemaError(result.error)) return result;

  return supabase
    .from('fireworks')
    .select(LEGACY_FIREWORK_SELECT)
    .order('name', { ascending: true })
    .limit(500);
}

async function selectFireworkById(supabase: ServerClient, fireworkId: string) {
  const result = await supabase
    .from('fireworks')
    .select(FIREWORK_SELECT)
    .eq('id', fireworkId)
    .maybeSingle();

  if (!isMissingStyleDefaultSchemaError(result.error)) return result;

  return supabase
    .from('fireworks')
    .select(LEGACY_FIREWORK_SELECT)
    .eq('id', fireworkId)
    .maybeSingle();
}

async function selectEffectOptions(supabase: ServerClient) {
  const result = await supabase
    .from('firework_effects')
    .select(EFFECT_OPTIONS_SELECT)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!isMissingStyleDefaultSchemaError(result.error)) return result;

  return supabase
    .from('firework_effects')
    .select(LEGACY_EFFECT_OPTIONS_SELECT)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
}

/** Lists every atomic firework with its base effect for the admin table. */
export async function listAdminFireworks(): Promise<AdminFireworkSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminFireworksCacheKey();
  const cached = await getCachedJson<AdminFireworkSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await selectFireworks(supabase);

  if (error) {
    console.error('[admin.fireworks] listAdminFireworks failed:', describeSupabaseError(error));
    return [];
  }

  const rows = (data ?? []) as FireworkRow[];
  const effectIds = rows
    .map((row) => firstEffect(row.firework_effects)?.id)
    .filter((id): id is string => Boolean(id));
  const [effectLinkMap, fireworkLinkMap] = await Promise.all([
    loadEffectStyleDefaultLinkMap(supabase, effectIds),
    loadFireworkStyleDefaultLinkMap(
      supabase,
      rows.map((row) => row.id),
    ),
  ]);
  const mapped = rows.map((row) => {
    const effect = firstEffect(row.firework_effects);
    return mapSummary(row, effectLinkMap[effect?.id ?? ''] ?? {}, fireworkLinkMap[row.id] ?? {});
  });
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/** Every base effect, ordered for the firework "base effect" selector. */
export async function listEffectOptions(): Promise<AdminEffectOption[]> {
  const { options } = await loadEffectOptionsAndModels();
  return options;
}

/** Base-effect options plus a map of effect id to `model_json` for previews. */
async function loadEffectOptionsAndModels(): Promise<{
  options: AdminEffectOption[];
  models: Record<string, Json>;
  starStyleDefaults: Record<string, AdminStyleDefaultOption | null>;
  trailStyleDefaults: Record<string, AdminStyleDefaultOption | null>;
  styleDefaultLinksByEffect: Record<string, AdminStyleDefaultLinkMap>;
}> {
  const supabase = await getServerClient();
  const { data, error } = await selectEffectOptions(supabase);
  if (error) {
    console.error(
      '[admin.fireworks] loadEffectOptionsAndModels failed:',
      describeSupabaseError(error),
    );
    return {
      options: [],
      models: {},
      starStyleDefaults: {},
      trailStyleDefaults: {},
      styleDefaultLinksByEffect: {},
    };
  }
  const rows = (data ?? []) as FireworkEffectRow[];
  const linkMap = await loadEffectStyleDefaultLinkMap(
    supabase,
    rows.map((row) => row.id),
  );
  const options = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    patternKey: row.pattern_key,
    family: row.family ?? 'aerial_burst',
  }));
  const models: Record<string, Json> = {};
  const starStyleDefaults: Record<string, AdminStyleDefaultOption | null> = {};
  const trailStyleDefaults: Record<string, AdminStyleDefaultOption | null> = {};
  const styleDefaultLinksByEffect: Record<string, AdminStyleDefaultLinkMap> = {};
  for (const row of rows) {
    models[row.id] = (row.model_json ?? {}) as Json;
    const legacyLinks = legacyStyleDefaultLinks({
      star: mapStyleDefaultOption(firstStyleDefault(row.star_style_default)),
      trail: mapStyleDefaultOption(firstStyleDefault(row.trail_style_default)),
    });
    const links = { ...legacyLinks, ...(linkMap[row.id] ?? {}) };
    styleDefaultLinksByEffect[row.id] = links;
    starStyleDefaults[row.id] = links.star ?? null;
    trailStyleDefaults[row.id] = links.trail ?? null;
  }
  return { options, models, starStyleDefaults, trailStyleDefaults, styleDefaultLinksByEffect };
}

/** One atomic firework plus its base-effect model and the effect options. */
export async function getAdminFireworkById(
  fireworkId: string,
): Promise<AdminFireworkDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const cacheKey = getAdminFireworkCacheKey(fireworkId);
  const cached = await getCachedJson<AdminFireworkDetail>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const [fireworkResult, effectData] = await Promise.all([
    selectFireworkById(supabase, fireworkId),
    loadEffectOptionsAndModels(),
  ]);

  if (fireworkResult.error) {
    console.error(
      '[admin.fireworks] getAdminFireworkById failed:',
      describeSupabaseError(fireworkResult.error),
    );
    return null;
  }
  if (!fireworkResult.data) return null;

  const row = fireworkResult.data as FireworkRow;
  const effect = firstEffect(row.firework_effects);
  const [fireworkLinkMap] = await Promise.all([
    loadFireworkStyleDefaultLinkMap(supabase, [row.id]),
  ]);
  const legacyEffectLinks = legacyStyleDefaultLinks({
    star: mapStyleDefaultOption(firstStyleDefault(effect?.star_style_default)),
    trail: mapStyleDefaultOption(firstStyleDefault(effect?.trail_style_default)),
  });
  const legacyFireworkLinks = legacyStyleDefaultLinks({
    star: mapStyleDefaultOption(firstStyleDefault(row.star_style_default)),
    trail: mapStyleDefaultOption(firstStyleDefault(row.trail_style_default)),
  });
  const effectStyleDefaultLinks = {
    ...legacyEffectLinks,
    ...(effectData.styleDefaultLinksByEffect[effect?.id ?? ''] ?? {}),
  };
  const fireworkStyleDefaultLinks = {
    ...legacyFireworkLinks,
    ...(fireworkLinkMap[row.id] ?? {}),
  };
  const detail: AdminFireworkDetail = {
    ...mapSummary(row, effectStyleDefaultLinks, fireworkStyleDefaultLinks),
    renderOverridesJson: row.render_overrides_json ?? {},
    effectModelJson: (effect?.model_json ?? effectData.models[effect?.id ?? ''] ?? {}) as Json,
    effectStarStyleDefault: effectStyleDefaultLinks.star ?? null,
    effectTrailStyleDefault: effectStyleDefaultLinks.trail ?? null,
    fireworkStarStyleDefault: fireworkStyleDefaultLinks.star ?? null,
    fireworkTrailStyleDefault: fireworkStyleDefaultLinks.trail ?? null,
    effectStyleDefaultLinks,
    fireworkStyleDefaultLinks,
    styleDefaults: await listAdminStyleDefaultOptions(),
    effectOptions: effectData.options,
    effectModels: effectData.models,
    effectStarStyleDefaults: effectData.starStyleDefaults,
    effectTrailStyleDefaults: effectData.trailStyleDefaults,
    effectStyleDefaultLinksByEffect: effectData.styleDefaultLinksByEffect,
  };
  await setCachedJson(cacheKey, detail, ADMIN_CACHE_TTL_SECONDS);
  return detail;
}
