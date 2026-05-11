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
} from "@/lib/shows";
import { safeParseFireworkSpec, type FireworkSpec } from "@/lib/fireworks/spec";
import { parseLaunchPositions } from "@/lib/fireworks/design";
import type { Database, Json } from "@/lib/database.types";

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
  | "effect_spec_id"
  | "catalogue_product_id"
  | "position_json"
  | "rotation_json"
  | "scale"
  | "overrides_json"
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
type ReplayCueRow = ShowCueProjection & {
  effect_specs: EffectSpecProjection | null;
};
type ShoppingItemProjection = Pick<
  ShoppingItemRow,
  "id" | "position" | "name" | "qty" | "price_cents" | "firework_part_number"
>;

const CACHE_PREFIX = "shows:v2";
const SHOWS_TTL_SECONDS = 60;
const FIREWORK_SPECS_TTL_SECONDS = 60 * 10;
const SHOW_SELECT =
  "id, slug, title, song, artist, status, duration_seconds, budget_cents, total_cents, effects_count, sync_percent, safety_meters, time_of_day, location, description, mood_tags, audio_path, launch_positions_json, updated_at";
const SHOW_CUE_SELECT =
  "id, position, time_seconds, description, effect_spec_id, catalogue_product_id, position_json, rotation_json, scale, overrides_json, seed_override, launch_position_index";
const EFFECT_SPEC_SELECT =
  "id, slug, name, description, duration_seconds, height_meters, spec_json";
const SHOPPING_ITEM_SELECT =
  "id, position, name, qty, price_cents, firework_part_number";
const REPLAY_CUE_SELECT = `${SHOW_CUE_SELECT}, effect_specs (${EFFECT_SPEC_SELECT})`;

function isRecord(value: Json | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseVec3(value: Json): { x: number; y: number; z: number } {
  if (!isRecord(value)) return { x: 0, y: 0, z: 0 };
  return {
    x: typeof value.x === "number" && Number.isFinite(value.x) ? value.x : 0,
    y: typeof value.y === "number" && Number.isFinite(value.y) ? value.y : 0,
    z: typeof value.z === "number" && Number.isFinite(value.z) ? value.z : 0,
  };
}

function parseRotation(value: Json): { pan: number; tilt: number; roll: number } {
  if (!isRecord(value)) return { pan: 0, tilt: 90, roll: 0 };
  return {
    pan: typeof value.pan === "number" && Number.isFinite(value.pan) ? value.pan : 0,
    tilt: typeof value.tilt === "number" && Number.isFinite(value.tilt) ? value.tilt : 90,
    roll: typeof value.roll === "number" && Number.isFinite(value.roll) ? value.roll : 0,
  };
}

function parseOverrides(value: Json): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return value as Record<string, unknown>;
}

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
    effectSpecId: row.effect_spec_id,
    catalogueProductId: row.catalogue_product_id,
    positionMeters: parseVec3(row.position_json),
    rotation: parseRotation(row.rotation_json),
    scale: row.scale == null ? 1 : Number(row.scale),
    overrides: parseOverrides(row.overrides_json),
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

function mapReplayCue(row: ReplayCueRow): ReplayCue | null {
  if (row.time_seconds == null) return null;
  if (!row.effect_specs) return null;
  return {
    ...mapCue(row),
    timeSeconds: Number(row.time_seconds),
    firework: mapEffectSpecification(row.effect_specs),
  };
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
    .select(REPLAY_CUE_SELECT)
    .eq("show_id", showId)
    .not("time_seconds", "is", null)
    .not("effect_spec_id", "is", null)
    .order("time_seconds", { ascending: true })
    .order("position", { ascending: true });
  if (error) {
    console.error("[shows.server] listReplayCuesForShow failed:", error);
    return [];
  }

  const rows = (data ?? []) as ReplayCueRow[];

  // Load product_effect_sequences for any catalogue-product cues so the engine
  // can fire the correct multi-shot sequence.
  const productIds = [
    ...new Set(
      rows
        .map((r) => r.catalogue_product_id)
        .filter((id): id is string => id != null),
    ),
  ];

  type SeqRow = {
    product_id: string;
    time_offset_seconds: number;
    pan_degrees: number;
    color: string | null;
    effect_specs: { spec_json: unknown } | null;
  };

  type ShotEntry = NonNullable<FireworkSpec["shots"]>[number];
  const shotsMap = new Map<string, ShotEntry[]>();

  if (productIds.length > 0) {
    const { data: seqs, error: seqErr } = await supabase
      .from("product_effect_sequences")
      .select("product_id, time_offset_seconds, pan_degrees, color, effect_specs(spec_json)")
      .in("product_id", productIds)
      .order("time_offset_seconds", { ascending: true });

    if (seqErr) {
      console.error("[shows.server] product_effect_sequences load failed:", seqErr);
    } else {
      for (const seq of (seqs ?? []) as SeqRow[]) {
        const arr = shotsMap.get(seq.product_id) ?? [];
        const shot: ShotEntry = {
          index: arr.length,
          timeOffsetSeconds: Number(seq.time_offset_seconds),
        };
        if (seq.pan_degrees !== 0) shot.panDegrees = seq.pan_degrees;
        // Prefer the sequence-level color override; fall back to the effect_spec's color
        const specColor =
          seq.color ??
          (typeof (seq.effect_specs?.spec_json as Record<string, unknown>)?.color === "string"
            ? ((seq.effect_specs?.spec_json as Record<string, unknown>).color as string)
            : null);
        if (specColor) shot.color = specColor as `#${string}`;
        arr.push(shot);
        shotsMap.set(seq.product_id, arr);
      }
    }
  }

  const mapped = rows
    .map((row) => {
      const cue = mapReplayCue(row);
      if (!cue) return null;
      // Inject the multi-shot sequence into the firework rawSpec so the engine
      // fires the correct per-tube timing and colours.
      if (row.catalogue_product_id) {
        const shots = shotsMap.get(row.catalogue_product_id);
        if (shots && shots.length > 0) {
          const injectedRaw = { ...(cue.firework.rawSpec as object), shots };
          cue.firework = {
            ...cue.firework,
            rawSpec: injectedRaw,
            spec: safeParseFireworkSpec(injectedRaw),
          };
        }
      }
      return cue;
    })
    .filter((cue): cue is ReplayCue => cue !== null);

  await setCachedJson(cacheKey, mapped, SHOWS_TTL_SECONDS);
  return mapped;
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
