/**
 * Shared options for the new-show flow: firework type constraints and
 * site-width handling. Client-safe (no server-only imports) so the wizard,
 * the server action, and the cue pipeline all use one source of truth.
 */

import type { LaunchPosition } from '../fireworks/launch-positions';

/* === Firework types ===================================================== */

export const FIREWORK_TYPE_KEYS = ['aerial_shells', 'cakes', 'fountains'] as const;

export type FireworkTypeKey = (typeof FIREWORK_TYPE_KEYS)[number];

export const FIREWORK_TYPES: Record<
  FireworkTypeKey,
  { key: FireworkTypeKey; label: string; description: string }
> = {
  aerial_shells: {
    key: 'aerial_shells',
    label: 'Aerial shells',
    description: 'Single bursts high in the sky - peonies, willows, brocades.',
  },
  cakes: {
    key: 'cakes',
    label: 'Multi-shot cakes',
    description: 'Sustained barrages that fire many shots from one fuse.',
  },
  fountains: {
    key: 'fountains',
    label: 'Fountains & ground',
    description: 'Ground-level sprays and gerbs, no aerial break.',
  },
};

export function isFireworkTypeKey(value: unknown): value is FireworkTypeKey {
  return typeof value === 'string' && (FIREWORK_TYPE_KEYS as readonly string[]).includes(value);
}

/** Parse a stored `firework_types` array; null/empty/full = no constraint. */
export function parseFireworkTypes(value: unknown): FireworkTypeKey[] | null {
  if (!Array.isArray(value)) return null;
  const keys = Array.from(new Set(value.filter(isFireworkTypeKey)));
  if (keys.length === 0 || keys.length === FIREWORK_TYPE_KEYS.length) return null;
  return keys;
}

/**
 * Best-effort check of whether a product matches one of the selected types.
 * Works off shot count + free text so it doesn't depend on catalogue
 * taxonomy being filled in.
 */
export function productMatchesTypes(
  product: { shotCount?: number | null; name?: string | null; description?: string | null },
  types: readonly FireworkTypeKey[],
): boolean {
  const text = `${product.name ?? ''} ${product.description ?? ''}`.toLowerCase();
  const isFountain = /fountain|gerb|ground effect/.test(text);
  const isMulti = (product.shotCount ?? 1) > 1;
  return types.some((type) => {
    if (type === 'fountains') return isFountain;
    if (type === 'cakes') return isMulti && !isFountain;
    return !isMulti && !isFountain; // aerial_shells
  });
}

/* === Site width ========================================================= */

export const MIN_SITE_WIDTH_FEET = 5;
export const MAX_SITE_WIDTH_FEET = 2000;
export const DEFAULT_SITE_WIDTH_FEET = 80;

function resolvedSiteWidthFeet(widthFeet: number | null | undefined): number {
  if (widthFeet == null || !Number.isFinite(widthFeet)) return DEFAULT_SITE_WIDTH_FEET;
  return Math.min(MAX_SITE_WIDTH_FEET, Math.max(MIN_SITE_WIDTH_FEET, widthFeet));
}

/**
 * Number of launch positions a site supports. Mirrors the stakeholder rule
 * of thumb: a narrow backyard cannot hold three firing positions.
 */
export function launchPositionsForWidth(widthFeet: number | null | undefined): 1 | 2 | 3 {
  const resolvedWidthFeet = resolvedSiteWidthFeet(widthFeet);
  if (resolvedWidthFeet >= 60) return 3;
  if (resolvedWidthFeet >= 30) return 2;
  return 1;
}

/**
 * Centre the active mortars across the measured site. Scene x-coordinates use
 * the supplied feet directly so wider sites spread out without inheriting the
 * renderer's fixed legacy spacing.
 */
export function buildLaunchPositionsForWidth(
  widthFeet: number | null | undefined,
): LaunchPosition[] {
  const resolvedWidthFeet = resolvedSiteWidthFeet(widthFeet);
  const positionCount = launchPositionsForWidth(resolvedWidthFeet);
  if (positionCount === 1) return [{ x: 0, y: 0, z: 0 }];

  const halfWidth = Number((resolvedWidthFeet / 2).toFixed(3));
  const left = { x: -halfWidth, y: 0, z: 0 };
  const right = { x: halfWidth, y: 0, z: 0 };
  if (positionCount === 2) return [left, right];
  return [left, { x: 0, y: 0, z: 0 }, right];
}

type LaunchPositionAwareProduct = {
  launchPositionOverrideIndices?: number[];
};

/** Whether every absolute multishot child position fits on this site. */
export function productFitsLaunchPositions(
  product: LaunchPositionAwareProduct,
  maxPositions: 1 | 2 | 3,
): boolean {
  return (product.launchPositionOverrideIndices ?? []).every(
    (index) => Number.isInteger(index) && index >= 0 && index < maxPositions,
  );
}

/**
 * Conservatively reserve the parent tube and every absolute child tube for a
 * multishot's full duration. This prevents expanded child shots colliding with
 * another generated cue even when only some children override their position.
 */
export function occupiedLaunchPositions(
  product: LaunchPositionAwareProduct,
  parentPosition: 0 | 1 | 2,
  maxPositions: 1 | 2 | 3,
): Array<0 | 1 | 2> | null {
  if (!productFitsLaunchPositions(product, maxPositions) || parentPosition >= maxPositions) {
    return null;
  }
  return Array.from(
    new Set([parentPosition, ...(product.launchPositionOverrideIndices ?? [])]),
  ).sort((a, b) => a - b) as Array<0 | 1 | 2>;
}
