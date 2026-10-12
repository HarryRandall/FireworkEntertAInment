/** A deterministic stand-in for an analysed song: loudness peaks that swell around each cue. */

/** Tempo of the demo track in beats per minute. */
export const DEMO_TRACK_BPM = 128;
const SECONDS_PER_MINUTE = 60;
/** Bars drawn across the whole track. */
const DEFAULT_BUCKETS = 160;
/** Quietest bar, as a share of full height, so silence still reads as a track. */
const FLOOR = 0.08;
/** Seconds either side of a cue that its swell spans. */
const CUE_SPREAD_SECONDS = 0.45;

/** Small repeatable variation per bar, in [0, 1). */
function jitter(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Loudness per bar in [0, 1] for a track of `durationSeconds`. The track builds towards the
 * end, pulses on the beat and swells at each cue time, the way the planner's analysis lines
 * shells up with the music. Values are rounded so server and client markup match.
 */
export function waveformPeaks(
  durationSeconds: number,
  cueTimes: readonly number[],
  buckets = DEFAULT_BUCKETS,
): number[] {
  const beatSeconds = SECONDS_PER_MINUTE / DEMO_TRACK_BPM;
  return Array.from({ length: buckets }, (_, index) => {
    const t = ((index + 0.5) / buckets) * durationSeconds;
    const build = 0.2 + 0.35 * (t / durationSeconds) ** 1.4;
    const beatPhase = (t % beatSeconds) / beatSeconds;
    const beat = 0.14 * (1 - beatPhase) ** 3;
    let swell = 0;
    for (const cue of cueTimes) swell += 0.3 * Math.exp(-(((t - cue) / CUE_SPREAD_SECONDS) ** 2));
    const value = build + beat + Math.min(0.4, swell) + 0.12 * (jitter(index) - 0.5);
    return Math.round(Math.max(FLOOR, Math.min(1, value)) * 1000) / 1000;
  });
}

/** `m:ss` for a non-negative number of seconds. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / SECONDS_PER_MINUTE)}:${(total % SECONDS_PER_MINUTE)
    .toString()
    .padStart(2, '0')}`;
}
