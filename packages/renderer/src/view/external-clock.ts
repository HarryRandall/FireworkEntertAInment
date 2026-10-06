/** Sampling a soundtrack clock without repeatedly resetting the effect sound scheduler. */
import type { Viewer } from './viewer';
import type { ViewerSound } from './sound/scheduler';

// Maximum continuous clock tick, seconds; longer jumps are seeks rather than video-frame cadence.
const CLOCK_JUMP_S = 0.1;

/** Updates external sequence seconds; pauses hush voices and discontinuities restart the scheduler. */
export function syncViewerClock(
  viewer: Viewer,
  sound: Pick<ViewerSound, 'reset' | 'hush'>,
  time_s: number,
  playing: boolean,
): void {
  if (!Number.isFinite(time_s)) throw new RangeError('Show time must be finite');
  viewer.externalClock = true;
  const next = Math.max(0, Math.min(viewer.duration, time_s));
  if (Math.abs(next - viewer.t) > CLOCK_JUMP_S || playing !== viewer.playing) sound.reset(next);
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
