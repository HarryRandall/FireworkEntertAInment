/** Serial ownership keeps asynchronous PNG readbacks on one detached WebGL context. */
import { PosterRenderer } from '../view/poster';
import type { Design } from '../schema/index';
import type { PosterCaptureOptions } from '../view/poster';

/** Dimensions in CSS pixels and output capability for one queued capture. */
export interface PosterSurfaceOptions extends PosterCaptureOptions {
  width: number;
  height: number;
  forceLdr: boolean;
}

/** Serialises captures through a reusable renderer; injected factories support DOM-free lifecycle tests. */
export class SharedPosterSurface {
  private tail: Promise<unknown> = Promise.resolve();
  private rig: PosterRenderer | null = null;
  private size: PosterSurfaceOptions | null = null;
  /** The factory must allocate a detached surface, never a mounted viewer. */
  constructor(
    private readonly create = (options: PosterSurfaceOptions) =>
      new PosterRenderer(options.width, options.height, options.forceLdr),
  ) {}

  /** Queues validated design sampling at non-negative sequence seconds; PNG encoding completes before reuse. */
  capture(design: Design, time_s: number, options: PosterSurfaceOptions): Promise<Blob> {
    const result = this.tail.then(() => {
      const rig = this.surface(options);
      return rig.capture(design, time_s, options);
    });
    // A rejected capture reaches its caller but cannot poison subsequent requests.
    this.tail = result.catch(() => {});
    return result;
  }

  /** Queues resource release after all earlier encoders, allowing later calls to allocate afresh. */
  dispose(): Promise<void> {
    const result = this.tail.then(() => {
      this.rig?.dispose();
      this.rig = null;
      this.size = null;
    });
    this.tail = result.catch(() => {});
    return result;
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
