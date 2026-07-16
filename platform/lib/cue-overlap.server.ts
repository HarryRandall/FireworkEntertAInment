/**
 * Cue-overlap helpers used by the cue builder.
 *
 * A cue occupies a tube (launch position) for the product's full airtime.
 * We refuse overlapping cues on the same tube so the catalogue's safety
 * delay is preserved. This module hides the catalogue lookup so callers can
 * just ask "how long is this product on the tube?".
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export const MIN_PRODUCT_DURATION_SECONDS = 0.5;

type AppSupabase = SupabaseClient<Database>;

function finiteOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function greatestPositiveDuration(...values: Array<number | null>): number | null {
  const durations = values.filter((value): value is number => value != null && value > 0);
  return durations.length > 0 ? Math.max(...durations) : null;
}

// Total airtime a catalogue item occupies on a tube. Use the greatest stored,
// renderer, or child duration so application checks match the database guard.
export async function getProductDurationSeconds(
  supabase: AppSupabase,
  catalogueItemId: string,
): Promise<number | null> {
  const { data: item, error: itemError } = await supabase
    .from('catalogue_items')
    .select('duration_seconds, firework_id, multishot_id, fireworks(duration_seconds)')
    .eq('id', catalogueItemId)
    .maybeSingle();
  if (itemError) {
    throw new Error('Could not read the catalogue item duration.', { cause: itemError });
  }
  const itemDuration = finiteOrNull(item?.duration_seconds);
  const directRow = Array.isArray(item?.fireworks) ? item.fireworks[0] : item?.fireworks;
  const directDuration = finiteOrNull(directRow?.duration_seconds);
  const directSafeDuration = greatestPositiveDuration(itemDuration, directDuration);
  if (!item?.multishot_id) return directSafeDuration;

  const { data: shots, error: shotsError } = await supabase
    .from('multishot_fireworks')
    .select('time_offset_seconds, fireworks(duration_seconds, catalogue_items(duration_seconds))')
    .eq('multishot_id', item.multishot_id);
  if (shotsError) {
    throw new Error('Could not read the multishot duration.', { cause: shotsError });
  }
  if (!shots || shots.length === 0) return directSafeDuration;
  let multishotDuration = 0;
  for (const shot of shots as Array<{
    time_offset_seconds: number;
    fireworks: {
      duration_seconds: number | null;
      catalogue_items: Array<{ duration_seconds: number | null }>;
    } | null;
  }>) {
    // A child with an unknown duration still occupies the tube; assume the
    // minimum rather than 0 so we never under-estimate multishot airtime.
    const childCatalogueDuration = greatestPositiveDuration(
      ...(shot.fireworks?.catalogue_items ?? []).map((item) => finiteOrNull(item.duration_seconds)),
    );
    const duration =
      greatestPositiveDuration(
        childCatalogueDuration,
        finiteOrNull(shot.fireworks?.duration_seconds),
        MIN_PRODUCT_DURATION_SECONDS,
      ) ?? MIN_PRODUCT_DURATION_SECONDS;
    const end = Math.ceil(((finiteOrNull(shot.time_offset_seconds) ?? 0) + duration) * 100) / 100;
    if (end > multishotDuration) multishotDuration = end;
  }
  return greatestPositiveDuration(directSafeDuration, multishotDuration);
}

export type CueWindow = {
  timeSeconds: number;
  durationSeconds: number;
  launchPositionIndex: number;
};

// Returns the conflicting window if `candidate` overlaps any cue in `existing`
// on the same tube, otherwise null. A tube is "busy" from cue.timeSeconds
// through cue.timeSeconds + duration.
export function findTubeOverlap<T extends CueWindow>(
  candidate: CueWindow,
  existing: T[],
): T | null {
  // Coerce non-finite durations to the minimum so a bad value can't silently
  // disable overlap detection (NaN comparisons are always false).
  const candStart = candidate.timeSeconds;
  const candEnd =
    candStart + (finiteOrNull(candidate.durationSeconds) ?? MIN_PRODUCT_DURATION_SECONDS);
  for (const other of existing) {
    if (other.launchPositionIndex !== candidate.launchPositionIndex) continue;
    const otherStart = other.timeSeconds;
    const otherEnd =
      otherStart + (finiteOrNull(other.durationSeconds) ?? MIN_PRODUCT_DURATION_SECONDS);
    if (candStart < otherEnd && otherStart < candEnd) return other;
  }
  return null;
}
