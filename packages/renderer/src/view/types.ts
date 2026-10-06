/** Stored-design inputs and playback state shared by the browser view. */
import type { Design } from '../schema/index';
import type { ShotPlacement } from '../sim/index';

/** One firing, with timing in seconds and placement in world metres. */
export interface Shot extends ShotPlacement {
  design: Design;
  t0?: number;
  seed?: number;
}
/** Browser view construction options; optional native playback chrome is owned by the viewer. */
export interface ViewerOptions {
  /** Adds the small native player and view preferences. */
  ui?: boolean;
  /** Enables orbit, wheel and touch controls; defaults to true. */
  controls?: boolean;
  /** Toggles playback for canvas taps without movement; defaults to true. */
  clickToPause?: boolean;
  design?: Design;
  shots?: readonly Shot[];
  prop?: 'mortar' | 'cake';
  autoplay?: boolean;
  loop?: boolean;
  startAt?: number;
  /** Starts and resets at the framed view, furthest normal orbit distance, or elevated single-shot pose. */
  startDistance?: 'framed' | 'farthest' | 'elevated';
  /** Forces the portable 8-bit output target, useful for fallback verification. */
  forceLdr?: boolean;
}
