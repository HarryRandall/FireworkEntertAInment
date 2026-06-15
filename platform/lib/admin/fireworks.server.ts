import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  AdminEffectOption,
  AdminFireworkDetail,
  AdminFireworkSummary,
} from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminFireworkCacheKey,
  getAdminFireworksCacheKey,
} from './cache-keys';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';

type FireworkEffectRow = {
  id: string;
  name: string;
  slug: string;
  pattern_key: string;
  family?: string | null;
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
};

const FIREWORK_SELECT =
  'id, slug, name, description, primary_color, secondary_color, color_palette, caliber, duration_seconds, height_meters, render_overrides_json, updated_at, firework_effects (id, slug, name, pattern_key, family, model_json)';

function firstEffect(
  effect: FireworkEffectRow | FireworkEffectRow[] | null | undefined,
): FireworkEffectRow | null {
  if (!effect) return null;
  return Array.isArray(effect) ? (effect[0] ?? null) : effect;
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
    preview: buildEffectPreview(
      {
        ...(typeof effect?.model_json === 'object' && effect?.model_json ? effect.model_json : {}),
        color: row.primary_color ?? undefined,
        colorPalette: palette.length ? palette : undefined,
      } as Json,
      { type: effect?.name ?? null, name: row.name },
    ),
    updatedAt: row.updated_at,
  };
}

/** Lists every atomic firework with its base effect for the admin table. */
export async function listAdminFireworks(): Promise<AdminFireworkSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminFireworksCacheKey();
  const cached = await getCachedJson<AdminFireworkSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('fireworks')
    .select(FIREWORK_SELECT)
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[admin.fireworks] listAdminFireworks failed:', error);
    return [];
  }

  const mapped = ((data ?? []) as FireworkRow[]).map(mapSummary);
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
}> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('firework_effects')
    .select('id, slug, name, pattern_key, family, model_json')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.error('[admin.fireworks] loadEffectOptionsAndModels failed:', error);
    return { options: [], models: {} };
  }
  const rows = (data ?? []) as FireworkEffectRow[];
  const options = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    patternKey: row.pattern_key,
    family: row.family ?? 'aerial_burst',
  }));
  const models: Record<string, Json> = {};
  for (const row of rows) models[row.id] = (row.model_json ?? {}) as Json;
  return { options, models };
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
    supabase.from('fireworks').select(FIREWORK_SELECT).eq('id', fireworkId).maybeSingle(),
    loadEffectOptionsAndModels(),
  ]);

  if (fireworkResult.error) {
    console.error('[admin.fireworks] getAdminFireworkById failed:', fireworkResult.error);
    return null;
  }
  if (!fireworkResult.data) return null;

  const row = fireworkResult.data as FireworkRow;
  const effect = firstEffect(row.firework_effects);
  const detail: AdminFireworkDetail = {
    ...mapSummary(row),
    renderOverridesJson: row.render_overrides_json ?? {},
    effectModelJson: (effect?.model_json ?? effectData.models[effect?.id ?? ''] ?? {}) as Json,
    effectOptions: effectData.options,
    effectModels: effectData.models,
  };
  await setCachedJson(cacheKey, detail, ADMIN_CACHE_TTL_SECONDS);
  return detail;
}
