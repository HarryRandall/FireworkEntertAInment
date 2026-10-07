/** Browser-only WebGL view entry point; the simulation remains DOM-free. */
export { Viewer } from './viewer';
export { PosterRenderer } from './poster';
export { buildPlayer } from './player';
export { reviewTime } from './review-framing';
export { cakeHole, CAKE_TOP_M, CAKE_WIDTH_M } from './props';
export type { Shot, ViewerOptions } from './types';

export { SETTINGS, setSetting, setVolume, onSettings, type ViewerSettings } from './settings';
export type { FrameProfile } from './frame-profile';

export {
  poster,
  posterAll,
  disposePosters,
  developedTime,
  type PosterOptions,
} from '../poster/index';

export { representativeTime } from './motion';
