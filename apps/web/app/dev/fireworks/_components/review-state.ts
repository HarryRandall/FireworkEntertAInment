/** Playback readout on the developer review surface. */
/** Browser viewer state mirrored into the developer controls. */
export interface ReviewState {
  t: number;
  duration: number;
  playing: boolean;
  count: number;
  hdr: boolean;
}
