'use client';

/**
 * Render a saved {@link ShaderCover} config to a PNG data URL by mounting the
 * real {@link ShaderCover} component into a hidden, fixed-size container,
 * letting the animated shader develop at its true speed, then capturing one
 * frame. Used at show-creation time and by the admin backfill so browse pages
 * can display a static <img> instead of a live WebGL context per card.
 *
 * Rendering the actual `ShaderCover` (instead of a hand-rolled duplicate shader
 * tree) keeps the poster visually identical to the live cover and kills drift
 * between the capture path and the card background.
 *
 * Browser-only: relies on DOM, WebGL, and react-dom/client.
 */
import { createRoot } from 'react-dom/client';
import { ShaderCover } from '@/app/components/app/ShaderCover';
import type { ShaderCover as ShaderCoverConfig } from '@/lib/shader-cover';

export type RenderCoverPosterOptions = {
  width?: number;
  height?: number;
  /** Maximum time to wait for the shader to paint before failing. */
  timeoutMs?: number;
  /** How long to let the animated shader develop before capturing a frame. */
  developMs?: number;
};

// 2x the standard 4:5 card size so the PNG stays crisp on retina and on the
// wider featured-hero cards. CoverPoster displays it at 384x480.
const DEFAULT_WIDTH = 768;
const DEFAULT_HEIGHT = 960;
// Let flow/noise shaders run at real speed long enough to reach a developed,
// representative state rather than capturing the dull first frame.
const DEFAULT_DEVELOP_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForCanvas(root: HTMLElement, timeoutMs: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const existing = root.querySelector('canvas');
    if (existing) {
      resolve(existing as HTMLCanvasElement);
      return;
    }

    const start = performance.now();
    const observer = new MutationObserver(() => {
      const canvas = root.querySelector('canvas');
      if (canvas) {
        observer.disconnect();
        window.clearInterval(interval);
        resolve(canvas as HTMLCanvasElement);
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    const interval = window.setInterval(() => {
      const canvas = root.querySelector('canvas');
      if (canvas) {
        observer.disconnect();
        window.clearInterval(interval);
        resolve(canvas as HTMLCanvasElement);
      } else if (performance.now() - start > timeoutMs) {
        observer.disconnect();
        window.clearInterval(interval);
        reject(new Error('Shader cover did not paint in time'));
      }
    }, 50);
  });
}

function waitForPaintableCanvas(canvas: HTMLCanvasElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (canvas.width > 0 && canvas.height > 0) {
      resolve();
      return;
    }
    const start = performance.now();
    const interval = window.setInterval(() => {
      if (canvas.width > 0 && canvas.height > 0) {
        window.clearInterval(interval);
        resolve();
      } else if (performance.now() - start > timeoutMs) {
        window.clearInterval(interval);
        reject(new Error('Shader cover canvas never became paintable'));
      }
    }, 50);
  });
}

/**
 * Capture on the next animation frame so the WebGL backing buffer is read right
 * after the shader's own rAF render, before the compositor can clear it.
 */
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

/**
 * Render a cover to a PNG data URL. The caller is responsible for uploading the
 * data URL and persisting the resulting storage path. Always cleans up the
 * hidden container and React root, even on failure.
 */
export async function renderCoverToPng(
  cover: ShaderCoverConfig,
  options: RenderCoverPosterOptions = {},
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('renderCoverToPng must run in the browser');
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const timeoutMs = options.timeoutMs ?? 4000;
  const developMs = options.developMs ?? DEFAULT_DEVELOP_MS;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const root = createRoot(container);
  // animate=true runs the shader at cover.speed so the captured frame shows a
  // real, developed moment of the live effect instead of a near-frozen frame.
  root.render(<ShaderCover cover={cover} animate />);

  try {
    const canvas = await waitForCanvas(container, timeoutMs);
    await waitForPaintableCanvas(canvas, timeoutMs);
    await delay(developMs);
    return await captureNextFrame(canvas);
  } finally {
    root.unmount();
    container.remove();
  }
}
