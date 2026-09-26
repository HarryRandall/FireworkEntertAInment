import * as THREE from 'three';
import type { FireworkDesign, FireworkStarLayer, StarLayerKey } from '../design.ts';
import type { RandomSource } from '../random.ts';
import { HOT_SPARK_COLOR } from './constants.ts';
import { starPatternPosition } from './geometry.ts';
import { clamp } from './math.ts';
import type { EffectContext } from './types.ts';

/** Apply the colour switch only to simulation, preserving copied and saved palettes. */
export function resolveEffectColours(design: FireworkDesign): FireworkDesign {
  if (design.colour.enabled) return design;
  const whiteLayer = (layer: FireworkStarLayer): FireworkStarLayer => ({
    ...layer,
    color: { r: 1, g: 1, b: 1 },
    colourPattern: {
      mode: 'solid',
      axis: 'vertical',
      count: 1,
      colours: [{ color: { r: 1, g: 1, b: 1 }, weight: 100 }],
    },
  });
  return {
    ...design,
    color: { r: 1, g: 1, b: 1 },
    secondaryColor: undefined,
    secondaryColorRatio: undefined,
    stars: {
      ...design.stars,
      outer: whiteLayer(design.stars.outer),
      core: whiteLayer(design.stars.core),
    },
  };
}

export function randomColor(rng: RandomSource): { r: number; g: number; b: number } {
  // HSV with high saturation gives vivid hues; the prior per-channel jitter
  // averaged toward washed-out pastels that didn't read as a colour.
  const h = rng.next() * 6;
  const i = Math.floor(h);
  const f = h - i;
  const v = 1;
  const s = 0.85;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0:
      return { r: v, g: t, b: p };
    case 1:
      return { r: q, g: v, b: p };
    case 2:
      return { r: p, g: v, b: t };
    case 3:
      return { r: p, g: q, b: v };
    case 4:
      return { r: t, g: p, b: v };
    default:
      return { r: v, g: p, b: q };
  }
}

export function resolveColor(
  color: FireworkDesign['color'],
  rng: RandomSource,
): { r: number; g: number; b: number } {
  return color === 'random' ? randomColor(rng) : color;
}

export function resolveOptionalColor(
  color: FireworkDesign['secondaryColor'],
  rng: RandomSource,
): THREE.Color | null {
  if (!color) return null;
  const rgb = resolveColor(color, rng);
  return new THREE.Color(rgb.r, rgb.g, rgb.b);
}

export function resolveLaunchColor(
  color: FireworkDesign['launch']['liftParticles']['colour'],
  fallback: THREE.Color,
  rng: RandomSource,
): THREE.Color {
  if (!color) return fallback.clone();
  const rgb = resolveColor(color, rng);
  return new THREE.Color(rgb.r, rgb.g, rgb.b);
}

export function mixColor(
  from: THREE.Color,
  to: THREE.Color,
  amount: number,
): { r: number; g: number; b: number } {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

export function applyColorMix(from: THREE.Color, to: THREE.Color, amount: number): THREE.Color {
  const mixed = mixColor(from, to, clamp(amount, 0, 1));
  return new THREE.Color(mixed.r, mixed.g, mixed.b);
}

export function starOpeningProgress(
  elapsedSeconds: number,
  lifeReferenceSeconds: number,
  percent: number,
): number {
  const duration = Math.max(0.01, lifeReferenceSeconds * clamp(percent / 100, 0.01, 1));
  const linear = clamp(elapsedSeconds / duration, 0, 1);
  return linear * linear * (3 - 2 * linear);
}

export function starOpeningColor(
  head: FireworkStarLayer['head'],
  target: THREE.Color,
  elapsedSeconds: number,
  lifeReferenceSeconds: number,
): THREE.Color {
  const opening = head.opening.colour;
  if (!opening.enabled) return target;
  const openingColor = new THREE.Color(opening.color.r, opening.color.g, opening.color.b);
  return applyColorMix(
    openingColor,
    target,
    starOpeningProgress(elapsedSeconds, lifeReferenceSeconds, opening.fadePercent),
  );
}

export function starOpeningSize(
  head: FireworkStarLayer['head'],
  fullSize: number,
  elapsedSeconds: number,
  lifeReferenceSeconds: number,
): number {
  const opening = head.opening.size;
  if (!opening.enabled) return fullSize;
  const start = clamp(opening.startPercent / 100, 0.01, 1);
  const progress = starOpeningProgress(elapsedSeconds, lifeReferenceSeconds, opening.growPercent);
  return fullSize * (start + (1 - start) * progress);
}

export function starClosingProgress(
  remainingSeconds: number,
  lifeReferenceSeconds: number,
  percent: number,
): number {
  const duration = Math.max(0.01, lifeReferenceSeconds * clamp(percent / 100, 0.01, 1));
  const linear = 1 - clamp(remainingSeconds / duration, 0, 1);
  return linear * linear * (3 - 2 * linear);
}

export function starClosingColor(
  head: FireworkStarLayer['head'],
  target: THREE.Color,
  remainingSeconds: number,
  lifeReferenceSeconds: number,
): THREE.Color {
  const closing = head.closing.colour;
  if (!closing.enabled) return target;
  const closingColor = new THREE.Color(closing.color.r, closing.color.g, closing.color.b);
  return applyColorMix(
    target,
    closingColor,
    starClosingProgress(remainingSeconds, lifeReferenceSeconds, closing.fadePercent),
  );
}

export function starClosingSize(
  head: FireworkStarLayer['head'],
  fullSize: number,
  remainingSeconds: number,
  lifeReferenceSeconds: number,
): number {
  const closing = head.closing.size;
  if (!closing.enabled) return fullSize;
  const end = clamp(closing.endPercent / 100, 0, 1);
  const progress = starClosingProgress(
    remainingSeconds,
    lifeReferenceSeconds,
    closing.shrinkPercent,
  );
  return fullSize * (1 + (end - 1) * progress);
}

export function starClosingOpacity(
  head: FireworkStarLayer['head'],
  remainingSeconds: number,
  lifeReferenceSeconds: number,
): number {
  const closing = head.closing.size;
  if (!closing.enabled) return 1;
  const end = clamp(closing.endPercent / 100, 0, 1);
  if (end >= 0.995) return 1;
  const progress = starClosingProgress(
    remainingSeconds,
    lifeReferenceSeconds,
    closing.shrinkPercent,
  );
  const sizeScale = 1 + (end - 1) * progress;
  return Math.pow(clamp(sizeScale, 0, 1), 0.72);
}

export function effectStarColourPatternColor(
  ctx: EffectContext,
  design: FireworkDesign,
  layer: FireworkStarLayer,
  fallback: THREE.Color,
  index: number,
  count: number,
  rng: RandomSource,
): THREE.Color | null {
  const pattern = layer.colourPattern;
  const colours = pattern.colours
    .map((stop) => ({
      color: resolveOptionalColor(stop.color, rng),
      weight: clamp(stop.weight, 0, 100),
    }))
    .filter((stop): stop is { color: THREE.Color; weight: number } => Boolean(stop.color));
  if (colours.length === 0) return null;
  if (pattern.mode === 'solid' || colours.length === 1) return colours[0].color.clone();

  const weightedColourAt = (position: number): THREE.Color => {
    const totalWeight = colours.reduce((sum, stop) => sum + stop.weight, 0);
    if (totalWeight <= 0) return fallback.clone();
    let cursor = clamp(position, 0, 0.999999) * totalWeight;
    for (const stop of colours) {
      cursor -= stop.weight;
      if (cursor <= 0) return stop.color.clone();
    }
    return colours[colours.length - 1].color.clone();
  };

  if (pattern.mode === 'bands') {
    return weightedColourAt(starPatternPosition(design, pattern.axis, index, count));
  }

  if (pattern.mode === 'stripes') {
    const position = starPatternPosition(design, pattern.axis, index, count);
    const repeats = Math.max(1, Math.round(pattern.count));
    return weightedColourAt((position * repeats) % 1);
  }

  const totalWeight = colours.reduce((sum, stop) => sum + stop.weight, 0);
  if (totalWeight <= 0) return fallback.clone();
  let cursor = rng.next() * totalWeight;
  for (const stop of colours) {
    cursor -= stop.weight;
    if (cursor <= 0) return stop.color.clone();
  }
  return colours[colours.length - 1].color.clone();
}

export function effectStarColor(
  ctx: EffectContext,
  design: FireworkDesign,
  layer: FireworkStarLayer,
  layerKey: StarLayerKey,
  color: THREE.Color,
  index: number,
  count: number,
  rng: RandomSource,
): THREE.Color {
  const layerColor = resolveOptionalColor(layer.color, rng);
  const baseColor =
    layerColor ??
    (layerKey === 'core'
      ? (resolveOptionalColor(design.secondaryColor, rng) ??
        applyColorMix(color, HOT_SPARK_COLOR, 0.55))
      : color);
  const patternedColor = effectStarColourPatternColor(
    ctx,
    design,
    layer,
    baseColor,
    index,
    count,
    rng,
  );
  if (patternedColor) return patternedColor;
  if (layerKey === 'core') return baseColor;
  const secondary = resolveOptionalColor(design.secondaryColor, rng);
  if (!secondary) return baseColor;
  if (design.pattern === 'strobe') {
    return rng.next() > 0.62 ? secondary : baseColor;
  }
  if (design.geometry === 'pearls') return index % 2 === 0 ? baseColor : secondary;
  // `secondaryColorRatio` is the fraction of stars that take the accent
  // colour. Defaults to 0.22 so existing shows render identically.
  const accentRatio = clamp(design.secondaryColorRatio ?? 0.22, 0, 1);
  return rng.next() > 1 - accentRatio ? secondary : baseColor;
}
