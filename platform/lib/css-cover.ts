/**
 * CSS cover - a lightweight, serialisable "visual identity" for a show,
 * rendered entirely with CSS/SVG (plus one small Canvas2D effect) instead of a
 * live WebGL context. It mirrors {@link ./shader-cover} so the two can coexist:
 * a stored cover carries an `engine` discriminator and either kind of cover can
 * be generated, parsed, and turned into a cheap gradient fallback.
 *
 * Why this exists: the WebGL shader covers look great but run a full-screen
 * fragment shader every frame, which is heavy on the generating/splash screen
 * and impossible to mount per browse card. A CSS cover animates far more
 * cheaply, pauses trivially, and - crucially - is a pure function of its config
 * plus a `frame`, so the frozen "photo" is pixel-identical to the live effect.
 *
 * Pure module: no React, no DOM. Safe to import on the server.
 */

export type CssCoverKind =
  | 'liquid'
  | 'silk'
  | 'caustics'
  | 'marble'
  | 'smoke'
  | 'spiro'
  | 'curtain'
  | 'aurora'
  | 'rays'
  | 'bloom'
  | 'starfield'
  | 'plasma'
  | 'kaleido'
  | 'dots'
  | 'constellation'
  | 'grid'
  | 'waves';

export type CssCover = {
  /** Discriminates CSS covers from WebGL {@link ./shader-cover} covers. */
  engine: 'css';
  kind: CssCoverKind;
  /** 3-6 hex colours, e.g. "#aabbcc". */
  colors: string[];
  /** Loop-speed multiplier; 1 is the base tempo. */
  speed: number;
  /** Overall zoom of the pattern; 1 is neutral. */
  scale: number;
  /** Orientation in degrees, used by directional kinds (warp, rays). */
  angle: number;
  /** Softness/blur, 0..1. */
  blur: number;
  /** Film-grain overlay opacity, 0..1. */
  grain: number;
  /** Brightness/bloom of the highlight, 0..1. */
  intensity: number;
  /** Ray count / particle count factor, 0..1. */
  density: number;
  /**
   * Seconds into the animation loop that define the frozen pose. The live
   * effect starts from this phase too, so freezing captures exactly what was on
   * screen. Kept within [0, LOOP_SECONDS).
   */
  frame: number;
  /** Stable seed for the Canvas2D kind so its particle layout is reproducible. */
  seed: number;
};

/** Base length of one animation loop, in seconds. `frame` lives in [0, this). */
export const CSS_COVER_LOOP_SECONDS = 24;

const KINDS: CssCoverKind[] = [
  'liquid',
  'silk',
  'caustics',
  'marble',
  'smoke',
  'spiro',
  'curtain',
  'aurora',
  'rays',
  'bloom',
  'starfield',
  'plasma',
  'kaleido',
  'dots',
  'constellation',
  'grid',
  'waves',
];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_COLORS = ['#3b82f6', '#00e5ff', '#8b5cf6'];
const MIN_VISIBLE_LIGHTNESS = 38;
const MIN_VISIBLE_SATURATION = 46;

/** A 0..1 random source so generation can be seeded or truly random. */
type Rng = () => number;

function mulberry32(seedNumber: number): Rng {
  let a = seedNumber >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function between(rng: Rng, min: number, max: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((min + rng() * (max - min)) * factor) / factor;
}

function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

function choice<T>(rng: Rng, items: readonly T[]): T {
  return items[intBetween(rng, 0, items.length - 1)]!;
}

type Hsl = { hue: number; saturation: number; lightness: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToHsl(hex: string): Hsl | null {
  if (!HEX_RE.test(hex)) return null;
  const numeric = Number.parseInt(hex.slice(1), 16);
  const r = ((numeric >> 16) & 255) / 255;
  const g = ((numeric >> 8) & 255) / 255;
  const b = (numeric & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return {
    hue: Math.round(hue),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normaliseCoverColor(color: string): string {
  const hsl = hexToHsl(color);
  if (!hsl) return FALLBACK_COLORS[0]!;
  const hasNoUsableHue = hsl.saturation < 4 && hsl.lightness < 18;
  const hue = hasNoUsableHue ? 214 : hsl.hue;
  const shouldBoostSaturation =
    hsl.lightness < MIN_VISIBLE_LIGHTNESS || (hsl.saturation < 12 && hsl.lightness < 70);
  const saturation = shouldBoostSaturation
    ? Math.max(hsl.saturation, MIN_VISIBLE_SATURATION)
    : hsl.saturation;
  const lightness = clamp(hsl.lightness, MIN_VISIBLE_LIGHTNESS, 74);
  return hslToHex(hue, saturation, lightness);
}

/** Filter to valid hex, normalise for visibility, and guarantee >= 2 colours. */
export function normaliseCssCoverColors(colors: string[]): string[] {
  const normalised = colors
    .filter((color) => HEX_RE.test(color))
    .map((color) => normaliseCoverColor(color));
  return normalised.length >= 2 ? normalised : FALLBACK_COLORS;
}

/** A slightly darker, saturated palette colour for use as a base backdrop. */
export function cssCoverBackdropColor(cover: Pick<CssCover, 'colors'>): string {
  const colors = normaliseCssCoverColors(cover.colors);
  const colour =
    colors.find((color) => {
      const hsl = hexToHsl(color);
      return hsl ? hsl.saturation >= 18 : false;
    }) ?? colors[0]!;
  const hsl = hexToHsl(colour);
  if (!hsl) return FALLBACK_COLORS[0]!;
  return hslToHex(
    hsl.hue,
    Math.max(hsl.saturation, MIN_VISIBLE_SATURATION),
    clamp(hsl.lightness - 18, 12, 34),
  );
}

/** Build a harmonious palette from a base hue so covers do not look muddy. */
function buildPalette(rng: Rng, count: number): string[] {
  const baseHue = intBetween(rng, 0, 359);
  const spread = choice(rng, [24, 40, 60, 120, 180]);
  return Array.from({ length: count }, (_, index) => {
    const hue = (baseHue + spread * index + intBetween(rng, -12, 12) + 360) % 360;
    return hslToHex(hue, intBetween(rng, 64, 100), intBetween(rng, 46, 70));
  });
}

/** Core generator shared by the random and deterministic entry points. */
function buildCover(rng: Rng): CssCover {
  return {
    engine: 'css',
    kind: choice(rng, KINDS),
    colors: buildPalette(rng, intBetween(rng, 3, 6)),
    speed: between(rng, 0.6, 1.6),
    scale: between(rng, 0.7, 1.35),
    angle: intBetween(rng, 0, 360),
    blur: between(rng, 0.25, 0.85),
    grain: between(rng, 0.04, 0.22),
    intensity: between(rng, 0.45, 1),
    density: between(rng, 0.3, 0.85),
    frame: between(rng, 0, CSS_COVER_LOOP_SECONDS),
    seed: intBetween(rng, 1, 0x7fffffff),
  };
}

/** A fresh, fully random CSS cover. Use at show-creation time. */
export function randomCssCover(): CssCover {
  return buildCover(mulberry32((Math.random() * 0xffffffff) >>> 0));
}

/** A stable CSS cover derived from any string (e.g. a template id). */
export function cssCoverFromSeed(seed: string): CssCover {
  return buildCover(mulberry32(hashString(seed)));
}

/** Parse/validate a stored CSS cover, returning null if it is not usable. */
export function parseCssCover(value: unknown): CssCover | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<CssCover>;
  if (raw.engine !== 'css') return null;
  if (!raw.kind || !KINDS.includes(raw.kind)) return null;
  const validColors = Array.isArray(raw.colors) ? raw.colors.filter((c) => HEX_RE.test(c)) : [];
  if (validColors.length < 2) return null;
  const colors = normaliseCssCoverColors(validColors);
  // Re-derive any missing numeric params from a seed of the colours so an older
  // partial record still renders sensibly.
  const fallback = cssCoverFromSeed(colors.join(''));
  return {
    ...fallback,
    ...raw,
    engine: 'css',
    kind: raw.kind,
    colors,
    frame: Number.isFinite(raw.frame) ? raw.frame! : fallback.frame,
    seed: Number.isFinite(raw.seed) ? raw.seed! : fallback.seed,
  };
}

/**
 * A cheap static gradient approximating the cover. Paints instantly (no
 * animation, no canvas) so it can back a skeleton or serve as the ultimate
 * fallback, exactly like {@link ./shader-cover#shaderCoverGradient}.
 */
export function cssCoverGradient(cover: Pick<CssCover, 'colors'>): string {
  const colors = normaliseCssCoverColors(cover.colors);
  const [a, b, c] = [colors[0], colors[1] ?? colors[0], colors[2] ?? colors[0]];
  const back = cssCoverBackdropColor({ colors });
  return [
    `radial-gradient(120% 110% at 28% 18%, ${a}, transparent 55%)`,
    `radial-gradient(120% 120% at 82% 88%, ${c}, transparent 52%)`,
    `linear-gradient(155deg, ${b}, ${back} 82%)`,
  ].join(', ');
}
