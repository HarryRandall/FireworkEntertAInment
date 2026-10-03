/** Fixed-point CPU raster matching the synthetic evidence camera and display conversion. */
import type { Particles } from '@showcrafter/fireworks/sim';
import type { Feature } from './contracts';
import { rasterPalette } from './palette';

// Fixture orthographic coverage in metres; physical scale is an explicit uncalibrated assumption.
const WORLD_WIDTH_M = 100;
const WORLD_HEIGHT_M = 75;
// Match the fixture renderer: point radius in pixels, alpha cutoff, packed RGB stride and sRGB gamma.
const POINT_RADIUS_PX = 2;
const MIN_ALPHA = 0.03;
const CHANNELS = 3;
const GAMMA = 2.2;
const BYTE_MAX = 255;
// Packed RGB integer channel shifts, in bits (three unsigned bytes).
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
// Measurement chromatic/visibility thresholds from features.py and onsets.py, in byte RGB units.
const VISIBLE_BYTE = 24;

interface Raster {
  pixels: Uint32Array;
  opacity: Float32Array;
  width: number;
  height: number;
  x: number;
}

/** Luminous raster bounds in pixels, summed byte energy and a chromatic display-RGB summary. */
export interface RasterFrame {
  left: number;
  right: number;
  top: number;
  bottom: number;
  energy: number;
  colours: Feature['colours'];
}

function channel(values: Float32Array, index: number): number {
  return Math.round(Math.pow(Math.max(0, values[index] ?? 0), 1 / GAMMA) * BYTE_MAX);
}

function paintPoint(raster: Raster, particles: Particles, index: number): void {
  const alpha = particles.alphas[index] ?? 0;
  if (alpha < MIN_ALPHA) {
    return;
  }
  const offset = index * CHANNELS;
  const x = Math.round(
    ((particles.positions[offset] ?? 0) / WORLD_WIDTH_M + raster.x) * raster.width,
  );
  const y = Math.round(
    (1 - (particles.positions[offset + 1] ?? 0) / WORLD_HEIGHT_M) * raster.height,
  );
  const colour =
    (channel(particles.colours, offset) << RED_SHIFT) |
    (channel(particles.colours, offset + 1) << GREEN_SHIFT) |
    channel(particles.colours, offset + 2);
  const left = Math.max(0, x - POINT_RADIUS_PX);
  const right = Math.min(raster.width - 1, x + POINT_RADIUS_PX);
  const top = Math.max(0, y - POINT_RADIUS_PX);
  const bottom = Math.min(raster.height - 1, y + POINT_RADIUS_PX);
  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) {
      const pixel = row * raster.width + column;
      if (alpha <= (raster.opacity[pixel] ?? 0)) {
        continue;
      }
      raster.opacity[pixel] = alpha;
      raster.pixels[pixel] = colour;
    }
  }
}

function describeRaster(raster: Raster): RasterFrame | null {
  const frame: RasterFrame = {
    left: raster.width,
    right: 0,
    top: raster.height,
    bottom: 0,
    energy: 0,
    colours: [],
  };
  for (let index = 0; index < raster.pixels.length; index++) {
    const packed = raster.pixels[index] ?? 0;
    const bright = Math.max(
      (packed >> RED_SHIFT) & BYTE_MAX,
      (packed >> GREEN_SHIFT) & BYTE_MAX,
      packed & BYTE_MAX,
    );
    if (bright < VISIBLE_BYTE) {
      continue;
    }
    const x = index % raster.width;
    const y = Math.floor(index / raster.width);
    frame.left = Math.min(frame.left, x);
    frame.right = Math.max(frame.right, x);
    frame.top = Math.min(frame.top, y);
    frame.bottom = Math.max(frame.bottom, y);
    frame.energy += bright;
  }
  if (frame.energy === 0) {
    return null;
  }
  frame.colours = rasterPalette(raster.pixels);
  return frame;
}

/** Rasterise CPU particles and measure luminous bounds in the content box, without a GPU.
 * x is the measured normalised launch position; the input particle buffers are never mutated.
 * Point size is fixed like the fixture renderer, so size fields remain weakly identifiable.
 */
export function rasterFrame(particles: Particles, feature: Feature, x: number): RasterFrame | null {
  const width = feature.content_box_px[2];
  const height = feature.content_box_px[3];
  const raster: Raster = {
    pixels: new Uint32Array(width * height),
    opacity: new Float32Array(width * height),
    width,
    height,
    x,
  };
  for (let index = 0; index < particles.alphas.length; index++) {
    paintPoint(raster, particles, index);
  }
  return describeRaster(raster);
}
