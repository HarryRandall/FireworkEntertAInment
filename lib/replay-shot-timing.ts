/** Direct catalogue fireworks start exactly at their persisted show cue time. */
export const DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS = 0;

/** Resolve a persisted show launch plus any catalogue multishot child offset. */
export function showReplayShotTimeSeconds(
  cueTimeSeconds: number,
  shotTimeOffsetSeconds: number,
): number {
  return cueTimeSeconds + shotTimeOffsetSeconds;
}
