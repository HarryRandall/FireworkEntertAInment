/**
 * Shared projection/select types and cache constants for the shows module.
 *
 * Splitting these out lets server modules import row shapes without pulling in
 * the heavy server-only data access code. Keep this file dependency-free
 * beyond the generated DB types.
 */
import type { Database } from '@/lib/database.types';
import type { ShoppingListItem } from '@/lib/show-domain';

export type ShowRow = Database['public']['Tables']['shows']['Row'];
export type ShowCueRow = Database['public']['Tables']['show_timeline_items']['Row'];
export type FireworkEffectRow = Database['public']['Tables']['firework_effects']['Row'];
export type FireworkVariantRow = Database['public']['Tables']['fireworks']['Row'];

/** Subset of `shows` columns the UI actually consumes. Keep in sync with {@link SHOW_SELECT}. */
export type ShowProjection = Pick<
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
  | 'cover_shader'
  | 'updated_at'
  | 'cover_image_path'
>;

/** Subset of `show_timeline_items` columns used by both authoring and replay views. */
export type ShowCueProjection = Pick<
  ShowCueRow,
  | 'id'
  | 'show_id'
  | 'position'
  | 'time_seconds'
  | 'description'
  | 'catalogue_item_id'
  | 'seed_override'
  | 'launch_position_index'
  | 'emphasis'
>;

export type FireworkEffectProjection = Pick<
  FireworkEffectRow,
  'id' | 'slug' | 'name' | 'pattern_key' | 'model_json'
>;

export type CatalogueFireworkCardProjection = Pick<
  FireworkVariantRow,
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'primary_color'
  | 'secondary_color'
  | 'color_palette'
  | 'caliber'
  | 'duration_seconds'
  | 'height_meters'
> & {
  firework_effects:
    | Pick<FireworkEffectRow, 'id' | 'slug' | 'name' | 'pattern_key'>
    | Pick<FireworkEffectRow, 'id' | 'slug' | 'name' | 'pattern_key'>[]
    | null;
};

export type FireworkVariantProjection = Pick<
  FireworkVariantRow,
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'primary_color'
  | 'secondary_color'
  | 'color_palette'
  | 'caliber'
  | 'duration_seconds'
  | 'height_meters'
  | 'render_overrides_json'
  | 'variant_json'
> & {
  firework_effects: FireworkEffectProjection | FireworkEffectProjection[] | null;
};

/** Replay-time row alias — same shape as the authoring projection today. */
export type ReplayCueRow = ShowCueProjection;

/** Result of a single shopping-list computation pass. */
export type ShoppingListComputation = {
  items: ShoppingListItem[];
  effectsCount: number;
};

/** Cache namespace for everything in this module. Bump the version on schema-affecting changes. */
export const CACHE_PREFIX = 'shows:v12';
/** TTL for show/cue/shopping reads. Short so mutations don't need to wait for invalidation propagation. */
export const SHOWS_TTL_SECONDS = 60;
/** TTL for the firework catalogue lookups — they rarely change. */
export const FIREWORK_SPECS_TTL_SECONDS = 60 * 10;

export const SHOW_SELECT =
  'id, slug, title, song, artist, status, duration_seconds, budget_cents, total_cents, effects_count, sync_percent, safety_meters, time_of_day, location, description, mood_tags, audio_path, music_analysis_id, generation_status, generation_error, generated_cue_count, generation_started_at, generation_completed_at, launch_positions_json, cover_shader, updated_at, cover_image_path';
export const SHOW_CUE_SELECT =
  'id, show_id, position, time_seconds, description, catalogue_item_id, seed_override, launch_position_index, emphasis';
export const FIREWORK_VARIANT_SELECT =
  'id, slug, name, description, primary_color, secondary_color, color_palette, caliber, duration_seconds, height_meters, render_overrides_json, variant_json, firework_effects(id, slug, name, pattern_key, model_json)';
/** Lighter fireworks projection for browse-only catalogue cards. */
export const CATALOGUE_FIREWORK_CARD_SELECT =
  'id, slug, name, description, primary_color, secondary_color, color_palette, caliber, duration_seconds, height_meters, firework_effects(id, slug, name, pattern_key)';
export const SHOW_CUES_WITH_PRODUCT_SELECT =
  'catalogue_item_id, catalogue_items(id, name, part_number, manufacturer)';
