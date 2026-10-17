/**
 * Read-side queries for shows, cues, products, and replay cues.
 *
 * Every helper:
 * - Resolves the current user with `getCurrentUserId` (returns `[]`/`null` when unauthenticated)
 * - Tries the Upstash cache first; on miss, queries Supabase and writes back
 * - Uses RLS-scoped reads — the user_id filter is defence-in-depth
 */
import 'server-only';

import { normaliseReplayCues, rehydrateReplayCues, type ReplayCuePayload } from './replay-payload';

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getCurrentUserId } from '@/lib/auth/current-user.server';
import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import { showReplayShotTimeSeconds } from '@/lib/replay-shot-timing';
import { isSupabaseTransientNetworkError } from '@/lib/supabase/errors';
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
import {
  assembleCatalogueItemShots,
  assembleCatalogueProducts,
  type CatalogueItemShotSpec,
} from './catalogue-products';
import {
  createReadLimiter,
  readCatalogueGraph,
  readCatalogueItems,
} from './catalogue-products.server';
import { mapCue, mapFireworkVariantSpecification, mapReplayCueBase, mapShow } from './mappers';
import { CatalogueReadError, ShowsNetworkError } from './read-errors';
import { computeShoppingListForShow } from './shopping.server';
import { getCatalogueReadClient, getServerClient } from './supabase';
import {
  CATALOGUE_FIREWORK_CARD_SELECT,
  FIREWORK_VARIANT_SELECT,
  FIREWORK_SPECS_TTL_SECONDS,
  SHOWS_TTL_SECONDS,
  SHOW_CUE_SELECT,
  SHOW_SELECT,
  type FireworkVariantProjection,
  type ReplayCueRow,
} from './types';

const catalogueLoadsInFlight = new Map<string, Promise<unknown>>();

async function loadCachedCatalogue<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
  const cached = await getCachedJson<T>(cacheKey);
  if (cached) return cached;

  const pending = catalogueLoadsInFlight.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const promise = loader().finally(() => {
    catalogueLoadsInFlight.delete(cacheKey);
  });
  catalogueLoadsInFlight.set(cacheKey, promise);
  return promise;
}

function finiteOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Catalogue reads never degrade to an empty list: the caller must know the read failed. */
function throwCatalogueRead(table: string, error: unknown): never {
  if (error instanceof ShowsNetworkError || error instanceof CatalogueReadError) throw error;
  console.error('[shows.server] catalogue read failed:', { table, error });
  if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
  throw new CatalogueReadError(error, { table });
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
    if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
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
    if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
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
    if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
    console.error('[shows.server] listCuesForShow failed:', error);
    return [];
  }
  const mapped = (data ?? []).map(mapCue);
  await setCachedJson(cacheKey, mapped, SHOWS_TTL_SECONDS);
  return mapped;
}

/** All atomic fireworks in the catalogue. Used by library previews. */
export const listFireworkSpecifications = cache(async (): Promise<FireworkSpecification[]> => {
  const cacheKey = getFireworkSpecificationsCacheKey();
  return loadCachedCatalogue(cacheKey, async () => {
    const supabase = await getCatalogueReadClient();
    const { data, error } = await supabase
      .from('fireworks')
      .select(FIREWORK_VARIANT_SELECT)
      .order('name', { ascending: true });
    if (error) throwCatalogueRead('fireworks', error);
    const mapped = ((data ?? []) as FireworkVariantProjection[]).map((row, i) =>
      mapFireworkVariantSpecification(row, i),
    );
    await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
    return mapped;
  });
});

export type ListFireworkProductsOptions = {
  /** Skip render-design joins for browse-only catalogue cards. */
  lightweight?: boolean;
  /** Private bounded reads bypass the shared catalogue cache and fail on read errors. */
  scopedRead?: { supabase: SupabaseClient<Database>; ids: string[] };
};

/**
 * Returns one {@link FireworkSpecification} per selectable catalogue item.
 *
 * Single-firework items read directly from `fireworks`. Multishots use their
 * first child firework for prompt/render preview data, while replay expands
 * the full sequence through `multishot_fireworks`.
 *
 * The read is a series of bounded, batched lookups (see
 * `catalogue-products.server`). A failure in any of them throws
 * {@link CatalogueReadError} or {@link ShowsNetworkError}; an empty array only
 * means that nothing is listed.
 */
export const listFireworkProducts = cache(
  async (options?: ListFireworkProductsOptions): Promise<FireworkSpecification[]> => {
    const lightweight = options?.lightweight ?? false;
    const cacheKey = getFireworkProductsCacheKey(lightweight);
    const fireworkSelect = lightweight ? CATALOGUE_FIREWORK_CARD_SELECT : FIREWORK_VARIANT_SELECT;

    const load = async () => {
      const supabase = options?.scopedRead?.supabase ?? (await getCatalogueReadClient());
      // One limiter spans the item read and every graph table.
      const limiter = createReadLimiter();
      const items = await readCatalogueItems(
        supabase,
        { ids: options?.scopedRead?.ids, listedOnly: true },
        limiter,
      );
      const graph = await readCatalogueGraph(
        supabase,
        items,
        fireworkSelect,
        { inventory: true, multishotMeta: true, multishotPreviews: true },
        limiter,
      );
      const mapped = assembleCatalogueProducts(graph, { lightweight });
      // Only a complete graph reaches the cache: any page or table failure threw above.
      if (!options?.scopedRead) await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
      return mapped;
    };
    return options?.scopedRead ? load() : loadCachedCatalogue(cacheKey, load);
  },
);

type FetchCatalogueItemShotsOptions = {
  /** Timing analysis must distinguish a missing offset from a real zero. */
  preserveUnknownTiming?: boolean;
  /** Timing profiles only need multishot children, so skip the direct firework payloads. */
  multishotChildrenOnly?: boolean;
};

/**
 * Fetches the per-catalogue-item shot spec for replay expansion. A single
 * firework becomes one shot; a multishot fans out into one shot per ordered
 * `multishot_fireworks` row. Shared by the per-show and batched replay loaders
 * so the catalogue join logic has one source of truth.
 *
 * Read failures propagate as {@link CatalogueReadError} or
 * {@link ShowsNetworkError}: an empty map would replay a saved show as silent.
 */
export async function fetchShotsByCatalogueItem(
  supabase: SupabaseClient<Database>,
  catalogueItemIds: string[],
  options: FetchCatalogueItemShotsOptions = {},
): Promise<Map<string, CatalogueItemShotSpec[]>> {
  if (catalogueItemIds.length === 0) return new Map();

  const limiter = createReadLimiter();
  // Replay must still expand items that were unlisted after the show was saved.
  const items = await readCatalogueItems(
    supabase,
    { ids: catalogueItemIds, listedOnly: false },
    limiter,
  );
  const graph = await readCatalogueGraph<FireworkVariantProjection>(
    supabase,
    items,
    FIREWORK_VARIANT_SELECT,
    { multishotChildrenOnly: options.multishotChildrenOnly },
    limiter,
  );
  return assembleCatalogueItemShots(graph, {
    preserveUnknownTiming: options.preserveUnknownTiming,
  });
}

/**
 * Expands time-scheduled timeline rows into replay cues using the preloaded
 * shot specs. Multishot catalogue items fan out into one cue per shot, with a
 * stable `-shot-<index>` id so the renderer can dedupe. Sorted by time.
 */
function expandReplayCues(
  rows: ReplayCueRow[],
  shotsByCatalogueItem: Map<string, CatalogueItemShotSpec[]>,
): ReplayCue[] {
  const expanded: ReplayCue[] = [];
  for (const row of rows) {
    const baseCue = mapReplayCueBase(row);
    if (!baseCue) continue;
    const shots = shotsByCatalogueItem.get(row.catalogue_item_id);
    if (!shots || shots.length === 0) continue;
    const startSeconds = finiteOrZero(row.time_seconds);
    for (let i = 0; i < shots.length; i++) {
      expanded.push({
        ...baseCue,
        // Stable id: keep the cue id when there's only one shot, otherwise
        // suffix with `-shot-<index>` so the renderer can dedupe correctly.
        id: shots.length === 1 ? baseCue.id : `${baseCue.id}-shot-${i}`,
        cakeId: shots.length > 1 ? baseCue.id : undefined,
        cakeLaunchPositionIndex: shots.length > 1 ? baseCue.launchPositionIndex : undefined,
        timeSeconds: showReplayShotTimeSeconds(startSeconds, shots[i].timeOffsetSeconds),
        // A multishot is one cake at its cue's position; shots only vary within the cake.
        launchPositionIndex: baseCue.launchPositionIndex,
        seedOverride: shots[i].seedOverride ?? baseCue.seedOverride,
        firework: shots[i].firework,
        shotPanDegrees: shots[i].panDegrees,
        shotTiltDegrees: shots[i].tiltDegrees,
        shotPositionOverride: shots[i].positionOverride,
      });
    }
  }

  expanded.sort((a, b) => a.timeSeconds - b.timeSeconds);
  return expanded;
}

/** Loads the deduplicated replay transport without expanding it before client serialisation. */
export async function getReplayCuePayloadForShow(showId: string): Promise<ReplayCuePayload> {
  const userId = await getCurrentUserId();
  if (!userId) return normaliseReplayCues([]);

  const cacheKey = getShowReplayCuesCacheKey(userId, showId);
  const cached = await getCachedJson<ReplayCuePayload>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const payload = normaliseReplayCues(await listReplayCuesForShowWithClient(supabase, showId));
  await setCachedJson(cacheKey, payload, SHOWS_TTL_SECONDS);
  return payload;
}

/** Trusted-client replay loader for non-dashboard server surfaces such as QR results. */
export async function listReplayCuesForShowWithClient(
  supabase: SupabaseClient<Database>,
  showId: string,
): Promise<ReplayCue[]> {
  const { data, error } = await supabase
    .from('show_timeline_items')
    .select(SHOW_CUE_SELECT)
    .eq('show_id', showId)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true })
    .order('position', { ascending: true });
  if (error) {
    if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
    console.error('[shows.server] listReplayCuesForShow failed:', error);
    return [];
  }

  const rows = (data ?? []) as ReplayCueRow[];
  const catalogueItemIds = [
    ...new Set(rows.map((r) => r.catalogue_item_id).filter((id): id is string => id != null)),
  ];
  const shotsByCatalogueItem = await fetchShotsByCatalogueItem(supabase, catalogueItemIds);
  return rehydrateReplayCues(normaliseReplayCues(expandReplayCues(rows, shotsByCatalogueItem)));
}

/**
 * Lists only a short card-preview window for a show. The `/shows` grid hover
 * preview should feel light and responsive, so it does not need the full replay
 * cue set that the dedicated preview page uses.
 */
export async function listReplayPreviewCuesForShow(
  showId: string,
  windowSeconds: number,
): Promise<ReplayCue[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const previewWindowSeconds = Math.max(1, Math.min(90, windowSeconds));
  const supabase = await getServerClient();

  const { data: firstData, error: firstError } = await supabase
    .from('show_timeline_items')
    .select('time_seconds')
    .eq('show_id', showId)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstError) {
    if (isSupabaseTransientNetworkError(firstError)) throw new ShowsNetworkError(firstError);
    console.error('[shows.server] listReplayPreviewCuesForShow first cue failed:', firstError);
    return [];
  }

  const firstCueTime = Number(firstData?.time_seconds);
  if (!Number.isFinite(firstCueTime)) return [];

  const previewStart = Math.max(0, firstCueTime - 0.3);
  const previewEnd = previewStart + previewWindowSeconds;
  const { data, error } = await supabase
    .from('show_timeline_items')
    .select(SHOW_CUE_SELECT)
    .eq('show_id', showId)
    .not('time_seconds', 'is', null)
    .gte('time_seconds', previewStart)
    .lte('time_seconds', previewEnd)
    .order('time_seconds', { ascending: true })
    .order('position', { ascending: true });

  if (error) {
    if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
    console.error('[shows.server] listReplayPreviewCuesForShow failed:', error);
    return [];
  }

  const rows = (data ?? []) as ReplayCueRow[];
  const catalogueItemIds = [
    ...new Set(rows.map((r) => r.catalogue_item_id).filter((id): id is string => id != null)),
  ];
  const shotsByCatalogueItem = await fetchShotsByCatalogueItem(supabase, catalogueItemIds);
  return expandReplayCues(rows, shotsByCatalogueItem)
    .map((cue) => ({
      ...cue,
      timeSeconds: Math.max(0, cue.timeSeconds - previewStart),
    }))
    .filter((cue) => cue.timeSeconds <= previewWindowSeconds + 0.001);
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
