'use client';

/**
 * Render a saved show cover to an image data URL by mounting the real cover
 * component into a hidden, fixed-size container and capturing one frame. Used
 * at show-creation time and by the admin backfill so browse pages can display
 * a static <img> instead of a live animated cover per card.
 *
 * CSS covers are frozen on their deterministic `frame` and snapshotted with
 * html-to-image, so the stored poster is exactly the still a frozen live
 * render would show. Legacy WebGL covers keep the original path: let the
 * shader develop at true speed, then read the canvas backing buffer.
 *
 * Rendering the actual cover components (instead of a hand-rolled duplicate
 * render tree) keeps the poster visually identical to the live cover and
 * kills drift between the capture path and the card background.
 *
 * Browser-only: relies on DOM, WebGL, and react-dom/client.
 */
import { createRoot } from 'react-dom/client';
import { toJpeg } from 'html-to-image';
import { CssCover } from '@/app/components/app/CssCover';
import { ShaderCover } from '@/app/components/app/ShaderCover';
import { cssCoverBackdropColor, type CssCover as CssCoverConfig } from '@/lib/css-cover';
import { isCssCover, type ShowCover } from '@/lib/cover';

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

// Output poster size (4:5, ~1.5x the 384x480 display size) and JPEG quality.
// The raw WebGL frame is noisy, so a full-res PNG can run to several MB and
// blow past the storage bucket's object size limit; a downscaled JPEG lands
// around tens of kilobytes with no visible difference at card size.
const POSTER_WIDTH = 576;
const POSTER_HEIGHT = 720;
const POSTER_JPEG_QUALITY = 0.82;

/** Downscale the captured frame to the poster size and re-encode as JPEG. */
async function downscalePoster(sourceDataUrl: string): Promise<string> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not decode captured cover frame'));
    image.src = sourceDataUrl;
  });
  const scaled = document.createElement('canvas');
  scaled.width = POSTER_WIDTH;
  scaled.height = POSTER_HEIGHT;
  const context = scaled.getContext('2d');
  if (!context) return sourceDataUrl;
  context.drawImage(image, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  return scaled.toDataURL('image/jpeg', POSTER_JPEG_QUALITY);
}

function makeHiddenContainer(width: number, height: number): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);
  return container;
}

/**
 * Snapshot a frozen CSS cover. Because CSS covers are a pure function of their
 * config plus `frame`, the captured poster is pixel-equivalent to what a
 * frozen live render shows - no develop time, no WebGL, no drift.
 */
async function renderCssCoverPoster(cover: CssCoverConfig): Promise<string> {
  const container = makeHiddenContainer(POSTER_WIDTH, POSTER_HEIGHT);
  const root = createRoot(container);
  root.render(<CssCover cover={cover} animate={false} />);

  try {
    // Two frames let React commit and the canvas kinds paint their frozen
    // frame; a short delay covers ResizeObserver-driven repaints.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await delay(60);
    const captured = await toJpeg(container, {
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      quality: POSTER_JPEG_QUALITY,
      backgroundColor: cssCoverBackdropColor(cover),
      pixelRatio: 1,
    });
    if (!captured.startsWith('data:image/')) {
      throw new Error('CSS cover capture produced an empty frame');
    }
    return captured;
  } finally {
    root.unmount();
    container.remove();
  }
}

/**
 * Render a cover to a compressed image data URL. The caller is responsible for
 * uploading the data URL and persisting the resulting storage path. Always
 * cleans up the hidden container and React root, even on failure.
 */
export async function renderCoverToPng(
  cover: ShowCover,
  options: RenderCoverPosterOptions = {},
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('renderCoverToPng must run in the browser');
  }

  if (isCssCover(cover)) {
    return renderCssCoverPoster(cover);
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const timeoutMs = options.timeoutMs ?? 4000;
  const developMs = options.developMs ?? DEFAULT_DEVELOP_MS;

  const container = makeHiddenContainer(width, height);
  const root = createRoot(container);
  // animate=true runs the shader at cover.speed so the captured frame shows a
  // real, developed moment of the live effect instead of a near-frozen frame.
  root.render(<ShaderCover cover={cover} animate />);

  try {
    const canvas = await waitForCanvas(container, timeoutMs);
    await waitForPaintableCanvas(canvas, timeoutMs);
    await delay(developMs);
    const captured = await captureNextFrame(canvas);
    // A lost WebGL context yields "data:," which round-trips into a text/plain
    // blob and a confusing storage rejection — fail loudly here instead.
    if (!captured.startsWith('data:image/')) {
      throw new Error('Shader cover capture produced an empty frame');
    }
    return await downscalePoster(captured);
  } finally {
    root.unmount();
    container.remove();
  }
}
