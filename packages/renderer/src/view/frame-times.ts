/** Rolling animation-frame cadence readout for local developer performance comparisons. */
// A 120-playing-frame window spans roughly two seconds at 60 Hz, without imposing a frame rate.
const FRAME_WINDOW = 120;
// Nearest-rank 95th percentile, a conventional summary of slower frames.
const TAIL_PERCENTILE = 0.95;
/** Frame interval summary in milliseconds; samples excludes pauses and visibility gaps. */
export interface FrameTimeSummary {
  medianMs: number;
  p95Ms: number;
  samples: number;
  window: number;
}
/** Tracks only visible playback intervals, with bounded reusable storage. */
export class FrameTimes {
  private readonly values = new Float64Array(FRAME_WINDOW);
  private cursor = 0;
  private samples = 0;
  /** Records a positive animation-frame interval in milliseconds. */
  record(intervalMs: number): void {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    this.values[this.cursor] = intervalMs;
    this.cursor = (this.cursor + 1) % FRAME_WINDOW;
    this.samples = Math.min(this.samples + 1, FRAME_WINDOW);
  }
  /** Clears the window when the scene or spray path changes. */
  reset(): void {
    this.cursor = 0;
    this.samples = 0;
  }
  /** Returns median and nearest-rank p95 in milliseconds for the current populated window. */
  summary(): FrameTimeSummary {
    const sorted = this.values.slice(0, this.samples).sort();
    const middle = Math.floor(this.samples / 2);
    const medianMs =
      this.samples % 2 === 0
        ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
        : (sorted[middle] ?? 0);
    return {
      medianMs,
      p95Ms: sorted[Math.ceil(this.samples * TAIL_PERCENTILE) - 1] ?? 0,
      samples: this.samples,
      window: FRAME_WINDOW,
    };
  }
}
