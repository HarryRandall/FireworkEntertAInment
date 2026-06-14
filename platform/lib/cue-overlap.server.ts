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

// Total airtime a catalogue item occupies on a tube. Prefer the pre-aggregated
// `catalogue_items.duration_seconds`; fall back to the linked firework or the
// largest child firework in a multishot.
export async function getProductDurationSeconds(
  supabase: AppSupabase,
  catalogueItemId: string,
): Promise<number | null> {
  const { data: item } = await supabase
    .from('catalogue_items')
    .select('duration_seconds, firework_id, multishot_id, fireworks(duration_seconds)')
    .eq('id', catalogueItemId)
    .maybeSingle();
  if (item?.duration_seconds != null) return Number(item.duration_seconds);
  const directDuration = Array.isArray(item?.fireworks)
    ? item.fireworks[0]?.duration_seconds
    : item?.fireworks?.duration_seconds;
  if (directDuration != null) return Number(directDuration);
  if (!item?.multishot_id) return null;

  const { data: shots } = await supabase
    .from('multishot_fireworks')
    .select('time_offset_seconds, fireworks(duration_seconds)')
    .eq('multishot_id', item.multishot_id);
  if (!shots || shots.length === 0) return null;
  let max = 0;
  for (const shot of shots as Array<{
    time_offset_seconds: number;
    fireworks: { duration_seconds: number | null } | null;
  }>) {
    const duration = shot.fireworks?.duration_seconds ?? 0;
    const end = Number(shot.time_offset_seconds ?? 0) + Number(duration);
    if (end > max) max = end;
  }
  return max;
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
  const candStart = candidate.timeSeconds;
  const candEnd = candStart + candidate.durationSeconds;
  for (const other of existing) {
    if (other.launchPositionIndex !== candidate.launchPositionIndex) continue;
    const otherStart = other.timeSeconds;
    const otherEnd = otherStart + other.durationSeconds;
    if (candStart < otherEnd && otherStart < candEnd) return other;
  }
  return null;
}
