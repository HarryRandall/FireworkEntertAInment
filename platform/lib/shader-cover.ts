/**
 * Shader cover — a small, serialisable "visual identity" for a show. One is
 * generated per show (randomly at creation, or deterministically from an id for
 * curated templates), persisted as JSON, and rendered both as the animated
 * background on the generating screen and as the cover art on Explore cards.
 *
 * Pure module: no React, no DOM. Safe to import on the server.
 */

export type ShaderCoverKind =
  | 'grain-gradient'
  | 'mesh-gradient'
  | 'warp'
  | 'simplex-noise'
  | 'god-rays';

export type WarpShape = 'checks' | 'stripes' | 'edge';
export type GrainShape = 'wave' | 'dots' | 'truchet' | 'corners' | 'ripple' | 'blob' | 'sphere';

export type ShaderCover = {
  kind: ShaderCoverKind;
  /** 3–6 hex colours, e.g. "#aabbcc". */
  colors: string[];
  speed: number;
  scale: number;
  rotation: number;
  frame: number;
  // Per-kind parameters. Defaults are applied by the renderer when absent.
  softness: number;
  intensity: number;
  distortion: number;
  swirl: number;
  grainMixer: number;
  stepsPerColor: number;
  density: number;
  spotty: number;
  midSize: number;
  midIntensity: number;
  warpShape: WarpShape;
  grainShape: GrainShape;
  shapeScale: number;
  proportion: number;
  swirlIterations: number;
};

const KINDS: ShaderCoverKind[] = [
  'grain-gradient',
  'mesh-gradient',
  'warp',
  'simplex-noise',
  'god-rays',
];
const WARP_SHAPES: WarpShape[] = ['checks', 'stripes', 'edge'];
const GRAIN_SHAPES: GrainShape[] = [
  'wave',
  'dots',
  'truchet',
  'corners',
  'ripple',
  'blob',
  'sphere',
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

type Hsl = {
  hue: number;
  saturation: number;
  lightness: number;
};

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

export function normaliseCoverColors(colors: string[]): string[] {
  const normalised = colors
    .filter((color) => HEX_RE.test(color))
    .map((color) => normaliseCoverColor(color));
  return normalised.length >= 2 ? normalised : FALLBACK_COLORS;
}

export function shaderCoverBackdropColor(cover: Pick<ShaderCover, 'colors'>): string {
  const colors = normaliseCoverColors(cover.colors);
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
    clamp(hsl.lightness - 8, 30, 46),
  );
}

/** Build a harmonious palette from a base hue so covers don't look muddy. */
function buildPalette(rng: Rng, count: number): string[] {
  const baseHue = intBetween(rng, 0, 359);
  const spread = choice(rng, [24, 40, 60, 120, 180]);
  return Array.from({ length: count }, (_, index) => {
    const hue = (baseHue + spread * index + intBetween(rng, -12, 12) + 360) % 360;
    return hslToHex(hue, intBetween(rng, 64, 100), intBetween(rng, 46, 70));
  });
}

/** Core generator shared by the random and deterministic entry points. */
function buildCover(rng: Rng): ShaderCover {
  const kind = choice(rng, KINDS);
  const colors = buildPalette(rng, intBetween(rng, 3, 6));
  const warpShape = choice(rng, WARP_SHAPES);

  return {
    kind,
    colors,
    speed: between(rng, 0.8, 2.4),
    scale: between(rng, 0.5, 1.1),
    rotation: intBetween(rng, 0, 360),
    frame: intBetween(rng, 0, 120000),
    // Constrained to match the playground rules (no harsh grain/bloom).
    softness: between(rng, 0, 1),
    intensity: between(rng, 0.35, 1),
    distortion: between(rng, 0.15, 1),
    swirl: between(rng, 0, 1),
    grainMixer: between(rng, 0, 0.1),
    stepsPerColor: intBetween(rng, 1, 6),
    density: between(rng, 0.03, 0.5),
    spotty: between(rng, 0.05, 0.85),
    midSize: between(rng, 0.05, 0.65),
    midIntensity: between(rng, 0.15, 1),
    warpShape,
    grainShape: choice(rng, GRAIN_SHAPES),
    shapeScale: warpShape === 'edge' ? 0 : between(rng, 0.05, 0.9),
    proportion: between(rng, 0.08, 0.88),
    swirlIterations: intBetween(rng, 10, 20),
  };
}

/** A fresh, fully random cover. Use at show-creation time. */
export function randomShaderCover(): ShaderCover {
  return buildCover(mulberry32((Math.random() * 0xffffffff) >>> 0));
}

/** A stable cover derived from any string (e.g. a template id). */
export function shaderCoverFromSeed(seed: string): ShaderCover {
  return buildCover(mulberry32(hashString(seed)));
}

/** Parse/validate a stored cover, returning null if it isn't usable. */
export function parseShaderCover(value: unknown): ShaderCover | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ShaderCover>;
  if (!raw.kind || !KINDS.includes(raw.kind)) return null;
  const validColors = Array.isArray(raw.colors) ? raw.colors.filter((c) => HEX_RE.test(c)) : [];
  if (validColors.length < 2) return null;
  const colors = normaliseCoverColors(validColors);
  // Re-derive any missing numeric params from a seed of the colours so an older
  // partial record still renders sensibly.
  const fallback = shaderCoverFromSeed(colors.join(''));
  return { ...fallback, ...raw, kind: raw.kind, colors };
}

/** A CSS gradient approximating the cover, for a cheap loading fallback. */
export function shaderCoverGradient(cover: Pick<ShaderCover, 'colors'>): string {
  const colors = normaliseCoverColors(cover.colors);
  const [a, b, c] = [colors[0], colors[1] ?? colors[0], colors[2] ?? colors[0]];
  const back = shaderCoverBackdropColor({ colors });
  return [
    `radial-gradient(120% 110% at 28% 18%, ${a}, transparent 55%)`,
    `radial-gradient(120% 120% at 82% 88%, ${c}, transparent 52%)`,
    `linear-gradient(155deg, ${b}, ${back} 82%)`,
  ].join(', ');
}
