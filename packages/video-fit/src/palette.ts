/** Chromatic byte-RGB palette measured from a CPU raster on the same thresholds as video features. */
import type { Feature } from './contracts';

// Match features.py: byte RGB bins, swatch count, bright-core floor and chromatic saturation floor.
const BIN_BYTES = 32;
const PALETTE_SIZE = 3;
const BRIGHT_BYTE = 80;
const SATURATION_FLOOR = 0.2;
const SATURATION_QUANTILE = 0.75;
// Byte RGB packing and a one-byte saturation histogram, whose quantisation error is at most 1/255.
const BYTE_MAX = 255;
const SATURATION_BINS = 256;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;

function saturation(packed: number): number {
  const red = (packed >> RED_SHIFT) & BYTE_MAX;
  const green = (packed >> GREEN_SHIFT) & BYTE_MAX;
  const blue = packed & BYTE_MAX;
  const bright = Math.max(red, green, blue);
  if (bright < BRIGHT_BYTE) {
    return -1;
  }
  const value = (bright - Math.min(red, green, blue)) / Math.max(1, bright);
  return value >= SATURATION_FLOOR ? Math.floor(value * BYTE_MAX) : -1;
}

function saturationThreshold(pixels: Uint32Array): number {
  const histogram = new Uint32Array(SATURATION_BINS);
  let count = 0;
  for (const packed of pixels) {
    const bucket = saturation(packed);
    if (bucket < 0) {
      continue;
    }
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
    count++;
  }
  let cumulative = 0;
  for (let bucket = 0; bucket < histogram.length; bucket++) {
    cumulative += histogram[bucket] ?? 0;
    if (cumulative >= count * SATURATION_QUANTILE) {
      return bucket;
    }
  }
  return BYTE_MAX;
}

/** Return up to three dominant sRGB swatches/fractions from packed unsigned RGB bytes.
 * Ignores white flashes and keeps the most chromatic quarter; never mutates the pixel buffer.
 */
export function rasterPalette(pixels: Uint32Array): Feature['colours'] {
  const threshold = saturationThreshold(pixels);
  const bins = new Map<string, { count: number; rgb: [number, number, number] }>();
  let total = 0;
  for (const packed of pixels) {
    if (saturation(packed) < threshold) {
      continue;
    }
    const red = (packed >> RED_SHIFT) & BYTE_MAX;
    const green = (packed >> GREEN_SHIFT) & BYTE_MAX;
    const blue = packed & BYTE_MAX;
    const key = [
      Math.floor(red / BIN_BYTES),
      Math.floor(green / BIN_BYTES),
      Math.floor(blue / BIN_BYTES),
    ].join(',');
    let bin = bins.get(key);
    if (!bin) {
      bin = { count: 0, rgb: [0, 0, 0] };
      bins.set(key, bin);
    }
    bin.count++;
    bin.rgb[0] += red;
    bin.rgb[1] += green;
    bin.rgb[2] += blue;
    total++;
  }
  return [...bins.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, PALETTE_SIZE)
    .map((bin) => ({
      rgb: bin.rgb.map((value) => value / bin.count / BYTE_MAX) as [number, number, number],
      fraction: bin.count / total,
    }));
}
