/** Packed analytic source texture ABI, shared with the live birth shader and parity harness. */
// RGBA texels and a power-of-two width within WebGL2's guaranteed minimum texture limit.
/** Width in texels of the nearest-sampled Float32 source texture. */
export const SOURCE_TEXTURE_WIDTH = 1024;
/** RGBA components per source texel. */
export const SOURCE_COMPONENTS = 4;
/** 32 control/modifier texels, one clock, two shared phases and 32 modifier phase texels. */
export const SOURCE_TEXELS = 67;
/** Scalar lanes in one source record. */
export const SOURCE_SCALARS = SOURCE_TEXELS * SOURCE_COMPONENTS;
/** Texture lane selectors; XYZ vectors occupy the first three components of their lane. */
export enum sourceLane {
  bounds = 0,
  schedule = 1,
  identity = 2,
  colour = 3,
  motion = 4,
  controls = 5,
  extra = 6,
  direction = 7,
  fade = 8,
  trajectory = 9,
  origin = 10,
  travel = 11,
  shape = 12,
  embellishment = 13,
  starDirection = 14,
  starPhase = 15,
  modifiers = 16,
  /** Anchor seconds, current offset seconds, last slot and child-age anchor seconds. */
  clock = 32,
  /** Six independently reduced launch/spinner/rotation phases in radians. */
  phases = 33,
  /** Two texels per ordered motion modifier, retaining all six independent bee harmonics. */
  modifierPhases = 35,
}
/** Analytic trajectory discriminators shared with GLSL; no stored design format is introduced. */
export enum SourceKind {
  Fixed,
  Launch,
  Star,
  Wheel,
  Spinner,
  Tourbillon,
  Comet,
  Child,
}
/** Ordered star motion operations shared with GLSL. */
export enum SourceModifier {
  Twist = 1,
  Fish,
  Bees,
  Flutter,
}
