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

type FireworkEffectRow = {
  id: string;
  name: string;
  slug: string;
  pattern_key: string;
};

type FireworkRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  caliber: string | null;
  duration_seconds: number | null;
  height_meters: number | null;
  render_overrides_json: Json;
  variant_json: Json;
  firework_effects: FireworkEffectRow | FireworkEffectRow[] | null;
};

type MultishotFireworkRow = {
  id?: string;
  sequence_index: number;
  time_offset_seconds?: number;
  pan_degrees?: number;
  tilt_degrees?: number;
  position_override_json?: Json | null;
  caliber: string | null;
  notes?: string | null;
  firework_id?: string | null;
  fireworks?: FireworkRow | FireworkRow[] | null;
};

type CatalogueItemWithVisualRow = {
  id: string;
  part_number: string;
  name: string;
  manufacturer: string | null;
  firework_type: string | null;
  catalogue_item_kind: string;
  metadata?: Json;
  description: string | null;
  duration_seconds: number | null;
  updated_at: string;
  fireworks: FireworkRow | FireworkRow[] | null;
  multishots: {
    id: string;
    shot_count: number;
    metadata?: Json;
    multishot_fireworks: MultishotFireworkRow[];
  } | null;
};

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function numberOrZero(value: number | string | null | undefined): number {
  return numberOrNull(value) ?? 0;
}

function firstFirework(firework: FireworkRow | FireworkRow[] | null | undefined) {
  if (!firework) return null;
  return Array.isArray(firework) ? (firework[0] ?? null) : firework;
}

function firstVariant(variant: FireworkRow | FireworkRow[] | null | undefined) {
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

function visualShots(row: CatalogueItemWithVisualRow): MultishotFireworkRow[] {
  const directFirework = firstFirework(row.fireworks);
  if (directFirework) {
    return [
      {
        id: row.id,
        sequence_index: 1,
        time_offset_seconds: 0,
        pan_degrees: 0,
        tilt_degrees: 0,
        caliber: directFirework.caliber ?? null,
        firework_id: directFirework.id,
        fireworks: directFirework,
      } as MultishotFireworkRow,
    ];
  }
  return [...(row.multishots?.multishot_fireworks ?? [])].sort(
    (a, b) => a.sequence_index - b.sequence_index,
  );
}

function mapFirework(row: CatalogueItemWithVisualRow): AdminFireworkSummary {
  const shots = visualShots(row);
  const variants = shots
    .map((shot) => firstVariant(shot.fireworks))
    .filter((variant): variant is FireworkRow => Boolean(variant));
  const uniqueEffects = new Map(
    variants.flatMap((variant) => {
      const effect = firstBaseEffect(variant.firework_effects);
      return effect ? [[effect.id, { effect, variant }] as const] : [];
    }),
  );
  const primaryVariant = variants[0] ?? null;
  const primaryBaseEffect = firstBaseEffect(primaryVariant?.firework_effects);

  return {
    id: row.id,
    partNumber: row.part_number,
    name: row.name,
    manufacturer: row.manufacturer,
    productKind: row.catalogue_item_kind,
    fireworkType: row.firework_type,
    description: row.description,
    durationSeconds: numberOrNull(row.duration_seconds),
    shotCount: shots.length,
    calibers: unique(shots.map((shot) => shot.caliber ?? '')),
    effectNames: unique(variants.map((variant) => variant.name)),
    effectTypes: unique([
      ...variants
        .map((variant) => firstBaseEffect(variant.firework_effects)?.name ?? '')
        .filter(Boolean),
    ]),
    preview: buildEffectPreview(primaryVariant?.render_overrides_json ?? null, {
      type: primaryBaseEffect?.name ?? row.firework_type,
      name: primaryVariant?.name ?? row.name,
    }),
    effects: [...uniqueEffects.values()]
      .map(({ effect, variant }) => ({
        id: effect.id,
        slug: effect.slug,
        name: effect.name,
        type: effect.name,
        durationSeconds: numberOrZero(variant.duration_seconds),
        heightMeters: numberOrNull(variant.height_meters),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    updatedAt: row.updated_at,
  };
}

function mapVariantOption(row: FireworkRow): AdminFireworkVariantOption {
  const effect = firstBaseEffect(row.firework_effects);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    primaryColor: row.primary_color,
    baseEffectName: effect?.name ?? 'Unknown effect',
  };
}

function mapFireworkDetail(
  row: CatalogueItemWithVisualRow,
  variantOptions: AdminFireworkVariantOption[],
): AdminFireworkDetail {
  return {
    ...mapFirework(row),
    productMetadata: row.metadata ?? {},
    variantOptions,
    shots: visualShots(row).map((shot) => {
      const variant = firstVariant(shot.fireworks);
      const baseEffect = firstBaseEffect(variant?.firework_effects);
      return {
        id: shot.id ?? '',
        shotIndex: shot.sequence_index,
        timeOffsetSeconds: numberOrZero(shot.time_offset_seconds),
        panDegrees: numberOrZero(shot.pan_degrees),
        tiltDegrees: numberOrZero(shot.tilt_degrees),
        caliber: shot.caliber,
        notes: shot.notes ?? null,
        variantId: shot.firework_id ?? variant?.id ?? null,
        variantName: variant?.name ?? null,
        variantSlug: variant?.slug ?? null,
        primaryColor: variant?.primary_color ?? null,
        baseEffectName: baseEffect?.name ?? null,
      };
    }),
  };
}

/** Returns catalogue items joined to their firework or multishot definitions. */
export async function listAdminFireworks(): Promise<AdminFireworkSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminFireworksCacheKey();
  const cached = await getCachedJson<AdminFireworkSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('catalogue_items')
    .select(
      `id, part_number, name, manufacturer, firework_type, catalogue_item_kind, description, duration_seconds, updated_at,
       fireworks (id, slug, name, description, primary_color, secondary_color, caliber, duration_seconds, height_meters, render_overrides_json, variant_json, firework_effects (id, slug, name, pattern_key)),
       multishots (
         id,
         shot_count,
         multishot_fireworks (
           sequence_index,
           caliber,
           fireworks (id, slug, name, description, primary_color, secondary_color, caliber, duration_seconds, height_meters, render_overrides_json, variant_json, firework_effects (id, slug, name, pattern_key))
         )
       )`,
    )
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[admin.fireworks] listAdminFireworks failed:', error);
    return [];
  }

  const mapped = ((data ?? []) as CatalogueItemWithVisualRow[]).map(mapFirework);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/** Returns one catalogue item with editable shot sequence details. */
export async function getAdminFireworkById(productId: string): Promise<AdminFireworkDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const cacheKey = getAdminFireworkCacheKey(productId);
  const cached = await getCachedJson<AdminFireworkDetail>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const [productResult, variantsResult] = await Promise.all([
    supabase
      .from('catalogue_items')
      .select(
        `id, part_number, name, manufacturer, firework_type, catalogue_item_kind, metadata, description, duration_seconds, updated_at,
         fireworks (id, slug, name, description, primary_color, secondary_color, caliber, duration_seconds, height_meters, render_overrides_json, variant_json, firework_effects (id, slug, name, pattern_key)),
         multishots (
           id,
           shot_count,
           metadata,
           multishot_fireworks (
             id,
             sequence_index,
             time_offset_seconds,
             pan_degrees,
             tilt_degrees,
             position_override_json,
             caliber,
             notes,
             firework_id,
             fireworks (id, slug, name, description, primary_color, secondary_color, caliber, duration_seconds, height_meters, render_overrides_json, variant_json, firework_effects (id, slug, name, pattern_key))
           )
         )`,
      )
      .eq('id', productId)
      .maybeSingle(),
    supabase
      .from('fireworks')
      .select(
        'id, slug, name, primary_color, secondary_color, firework_effects (id, slug, name, pattern_key)',
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

  const variantOptions = ((variantsResult.data ?? []) as FireworkRow[]).map(mapVariantOption);
  const mapped = mapFireworkDetail(
    productResult.data as CatalogueItemWithVisualRow,
    variantOptions,
  );
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
