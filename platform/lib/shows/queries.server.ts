/**
 * Read-side queries for shows, cues, products, and replay cues.
 *
 * Every helper:
 * - Resolves the current user with `getCurrentUserId` (returns `[]`/`null` when unauthenticated)
 * - Tries the Upstash cache first; on miss, queries Supabase and writes back
 * - Uses RLS-scoped reads — the user_id filter is defence-in-depth
 */
import 'server-only';

import { cache } from 'react';
import { getCurrentUserId } from '@/lib/current-user.server';
import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  FireworkSpecification,
  ReplayCue,
  Show,
  ShowCue,
  ShoppingListItem,
} from '@/lib/show-domain';
import {
  getFireworkProductsCacheKey,
  getFireworkSpecificationsCacheKey,
  getShoppingListCacheKey,
  getShowBySlugCacheKey,
  getShowCuesCacheKey,
  getShowReplayCuesCacheKey,
  getUserShowsCacheKey,
} from './cache-keys';
import { mapCue, mapEffectSpecification, mapReplayCueBase, mapShow } from './mappers';
import { computeShoppingListForShow } from './shopping.server';
import { getServerClient } from './supabase';
import {
  EFFECT_SPEC_SELECT,
  FIREWORK_SPECS_TTL_SECONDS,
  SHOWS_TTL_SECONDS,
  SHOW_CUE_SELECT,
  SHOW_SELECT,
  type EffectSpecProjection,
  type ReplayCueRow,
} from './types';

/** Returns every show owned by the current user, sorted by `updated_at` desc. */
export async function listShowsForCurrentUser(): Promise<Show[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const cacheKey = getUserShowsCacheKey(userId);
  const cached = await getCachedJson<Show[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('shows')
    .select(SHOW_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[shows.server] listShowsForCurrentUser failed:', error);
    return [];
  }
  const mapped = (data ?? []).map(mapShow);
  await setCachedJson(cacheKey, mapped, SHOWS_TTL_SECONDS);
  return mapped;
}

/** Fetch a single show by URL slug for the current user. Memoised per request. */
export const getShowBySlug = cache(async (slug: string): Promise<Show | null> => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const cacheKey = getShowBySlugCacheKey(userId, slug);
  const cached = await getCachedJson<Show>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('shows')
    .select(SHOW_SELECT)
    .eq('user_id', userId)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('[shows.server] getShowBySlug failed:', error);
    return null;
  }
  const mapped = data ? mapShow(data) : null;
  if (mapped) {
    await setCachedJson(cacheKey, mapped, SHOWS_TTL_SECONDS);
  }
  return mapped;
});

/** Lists cues for a show in `position` order (authoring view). */
export async function listCuesForShow(showId: string): Promise<ShowCue[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const cacheKey = getShowCuesCacheKey(userId, showId);
  const cached = await getCachedJson<ShowCue[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('show_cues')
    .select(SHOW_CUE_SELECT)
    .eq('show_id', showId)
    .order('position', { ascending: true });
  if (error) {
    console.error('[shows.server] listCuesForShow failed:', error);
    return [];
  }
  const mapped = (data ?? []).map(mapCue);
  await setCachedJson(cacheKey, mapped, SHOWS_TTL_SECONDS);
  return mapped;
}

/** All effect specs in the catalogue. Used by admin tooling and seed scripts. */
export async function listFireworkSpecifications(): Promise<FireworkSpecification[]> {
  const cacheKey = getFireworkSpecificationsCacheKey();
  const cached = await getCachedJson<FireworkSpecification[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('effect_specs')
    .select(EFFECT_SPEC_SELECT)
    .order('name', { ascending: true });
  if (error) {
    console.error('[shows.server] listFireworkSpecifications failed:', error);
    return [];
  }
  const mapped = ((data ?? []) as EffectSpecProjection[]).map((row, i) =>
    mapEffectSpecification(row, i),
  );
  await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
  return mapped;
}

/**
 * Returns one {@link FireworkSpecification} per *product*, with the renderer
 * details filled in from the product's first product_shot.
 *
 * This is what the cue builder presents to the user: they pick a product, and
 * the renderer fires N shots from `product_shots`. The returned `id` is the
 * `products.id` so the cue-add form can write directly to
 * `show_cues.product_id`.
 */
export async function listFireworkProducts(): Promise<FireworkSpecification[]> {
  const cacheKey = getFireworkProductsCacheKey();
  const cached = await getCachedJson<FireworkSpecification[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, part_number, description, duration_seconds,
       product_shots (
         shot_index,
         caliber,
         effect_specs (${EFFECT_SPEC_SELECT})
       )`,
    )
    .order('name', { ascending: true });
  if (error) {
    console.error('[shows.server] listFireworkProducts failed:', error);
    return [];
  }

  type ProductRow = {
    id: string;
    name: string;
    part_number: string;
    description: string | null;
    duration_seconds: number | null;
    product_shots: Array<{
      shot_index: number;
      caliber: string | null;
      effect_specs: EffectSpecProjection | null;
    }>;
  };

  const mapped: FireworkSpecification[] = [];
  for (const row of (data ?? []) as ProductRow[]) {
    const shots = [...(row.product_shots ?? [])].sort((a, b) => a.shot_index - b.shot_index);
    const primary = shots.find((s) => s.effect_specs != null);
    if (!primary?.effect_specs) continue;
    const effectSpec = primary.effect_specs;
    mapped.push({
      ...mapEffectSpecification(effectSpec, mapped.length, primary.caliber ?? null),
      id: row.id,
      slug: row.part_number,
      name: row.name,
      description: row.description ?? effectSpec.description,
      durationSeconds: row.duration_seconds ?? effectSpec.duration_seconds,
      shotCount: shots.length,
    });
  }

  await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
  return mapped;
}

/**
 * Lists time-scheduled cues expanded for replay.
 *
 * Multi-shot products fan out into one {@link ReplayCue} per shot, with each
 * shot's `timeSeconds` offset by `product_shots.time_offset_seconds`. The
 * renderer can therefore stay product-agnostic.
 */
export async function listReplayCuesForShow(showId: string): Promise<ReplayCue[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const cacheKey = getShowReplayCuesCacheKey(userId, showId);
  const cached = await getCachedJson<ReplayCue[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('show_cues')
    .select(SHOW_CUE_SELECT)
    .eq('show_id', showId)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true })
    .order('position', { ascending: true });
  if (error) {
    console.error('[shows.server] listReplayCuesForShow failed:', error);
    return [];
  }

  const rows = (data ?? []) as ReplayCueRow[];

  // Single-shot products have one `product_shots` row at offset 0; multi-shot
  // products have N rows we need to expand into individual replay cues so
  // the renderer doesn't have to know the catalogue shape.
  const productIds = [
    ...new Set(rows.map((r) => r.product_id).filter((id): id is string => id != null)),
  ];

  type ShotRow = {
    product_id: string;
    shot_index: number;
    time_offset_seconds: number;
    caliber: string | null;
    effect_specs: EffectSpecProjection | null;
  };

  type ShotSpec = { timeOffsetSeconds: number; firework: FireworkSpecification };
  const shotsByProduct = new Map<string, ShotSpec[]>();

  if (productIds.length > 0) {
    const { data: shots, error: shotsErr } = await supabase
      .from('product_shots')
      .select(
        `product_id, shot_index, time_offset_seconds, caliber, effect_specs (${EFFECT_SPEC_SELECT})`,
      )
      .in('product_id', productIds)
      .order('shot_index', { ascending: true });

    if (shotsErr) {
      console.error('[shows.server] product_shots load failed:', shotsErr);
    } else {
      for (const shot of (shots ?? []) as ShotRow[]) {
        if (!shot.effect_specs) continue;
        const arr = shotsByProduct.get(shot.product_id) ?? [];
        arr.push({
          timeOffsetSeconds: Number(shot.time_offset_seconds),
          firework: mapEffectSpecification(shot.effect_specs, arr.length, shot.caliber ?? null),
        });
        shotsByProduct.set(shot.product_id, arr);
      }
    }
  }

  const expanded: ReplayCue[] = [];
  for (const row of rows) {
    const baseCue = mapReplayCueBase(row);
    if (!baseCue) continue;
    const shots = shotsByProduct.get(row.product_id);
    if (!shots || shots.length === 0) continue;
    const startSeconds = Number(row.time_seconds);
    for (let i = 0; i < shots.length; i++) {
      expanded.push({
        ...baseCue,
        // Stable id: keep the cue id when there's only one shot, otherwise
        // suffix with `-shot-<index>` so the renderer can dedupe correctly.
        id: shots.length === 1 ? baseCue.id : `${baseCue.id}-shot-${i}`,
        timeSeconds: startSeconds + shots[i].timeOffsetSeconds,
        firework: shots[i].firework,
      });
    }
  }

  expanded.sort((a, b) => a.timeSeconds - b.timeSeconds);

  await setCachedJson(cacheKey, expanded, SHOWS_TTL_SECONDS);
  return expanded;
}

/** Per-show shopping list with pricing. Cached with the standard TTL. */
export async function listShoppingItemsForShow(showId: string): Promise<ShoppingListItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const cacheKey = getShoppingListCacheKey(userId, showId);
  const cached = await getCachedJson<ShoppingListItem[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const computed = await computeShoppingListForShow(supabase, showId);
  if (!computed) return [];

  await setCachedJson(cacheKey, computed.items, SHOWS_TTL_SECONDS);
  return computed.items;
}
