'use client';

/**
 * Capture a PNG screenshot of the *real* empty firework scene (night sky,
 * starfield, grid floor and mortar tubes) by mounting a hidden
 * {@link FireworkReplayCanvas} with no cues, letting the scene paint, and
 * reading one frame off the WebGL canvas.
 *
 * Using the actual renderer keeps the hover placeholder pixel-identical to the
 * live replay's opening frame, instead of a hand-drawn approximation. The
 * capture runs once per session (see stage-poster-cache) and the result is a
 * cheap static <img>, so browse cards never mount WebGL just to show the base.
 *
 * Browser-only: relies on DOM, WebGL and react-dom/client.
 */
import { createRoot } from 'react-dom/client';
import { FireworkReplayCanvas } from '@/components/replay/FireworkReplayCanvas';

// 4:5 portrait to match the browse cards, at 2x for crisp retina output.
const CAPTURE_WIDTH = 768;
const CAPTURE_HEIGHT = 960;
// Give the starfield, grid and bloom a few frames to settle before grabbing.
const SETTLE_MS = 180;
const READY_TIMEOUT_MS = 4000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function captureNextFrame(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error as Error);
      }
    });
  });
}

export async function renderStageToPng(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('renderStageToPng must run in the browser');
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '-10000px';
  container.style.width = `${CAPTURE_WIDTH}px`;
  container.style.height = `${CAPTURE_HEIGHT}px`;
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const root = createRoot(container);
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  root.render(
    <FireworkReplayCanvas
      cues={[]}
      elapsed={0}
      interactive={false}
      muted
      maxDevicePixelRatio={2}
      antialias
      preserveDrawingBuffer
      showLoadingBar={false}
      onReady={resolveReady}
    />,
  );

  try {
    await Promise.race([ready, delay(READY_TIMEOUT_MS)]);
    await delay(SETTLE_MS);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Stage canvas did not mount');
    return await captureNextFrame(canvas);
  } finally {
    root.unmount();
    container.remove();
  }
}
