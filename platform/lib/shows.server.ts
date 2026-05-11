import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUserId } from "@/lib/current-user.server";
import {
  deleteCachedKeys,
  getCachedJson,
  setCachedJson,
} from "@/lib/server-cache";
import type {
  FireworkSpecification,
  ReplayCue,
  Show,
  ShowCue,
  ShoppingListItem,
  ShowStatus,
} from "@/lib/show-domain";
import { safeParseFireworkSpec } from "@/lib/fireworks/spec";
import { parseLaunchPositions } from "@/lib/fireworks/design";
import type { Database } from "@/lib/database.types";

type ShowRow = Database["public"]["Tables"]["shows"]["Row"];
type ShowCueRow = Database["public"]["Tables"]["show_cues"]["Row"];
type EffectSpecRow = Database["public"]["Tables"]["effect_specs"]["Row"];
type ShoppingItemRow =
  Database["public"]["Tables"]["shopping_list_items"]["Row"];
type ShowProjection = Pick<
  ShowRow,
  | "id"
  | "slug"
  | "title"
  | "song"
  | "artist"
  | "status"
  | "duration_seconds"
  | "budget_cents"
  | "total_cents"
  | "effects_count"
  | "sync_percent"
  | "safety_meters"
  | "time_of_day"
  | "location"
  | "description"
  | "mood_tags"
  | "audio_path"
  | "launch_positions_json"
  | "updated_at"
>;
type ShowCueProjection = Pick<
  ShowCueRow,
  | "id"
  | "position"
  | "time_seconds"
  | "description"
  | "product_id"
  | "seed_override"
  | "launch_position_index"
>;
type EffectSpecProjection = Pick<
  EffectSpecRow,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "duration_seconds"
  | "height_meters"
  | "spec_json"
>;
type ReplayCueRow = ShowCueProjection;
type ShoppingItemProjection = Pick<
  ShoppingItemRow,
  "id" | "position" | "name" | "qty" | "price_cents" | "firework_part_number"
>;

const CACHE_PREFIX = "shows:v5";
const SHOWS_TTL_SECONDS = 60;
const FIREWORK_SPECS_TTL_SECONDS = 60 * 10;
const SHOW_SELECT =
  "id, slug, title, song, artist, status, duration_seconds, budget_cents, total_cents, effects_count, sync_percent, safety_meters, time_of_day, location, description, mood_tags, audio_path, launch_positions_json, updated_at";
const SHOW_CUE_SELECT =
  "id, position, time_seconds, description, product_id, seed_override, launch_position_index";
const EFFECT_SPEC_SELECT =
  "id, slug, name, description, duration_seconds, height_meters, spec_json";
const SHOPPING_ITEM_SELECT =
  "id, position, name, qty, price_cents, firework_part_number";

function mapShow(row: ShowProjection): Show {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    song: row.song,
    artist: row.artist,
    status: (row.status as ShowStatus) ?? "draft",
    durationSeconds: row.duration_seconds,
    budgetCents: row.budget_cents,
    totalCents: row.total_cents,
    effectsCount: row.effects_count,
    syncPercent:
      row.sync_percent == null ? null : Number(row.sync_percent),
    safetyMeters: row.safety_meters,
    timeOfDay: row.time_of_day,
    location: row.location,
    description: row.description,
    moodTags: row.mood_tags ?? [],
    audioPath: row.audio_path,
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
): FireworkSpecification {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: index,
    durationSeconds: row.duration_seconds,
    heightMeters: row.height_meters,
    spec: safeParseFireworkSpec(row.spec_json),
    rawSpec: row.spec_json,
  };
}

function mapReplayCueBase(row: ReplayCueRow): ShowCue | null {
  if (row.time_seconds == null) return null;
  return mapCue(row);
}

function mapShoppingItem(row: ShoppingItemProjection): ShoppingListItem {
  return {
    id: row.id,
    position: row.position,
    name: row.name,
    qty: row.qty,
    priceCents: row.price_cents,
    fireworkPartNumber: row.firework_part_number,
  };
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

export async function listShowsForCurrentUser(): Promise<Show[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const cacheKey = getUserShowsCacheKey(userId);
  const cached = await getCachedJson<Show[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("shows")
    .select(SHOW_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[shows.server] listShowsForCurrentUser failed:", error);
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
    .from("shows")
    .select(SHOW_SELECT)
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[shows.server] getShowBySlug failed:", error);
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
    .from("show_cues")
    .select(SHOW_CUE_SELECT)
    .eq("show_id", showId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[shows.server] listCuesForShow failed:", error);
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
    .from("effect_specs")
    .select(EFFECT_SPEC_SELECT)
    .order("name", { ascending: true });
  if (error) {
    console.error("[shows.server] listFireworkSpecifications failed:", error);
    return [];
  }
  const mapped = ((data ?? []) as EffectSpecProjection[]).map(mapEffectSpecification);
  await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
  return mapped;
}

export function getFireworkProductsCacheKey(): string {
  return `${CACHE_PREFIX}:firework-products`;
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
    .from("products")
    .select(
      `id, name, part_number, description, duration_seconds,
       product_shots (
         shot_index,
         effect_specs (${EFFECT_SPEC_SELECT})
       )`,
    )
    .order("name", { ascending: true });
  if (error) {
    console.error("[shows.server] listFireworkProducts failed:", error);
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
      effect_specs: EffectSpecProjection | null;
    }>;
  };

  const mapped: FireworkSpecification[] = [];
  for (const row of (data ?? []) as ProductRow[]) {
    const shots = [...(row.product_shots ?? [])].sort(
      (a, b) => a.shot_index - b.shot_index,
    );
    const primary = shots.find((s) => s.effect_specs != null);
    if (!primary?.effect_specs) continue;
    const effectSpec = primary.effect_specs;
    mapped.push({
      id: row.id,
      slug: row.part_number,
      name: row.name,
      description: row.description ?? effectSpec.description,
      sortOrder: mapped.length,
      durationSeconds: row.duration_seconds ?? effectSpec.duration_seconds,
      heightMeters: effectSpec.height_meters,
      spec: safeParseFireworkSpec(effectSpec.spec_json),
      rawSpec: effectSpec.spec_json,
    });
  }

  await setCachedJson(cacheKey, mapped, FIREWORK_SPECS_TTL_SECONDS);
  return mapped;
}

export async function listReplayCuesForShow(
  showId: string,
): Promise<ReplayCue[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const cacheKey = getShowReplayCuesCacheKey(userId, showId);
  const cached = await getCachedJson<ReplayCue[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("show_cues")
    .select(SHOW_CUE_SELECT)
    .eq("show_id", showId)
    .not("time_seconds", "is", null)
    .order("time_seconds", { ascending: true })
    .order("position", { ascending: true });
  if (error) {
    console.error("[shows.server] listReplayCuesForShow failed:", error);
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
    effect_specs: EffectSpecProjection | null;
  };

  type ShotSpec = { timeOffsetSeconds: number; firework: FireworkSpecification };
  const shotsByProduct = new Map<string, ShotSpec[]>();

  if (productIds.length > 0) {
    const { data: shots, error: shotsErr } = await supabase
      .from("product_shots")
      .select(
        `product_id, shot_index, time_offset_seconds, effect_specs (${EFFECT_SPEC_SELECT})`,
      )
      .in("product_id", productIds)
      .order("shot_index", { ascending: true });

    if (shotsErr) {
      console.error("[shows.server] product_shots load failed:", shotsErr);
    } else {
      for (const shot of (shots ?? []) as ShotRow[]) {
        if (!shot.effect_specs) continue;
        const arr = shotsByProduct.get(shot.product_id) ?? [];
        arr.push({
          timeOffsetSeconds: Number(shot.time_offset_seconds),
          firework: mapEffectSpecification(shot.effect_specs, arr.length),
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

export async function listShoppingItemsForShow(
  showId: string,
): Promise<ShoppingListItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const cacheKey = getShoppingListCacheKey(userId, showId);
  const cached = await getCachedJson<ShoppingListItem[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select(SHOPPING_ITEM_SELECT)
    .eq("show_id", showId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[shows.server] listShoppingItemsForShow failed:", error);
    return [];
  }
  const mapped = (data ?? []).map(mapShoppingItem);
  await setCachedJson(cacheKey, mapped, SHOWS_TTL_SECONDS);
  return mapped;
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
    .from("audio")
    .createSignedUrl(audioPath, expiresInSeconds);
  if (error) {
    console.error("[shows.server] getAudioSignedUrl failed:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}
