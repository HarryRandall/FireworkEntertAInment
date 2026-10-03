/** Linear-RGB conversion and authored colour and brightness curve sampling. */
import type { Brightness, Colour, ColourValue } from '../schema/index';

// sRGB conversion constants, from the prototype's display-colour approximation.
const SRGB_CHANNEL_MAX = 255;
const SRGB_GAMMA = 2.2;
const HEX_RADIX = 16;
/** Three linear-RGB components or a three-dimensional position vector. */
export type Vec3 = [number, number, number];
export const WHITE: Vec3 = [1, 1, 1];
export const PRIME: Vec3 = [0.6, 0.25, 0.06];
/** Converts a #rrggbb sRGB colour to linear RGB components in [0, 1]. */
export function rgb(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), HEX_RADIX);
  const lin = (v: number) => Math.pow(v / SRGB_CHANNEL_MAX, SRGB_GAMMA);
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}
/** Linearly interpolates two linear RGB colours by a dimensionless amount. */
export function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
/** Smoothly maps a dimensionless value from [a, b] to [0, 1]. */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function palette(value: ColourValue, mode: Colour['mode'], index: number, h: number): Vec3 {
  if (typeof value === 'string') return rgb(value);
  const i =
    mode === 'random'
      ? Math.floor(h * value.length)
      : mode === 'alternate'
        ? index % value.length
        : mode === 'per_star'
          ? index
          : 0;
  const hex = value[i];
  if (!hex) throw new RangeError('Colour palette has no entry for this star');
  return rgb(hex);
}
/** Samples an authored colour gradient at normalised life progress for one star. */
export function colourAt(colour: Colour, progress: number, index: number, h: number): Vec3 {
  const first = colour.stops[0];
  if (!first) throw new RangeError('Colour needs a stop');
  let left = first;
  for (const right of colour.stops.slice(1)) {
    if (progress < right[0])
      return mix(
        palette(left[1], colour.mode, index, h),
        palette(right[1], colour.mode, index, h),
        Math.max(0, (progress - left[0]) / (right[0] - left[0])),
      );
    left = right;
  }
  return palette(left[1], colour.mode, index, h);
}
/** Samples an authored brightness curve at normalised life progress. */
export function brightnessAt(curve: Brightness, progress: number): number {
  const first = curve[0];
  if (!first) throw new RangeError('Brightness needs a stop');
  let left = first;
  for (const right of curve.slice(1)) {
    if (progress < right[0])
      return (
        left[1] + (right[1] - left[1]) * Math.max(0, (progress - left[0]) / (right[0] - left[0]))
      );
    left = right;
  }
  return left[1];
}
