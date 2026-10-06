// Transport UI budget, milliseconds between running readouts: 10 Hz retains responsive scrubbing.
const PLAYBACK_READOUT_INTERVAL_MS = 100;

/** Gates running clock readouts while reporting pauses, duration changes and backwards seeks immediately. */
export function playbackReadoutGate() {
  let lastMs = -Infinity;
  let previous: { time: number; duration: number; playing: boolean } | undefined;
  return (
    next: { time: number; duration: number; playing: boolean },
    nowMs = performance.now(),
  ) => {
    const immediate =
      !previous ||
      !next.playing ||
      next.playing !== previous.playing ||
      next.duration !== previous.duration ||
      next.time < previous.time;
    if (!immediate && nowMs - lastMs < PLAYBACK_READOUT_INTERVAL_MS) return false;
    if (
      previous &&
      next.time === previous.time &&
      next.duration === previous.duration &&
      next.playing === previous.playing
    )
      return false;
    previous = { ...next };
    lastMs = nowMs;
    return true;
  };
}
