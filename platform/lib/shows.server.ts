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
  FireworkAudioSyncEvent,
  FireworkRenderParams,
  FireworkRenderSection,
  FireworkRenderSpec,
  FireworkSpecification,
  ReplayCue,
  Show,
  ShowCue,
  ShoppingListItem,
  ShowStatus,
} from "@/lib/shows";
import type { Database, Json } from "@/lib/database.types";

type ShowRow = Database["public"]["Tables"]["shows"]["Row"];
type ShowCueRow = Database["public"]["Tables"]["show_cues"]["Row"];
type FireworkSpecificationRow =
  Database["public"]["Tables"]["firework_specifications"]["Row"];
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
  | "updated_at"
>;
type ShowCueProjection = Pick<
  ShowCueRow,
  | "id"
  | "position"
  | "time_seconds"
  | "description"
  | "firework_specification_id"
  | "render_params"
>;
type FireworkSpecificationProjection = Pick<
  FireworkSpecificationRow,
  "id" | "slug" | "name" | "description" | "sort_order" | "spec"
>;
type ReplayCueRow = ShowCueProjection & {
  firework_specifications: FireworkSpecificationProjection | null;
};
type ShoppingItemProjection = Pick<
  ShoppingItemRow,
  "id" | "position" | "name" | "qty" | "price_cents" | "firework_part_number"
>;

const DEFAULT_FIREWORK_SPEC: FireworkRenderSpec = {
  particleCount: 220,
  burstDuration: 2.4,
  colors: ["#00E5FF", "#8B5CF6", "#FF3DF2"],
  spread: 2.6,
  launchHeight: 3,
  gravity: -1.5,
  drag: 0.86,
  sparkSize: 0.075,
  trailLength: 0.65,
};
const CACHE_PREFIX = "shows:v1";
const SHOWS_TTL_SECONDS = 60;
const FIREWORK_SPECS_TTL_SECONDS = 60 * 10;
const SHOW_SELECT =
  "id, slug, title, song, artist, status, duration_seconds, budget_cents, total_cents, effects_count, sync_percent, safety_meters, time_of_day, location, description, mood_tags, audio_path, updated_at";
const SHOW_CUE_SELECT =
  "id, position, time_seconds, description, firework_specification_id, render_params";
const FIREWORK_SPECIFICATION_SELECT =
  "id, slug, name, description, sort_order, spec";
const SHOPPING_ITEM_SELECT =
  "id, position, name, qty, price_cents, firework_part_number";
const REPLAY_CUE_SELECT = `${SHOW_CUE_SELECT}, firework_specifications (${FIREWORK_SPECIFICATION_SELECT})`;

function isRecord(value: Json | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(
  source: Record<string, Json | undefined>,
  key: keyof FireworkRenderSpec,
  fallback: number,
): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readColors(source: Record<string, Json | undefined>): string[] {
  const colors = source.colors;
  if (!Array.isArray(colors)) return DEFAULT_FIREWORK_SPEC.colors;
  const valid = colors.filter(
    (color): color is string => typeof color === "string" && color.length > 0,
  );
  return valid.length > 0 ? valid : DEFAULT_FIREWORK_SPEC.colors;
}

function parseRenderSpec(spec: Json): FireworkRenderSpec {
  if (!isRecord(spec)) return DEFAULT_FIREWORK_SPEC;
  const sections = Array.isArray(spec.sections)
    ? (spec.sections.filter(isRecord) as unknown as FireworkRenderSection[])
    : undefined;
  const audioSync = Array.isArray(spec.audioSync)
    ? (spec.audioSync.filter(isRecord) as unknown as FireworkAudioSyncEvent[])
    : undefined;
  return {
    particleCount: Math.round(
      readNumber(spec, "particleCount", DEFAULT_FIREWORK_SPEC.particleCount),
    ),
    burstDuration: readNumber(
      spec,
      "burstDuration",
      DEFAULT_FIREWORK_SPEC.burstDuration,
    ),
    colors: readColors(spec),
    spread: readNumber(spec, "spread", DEFAULT_FIREWORK_SPEC.spread),
    launchHeight: readNumber(
      spec,
      "launchHeight",
      DEFAULT_FIREWORK_SPEC.launchHeight,
    ),
    gravity: readNumber(spec, "gravity", DEFAULT_FIREWORK_SPEC.gravity),
    drag: readNumber(spec, "drag", DEFAULT_FIREWORK_SPEC.drag),
    sparkSize: readNumber(spec, "sparkSize", DEFAULT_FIREWORK_SPEC.sparkSize),
    trailLength: readNumber(
      spec,
      "trailLength",
      DEFAULT_FIREWORK_SPEC.trailLength,
    ),
    secondaryBursts: readNumber(spec, "secondaryBursts", 0) || undefined,
    sections,
    audioSync,
  };
}

function parseRenderParams(params: Json | null): FireworkRenderParams | null {
  const source = params ?? undefined;
  if (!isRecord(source)) return null;
  const overrides: FireworkRenderParams = {};
  if (typeof source.particleCount === "number") {
    overrides.particleCount = Math.round(source.particleCount);
  }
  if (typeof source.burstDuration === "number") {
    overrides.burstDuration = source.burstDuration;
  }
  if (Array.isArray(source.colors)) {
    overrides.colors = source.colors.filter(
      (color): color is string => typeof color === "string",
    );
  }
  if (typeof source.spread === "number") overrides.spread = source.spread;
  if (typeof source.launchHeight === "number") {
    overrides.launchHeight = source.launchHeight;
  }
  if (typeof source.gravity === "number") overrides.gravity = source.gravity;
  if (typeof source.drag === "number") overrides.drag = source.drag;
  if (typeof source.sparkSize === "number") overrides.sparkSize = source.sparkSize;
  if (typeof source.trailLength === "number") {
    overrides.trailLength = source.trailLength;
  }
  if (typeof source.secondaryBursts === "number") {
    overrides.secondaryBursts = source.secondaryBursts;
  }
  return overrides;
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
    updatedAt: row.updated_at,
  };
}

function mapCue(row: ShowCueProjection): ShowCue {
  return {
    id: row.id,
    position: row.position,
    timeSeconds: row.time_seconds == null ? null : Number(row.time_seconds),
    description: row.description,
    fireworkSpecificationId: row.firework_specification_id,
    renderParams: parseRenderParams(row.render_params),
  };
}

function mapFireworkSpecification(
  row: FireworkSpecificationProjection,
): FireworkSpecification {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    spec: parseRenderSpec(row.spec),
  };
}

function mapReplayCue(row: ReplayCueRow): ReplayCue | null {
  if (row.time_seconds == null || !row.firework_specifications) return null;
  return {
    ...mapCue(row),
    timeSeconds: Number(row.time_seconds),
    firework: mapFireworkSpecification(row.firework_specifications),
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
    .from("firework_specifications")
    .select(FIREWORK_SPECIFICATION_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("[shows.server] listFireworkSpecifications failed:", error);
    return [];
  }
  const mapped = (data ?? []).map(mapFireworkSpecification);
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
    .not("firework_specification_id", "is", null)
    .order("time_seconds", { ascending: true })
    .order("position", { ascending: true });
  if (error) {
    console.error("[shows.server] listReplayCuesForShow failed:", error);
    return [];
  }
  const mapped = ((data ?? []) as ReplayCueRow[])
    .map(mapReplayCue)
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
