/** Immutable authored key editing and renderer-sampled preview geometry. */
import type { Brightness, Colour, ColourStop } from '@showcrafter/renderer/schema';
import { brightnessAt, colourAt } from '@showcrafter/renderer/sim';

// Schema permits at most 32 authored stops; a small time gap avoids coincident keys.
const MAX_STOPS = 32;
const MIN_TIME_GAP = 0.001; // Normalised life units, visual editing precision.
const PREVIEW_SAMPLES = 64; // Visual judgement: enough segments for a compact editor.
const CHANNEL_MAX = 255; // Eight-bit display sRGB channel maximum.
const DISPLAY_GAMMA = 2.2; // Inverse of the renderer's 2.2 gamma sRGB approximation.

/** Clamps a finite scalar to inclusive caller-defined bounds. */
function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
/** Converts a client coordinate into normalised progress using a non-zero CSS-pixel extent. */
export function pointerFraction(position: number, origin: number, extent: number): number {
  return extent > 0 ? clamp((position - origin) / extent) : 0;
}
function keyTime(
  keys: readonly [number, unknown][],
  index: number,
  time: number,
  options: { pinEnds: boolean; maxTime: number },
): number {
  const current = keys.at(index);
  if (current === undefined) {
    throw new RangeError('Unknown key');
  }
  if (options.pinEnds && (index === 0 || index === keys.length - 1)) {
    return current[0];
  }
  const [min, max] = neighbouringTimeBounds(keys, index, current[0], options.maxTime);
  return clamp(time, min, max);
}
function neighbouringTimeBounds(
  keys: readonly [number, unknown][],
  index: number,
  currentTime: number,
  maxTime: number,
): [number, number] {
  const left = index === 0 ? 0 : (keys.at(index - 1)?.[0] ?? 0);
  const right = keys.at(index + 1)?.[0] ?? maxTime;
  // Stored keys may be closer than the editing step. Keep a positive gap without crossing them.
  const gap = Math.min(
    MIN_TIME_GAP,
    index === 0 ? MIN_TIME_GAP : (currentTime - left) / 2,
    index === keys.length - 1 ? MIN_TIME_GAP : (right - currentTime) / 2,
  );
  const min = index === 0 ? 0 : left + gap;
  const max = index === keys.length - 1 ? maxTime : right - gap;
  return [min, max];
}

/** Moves one ordered brightness key in normalised life and caller-defined value units without mutation. */
export function moveCurveKey(
  keys: Brightness,
  index: number,
  point: [number, number],
  options: { pinEnds: boolean; maxValue: number },
): Brightness {
  if (!point.every(Number.isFinite)) {
    return keys.map((key) => [...key]);
  }
  return keys.map((key, row) =>
    row === index
      ? [
          keyTime(keys, index, point[0], { pinEnds: options.pinEnds, maxTime: 1 }),
          clamp(point[1], 0, options.maxValue),
        ]
      : [...key],
  );
}
/** Inserts a key at normalised life time, using an optional brightness or renderer interpolation; retains schema capacity. */
export function addCurveKey(keys: Brightness, time: number, value?: number): Brightness {
  const position = clamp(time);
  if (keys.length >= MAX_STOPS || keys.some((key) => Math.abs(key[0] - position) < MIN_TIME_GAP)) {
    return keys.map((key) => [...key]);
  }
  return [...keys, [position, value ?? brightnessAt(keys, position)] as [number, number]].sort(
    (a, b) => a[0] - b[0],
  );
}
/** Removes an interior key while retaining at least two stops and optionally both endpoints. */
export function removeKey<T>(
  keys: readonly [number, T][],
  index: number,
  pinEnds: boolean,
): [number, T][] {
  if (keys.length <= 2 || (pinEnds && (index === 0 || index === keys.length - 1))) {
    return keys.map((key) => [...key]);
  }
  return keys.filter((_, row) => row !== index).map((key) => [...key]);
}
/** Builds a unit-square SVG path using the renderer's actual brightness interpolation. */
export function curvePath(keys: Brightness, maxValue: number): string {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    throw new RangeError('Curve maximum must be positive and finite');
  }
  return Array.from({ length: PREVIEW_SAMPLES + 1 }, (_, sample) => {
    const time = sample / PREVIEW_SAMPLES;
    return `${sample === 0 ? 'M' : 'L'}${String(time)},${String(1 - brightnessAt(keys, time) / maxValue)}`;
  }).join(' ');
}
/** Moves an ordered gradient stop; time uses renderer colour progress and preserves palettes. */
export function moveGradientStop(
  stops: ColourStop[],
  index: number,
  time: number,
  options: { pinEnds: boolean; maxTime: number },
): ColourStop[] {
  if (!Number.isFinite(time)) {
    return structuredClone(stops);
  }
  return stops.map((stop, row) =>
    row === index
      ? [keyTime(stops, index, time, options), structuredClone(stop[1])]
      : structuredClone(stop),
  );
}
function displayColour(linear: readonly number[]): string {
  return `rgb(${linear.map((channel) => Math.round(Math.pow(clamp(channel), 1 / DISPLAY_GAMMA) * CHANNEL_MAX)).join(' ')})`;
}
/** Samples a gradient in linear RGB using the renderer, then converts to display sRGB for CSS. */
export function gradientCss(colour: Colour, maxTime = 1): string {
  // CSS percentages are in units of one hundred, unlike normalised renderer time.
  const percent = 100;
  const stops = Array.from({ length: PREVIEW_SAMPLES + 1 }, (_, sample) => {
    const fraction = sample / PREVIEW_SAMPLES;
    return `${displayColour(colourAt(colour, fraction * maxTime, 0, 0))} ${String(fraction * percent)}%`;
  });
  return `linear-gradient(to right, ${stops.join(',')})`;
}
/** Inserts a stop at normalised life progress using the sampled renderer colour. */
export function addGradientStop(colour: Colour, time: number, maxTime = 1): ColourStop[] {
  const position = clamp(time, 0, maxTime);
  if (
    colour.stops.length >= MAX_STOPS ||
    colour.stops.some((stop) => Math.abs(stop[0] - position) < MIN_TIME_GAP)
  ) {
    return structuredClone(colour.stops);
  }
  // Sample every palette lane; random palettes use bin centres to retain each authored colour.
  const paletteSize = Math.max(
    ...colour.stops.map((stop) => (typeof stop[1] === 'string' ? 1 : stop[1].length)),
  );
  const palette = Array.from({ length: paletteSize }, (_, index) =>
    encodeColour(colourAt(colour, position, index, (index + 0.5) / paletteSize)),
  );
  const encoded = paletteSize === 1 ? (palette[0] ?? '#ffffff') : palette;
  return [...structuredClone(colour.stops), [position, encoded] as ColourStop].sort(
    (a, b) => a[0] - b[0],
  );
}
function encodeColour(channels: readonly number[]): string {
  const radix = 16; // Hexadecimal RGB encoding uses base sixteen.
  const hex =
    '#' +
    channels
      .map((channel) =>
        Math.round(Math.pow(clamp(channel), 1 / DISPLAY_GAMMA) * CHANNEL_MAX)
          .toString(radix)
          .padStart(2, '0'),
      )
      .join('');
  return hex;
}

/** Returns the midpoint of the widest existing key gap, in normalised life units. */
export function insertionTime(keys: readonly [number, unknown][]): number {
  let widest = 0;
  let midpoint = 0.5;
  for (let index = 1; index < keys.length; index++) {
    const left = keys.at(index - 1);
    const right = keys.at(index);
    if (left !== undefined && right !== undefined && right[0] - left[0] > widest) {
      widest = right[0] - left[0];
      midpoint = (right[0] + left[0]) / 2;
    }
  }
  return midpoint;
}
