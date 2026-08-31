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
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getCurrentUserId } from '@/lib/current-user.server';
import type { LaunchPosition } from '@/lib/fireworks/design';
import { resolveFireworkPreviewImage } from '@/lib/firework-preview-image';
import {
  parseReconstructionShotVariant,
  parseShotLaunchPositionIndex,
  parseShotPositionOverride,
  parseShotSeedOverride,
  type ReconstructionShotMetadata,
} from '@/lib/reconstruction-shot';
import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import {
  DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS,
  showReplayShotTimeSeconds,
} from '@/lib/replay-shot-timing';
import { isSupabaseTransientNetworkError } from '@/utils/supabase/errors';
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
  mapCue,
  mapCatalogueFireworkCard,
  mapFireworkVariantSpecification,
  mapReplayCueBase,
  mapShow,
} from './mappers';
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
  type FireworkPreviewImageProjectionRelation,
  type ReplayCueRow,
  type CatalogueFireworkCardProjection,
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

/**
 * Thrown when a shows read fails due to a network or connect issue, so the page
 * can render a real error state instead of a fake empty list. Previously
 * `listShowsForCurrentUser` returned `[]` on `fetch failed`, which made
 * `/shows?page=3` show an empty library after an 18s hang even when the user had
 * shows.
 */
export class ShowsNetworkError extends Error {
  constructor(cause: unknown) {
    super('Shows service is temporarily unavailable. Please retry.', { cause });
    this.name = 'ShowsNetworkError';
  }
}

function firstVariant<T>(variant: T | T[] | null | undefined): T | null {
  if (!variant) return null;
  return Array.isArray(variant) ? (variant[0] ?? null) : variant;
}

/** `variant_json.reconstructionShot` is shared by show replay and card previews. */
function parseDirectReconstructionShot(input: unknown): ReconstructionShotMetadata | null {
  return parseReconstructionShotVariant(input);
}

function finiteOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function conservativeProductDuration(...values: Array<number | null | undefined>): number | null {
  const durations = values.filter(
    (value): value is number => value != null && Number.isFinite(value) && value > 0,
  );
  return durations.length > 0 ? Math.max(...durations) : null;
}

/** Cheapest purchasable supplier price for a catalogue item; null when unlisted. */
function cheapestAvailablePriceCents(
  rows: Array<{ price_cents: number | null; available: boolean | null }> | null | undefined,
): number | null {
  let cheapest: number | null = null;
  for (const row of rows ?? []) {
    if (!row.available || row.price_cents == null || !Number.isFinite(row.price_cents)) continue;
    if (cheapest == null || row.price_cents < cheapest) cheapest = row.price_cents;
  }
  return cheapest;
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
    if (error) {
      if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
      console.error('[shows.server] listFireworkSpecifications failed:', error);
      return [];
    }
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
};

/**
 * Returns one {@link FireworkSpecification} per selectable catalogue item.
 *
 * Single-firework items read directly from `fireworks`. Multishots use their
 * first child firework for prompt/render preview data, while replay expands
 * the full sequence through `multishot_fireworks`.
 */
export const listFireworkProducts = cache(
  async (options?: ListFireworkProductsOptions): Promise<FireworkSpecification[]> => {
    const lightweight = options?.lightweight ?? false;
    const cacheKey = getFireworkProductsCacheKey(lightweight);
    const fireworkSelect = lightweight ? CATALOGUE_FIREWORK_CARD_SELECT : FIREWORK_VARIANT_SELECT;

    return loadCachedCatalogue(cacheKey, async () => {
      const supabase = await getCatalogueReadClient();
      const { data, error } = await supabase
        .from('catalogue_items')
        .select(
          `id, name, part_number, manufacturer, description, duration_seconds, catalogue_item_kind,
       supplier_inventory_items (price_cents, available),
       fireworks (${fireworkSelect}),
       multishots (
         id,
         shot_count,
         firework_preview_images(source_revision, renderer_version, storage_path),
         multishot_fireworks (
           sequence_index,
           caliber,
           position_override_json,
           fireworks (${fireworkSelect})
         )
       )`,
        )
        .order('name', { ascending: true });
      if (error) {
        if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
        console.error('[shows.server] listFireworkProducts failed:', error);
        return [];
      }

      type CatalogueItemRow = {
        id: string;
        name: string;
        part_number: string;
        manufacturer: string | null;
        description: string | null;
        duration_seconds: number | null;
        catalogue_item_kind: string;
        supplier_inventory_items: Array<{
          price_cents: number | null;
          available: boolean | null;
        }> | null;
        fireworks:
          | FireworkVariantProjection
          | FireworkVariantProjection[]
          | CatalogueFireworkCardProjection
          | CatalogueFireworkCardProjection[]
          | null;
        multishots: {
          id: string;
          shot_count: number;
          firework_preview_images: FireworkPreviewImageProjectionRelation;
          multishot_fireworks: Array<{
            sequence_index: number;
            caliber: string | null;
            position_override_json: unknown;
            fireworks:
              | FireworkVariantProjection
              | FireworkVariantProjection[]
              | CatalogueFireworkCardProjection
              | CatalogueFireworkCardProjection[]
              | null;
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
        const launchPositionOverrideIndices = Array.from(
          new Set(
            multishotRows
              .map((shot) => parseShotLaunchPositionIndex(shot.position_override_json))
              .filter((index): index is number => index != null),
          ),
        ).sort((a, b) => a - b);
        const primary = directFirework ?? firstVariant(firstMultishotFirework?.fireworks);
        if (!primary) continue;

        const base = lightweight
          ? mapCatalogueFireworkCard(
              primary as CatalogueFireworkCardProjection,
              mapped.length,
              firstMultishotFirework?.caliber ?? null,
            )
          : mapFireworkVariantSpecification(
              primary as FireworkVariantProjection,
              mapped.length,
              firstMultishotFirework?.caliber ?? null,
            );
        const previewImage =
          row.catalogue_item_kind === 'multishot'
            ? resolveFireworkPreviewImage(row.multishots?.firework_preview_images)
            : {
                previewImagePath: base.previewImagePath ?? null,
                previewImageRevision: base.previewImageRevision ?? null,
              };
        mapped.push({
          ...base,
          ...previewImage,
          id: row.id,
          slug: row.part_number,
          name: row.name,
          manufacturer: row.manufacturer,
          description: row.description ?? base.description,
          minPriceCents: cheapestAvailablePriceCents(row.supplier_inventory_items),
          durationSeconds: row.duration_seconds ?? base.durationSeconds,
          occupancyDurationSeconds: conservativeProductDuration(
            row.duration_seconds,
            base.durationSeconds,
          ),
          shotCount:
            row.catalogue_item_kind === 'multishot'
              ? (row.multishots?.shot_count ?? multishotRows.length)
              : 1,
          hasLaunchPositionOverrides:
            row.catalogue_item_kind === 'multishot' && launchPositionOverrideIndices.length > 0,
          launchPositionOverrideIndices,
        });
      }

      await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
      return mapped;
    });
  },
);

type CatalogueFireworkRow = {
  id: string;
  catalogue_item_kind: string;
  fireworks: FireworkVariantProjection | FireworkVariantProjection[] | null;
  multishots: {
    id: string;
    multishot_fireworks: Array<{
      id: string;
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

export type CatalogueItemShotSpec = {
  kind: 'direct' | 'multishot';
  sourceCueId: string;
  timeOffsetSeconds: number;
  panDegrees: number | null;
  tiltDegrees: number | null;
  positionOverride: LaunchPosition | null;
  launchPositionIndex: number | null;
  seedOverride: number | null;
  firework: FireworkSpecification;
};

type FetchCatalogueItemShotsOptions = {
  /** Card-preview APIs must surface read failures instead of treating them as no preview. */
  failOnError?: boolean;
};

/**
 * Fetches the per-catalogue-item shot spec for replay expansion. A single
 * firework becomes one shot; a multishot fans out into one shot per ordered
 * `multishot_fireworks` row. Shared by the per-show and batched replay loaders
 * so the catalogue join logic has one source of truth.
 */
export async function fetchShotsByCatalogueItem(
  supabase: SupabaseClient<Database>,
  catalogueItemIds: string[],
  options: FetchCatalogueItemShotsOptions = {},
): Promise<Map<string, CatalogueItemShotSpec[]>> {
  const shotsByCatalogueItem = new Map<string, CatalogueItemShotSpec[]>();
  if (catalogueItemIds.length === 0) return shotsByCatalogueItem;

  const { data, error } = await supabase
    .from('catalogue_items')
    .select(
      `id, catalogue_item_kind,
       fireworks (${FIREWORK_VARIANT_SELECT}),
       multishots (
         id,
         multishot_fireworks (
           id,
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

  if (error) {
    if (options.failOnError || isSupabaseTransientNetworkError(error)) {
      throw new ShowsNetworkError(error);
    }
    console.error('[shows.server] catalogue_items load failed:', error);
    return shotsByCatalogueItem;
  }

  for (const item of (data ?? []) as CatalogueFireworkRow[]) {
    const directFirework = firstVariant(item.fireworks);
    if (directFirework) {
      const reconstructionShot = parseDirectReconstructionShot(directFirework.variant_json);
      shotsByCatalogueItem.set(item.id, [
        {
          kind: 'direct',
          sourceCueId: `${directFirework.id}-card-preview`,
          timeOffsetSeconds: DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS,
          panDegrees: reconstructionShot?.panDegrees ?? null,
          tiltDegrees: reconstructionShot?.tiltDegrees ?? null,
          positionOverride: reconstructionShot?.positionOverride ?? null,
          launchPositionIndex: reconstructionShot?.launchPositionIndex ?? null,
          seedOverride: reconstructionShot?.seedOverride ?? null,
          firework: mapFireworkVariantSpecification(directFirework, 0),
        },
      ]);
      continue;
    }

    const multishotRows = [...(item.multishots?.multishot_fireworks ?? [])].sort(
      (a, b) => a.sequence_index - b.sequence_index,
    );
    const shots: CatalogueItemShotSpec[] = [];
    for (const shot of multishotRows) {
      const firework = firstVariant(shot.fireworks);
      if (!firework) continue;
      shots.push({
        kind: 'multishot',
        sourceCueId: shot.id,
        timeOffsetSeconds: finiteOrZero(shot.time_offset_seconds),
        panDegrees: shot.pan_degrees == null ? null : Number(shot.pan_degrees),
        tiltDegrees: shot.tilt_degrees == null ? null : Number(shot.tilt_degrees),
        positionOverride: parseShotPositionOverride(shot.position_override_json),
        launchPositionIndex: parseShotLaunchPositionIndex(shot.position_override_json),
        seedOverride: parseShotSeedOverride(shot.position_override_json),
        firework: mapFireworkVariantSpecification(firework, shots.length, shot.caliber),
      });
    }
    if (shots.length > 0) shotsByCatalogueItem.set(item.id, shots);
  }

  return shotsByCatalogueItem;
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
        timeSeconds: showReplayShotTimeSeconds(startSeconds, shots[i].timeOffsetSeconds),
        // Each multishot shot can fire from its own tube; fall back to the
        // parent cue's tube when the shot doesn't override it.
        launchPositionIndex: shots[i].launchPositionIndex ?? baseCue.launchPositionIndex,
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

/**
 * Lists time-scheduled cues expanded for replay, for a single show. Cached per
 * show so the show detail page reuses the result.
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
  const expanded = await listReplayCuesForShowWithClient(supabase, showId);
  await setCachedJson(cacheKey, expanded, SHOWS_TTL_SECONDS);
  return expanded;
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
  return expandReplayCues(rows, shotsByCatalogueItem);
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

/**
 * Batched replay-cue loader for listing pages. Fetches one `show_timeline_items`
 * query for every show id and one `catalogue_items` join for the distinct
 * catalogue items, then groups the expanded cues by show id. Replaces the
 * 12-call per-show fan-out that made `/shows` issue up to 24 parallel Supabase
 * requests per page. Returns a map with an entry (possibly empty) for every
 * requested show id.
 */
export async function listReplayCuesForShows(showIds: string[]): Promise<Map<string, ReplayCue[]>> {
  const result = new Map<string, ReplayCue[]>();
  if (showIds.length === 0) return result;
  const userId = await getCurrentUserId();
  if (!userId) {
    for (const id of showIds) result.set(id, []);
    return result;
  }

  const uniqueShowIds = [...new Set(showIds)];
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('show_timeline_items')
    .select(SHOW_CUE_SELECT)
    .in('show_id', uniqueShowIds)
    .not('time_seconds', 'is', null)
    .order('time_seconds', { ascending: true })
    .order('position', { ascending: true });
  if (error) {
    if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
    console.error('[shows.server] listReplayCuesForShows failed:', error);
    for (const id of uniqueShowIds) result.set(id, []);
    return result;
  }

  const rows = (data ?? []) as ReplayCueRow[];
  const rowsByShowId = new Map<string, ReplayCueRow[]>();
  for (const id of uniqueShowIds) rowsByShowId.set(id, []);
  for (const row of rows) {
    const list = rowsByShowId.get(row.show_id);
    if (list) list.push(row);
  }

  const catalogueItemIds = [
    ...new Set(rows.map((r) => r.catalogue_item_id).filter((id): id is string => id != null)),
  ];
  const shotsByCatalogueItem = await fetchShotsByCatalogueItem(supabase, catalogueItemIds);

  for (const showId of uniqueShowIds) {
    result.set(showId, expandReplayCues(rowsByShowId.get(showId) ?? [], shotsByCatalogueItem));
  }
  return result;
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
