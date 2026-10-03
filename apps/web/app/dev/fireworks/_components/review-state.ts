/** Playback readout on the developer review surface. */
import type { FrameProfile } from '@showcrafter/fireworks/view';
/** Browser viewer state mirrored into the developer controls. */
export interface ReviewState {
  t: number;
  duration: number;
  playing: boolean;
  count: number;
  hdr: boolean;
  sprayMode: 'cpu' | 'gpu';
  shotCount: number;
  timing: { medianMs: number; p95Ms: number; samples: number; window: number };
  frameMs: number;
  profile: FrameProfile | null;
}
