import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type {
  Show,
  ShowCue,
  ShoppingListItem,
  ShowStatus,
} from "@/lib/shows";
import type { Database } from "@/lib/database.types";

type ShowRow = Database["public"]["Tables"]["shows"]["Row"];
type ShowCueRow = Database["public"]["Tables"]["show_cues"]["Row"];
type ShoppingItemRow =
  Database["public"]["Tables"]["shopping_list_items"]["Row"];

function mapShow(row: ShowRow): Show {
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

function mapCue(row: ShowCueRow): ShowCue {
  return {
    id: row.id,
    position: row.position,
    timeSeconds: row.time_seconds == null ? null : Number(row.time_seconds),
    description: row.description,
  };
}

function mapShoppingItem(row: ShoppingItemRow): ShoppingListItem {
  return {
    id: row.id,
    position: row.position,
    name: row.name,
    qty: row.qty,
    priceCents: row.price_cents,
    fireworkPartNumber: row.firework_part_number,
  };
}

async function getServerClient() {
  return createClient(await cookies());
}

export async function listShowsForCurrentUser(): Promise<Show[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[shows.server] listShowsForCurrentUser failed:", error);
    return [];
  }
  return (data ?? []).map(mapShow);
}

export async function getShowBySlug(slug: string): Promise<Show | null> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[shows.server] getShowBySlug failed:", error);
    return null;
  }
  return data ? mapShow(data) : null;
}

export async function listCuesForShow(showId: string): Promise<ShowCue[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("show_cues")
    .select("*")
    .eq("show_id", showId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[shows.server] listCuesForShow failed:", error);
    return [];
  }
  return (data ?? []).map(mapCue);
}

export async function listShoppingItemsForShow(
  showId: string,
): Promise<ShoppingListItem[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("show_id", showId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[shows.server] listShoppingItemsForShow failed:", error);
    return [];
  }
  return (data ?? []).map(mapShoppingItem);
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
