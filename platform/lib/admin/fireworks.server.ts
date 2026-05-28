import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  AdminFireworkDetail,
  AdminFireworkSummary,
  AdminFireworkVariantOption,
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

type EffectShotRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  duration_seconds: number | null;
  height_meters: number | null;
  spec_json: Json;
};

type FireworkEffectRow = {
  id: string;
  name: string;
  slug: string;
  pattern_key: string;
};

type FireworkVariantRow = {
  id: string;
  slug: string;
  name: string;
  primary_color: string | null;
  secondary_color: string | null;
  source_effect_spec_id: string | null;
  firework_effects: FireworkEffectRow | FireworkEffectRow[] | null;
};

type ProductWithShotsRow = {
  id: string;
  part_number: string;
  name: string;
  manufacturer: string | null;
  subtype: string | null;
  product_kind: string;
  product_metadata?: Json;
  description: string | null;
  duration_seconds: number | null;
  updated_at: string;
  product_shots: Array<{
    id?: string;
    shot_index: number;
    time_offset_seconds?: number;
    pan_degrees?: number;
    tilt_degrees?: number;
    caliber: string | null;
    shot_notes?: string | null;
    firework_variant_id?: string | null;
    effect_spec_id?: string | null;
    firework_variants?: FireworkVariantRow | FireworkVariantRow[] | null;
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

function firstVariant(variant: FireworkVariantRow | FireworkVariantRow[] | null | undefined) {
  if (!variant) return null;
  return Array.isArray(variant) ? (variant[0] ?? null) : variant;
}

function firstBaseEffect(
  effect: FireworkEffectRow | FireworkEffectRow[] | null | undefined,
): FireworkEffectRow | null {
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
  const variants = shots
    .map((shot) => firstVariant(shot.firework_variants))
    .filter((variant): variant is FireworkVariantRow => Boolean(variant));
  const uniqueEffects = new Map(effects.map((effect) => [effect.id, effect]));
  const primaryEffect = effects[0] ?? null;
  const primaryVariant = variants[0] ?? null;
  const primaryBaseEffect = firstBaseEffect(primaryVariant?.firework_effects);

  return {
    id: row.id,
    partNumber: row.part_number,
    name: row.name,
    manufacturer: row.manufacturer,
    productKind: row.product_kind,
    fireworkType: row.subtype,
    description: row.description,
    durationSeconds: numberOrNull(row.duration_seconds),
    shotCount: shots.length,
    calibers: unique(shots.map((shot) => shot.caliber ?? '')),
    effectNames: unique([
      ...variants.map((variant) => variant.name),
      ...effects.map((effect) => effect.name),
    ]),
    effectTypes: unique([
      ...variants
        .map((variant) => firstBaseEffect(variant.firework_effects)?.name ?? '')
        .filter(Boolean),
      ...effects.map((effect) => effect.type),
    ]),
    preview: buildEffectPreview(primaryEffect?.spec_json ?? null, {
      type: primaryBaseEffect?.name ?? primaryEffect?.type ?? row.subtype,
      name: primaryVariant?.name ?? primaryEffect?.name ?? row.name,
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

function mapVariantOption(row: FireworkVariantRow): AdminFireworkVariantOption {
  const effect = firstBaseEffect(row.firework_effects);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    primaryColor: row.primary_color,
    baseEffectName: effect?.name ?? 'Unknown effect',
    sourceEffectSpecId: row.source_effect_spec_id,
  };
}

function mapFireworkDetail(
  row: ProductWithShotsRow,
  variantOptions: AdminFireworkVariantOption[],
): AdminFireworkDetail {
  return {
    ...mapFirework(row),
    productMetadata: row.product_metadata ?? {},
    variantOptions,
    shots: [...(row.product_shots ?? [])]
      .sort((a, b) => a.shot_index - b.shot_index)
      .map((shot) => {
        const variant = firstVariant(shot.firework_variants);
        const baseEffect = firstBaseEffect(variant?.firework_effects);
        const legacyEffect = firstEffect(shot.effect_specs);
        return {
          id: shot.id ?? '',
          shotIndex: shot.shot_index,
          timeOffsetSeconds: numberOrZero(shot.time_offset_seconds),
          panDegrees: numberOrZero(shot.pan_degrees),
          tiltDegrees: numberOrZero(shot.tilt_degrees),
          caliber: shot.caliber,
          notes: shot.shot_notes ?? null,
          variantId: shot.firework_variant_id ?? variant?.id ?? null,
          effectSpecId: shot.effect_spec_id ?? legacyEffect?.id ?? null,
          variantName: variant?.name ?? legacyEffect?.name ?? null,
          variantSlug: variant?.slug ?? legacyEffect?.slug ?? null,
          primaryColor: variant?.primary_color ?? null,
          baseEffectName: baseEffect?.name ?? legacyEffect?.type ?? null,
        };
      }),
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
      `id, part_number, name, manufacturer, subtype, product_kind, description, duration_seconds, updated_at,
       product_shots (
         shot_index,
         caliber,
         firework_variants (id, slug, name, primary_color, secondary_color, source_effect_spec_id, firework_effects (id, slug, name, pattern_key)),
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

/** Returns one product-level firework with editable shot sequence details. */
export async function getAdminFireworkById(productId: string): Promise<AdminFireworkDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const cacheKey = getAdminFireworkCacheKey(productId);
  const cached = await getCachedJson<AdminFireworkDetail>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const [productResult, variantsResult] = await Promise.all([
    supabase
      .from('products')
      .select(
        `id, part_number, name, manufacturer, subtype, product_kind, product_metadata, description, duration_seconds, updated_at,
         product_shots (
           id,
           shot_index,
           time_offset_seconds,
           pan_degrees,
           tilt_degrees,
           caliber,
           shot_notes,
           firework_variant_id,
           effect_spec_id,
           firework_variants (id, slug, name, primary_color, secondary_color, source_effect_spec_id, firework_effects (id, slug, name, pattern_key)),
           effect_specs (id, slug, name, type, duration_seconds, height_meters, spec_json)
         )`,
      )
      .eq('id', productId)
      .maybeSingle(),
    supabase
      .from('firework_variants')
      .select(
        'id, slug, name, primary_color, secondary_color, source_effect_spec_id, firework_effects (id, slug, name, pattern_key)',
      )
      .order('name', { ascending: true }),
  ]);

  if (productResult.error) {
    console.error('[admin.fireworks] getAdminFireworkById failed:', productResult.error);
    return null;
  }
  if (variantsResult.error) {
    console.error('[admin.fireworks] variant options load failed:', variantsResult.error);
  }
  if (!productResult.data) return null;

  const variantOptions = ((variantsResult.data ?? []) as FireworkVariantRow[]).map(
    mapVariantOption,
  );
  const mapped = mapFireworkDetail(productResult.data as ProductWithShotsRow, variantOptions);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
