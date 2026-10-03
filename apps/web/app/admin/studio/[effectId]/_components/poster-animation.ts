/** One serial poster animation per visible card, using the renderer's shared WebGL surface. */
import type { Design } from '@showcrafter/fireworks';
import { previewWindow, type PreviewWindow } from '@/lib/studio/preview-window';
import { developedTime, poster } from '@showcrafter/fireworks/poster';

const POSTER_WIDTH_PX = 240; // Prototype preview width, CSS pixels.
const POSTER_HEIGHT_PX = 150; // Prototype preview aspect, CSS pixels.
const FRAME_INTERVAL_MS = 33; // Prototype small-card target, approximately 30 fps.
const MS_PER_SECOND = 1000;
const LOOP_GAP_S = 0.4; // Prototype pause between loops, seconds.
const MIN_LOOP_S = 0.6; // Prototype shortest useful clip, seconds.
const CAMERA_HEIGHT_RATIO = 0.3; // Prototype climb framing, fraction of apex metres.
const CAMERA_DISTANCE_RATIO = 1.5; // Prototype camera distance, fraction of apex metres.

/** Serialises captures, suppresses stale completion and cancels pending frames on disposal. */
export class PosterAnimation {
  private readonly window: PreviewWindow;
  private readonly still_s: number;
  private cancelled = false;
  private frame = 0;
  private last = 0;
  private readonly start = performance.now();
  private readonly media = matchMedia('(prefers-reduced-motion: reduce)');
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly document: Design,
    private readonly options: { loop: boolean; climb: boolean; address: string },
    private readonly report: (message: string) => void,
  ) {
    this.window = previewWindow(document, options.address, options.climb);
    this.still_s = options.climb ? this.window.to_s / 2 : developedTime(document);
    canvas.dataset.ready = 'false';
    this.schedule();
  }
  /** Stops scheduling and ignores any capture that was already in flight. */
  dispose(): void {
    this.cancelled = true;
    cancelAnimationFrame(this.frame);
  }
  private isCancelled(): boolean {
    return this.cancelled;
  }
  private schedule(): void {
    this.frame = requestAnimationFrame((now) => {
      this.draw(now).catch((error: unknown) => {
        if (!this.isCancelled()) this.report(String(error));
      });
    });
  }
  private async draw(now: number): Promise<void> {
    if (this.isCancelled()) return;
    if (now - this.last < FRAME_INTERVAL_MS) {
      this.schedule();
      return;
    }
    this.last = now;
    try {
      await poster(this.canvas, this.document, {
        width: POSTER_WIDTH_PX,
        height: POSTER_HEIGHT_PX,
        t: this.time(now),
        framing: this.options.climb ? climbFraming(this.document) : undefined,
      });
      if (this.isCancelled()) return;
      this.canvas.dataset.ready = 'true';
      this.report('');
      if (this.options.loop && !this.media.matches) this.schedule();
    } catch (error) {
      if (!this.isCancelled())
        this.report(error instanceof Error ? error.message : 'Preview unavailable.');
    }
  }
  private time(now: number): number {
    if (!this.options.loop || this.media.matches) return this.still_s;
    const from = this.window.from_s;
    const span = Math.max(MIN_LOOP_S, this.window.to_s - from);
    return from + (((now - this.start) / MS_PER_SECOND) % (span + LOOP_GAP_S));
  }
}
function climbFraming(document: Design) {
  const height = document.launch?.height_m ?? 0;
  return {
    target: [0, height / 2, 0] as [number, number, number],
    position: [0, height * CAMERA_HEIGHT_RATIO, height * CAMERA_DISTANCE_RATIO] as [
      number,
      number,
      number,
    ],
  };
}
