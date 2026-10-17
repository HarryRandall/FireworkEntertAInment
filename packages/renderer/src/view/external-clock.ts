/** Sampling a soundtrack clock without repeatedly resetting the effect sound scheduler. */
import type { Viewer } from './viewer';
import type { ViewerSound } from './sound/scheduler';

// Maximum backward clock tick, seconds; media clocks settle slightly after a seek lands.
const CLOCK_JUMP_S = 0.1;
// How far beyond the real time that passed the media may advance in one sample and still be
// continuous playback, seconds. Slow frames (6 FPS, a 400 ms stall on a dense show, a hidden tab)
// advance the media by exactly the wall time that passed; only a seek advances it by more.
// Cutting every voice on each slow frame is what made effect audio drop out at low frame rates.
// Media clocks are coarse on some engines, so the slack covers a quarter-second update step.
const CLOCK_SEEK_S = 0.35;

/**
 * Whether a clock sample is a transport discontinuity rather than a continuous (if late) tick.
 * `wall_s` is the real time since the previous sample; unknown on the first sample.
 */
export function isClockDiscontinuity(
  previous_s: number,
  next_s: number,
  playing: boolean,
  wall_s: number | null = null,
): boolean {
  const delta = next_s - previous_s;
  if (delta < -CLOCK_JUMP_S) return true;
  if (!playing) return delta > CLOCK_JUMP_S;
  return delta - Math.max(0, wall_s ?? 0) > CLOCK_SEEK_S;
}

const MS_PER_S = 1000;

/** One reading of the soundtrack clock; `now_s` defaults to the monotonic wall clock. */
export type ClockSample = { time_s: number; playing: boolean; now_s?: number };

/** Records the sample's wall time and returns the real seconds since the previous sample. */
function wallSecondsSinceLastSample(viewer: Viewer, now_s: number): number | null {
  const previous = viewer.clockSampledAt_s;
  viewer.clockSampledAt_s = now_s;
  return typeof previous === 'number' ? now_s - previous : null;
}

/** Whether this sample restarts the scheduler: a transport change, or a jump that is not playback. */
function needsSoundReset(viewer: Viewer, next: number, playing: boolean, wall_s: number | null) {
  if (playing !== viewer.playing) return true;
  return isClockDiscontinuity(viewer.t, next, playing && viewer.playing, wall_s);
}

/** Updates external sequence seconds; pauses hush voices and discontinuities restart the scheduler. */
export function syncViewerClock(
  viewer: Viewer,
  sound: Pick<ViewerSound, 'reset' | 'hush'>,
  { time_s, playing, now_s = performance.now() / MS_PER_S }: ClockSample,
): void {
  if (!Number.isFinite(time_s)) throw new RangeError('Show time must be finite');
  viewer.externalClock = true;
  const next = Math.max(0, Math.min(viewer.duration, time_s));
  const wall_s = wallSecondsSinceLastSample(viewer, now_s);
  if (needsSoundReset(viewer, next, playing, wall_s)) sound.reset(next);
  if (!playing && viewer.playing) sound.hush();
  const changed = next !== viewer.t || playing !== viewer.playing;
  viewer.playing = playing;
  if (next !== viewer.t) viewer.t = next;
  if (changed) viewer.invalidate();
}

/** Subscribes to viewer transport changes, emitting the initial state exactly once. */
export function subscribeViewer(
  state: { viewer: Viewer; disposed: boolean; listeners: Set<(viewer: Viewer) => void> },
  listener: (viewer: Viewer) => void,
): () => void {
  if (state.disposed) return () => {};
  state.listeners.add(listener);
  listener(state.viewer);
  return () => {
    state.listeners.delete(listener);
  };
}
