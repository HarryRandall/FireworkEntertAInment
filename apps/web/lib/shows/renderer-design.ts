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

/** Show convention, dimensionless levels from the renderer adjustment registry.
 * Calibre baseline is 75 mm; each band raises launch height (1.12 per level,
 * lift time by its square root) and layer radius (1.15 per level). Authored
 * catalogue height is retained as the baseline, never converted from old geometry.
 * Accent adds one size/brightness level; peak adds two. Combined levels clamp to -3..3.
 */
const SHOW_DESIGN_ADJUSTMENTS = {
  calibre: [
    { maximumMm: 30, level: -3 },
    { maximumMm: 50, level: -2 },
    { maximumMm: 60, level: -1 },
    { maximumMm: 75, level: 0 },
    { maximumMm: 100, level: 1 },
    { maximumMm: 125, level: 2 },
    { maximumMm: Infinity, level: 3 },
  ],
  emphasis: { normal: 0, accent: 1, peak: 2 },
} as const;

function level(value: number): AdjustmentLevel {
  return Math.max(-3, Math.min(3, Math.round(value))) as AdjustmentLevel;
}

/** Resolves the same quick adjustments for both musical timing and visible shots. */
export function resolvedShowDesign(
  product: { design?: Design | null; caliber?: string | null },
  emphasis: CueEmphasis = 'normal',
): Design {
  if (!product.design) throw new Error('This firework has no valid renderer design.');
  const design = product.design;
  const mm = showCalibreMillimetres(product.caliber);
  const calibreLevel =
    mm != null && mm > 0
      ? (SHOW_DESIGN_ADJUSTMENTS.calibre.find((band) => mm <= band.maximumMm)?.level ?? 0)
      : 0;
  const emphasisLevel = SHOW_DESIGN_ADJUSTMENTS.emphasis[emphasis];
  const adjustments: Record<string, AdjustmentLevel> = Object.fromEntries(
    Object.entries(design.adjustments ?? {}).map(([key, value]) => [key, level(value)]),
  );
  const add = (key: string, amount: number) => {
    adjustments[key] = level((adjustments[key] ?? 0) + amount);
  };
  add('launch.height', calibreLevel);
  add('ground.star_size', calibreLevel + emphasisLevel);
  add('break.flash', emphasisLevel);
  const layerIds = new Set(design.breaks.flatMap((burst) => burst.layers.map((layer) => layer.id)));
  for (const id of layerIds) {
    add(`layer.${id}.size`, calibreLevel + emphasisLevel);
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

// Millimetres per international inch, exact SI conversion.
const MILLIMETRES_PER_INCH = 25.4;

/** Parses catalogue calibre in millimetres or common inch notation; unknown values use the baseline. */
function showCalibreMillimetres(calibre: string | null | undefined): number | null {
  const mm = calibre?.trim().match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  if (mm) return Number(mm[1]);
  const inch = calibre?.trim().match(/^(\d+(?:\.\d+)?)\s*(?:["\u201D\u2033]|in(?:ch(?:es)?)?)$/i);
  return inch ? Number(inch[1]) * MILLIMETRES_PER_INCH : null;
}
