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
import {
  resolveFireworkPreviewImage,
  type FireworkPreviewImageRelation,
} from '@/lib/firework-preview-image';
import { emptyStyleDefaultIdMap } from '@/lib/fireworks/style-defaults';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminFireworkCacheKey,
  getAdminFireworksCacheKey,
} from './cache-keys';
import { listFireworkEditorVersions } from './editor-versions.server';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { describeSupabaseError, isMissingStyleDefaultSchemaError } from './style-default-schema';
import { listAdminStyleDefaultOptions } from './style-defaults.server';
import { getServerClient } from './supabase';

type ServerClient = Awaited<ReturnType<typeof getServerClient>>;
type CachedAdminFireworkDetail = Omit<AdminFireworkDetail, 'history'>;

type FireworkEffectRow = {
  id: string;
  name: string;
  slug: string;
  pattern_key: string;
  type?: string | null;
  model_json?: Json;
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
  updated_at: string;
  firework_effects: FireworkEffectRow | FireworkEffectRow[] | null;
  firework_preview_images?: FireworkPreviewImageRelation;
};

const FIREWORK_SELECT =
  'id, slug, name, description, primary_color, secondary_color, color_palette, caliber, duration_seconds, height_meters, render_overrides_json, updated_at, firework_effects (id, slug, name, pattern_key, model_json), firework_preview_images(source_revision, renderer_version, storage_path)';
const LEGACY_FIREWORK_SELECT =
  'id, slug, name, description, primary_color, secondary_color, color_palette, caliber, duration_seconds, height_meters, render_overrides_json, updated_at, firework_effects (id, slug, name, pattern_key, model_json), firework_preview_images(source_revision, renderer_version, storage_path)';
const EFFECT_OPTIONS_SELECT = 'id, slug, name, pattern_key, model_json';
const LEGACY_EFFECT_OPTIONS_SELECT = 'id, slug, name, pattern_key, model_json';

function firstEffect(
  effect: FireworkEffectRow | FireworkEffectRow[] | null | undefined,
): FireworkEffectRow | null {
  if (!effect) return null;
  return Array.isArray(effect) ? (effect[0] ?? null) : effect;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function mapSummary(row: FireworkRow): AdminFireworkSummary {
  const effect = firstEffect(row.firework_effects);
  const palette = Array.isArray(row.color_palette) ? row.color_palette : [];
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
    starStyleDefaultId: null,
    trailStyleDefaultId: null,
    styleDefaultIds: emptyStyleDefaultIdMap(),
    preview: buildEffectPreview(
      {
        ...jsonObject(effect?.model_json),
        ...jsonObject(row.render_overrides_json),
        color: row.primary_color ?? undefined,
        colorPalette: palette.length ? palette : undefined,
      } as Json,
      { pattern: effect?.name ?? null, name: row.name },
    ),
    ...resolveFireworkPreviewImage(row.firework_preview_images),
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
  const mapped = rows.map(mapSummary);
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
  const options = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    patternKey: row.pattern_key,
  }));
  const models: Record<string, Json> = {};
  const starStyleDefaults: Record<string, AdminStyleDefaultOption | null> = {};
  const trailStyleDefaults: Record<string, AdminStyleDefaultOption | null> = {};
  const styleDefaultLinksByEffect: Record<string, AdminStyleDefaultLinkMap> = {};
  for (const row of rows) {
    models[row.id] = (row.model_json ?? {}) as Json;
    styleDefaultLinksByEffect[row.id] = {};
    starStyleDefaults[row.id] = null;
    trailStyleDefaults[row.id] = null;
  }
  return { options, models, starStyleDefaults, trailStyleDefaults, styleDefaultLinksByEffect };
}

/** One atomic firework plus its base-effect model and the effect options. */
export async function getAdminFireworkById(
  fireworkId: string,
): Promise<AdminFireworkDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const cacheKey = getAdminFireworkCacheKey(fireworkId);
  const supabase = await getServerClient();
  const cached = await getCachedJson<CachedAdminFireworkDetail>(cacheKey);
  if (cached) {
    return {
      ...cached,
      history: await listFireworkEditorVersions(supabase, fireworkId),
    };
  }

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
  const effectStyleDefaultLinks = effectData.styleDefaultLinksByEffect[effect?.id ?? ''] ?? {};
  const fireworkStyleDefaultLinks: AdminStyleDefaultLinkMap = {};
  const [styleDefaults, history] = await Promise.all([
    listAdminStyleDefaultOptions(),
    listFireworkEditorVersions(supabase, row.id),
  ]);
  const detail: CachedAdminFireworkDetail = {
    ...mapSummary(row),
    renderOverridesJson: row.render_overrides_json ?? {},
    effectModelJson: (effect?.model_json ?? effectData.models[effect?.id ?? ''] ?? {}) as Json,
    effectStarStyleDefault: effectStyleDefaultLinks.star ?? null,
    effectTrailStyleDefault: effectStyleDefaultLinks.trail ?? null,
    fireworkStarStyleDefault: fireworkStyleDefaultLinks.star ?? null,
    fireworkTrailStyleDefault: fireworkStyleDefaultLinks.trail ?? null,
    effectStyleDefaultLinks,
    fireworkStyleDefaultLinks,
    styleDefaults,
    effectOptions: effectData.options,
    effectModels: effectData.models,
    effectStarStyleDefaults: effectData.starStyleDefaults,
    effectTrailStyleDefaults: effectData.trailStyleDefaults,
    effectStyleDefaultLinksByEffect: effectData.styleDefaultLinksByEffect,
  };
  await setCachedJson(cacheKey, detail, ADMIN_CACHE_TTL_SECONDS);
  return { ...detail, history };
}
