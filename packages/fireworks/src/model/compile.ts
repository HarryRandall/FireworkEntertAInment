import { hexToRendererColor } from './colours.ts';
import { RendererValidationError, type RenderResult } from './diagnostics.ts';
import { DEFAULT_DESIGN, hydrateBurstTrailDefaults, safeParseFireworkDesign } from './normalise.ts';
import type { RecordLike } from './records.ts';
import { deepMergeDesign, isRecord } from './records.ts';
import { FireworkDesignSchema, type FireworkDesign } from './schema.ts';

export const FIREWORK_RENDER_DEFAULT_KEYS = new Set([
  'size',
  'colour',
  'color',
  'secondaryColor',
  'secondaryColorRatio',
  'liftVelocity',
  'shellLife',
  'pattern',
  'geometry',
  'trailProfile',
  'geometryTuning',
  'burstTrail',
  'burst',
  'flair',
  'crackle',
  'sound',
  'strobe',
  'trail',
  'split',
  'mortar',
  'launch',
  'stars',
  'brocade',
]);

export const EFFECT_MODEL_STRUCTURE_KEYS = ['geometry', 'trailProfile'] as const;

export function canonicaliseEffectModelJson(input: unknown): RecordLike {
  const source = isRecord(input) ? input : {};
  const canonical: RecordLike = {};
  const topLevelDefaults: RecordLike = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === 'renderDefaults') continue;
    if (key === 'pistil') continue;
    if (FIREWORK_RENDER_DEFAULT_KEYS.has(key)) {
      topLevelDefaults[key] = value;
      continue;
    }
    canonical[key] = value;
  }

  const existingDefaults = isRecord(source.renderDefaults) ? source.renderDefaults : {};
  // `renderDefaults` wins so old top-level values cannot fight the live editor.
  const mergedDefaults = deepMergeDesign(topLevelDefaults, existingDefaults);
  const renderDefaults = isRecord(mergedDefaults) ? { ...mergedDefaults } : {};
  delete renderDefaults.pistil;

  for (const key of EFFECT_MODEL_STRUCTURE_KEYS) {
    const value = renderDefaults[key] ?? source[key];
    if (value !== undefined) {
      canonical[key] = value;
      renderDefaults[key] = value;
    }
  }

  canonical.renderDefaults = renderDefaults;
  return canonical;
}

export function extractBaseDefaults(baseModel: unknown): unknown {
  if (!isRecord(baseModel)) return baseModel;
  if (!isRecord(baseModel.renderDefaults)) return baseModel;
  return canonicaliseEffectModelJson(baseModel).renderDefaults;
}

export function mergeDefaultFragments(fragments: readonly unknown[] | undefined): unknown {
  if (!fragments?.length) return {};
  return fragments.reduce<unknown>(
    (merged, fragment) => deepMergeDesign(merged, hydrateBurstTrailDefaults(fragment)),
    {},
  );
}

export type CompileFireworkDesignInput = {
  baseModel?: unknown;
  effectStyleDefaults?: readonly unknown[];
  fireworkStyleDefaults?: readonly unknown[];
  variantOverrides?: unknown;
  primaryColor?: string | null;
  colorPalette?: string[] | null;
};

export function compileFireworkDesign(params: CompileFireworkDesignInput): FireworkDesign {
  const fragments = [
    ...(params.effectStyleDefaults ?? []),
    extractBaseDefaults(params.baseModel),
    ...(params.fireworkStyleDefaults ?? []),
    params.variantOverrides,
  ].filter((value) => value !== undefined && value !== null);
  for (const fragment of fragments) {
    if (!isRecord(fragment))
      throw new RendererValidationError([
        { path: [], message: 'Renderer settings must be an object.' },
      ]);
  }
  for (const fragment of fragments) {
    const parsed = FireworkDesignSchema.safeParse(deepMergeDesign(DEFAULT_DESIGN, fragment));
    if (!parsed.success)
      throw new RendererValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        })),
      );
  }
  const compiled = fragments.reduce<RecordLike>(
    (merged, fragment) =>
      deepMergeDesign(merged, hydrateBurstTrailDefaults(fragment)) as RecordLike,
    structuredClone(DEFAULT_DESIGN),
  );
  const colourSettings = isRecord(compiled.colour) ? compiled.colour : {};
  const colourEnabled = colourSettings.enabled !== false;
  const explicitColor = params.primaryColor
    ? hexToRendererColor(params.primaryColor)
    : params.colorPalette?.[0]
      ? hexToRendererColor(params.colorPalette[0])
      : null;
  if (colourEnabled && explicitColor) {
    compiled.color = explicitColor;
  }
  if (colourEnabled && params.colorPalette?.[1]) {
    const secondaryColor = hexToRendererColor(params.colorPalette[1]);
    if (secondaryColor) compiled.secondaryColor = secondaryColor;
  }
  if (!colourEnabled) {
    compiled.color = { r: 1, g: 1, b: 1 };
    delete compiled.secondaryColor;
    delete compiled.secondaryColorRatio;
    if (isRecord(compiled.stars)) {
      const stars = { ...compiled.stars };
      for (const layerKey of ['outer', 'core']) {
        const layer = isRecord(stars[layerKey]) ? { ...stars[layerKey] } : {};
        layer.color = { r: 1, g: 1, b: 1 };
        layer.colourPattern = {
          mode: 'solid',
          axis: 'vertical',
          count: 1,
          colours: [{ color: { r: 1, g: 1, b: 1 }, weight: 100 }],
        };
        stars[layerKey] = layer;
      }
      compiled.stars = stars;
    }
  }

  return safeParseFireworkDesign(compiled);
}

export function validateFireworkDesign(params: CompileFireworkDesignInput): RenderResult {
  try {
    return { ok: true, design: compileFireworkDesign(params) };
  } catch (error) {
    if (error instanceof RendererValidationError)
      return { ok: false, diagnostics: error.diagnostics };
    throw error;
  }
}
