/** Browser publishing and thumbnail APIs share one detached, serial WebGL renderer. */
import { clipCanvasSurface } from '../view/viewer-input';
import type { Design } from '../schema/index';
import { effectTemplates } from '../templates/index';
import type { PosterCaptureOptions } from '../view/poster';
import { framingFor } from '../sim/framing';
import { developedTime } from './moment';
import { SharedPosterSurface, type PosterSurfaceOptions } from './shared';

// Prototype thumbnail fallback and minimum dimensions, in CSS pixels.
const DEFAULT_WIDTH_PX = 320;
const DEFAULT_HEIGHT_PX = 200;
const MIN_WIDTH_PX = 64;
const MIN_HEIGHT_PX = 40;
const shared = new SharedPosterSurface();

/** Overrides for browser stills; time is sequence seconds, size is CSS pixels, framing is world metres. */
export interface PosterOptions extends PosterCaptureOptions {
  t?: number;
  width?: number;
  height?: number;
  forceLdr?: boolean;
}

/** Renders a validated design through the shared context and returns its PNG for browser uploads.
 * A non-null canvas receives the same PNG in its 2D context; null requests only the Blob.
 * Resolves after encoding/copying, never mutates the design or a live viewer. */
export async function poster(
  canvas: HTMLCanvasElement | null,
  design: Design,
  options: PosterOptions = {},
): Promise<Blob> {
  if (options.shots !== undefined && options.shots.length === 0)
    throw new RangeError('Poster shots must not be empty');
  const surface = surfaceOptions(canvas, options);
  const time = posterTime(design, options);
  const blob = await shared.capture(design, time, surface);
  if (canvas !== null) {
    if (canvas.parentElement) clipCanvasSurface(canvas.parentElement, canvas);
    await copyPoster(canvas, blob);
  }
  return blob;
}

/** Captures the empty shared world through the same serial surface as firework thumbnails. */
export function stagePoster(
  options: Pick<PosterOptions, 'width' | 'height' | 'forceLdr'> = {},
): Promise<Blob> {
  const design = effectTemplates[0]?.design;
  if (!design) throw new Error('No renderer template is available for stage framing.');
  return shared.capture(design, 0, { ...surfaceOptions(null, options), shots: [] });
}

/** Renders built-in template canvases marked data-poster in DOM order, using one shared context.
 * Resolves after every canvas is encoded/copied; unknown template keys fail visibly. */
export async function posterAll(
  root: ParentNode = document,
  options: PosterOptions = {},
): Promise<void> {
  for (const canvas of Array.from(
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-poster]'),
  )) {
    const entry = effectTemplates.find((template) => template.key === canvas.dataset.poster);
    if (!entry) throw new Error(`Unknown poster template: ${canvas.dataset.poster ?? ''}`);
    let captureOptions = options;
    // The prototype stores rocket templates as shells; their group preserves climb framing.
    if (entry.group === 'Rockets and candles' && options.framing === undefined) {
      const surface = surfaceOptions(canvas, options);
      captureOptions = {
        ...options,
        framing: framingFor(
          options.shots ?? [{ design: entry.design }],
          false,
          surface.width / surface.height,
        ),
      };
    }
    await poster(canvas, entry.design, captureOptions);
  }
}

/** Frees the shared poster context after queued PNGs finish; subsequent requests recreate it lazily. */
export function disposePosters(): Promise<void> {
  return shared.dispose();
}

function dimension(
  explicit: number | undefined,
  measured: number | undefined,
  fallback: number,
  minimum: number,
): number {
  const value = explicit ?? (measured === undefined || measured === 0 ? fallback : measured);
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError('Poster dimensions must be positive and finite');
  return Math.max(minimum, Math.round(value));
}

async function copyPoster(canvas: HTMLCanvasElement, blob: Blob): Promise<void> {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Poster destination needs a 2D canvas context');
  const image = await createImageBitmap(blob);
  try {
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);
  } finally {
    image.close();
  }
}

export { developedTime } from './moment';

function surfaceOptions(
  canvas: HTMLCanvasElement | null,
  options: PosterOptions,
): PosterSurfaceOptions {
  const rect = canvas?.getBoundingClientRect();
  return {
    ...options,
    width: dimension(options.width, rect?.width, DEFAULT_WIDTH_PX, MIN_WIDTH_PX),
    height: dimension(options.height, rect?.height, DEFAULT_HEIGHT_PX, MIN_HEIGHT_PX),
    forceLdr: options.forceLdr ?? false,
  };
}

function posterTime(design: Design, options: PosterOptions): number {
  const shot = options.shots?.[0];
  const time = options.t ?? (shot?.t0 ?? 0) + developedTime(shot?.design ?? design);
  if (!Number.isFinite(time) || time < 0)
    throw new RangeError('Poster time must be non-negative and finite');
  return time;
}
