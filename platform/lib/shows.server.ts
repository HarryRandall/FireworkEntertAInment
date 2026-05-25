import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getCurrentUserId } from '@/lib/current-user.server';
import { deleteCachedKeys, getCachedJson, setCachedJson } from '@/lib/server-cache';
import type {
  FireworkSpecification,
  ReplayCue,
  Show,
  ShowCue,
  ShoppingListItem,
  ShowGenerationStatus,
  ShowStatus,
} from '@/lib/show-domain';
import { safeParseFireworkSpec } from '@/lib/fireworks/spec';
import { parseLaunchPositions } from '@/lib/fireworks/design';
import type { Database } from '@/lib/database.types';

type ShowRow = Database['public']['Tables']['shows']['Row'];
type ShowCueRow = Database['public']['Tables']['show_cues']['Row'];
type EffectSpecRow = Database['public']['Tables']['effect_specs']['Row'];
type ShowProjection = Pick<
  ShowRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'song'
  | 'artist'
  | 'status'
  | 'duration_seconds'
  | 'budget_cents'
  | 'total_cents'
  | 'effects_count'
  | 'sync_percent'
  | 'safety_meters'
  | 'time_of_day'
  | 'location'
  | 'description'
  | 'mood_tags'
  | 'audio_path'
  | 'music_analysis_id'
  | 'generation_status'
  | 'generation_error'
  | 'generated_cue_count'
  | 'generation_started_at'
  | 'generation_completed_at'
  | 'launch_positions_json'
  | 'updated_at'
>;
type ShowCueProjection = Pick<
  ShowCueRow,
  | 'id'
  | 'position'
  | 'time_seconds'
  | 'description'
  | 'product_id'
  | 'seed_override'
  | 'launch_position_index'
>;
type EffectSpecProjection = Pick<
  EffectSpecRow,
  'id' | 'slug' | 'name' | 'description' | 'duration_seconds' | 'height_meters' | 'spec_json'
>;
type ReplayCueRow = ShowCueProjection;
type ShoppingListComputation = {
  items: ShoppingListItem[];
  effectsCount: number;
};

const CACHE_PREFIX = 'shows:v6';
const SHOWS_TTL_SECONDS = 60;
const FIREWORK_SPECS_TTL_SECONDS = 60 * 10;
const SHOW_SELECT =
  'id, slug, title, song, artist, status, duration_seconds, budget_cents, total_cents, effects_count, sync_percent, safety_meters, time_of_day, location, description, mood_tags, audio_path, music_analysis_id, generation_status, generation_error, generated_cue_count, generation_started_at, generation_completed_at, launch_positions_json, updated_at';
const SHOW_CUE_SELECT =
  'id, position, time_seconds, description, product_id, seed_override, launch_position_index';
const EFFECT_SPEC_SELECT =
  'id, slug, name, description, duration_seconds, height_meters, spec_json';
const SHOW_CUES_WITH_PRODUCT_SELECT = 'product_id, products(id, name, part_number, manufacturer)';

function mapShow(row: ShowProjection): Show {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    song: row.song,
    artist: row.artist,
    status: (row.status as ShowStatus) ?? 'draft',
    durationSeconds: row.duration_seconds,
    budgetCents: row.budget_cents,
    totalCents: row.total_cents,
    effectsCount: row.effects_count,
    syncPercent: row.sync_percent == null ? null : Number(row.sync_percent),
    safetyMeters: row.safety_meters,
    timeOfDay: row.time_of_day,
    location: row.location,
    description: row.description,
    moodTags: row.mood_tags ?? [],
    audioPath: row.audio_path,
    musicAnalysisId: row.music_analysis_id,
    generationStatus: (row.generation_status as ShowGenerationStatus) ?? 'idle',
    generationError: row.generation_error,
    generatedCueCount: row.generated_cue_count,
    generationStartedAt: row.generation_started_at,
    generationCompletedAt: row.generation_completed_at,
    launchPositions: parseLaunchPositions(row.launch_positions_json),
    updatedAt: row.updated_at,
  };
}

function mapCue(row: ShowCueProjection): ShowCue {
  return {
    id: row.id,
    position: row.position,
    timeSeconds: row.time_seconds == null ? null : Number(row.time_seconds),
    description: row.description,
    productId: row.product_id,
    seedOverride: row.seed_override,
    launchPositionIndex: Math.max(
      0,
      Math.min(2, Math.floor(Number(row.launch_position_index ?? 0))),
    ),
  };
}

function mapEffectSpecification(
  row: EffectSpecProjection,
  index = 0,
  caliber: string | null = null,
): FireworkSpecification {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: index,
    durationSeconds: row.duration_seconds,
    heightMeters: row.height_meters,
    caliber,
    shotCount: null,
    spec: safeParseFireworkSpec(row.spec_json),
    rawSpec: row.spec_json,
  };
}

function mapReplayCueBase(row: ReplayCueRow): ShowCue | null {
  if (row.time_seconds == null) return null;
  return mapCue(row);
}

const getServerClient = cache(async () => {
  return createClient(await cookies());
});

export function getUserShowsCacheKey(userId: string): string {
  return `${CACHE_PREFIX}:users:${userId}:shows`;
}

export function getShowBySlugCacheKey(userId: string, slug: string): string {
  return `${CACHE_PREFIX}:users:${userId}:show-by-slug:${slug}`;
}

export function getShowCuesCacheKey(userId: string, showId: string): string {
  return `${CACHE_PREFIX}:users:${userId}:show:${showId}:cues`;
}

export function getShowReplayCuesCacheKey(userId: string, showId: string): string {
  return `${CACHE_PREFIX}:users:${userId}:show:${showId}:replay-cues`;
}

export function getShoppingListCacheKey(userId: string, showId: string): string {
  return `${CACHE_PREFIX}:users:${userId}:show:${showId}:shopping`;
}

export function getFireworkSpecificationsCacheKey(): string {
  return `${CACHE_PREFIX}:firework-specifications`;
}

export async function invalidateShowsCacheForUser(userId: string): Promise<void> {
  await deleteCachedKeys([getUserShowsCacheKey(userId)]);
}

export async function invalidateShowCacheForUser(
  userId: string,
  params: { showId: string; showSlug?: string | null },
): Promise<void> {
  const keys = [
    getUserShowsCacheKey(userId),
    getShowCuesCacheKey(userId, params.showId),
    getShowReplayCuesCacheKey(userId, params.showId),
    getShoppingListCacheKey(userId, params.showId),
  ];
  if (params.showSlug) {
    keys.push(getShowBySlugCacheKey(userId, params.showSlug));
  }
  await deleteCachedKeys(keys);
}

export async function syncShowDerivedFieldsForUser(
  userId: string,
  params: { showId: string; showSlug?: string | null },
): Promise<void> {
  const supabase = await getServerClient();
  const computed = await computeShoppingListForShow(supabase, params.showId);
  if (!computed) return;

  const totalCents = computed.items.reduce((sum, item) => sum + item.qty * item.priceCents, 0);
  await supabase
    .from('shows')
    .update({
      total_cents: totalCents,
      effects_count: computed.effectsCount,
    })
    .eq('id', params.showId)
    .eq('user_id', userId);
  await invalidateShowCacheForUser(userId, params);
}

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

export function getFireworkProductsCacheKey(): string {
  return `${CACHE_PREFIX}:firework-products`;
}

export async function invalidateFireworkCatalogueCaches(): Promise<void> {
  await deleteCachedKeys([getFireworkSpecificationsCacheKey(), getFireworkProductsCacheKey()]);
}

/**
 * Return one FireworkSpecification per product, with the renderer details
 * filled in from the product's first product_shot. This is what the cue
 * builder presents to the user: they pick a *product*, the renderer figures
 * out how many shots to fire (and which design per shot) via product_shots.
 *
 * `id` on the returned rows is `products.id` so the cue-add form can insert
 * directly into `show_cues.product_id`.
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

  // Load product_shots so multi-shot products expand into one ReplayCue per
  // shot. Single-shot products have exactly one row at time_offset_seconds=0.
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

async function computeShoppingListForShow(
  supabase: SupabaseClient<Database>,
  showId: string,
): Promise<ShoppingListComputation | null> {
  const { data: cueRows, error: cueError } = await supabase
    .from('show_cues')
    .select(SHOW_CUES_WITH_PRODUCT_SELECT)
    .eq('show_id', showId);
  if (cueError) {
    console.error('[shows.server] listShoppingItemsForShow cues failed:', cueError);
    return null;
  }
  const effectsCount = cueRows?.length ?? 0;

  // Aggregate qty per product
  const byProduct = new Map<
    string,
    { name: string; partNumber: string; manufacturer: string | null; qty: number }
  >();
  for (const row of cueRows ?? []) {
    const p = row.products as {
      id: string;
      name: string;
      part_number: string;
      manufacturer: string | null;
    } | null;
    if (!p) continue;
    const existing = byProduct.get(p.id);
    if (existing) {
      existing.qty += 1;
    } else {
      byProduct.set(p.id, {
        name: p.name,
        partNumber: p.part_number,
        manufacturer: p.manufacturer,
        qty: 1,
      });
    }
  }

  if (byProduct.size === 0) {
    return { items: [], effectsCount };
  }

  // Fetch cheapest available price per product from supplier inventory
  const productIds = Array.from(byProduct.keys());
  const { data: inventoryRows } = await supabase
    .from('supplier_inventory_items')
    .select('product_id, price_cents')
    .in('product_id', productIds)
    .eq('available', true)
    .not('price_cents', 'is', null);

  const cheapestPrice = new Map<string, number>();
  for (const inv of inventoryRows ?? []) {
    if (inv.product_id == null || inv.price_cents == null) continue;
    const current = cheapestPrice.get(inv.product_id);
    if (current == null || inv.price_cents < current) {
      cheapestPrice.set(inv.product_id, inv.price_cents);
    }
  }

  const items: ShoppingListItem[] = Array.from(byProduct.entries())
    .map(([id, p]) => ({
      id,
      name: p.name,
      qty: p.qty,
      priceCents: cheapestPrice.get(id) ?? 0,
      partNumber: p.partNumber,
      manufacturer: p.manufacturer,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { items, effectsCount };
}

/**
 * Generate a private signed URL for the user's audio asset.
 * Returns null when no audio is attached or the asset is unreachable.
 */
export async function getAudioSignedUrl(
  audioPath: string | null,
  expiresInSeconds = 60 * 30,
): Promise<string | null> {
  if (!audioPath) return null;
  const supabase = await getServerClient();
  const { data, error } = await supabase.storage
    .from('audio')
    .createSignedUrl(audioPath, expiresInSeconds);
  if (error) {
    console.error('[shows.server] getAudioSignedUrl failed:', error);
    return null;
  }
  return data?.signedUrl ?? null;
}
