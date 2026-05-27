import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { AdminEffectDetail, AdminEffectSummary, AdminLinkedProduct } from '@/lib/admin.types';
import type { Database, Json } from '@/lib/database.types';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminEffectCacheKey,
  getAdminEffectsCacheKey,
} from './cache-keys';
import { buildEffectPreview } from './effect-preview';
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';

type EffectRow = Pick<
  Database['public']['Tables']['effect_specs']['Row'],
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'type'
  | 'source'
  | 'confidence'
  | 'duration_seconds'
  | 'height_meters'
  | 'shot_count'
  | 'spec_json'
  | 'updated_at'
> & {
  product_shots?: Array<{ product_id: string | null }> | null;
};

type LinkedProductRow = {
  id: string;
  part_number: string;
  name: string;
  manufacturer: string | null;
  subtype: string | null;
  duration_seconds: number | null;
};

type EffectDetailRow = EffectRow & {
  product_shots?: Array<{
    id: string;
    product_id: string;
    shot_index: number;
    time_offset_seconds: number;
    pan_degrees: number;
    caliber: string | null;
    products: LinkedProductRow | LinkedProductRow[] | null;
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

function mapEffectSummary(row: EffectRow): AdminEffectSummary {
  const productIds = new Set(
    (row.product_shots ?? []).map((shot) => shot.product_id).filter((id): id is string => !!id),
  );

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source,
    confidence: numberOrZero(row.confidence),
    durationSeconds: numberOrZero(row.duration_seconds),
    heightMeters: numberOrNull(row.height_meters),
    shotCount: row.shot_count,
    productCount: productIds.size,
    preview: buildEffectPreview(row.spec_json, { type: row.type, name: row.name }),
    updatedAt: row.updated_at,
  };
}

function firstProduct(product: LinkedProductRow | LinkedProductRow[] | null | undefined) {
  if (!product) return null;
  return Array.isArray(product) ? (product[0] ?? null) : product;
}

function mapLinkedProducts(row: EffectDetailRow): AdminLinkedProduct[] {
  const byProduct = new Map<string, AdminLinkedProduct>();

  for (const shot of row.product_shots ?? []) {
    const product = firstProduct(shot.products);
    if (!product) continue;

    const existing =
      byProduct.get(product.id) ??
      ({
        id: product.id,
        partNumber: product.part_number,
        name: product.name,
        manufacturer: product.manufacturer,
        fireworkType: product.subtype,
        durationSeconds: numberOrNull(product.duration_seconds),
        shots: [],
      } satisfies AdminLinkedProduct);

    existing.shots.push({
      id: shot.id,
      shotIndex: shot.shot_index,
      timeOffsetSeconds: numberOrZero(shot.time_offset_seconds),
      panDegrees: shot.pan_degrees,
      caliber: shot.caliber,
    });
    byProduct.set(product.id, existing);
  }

  return [...byProduct.values()]
    .map((product) => ({
      ...product,
      shots: product.shots.sort((a, b) => a.shotIndex - b.shotIndex),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mapEffectDetail(row: EffectDetailRow): AdminEffectDetail {
  return {
    ...mapEffectSummary(row),
    specJson: row.spec_json as Json,
    linkedProducts: mapLinkedProducts(row),
  };
}

/** Returns every reusable effect spec for the admin effects browser. */
export async function listAdminEffects(): Promise<AdminEffectSummary[]> {
  if (!(await requirePermission('admin.manage_catalogue'))) return [];

  const cacheKey = getAdminEffectsCacheKey();
  const cached = await getCachedJson<AdminEffectSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('effect_specs')
    .select(
      'id, slug, name, description, type, source, confidence, duration_seconds, height_meters, shot_count, spec_json, updated_at, product_shots(product_id)',
    )
    .order('name', { ascending: true });

  if (error) {
    console.error('[admin.effects] listAdminEffects failed:', error);
    return [];
  }

  const mapped = ((data ?? []) as EffectRow[]).map(mapEffectSummary);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/** Returns one effect spec plus the products that use it. */
export async function getAdminEffectById(effectId: string): Promise<AdminEffectDetail | null> {
  if (!(await requirePermission('admin.manage_catalogue'))) return null;

  const cacheKey = getAdminEffectCacheKey(effectId);
  const cached = await getCachedJson<AdminEffectDetail>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('effect_specs')
    .select(
      `id, slug, name, description, type, source, confidence, duration_seconds, height_meters, shot_count, spec_json, updated_at,
       product_shots (
         id,
         product_id,
         shot_index,
         time_offset_seconds,
         pan_degrees,
         caliber,
         products (id, part_number, name, manufacturer, subtype, duration_seconds)
       )`,
    )
    .eq('id', effectId)
    .maybeSingle();

  if (error) {
    console.error('[admin.effects] getAdminEffectById failed:', error);
    return null;
  }
  if (!data) return null;

  const mapped = mapEffectDetail(data as EffectDetailRow);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
