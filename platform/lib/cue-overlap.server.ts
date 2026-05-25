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

// Total airtime a product occupies on a tube. Prefer the pre-aggregated
// `products.duration_seconds`; fall back to the largest
// `time_offset_seconds + effect_specs.duration_seconds` from `product_shots`.
export async function getProductDurationSeconds(
  supabase: AppSupabase,
  productId: string,
): Promise<number | null> {
  const { data: product } = await supabase
    .from('products')
    .select('duration_seconds')
    .eq('id', productId)
    .maybeSingle();
  if (product?.duration_seconds != null) return Number(product.duration_seconds);

  const { data: shots } = await supabase
    .from('product_shots')
    .select('time_offset_seconds, effect_specs!inner(duration_seconds)')
    .eq('product_id', productId);
  if (!shots || shots.length === 0) return null;
  let max = 0;
  for (const shot of shots as Array<{
    time_offset_seconds: number;
    effect_specs: { duration_seconds: number } | null;
  }>) {
    const end =
      Number(shot.time_offset_seconds ?? 0) + Number(shot.effect_specs?.duration_seconds ?? 0);
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
