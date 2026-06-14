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
import type { LaunchPosition } from '@/lib/fireworks/design';
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
import { mapCue, mapFireworkVariantSpecification, mapReplayCueBase, mapShow } from './mappers';
import { computeShoppingListForShow } from './shopping.server';
import { getServerClient } from './supabase';
import {
  FIREWORK_VARIANT_SELECT,
  FIREWORK_SPECS_TTL_SECONDS,
  SHOWS_TTL_SECONDS,
  SHOW_CUE_SELECT,
  SHOW_SELECT,
  type FireworkVariantProjection,
  type ReplayCueRow,
} from './types';

function firstVariant(
  variant: FireworkVariantProjection | FireworkVariantProjection[] | null | undefined,
): FireworkVariantProjection | null {
  if (!variant) return null;
  return Array.isArray(variant) ? (variant[0] ?? null) : variant;
}

function parseShotPositionOverride(input: unknown): LaunchPosition | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y);
  const z = Number(record.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

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
    .from('show_timeline_items')
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

/** All atomic fireworks in the catalogue. Used by library previews. */
export async function listFireworkSpecifications(): Promise<FireworkSpecification[]> {
  const cacheKey = getFireworkSpecificationsCacheKey();
  const cached = await getCachedJson<FireworkSpecification[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('fireworks')
    .select(FIREWORK_VARIANT_SELECT)
    .order('name', { ascending: true });
  if (error) {
    console.error('[shows.server] listFireworkSpecifications failed:', error);
    return [];
  }
  const mapped = ((data ?? []) as FireworkVariantProjection[]).map((row, i) =>
    mapFireworkVariantSpecification(row, i),
  );
  await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
  return mapped;
}

/**
 * Returns one {@link FireworkSpecification} per selectable catalogue item.
 *
 * Single-firework items read directly from `fireworks`. Multishots use their
 * first child firework for prompt/render preview data, while replay expands
 * the full sequence through `multishot_fireworks`.
 */
export async function listFireworkProducts(): Promise<FireworkSpecification[]> {
  const cacheKey = getFireworkProductsCacheKey();
  const cached = await getCachedJson<FireworkSpecification[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('catalogue_items')
    .select(
      `id, name, part_number, description, duration_seconds, catalogue_item_kind,
       fireworks (${FIREWORK_VARIANT_SELECT}),
       multishots (
         id,
         shot_count,
         multishot_fireworks (
           sequence_index,
           caliber,
           fireworks (${FIREWORK_VARIANT_SELECT})
         )
       )`,
    )
    .order('name', { ascending: true });
  if (error) {
    console.error('[shows.server] listFireworkProducts failed:', error);
    return [];
  }

  type CatalogueItemRow = {
    id: string;
    name: string;
    part_number: string;
    description: string | null;
    duration_seconds: number | null;
    catalogue_item_kind: string;
    fireworks: FireworkVariantProjection | FireworkVariantProjection[] | null;
    multishots: {
      id: string;
      shot_count: number;
      multishot_fireworks: Array<{
        sequence_index: number;
        caliber: string | null;
        fireworks: FireworkVariantProjection | FireworkVariantProjection[] | null;
      }>;
    } | null;
  };

  const mapped: FireworkSpecification[] = [];
  for (const row of (data ?? []) as CatalogueItemRow[]) {
    const directFirework = firstVariant(row.fireworks);
    const multishotRows = [...(row.multishots?.multishot_fireworks ?? [])].sort(
      (a, b) => a.sequence_index - b.sequence_index,
    );
    const firstMultishotFirework = multishotRows.find((shot) => shot.fireworks != null);
    const primary = directFirework ?? firstVariant(firstMultishotFirework?.fireworks);
    if (!primary) continue;

    const base = mapFireworkVariantSpecification(
      primary,
      mapped.length,
      firstMultishotFirework?.caliber ?? null,
    );
    mapped.push({
      ...base,
      id: row.id,
      slug: row.part_number,
      name: row.name,
      description: row.description ?? base.description,
      durationSeconds: row.duration_seconds ?? base.durationSeconds,
      shotCount:
        row.catalogue_item_kind === 'multishot'
          ? (row.multishots?.shot_count ?? multishotRows.length)
          : 1,
    });
  }

  await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
  return mapped;
}

/**
 * Lists time-scheduled cues expanded for replay.
 *
 * Catalogue items that point at a single firework become one replay cue.
 * Catalogue items that point at a multishot fan out into one replay cue per
 * ordered `multishot_fireworks` row.
 */
export async function listReplayCuesForShow(showId: string): Promise<ReplayCue[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const cacheKey = getShowReplayCuesCacheKey(userId, showId);
  const cached = await getCachedJson<ReplayCue[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('show_timeline_items')
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
  const catalogueItemIds = [
    ...new Set(rows.map((r) => r.catalogue_item_id).filter((id): id is string => id != null)),
  ];

  type CatalogueFireworkRow = {
    id: string;
    catalogue_item_kind: string;
    fireworks: FireworkVariantProjection | FireworkVariantProjection[] | null;
    multishots: {
      id: string;
      multishot_fireworks: Array<{
        sequence_index: number;
        time_offset_seconds: number;
        pan_degrees: number | null;
        tilt_degrees: number | null;
        position_override_json: unknown;
        caliber: string | null;
        fireworks: FireworkVariantProjection | FireworkVariantProjection[] | null;
      }>;
    } | null;
  };

  type ShotSpec = {
    timeOffsetSeconds: number;
    panDegrees: number | null;
    tiltDegrees: number | null;
    positionOverride: LaunchPosition | null;
    firework: FireworkSpecification;
  };
  const shotsByCatalogueItem = new Map<string, ShotSpec[]>();

  if (catalogueItemIds.length > 0) {
    const { data: catalogueItems, error: catalogueErr } = await supabase
      .from('catalogue_items')
      .select(
        `id, catalogue_item_kind,
         fireworks (${FIREWORK_VARIANT_SELECT}),
         multishots (
           id,
           multishot_fireworks (
             sequence_index,
             time_offset_seconds,
             pan_degrees,
             tilt_degrees,
             position_override_json,
             caliber,
             fireworks (${FIREWORK_VARIANT_SELECT})
           )
         )`,
      )
      .in('id', catalogueItemIds);

    if (catalogueErr) {
      console.error('[shows.server] catalogue_items load failed:', catalogueErr);
    } else {
      for (const item of (catalogueItems ?? []) as CatalogueFireworkRow[]) {
        const directFirework = firstVariant(item.fireworks);
        if (directFirework) {
          shotsByCatalogueItem.set(item.id, [
            {
              timeOffsetSeconds: 0,
              panDegrees: null,
              tiltDegrees: null,
              positionOverride: null,
              firework: mapFireworkVariantSpecification(directFirework, 0),
            },
          ]);
          continue;
        }

        const multishotRows = [...(item.multishots?.multishot_fireworks ?? [])].sort(
          (a, b) => a.sequence_index - b.sequence_index,
        );
        const shots: ShotSpec[] = [];
        for (const shot of multishotRows) {
          const firework = firstVariant(shot.fireworks);
          if (!firework) continue;
          shots.push({
            timeOffsetSeconds: Number(shot.time_offset_seconds),
            panDegrees: shot.pan_degrees == null ? null : Number(shot.pan_degrees),
            tiltDegrees: shot.tilt_degrees == null ? null : Number(shot.tilt_degrees),
            positionOverride: parseShotPositionOverride(shot.position_override_json),
            firework: mapFireworkVariantSpecification(firework, shots.length, shot.caliber),
          });
        }
        if (shots.length > 0) shotsByCatalogueItem.set(item.id, shots);
      }
    }
  }

  const expanded: ReplayCue[] = [];
  for (const row of rows) {
    const baseCue = mapReplayCueBase(row);
    if (!baseCue) continue;
    const shots = shotsByCatalogueItem.get(row.catalogue_item_id);
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
        shotPanDegrees: shots[i].panDegrees,
        shotTiltDegrees: shots[i].tiltDegrees,
        shotPositionOverride: shots[i].positionOverride,
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
