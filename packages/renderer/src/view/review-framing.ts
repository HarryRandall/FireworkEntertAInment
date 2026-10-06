/** Review still moments retain the prototype's developed trail timing. */
import { type Design } from '../schema/index';
import { shotDuration } from '../sim/index';
// Review stills show developed trails: half a second after apex, or half way through ground effects.
const REVIEW_AFTER_APEX_S = 0.5;
const GROUND_REVIEW_FRACTION = 0.4;
/** Chooses a readable review time in seconds for a stored design. */
export function reviewTime(design: Design): number {
  return design.launch
    ? design.launch.time_s + REVIEW_AFTER_APEX_S
    : shotDuration(design) * GROUND_REVIEW_FRACTION;
}
