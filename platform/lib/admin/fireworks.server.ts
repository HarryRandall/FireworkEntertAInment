import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { AdminFireworkSummary } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import { ADMIN_CACHE_TTL_SECONDS, getAdminFireworksCacheKey } from './cache-keys';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';

type EffectShotRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  duration_seconds: number | null;
  height_meters: number | null;
  spec_json: Json;
};

type ProductWithShotsRow = {
  id: string;
  part_number: string;
  name: string;
  manufacturer: string | null;
  subtype: string | null;
  description: string | null;
  duration_seconds: number | null;
  updated_at: string;
  product_shots: Array<{
    shot_index: number;
    caliber: string | null;
    effect_specs: EffectShotRow | EffectShotRow[] | null;
  }> | null;
};

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function numberOrZero(value: number | string | null | undefined): number {
  return numberOrNull(value) ?? 0;
}

function firstEffect(effect: EffectShotRow | EffectShotRow[] | null | undefined) {
  if (!effect) return null;
  return Array.isArray(effect) ? (effect[0] ?? null) : effect;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function mapFirework(row: ProductWithShotsRow): AdminFireworkSummary {
  const shots = [...(row.product_shots ?? [])].sort((a, b) => a.shot_index - b.shot_index);
  const effects = shots
    .map((shot) => firstEffect(shot.effect_specs))
    .filter((effect): effect is EffectShotRow => Boolean(effect));
  const uniqueEffects = new Map(effects.map((effect) => [effect.id, effect]));
  const primaryEffect = effects[0] ?? null;

  return {
    id: row.id,
    partNumber: row.part_number,
    name: row.name,
    manufacturer: row.manufacturer,
    fireworkType: row.subtype,
    description: row.description,
    durationSeconds: numberOrNull(row.duration_seconds),
    shotCount: shots.length,
    calibers: unique(shots.map((shot) => shot.caliber ?? '')),
    effectNames: unique(effects.map((effect) => effect.name)),
    effectTypes: unique(effects.map((effect) => effect.type)),
    preview: buildEffectPreview(primaryEffect?.spec_json ?? null, {
      type: primaryEffect?.type ?? row.subtype,
      name: primaryEffect?.name ?? row.name,
    }),
    effects: [...uniqueEffects.values()]
      .map((effect) => ({
        id: effect.id,
        slug: effect.slug,
        name: effect.name,
        type: effect.type,
        durationSeconds: numberOrZero(effect.duration_seconds),
        heightMeters: numberOrNull(effect.height_meters),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    updatedAt: row.updated_at,
  };
}

/** Returns product-level fireworks joined to their shot/effect definitions. */
export async function listAdminFireworks(): Promise<AdminFireworkSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminFireworksCacheKey();
  const cached = await getCachedJson<AdminFireworkSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, part_number, name, manufacturer, subtype, description, duration_seconds, updated_at,
       product_shots (
         shot_index,
         caliber,
         effect_specs (id, slug, name, type, duration_seconds, height_meters, spec_json)
       )`,
    )
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[admin.fireworks] listAdminFireworks failed:', error);
    return [];
  }

  const mapped = ((data ?? []) as ProductWithShotsRow[]).map(mapFirework);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
