/** Serial ownership keeps asynchronous PNG readbacks on one detached WebGL context. */
import { PosterRenderer } from '../view/poster';
import type { Design } from '../schema/index';
import type { PosterCaptureOptions } from '../view/poster';
import { SETTINGS } from '../view/settings';

// Memory budget: retain at most 32 encoded thumbnails, including pending captures.
const MAX_CACHED_POSTERS = 32;

// Encoding budget in milliseconds: five seconds allows browser readback without holding later thumbnails indefinitely.
const POSTER_CAPTURE_TIMEOUT_MS = 5000;

/** Dimensions in CSS pixels and output capability for one queued capture. */
export interface PosterSurfaceOptions extends PosterCaptureOptions {
  width: number;
  height: number;
  forceLdr: boolean;
}

class PosterCaptureTimeout extends Error {}

/** Serialises captures through a reusable renderer; injected factories support DOM-free lifecycle tests. */
export class SharedPosterSurface {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly captures = new Map<string, Promise<Blob>>();
  private rig: PosterRenderer | null = null;
  private size: PosterSurfaceOptions | null = null;
  /** The factory allocates a detached surface. The positive timeout budget is milliseconds per capture, excluding queue wait. */
  constructor(
    private readonly create = (options: PosterSurfaceOptions) =>
      new PosterRenderer(options.width, options.height, options.forceLdr),
    private readonly timeoutMs = POSTER_CAPTURE_TIMEOUT_MS,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new RangeError('Poster timeout must be positive and finite');
  }

  /** Queues validated design sampling at non-negative sequence seconds; PNG encoding completes before reuse. */
  capture(design: Design, time_s: number, options: PosterSurfaceOptions): Promise<Blob> {
    const key = captureKey(design, time_s, options);
    const cached = this.captures.get(key);
    if (cached) return cached;
    const result = this.tail.then(() => {
      // Preferences can change while another encoder owns the queue. Do not retain mismatched pixels.
      if (captureKey(design, time_s, options) !== key) this.captures.delete(key);
      const rig = this.surface(options);
      return this.captureWithinBudget(rig, design, time_s, options);
    });
    // A rejected capture reaches its caller but cannot poison subsequent requests.
    this.captures.set(key, result);
    if (this.captures.size > MAX_CACHED_POSTERS) {
      const oldest = this.captures.keys().next().value;
      if (oldest !== undefined) this.captures.delete(oldest);
    }
    this.tail = result.catch(() => {
      if (this.captures.get(key) === result) this.captures.delete(key);
    });
    return result;
  }

  /** Queues resource release after all earlier encoders, allowing later calls to allocate afresh. */
  dispose(): Promise<void> {
    this.captures.clear();
    const result = this.tail.then(() => {
      this.rig?.dispose();
      this.rig = null;
      this.size = null;
    });
    this.tail = result.catch(() => {});
    return result;
  }

  private async captureWithinBudget(
    rig: PosterRenderer,
    design: Design,
    timeS: number,
    options: PosterSurfaceOptions,
  ): Promise<Blob> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        rig.capture(design, timeS, options),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new PosterCaptureTimeout('Poster capture timed out. Retry the preview.'));
          }, this.timeoutMs);
        }),
      ]);
    } catch (failure) {
      // A late encoder callback owns only its old canvas, never the next request's renderer.
      if (failure instanceof PosterCaptureTimeout) {
        this.rig = null;
        this.size = null;
        rig.dispose();
      }
      throw failure;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private surface(options: PosterSurfaceOptions): PosterRenderer {
    if (this.size !== null && this.size.forceLdr !== options.forceLdr) {
      this.rig?.dispose();
      this.rig = null;
    }
    if (this.rig === null) this.rig = this.create(options);
    else if (this.size?.width !== options.width || this.size.height !== options.height)
      this.rig.resize(options.width, options.height);
    this.size = options;
    return this.rig;
  }
}

function captureKey(design: Design, time_s: number, options: PosterSurfaceOptions): string {
  return JSON.stringify([
    design,
    time_s,
    options,
    typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    SETTINGS.smoke,
    SETTINGS.ground,
  ]);
}
