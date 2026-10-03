/** Browser poster formats shared by publishing, stale detection and the admin queue. */
import { RENDERER_VERSION } from '@showcrafter/fireworks';

// CSS pixels, visual choices for catalogue thumbnails, widescreen previews and sharing cards.
const CARD_WIDTH_PX = 320;
const CARD_HEIGHT_PX = 200;
const WIDE_WIDTH_PX = 960;
const WIDE_HEIGHT_PX = 540;
const SQUARE_SIDE_PX = 600;
const OG_WIDTH_PX = 1200;
const OG_HEIGHT_PX = 630;
/** Output names and CSS-pixel dimensions, chosen for catalogue cards and sharing surfaces. */
export const POSTER_SPECS = [
  { framing: 'card', width: CARD_WIDTH_PX, height: CARD_HEIGHT_PX },
  { framing: 'wide', width: WIDE_WIDTH_PX, height: WIDE_HEIGHT_PX },
  { framing: 'square', width: SQUARE_SIDE_PX, height: SQUARE_SIDE_PX },
  { framing: 'og', width: OG_WIDTH_PX, height: OG_HEIGHT_PX },
] as const;
/** Persisted render metadata used to decide whether a version needs browser rendering. */
export interface PosterRecord {
  renderer: string;
  framing: string;
  status: string;
}
/** Requires all formats from the current renderer; old or failed stills remain retryable. */
export function needsPosters(records: readonly PosterRecord[]): boolean {
  return POSTER_SPECS.some(
    (spec) =>
      !records.some(
        (row) =>
          row.renderer === RENDERER_VERSION &&
          row.framing === spec.framing &&
          row.status === 'ready',
      ),
  );
}
