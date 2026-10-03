/** Browser waits observe completed live draws, independently of thumbnail preparation. */
import { expect, type Page } from '@playwright/test';

// Match the viewer's diagnostic precision in show seconds.
const DRAWN_TIME_DECIMALS = 6;

/** Waits for the live canvas to finish drawing the requested, already-clamped show seconds. */
export async function waitForDrawnTime(page: Page, time_s: number): Promise<void> {
  const canvas = page.getByTestId('stage').locator('canvas');
  // Selecting catalogue cards can occlude the demand-rendered stage. Visibility wakes its RAF.
  await canvas.scrollIntoViewIfNeeded();
  // Readiness precedes the first draw, so absent evidence must be retried rather than parsed.
  await expect
    .poll(async () =>
      canvas.evaluate((element) => ({
        time: element.getAttribute('data-drawn-time'),
        pending: element.getAttribute('data-draw-pending'),
      })),
    )
    .toEqual({ time: time_s.toFixed(DRAWN_TIME_DECIMALS), pending: 'false' });
}

// The built-in player overlays the canvas (its bar wraps over more of it at phone width),
// so renderer comparisons hide it; otherwise focus rings and hover states read as frame changes.
export const HIDE_PLAYER_OVERLAY = '.sc-player { visibility: hidden !important; }';

/** Captures the live canvas pixels without the player controls drawn over them. */
export async function captureRenderer(page: Page, path?: string): Promise<Buffer> {
  return page
    .getByTestId('stage')
    .locator('canvas')
    .screenshot({ style: HIDE_PLAYER_OVERLAY, ...(path === undefined ? {} : { path }) });
}
