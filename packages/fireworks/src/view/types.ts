/** Stored-design inputs and playback state shared by the browser view. */
import type { Design } from '../schema/index';
import type { ShotPlacement } from '../sim/index';

/** One firing, with timing in seconds and placement in world metres. */
export interface Shot extends ShotPlacement {
  design: Design;
  t0?: number;
  seed?: number;
}
/** Browser view construction options; playback chrome belongs to the caller. */
export interface ViewerOptions {
  design?: Design;
  shots?: readonly Shot[];
  prop?: 'mortar' | 'cake';
  autoplay?: boolean;
  loop?: boolean;
  startAt?: number;
  /** Forces the portable 8-bit output target, useful for fallback verification. */
  forceLdr?: boolean;
}
