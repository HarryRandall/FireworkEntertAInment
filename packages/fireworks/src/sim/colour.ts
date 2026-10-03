/** Linear-RGB conversion and authored colour and brightness curve sampling. */
import type { Brightness, Colour, ColourValue } from '../schema/index';

// sRGB conversion constants, from the prototype's display-colour approximation.
const SRGB_CHANNEL_MAX = 255;
const SRGB_GAMMA = 2.2;
const HEX_RADIX = 16;
// RGB hex packing uses eight bits per channel, red in the high byte.
const RED_SHIFT_BITS = 16;
const GREEN_SHIFT_BITS = 8;
// Hermite cubic coefficient gives zero slope at both ends of smoothstep.
const SMOOTHSTEP_CUBIC_COEFFICIENT = 3;
// Prototype ignition palette, linear RGB channel intensities.
const PRIME_RED = 0.6;
const PRIME_GREEN = 0.25;
const PRIME_BLUE = 0.06;
/** Three linear-RGB components or a three-dimensional position vector. */
export type Vec3 = [number, number, number];
/** Neutral linear RGB white, used for hot particle cores. */
export const WHITE: Vec3 = [1, 1, 1];
/** Prototype ignition colour in linear RGB, before stars reach full brightness. */
export const PRIME: Vec3 = [PRIME_RED, PRIME_GREEN, PRIME_BLUE];
/** Converts a #rrggbb sRGB colour to linear RGB components in [0, 1]. */
export function rgb(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), HEX_RADIX);
  const lin = (v: number) => Math.pow(v / SRGB_CHANNEL_MAX, SRGB_GAMMA);
  return [
    lin((n >> RED_SHIFT_BITS) & SRGB_CHANNEL_MAX),
    lin((n >> GREEN_SHIFT_BITS) & SRGB_CHANNEL_MAX),
    lin(n & SRGB_CHANNEL_MAX),
  ];
}
/** Linearly interpolates two linear RGB colours by a dimensionless amount. */
export function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
/** Smoothly maps a dimensionless value from [a, b] to [0, 1]. */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (SMOOTHSTEP_CUBIC_COEFFICIENT - 2 * t);
}
function palette(value: ColourValue, mode: Colour['mode'], index: number, h: number): Vec3 {
  if (typeof value === 'string') return rgb(value);
  let i = 0;
  if (mode === 'random') i = Math.floor(h * value.length);
  else if (mode === 'alternate') i = index % value.length;
  else if (mode === 'per_star') i = index;
  const hex = value[i];
  if (hex === undefined || hex.length === 0)
    throw new RangeError('Colour palette has no entry for this star');
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
