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
export type ShowCueRow = Database['public']['Tables']['show_cues']['Row'];
export type EffectSpecRow = Database['public']['Tables']['effect_specs']['Row'];

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
  | 'updated_at'
>;

/** Subset of `show_cues` columns used by both authoring and replay views. */
export type ShowCueProjection = Pick<
  ShowCueRow,
  | 'id'
  | 'position'
  | 'time_seconds'
  | 'description'
  | 'product_id'
  | 'seed_override'
  | 'launch_position_index'
>;

/** Subset of `effect_specs` columns the renderer needs. */
export type EffectSpecProjection = Pick<
  EffectSpecRow,
  'id' | 'slug' | 'name' | 'description' | 'duration_seconds' | 'height_meters' | 'spec_json'
>;

/** Replay-time row alias — same shape as the authoring projection today. */
export type ReplayCueRow = ShowCueProjection;

/** Result of a single shopping-list computation pass. */
export type ShoppingListComputation = {
  items: ShoppingListItem[];
  effectsCount: number;
};

/** Cache namespace for everything in this module. Bump the version on schema-affecting changes. */
export const CACHE_PREFIX = 'shows:v6';
/** TTL for show/cue/shopping reads. Short so mutations don't need to wait for invalidation propagation. */
export const SHOWS_TTL_SECONDS = 60;
/** TTL for the firework catalogue lookups — they rarely change. */
export const FIREWORK_SPECS_TTL_SECONDS = 60 * 10;

export const SHOW_SELECT =
  'id, slug, title, song, artist, status, duration_seconds, budget_cents, total_cents, effects_count, sync_percent, safety_meters, time_of_day, location, description, mood_tags, audio_path, music_analysis_id, generation_status, generation_error, generated_cue_count, generation_started_at, generation_completed_at, launch_positions_json, updated_at';
export const SHOW_CUE_SELECT =
  'id, position, time_seconds, description, product_id, seed_override, launch_position_index';
export const EFFECT_SPEC_SELECT =
  'id, slug, name, description, duration_seconds, height_meters, spec_json';
export const SHOW_CUES_WITH_PRODUCT_SELECT =
  'product_id, products(id, name, part_number, manufacturer)';
