/** Local reference timing accepts measured onsets without coupling Studio to analysis storage. */
import { z } from 'zod';
const MS_PER_SECOND = 1000; // Milliseconds in one second, the video_analyses shot clock's unit.
const measuredShots = z.array(z.object({ t_ms: z.number().finite().nonnegative() }));

/** Reads unknown video_analyses shots and returns sorted onset seconds from the clip start. */
export function measuredShotTimes(shots: unknown): number[] {
  return measuredShots
    .parse(shots)
    .map((shot) => shot.t_ms / MS_PER_SECOND)
    .sort((a, b) => a - b);
}
/** Maps firing-relative draft seconds to clip seconds, clamped to the loaded clip's duration.
 * The selected measured onset defaults to zero for local clips; no inputs are mutated.
 */
export function referenceTime(timeS: number, durationS: number, onsetS = 0): number {
  return Math.max(0, Math.min(durationS, timeS + onsetS));
}
