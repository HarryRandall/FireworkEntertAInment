/** Shared stored-design validation and show adjustments for planning and playback. */
import {
  resolveDesign,
  upgradeDesign,
  type AdjustmentLevel,
  type Design,
} from '@showcrafter/renderer';
import type { CueEmphasis } from '@/lib/cue-generation/schemas';

export type ShowDesignResult = { ok: true; design: Design } | { ok: false; error: string };

/** Validates stored data through the renderer's version gate, with a visible typed error. */
export function readShowDesign(value: unknown, schema: number): ShowDesignResult {
  try {
    const design = upgradeDesign(value, schema);
    resolveDesign(design);
    return { ok: true, design };
  } catch {
    return {
      ok: false,
      error: 'This firework has no valid renderer design. Please repair its catalogue design.',
    };
  }
}

/** Show emphasis, dimensionless levels from the renderer adjustment registry.
 * Accent adds one size/brightness level; peak adds two. Combined levels clamp to -3..3.
 * Catalogue designs already carry their physical height and spread (Finale-mapped
 * products are built from their VDL at Finale 3D's sizes), so calibre adds nothing.
 */
const SHOW_DESIGN_ADJUSTMENTS = {
  emphasis: { normal: 0, accent: 1, peak: 2 },
} as const;

function level(value: number): AdjustmentLevel {
  return Math.max(-3, Math.min(3, Math.round(value))) as AdjustmentLevel;
}

/** Resolves the same quick adjustments for both musical timing and visible shots. */
export function resolvedShowDesign(
  product: { design?: Design | null },
  emphasis: CueEmphasis = 'normal',
): Design {
  if (!product.design) throw new Error('This firework has no valid renderer design.');
  const design = product.design;
  const emphasisLevel = SHOW_DESIGN_ADJUSTMENTS.emphasis[emphasis];
  const adjustments: Record<string, AdjustmentLevel> = Object.fromEntries(
    Object.entries(design.adjustments ?? {}).map(([key, value]) => [key, level(value)]),
  );
  const add = (key: string, amount: number) => {
    adjustments[key] = level((adjustments[key] ?? 0) + amount);
  };
  add('ground.star_size', emphasisLevel);
  add('break.flash', emphasisLevel);
  const layerIds = new Set(design.breaks.flatMap((burst) => burst.layers.map((layer) => layer.id)));
  for (const id of layerIds) {
    add(`layer.${id}.size`, emphasisLevel);
    add(`layer.${id}.brightness`, emphasisLevel);
  }
  return resolveDesign({ ...design, adjustments });
}

/** Firing-to-impact delay in seconds; mines and all ground kinds fire on the impact. */
export function showLiftTimeSeconds(design: Design): number {
  return design.kind === 'shell' || design.kind === 'rocket' ? (design.launch?.time_s ?? 0) : 0;
}

/** Returns authored renderer colours plus catalogue labels, without legacy effect flags. */
export function showProductColours(product: {
  design?: Design | null;
  variant?: {
    primaryColor: string | null;
    secondaryColor: string | null;
    colorPalette: string[];
  } | null;
}): string[] {
  const values = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) values.add(value);
    else if (Array.isArray(value)) for (const child of value) visit(child);
    else if (value != null && typeof value === 'object')
      for (const child of Object.values(value)) visit(child);
  };
  for (const burst of product.design?.breaks ?? [])
    for (const layer of burst.layers) visit(layer.colour);
  visit(product.design?.ground);
  for (const value of [
    product.variant?.primaryColor,
    product.variant?.secondaryColor,
    ...(product.variant?.colorPalette ?? []),
  ])
    if (value) values.add(value);
  return [...values];
}
