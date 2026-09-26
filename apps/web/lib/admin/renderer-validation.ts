import {
  RendererValidationError,
  validateFireworkDesign,
  type RenderResult,
} from '@showcrafter/fireworks/design';
import { isRecord } from '@showcrafter/fireworks/model/records';
import {
  compileStyleDefaultPreviewDesign,
  isFireworkStyleDefaultKind,
  makeTrailPreviewStarDefaults,
} from '@showcrafter/fireworks/style-defaults';

type CatalogueRenderSource = {
  recordId: string;
  settings: unknown;
} & ({ kind: 'effect' } | { kind: 'firework' } | { kind: 'style-default'; styleKind: string });

/** Validate the stored source before any preview normalisation can discard it. */
export function validateCatalogueRender(source: CatalogueRenderSource): RenderResult {
  let result: RenderResult;
  if (!isRecord(source.settings)) {
    result = {
      ok: false,
      diagnostics: [
        {
          path: [],
          message:
            source.kind === 'firework'
              ? 'The saved render snapshot is missing or is not an object.'
              : 'Renderer settings must be an object.',
        },
      ],
    };
  } else if (source.kind === 'effect') {
    result =
      'renderDefaults' in source.settings && !isRecord(source.settings.renderDefaults)
        ? {
            ok: false,
            diagnostics: [
              { path: ['renderDefaults'], message: 'Renderer settings must be an object.' },
            ],
          }
        : validateFireworkDesign({ baseModel: source.settings });
  } else if (source.kind === 'firework') {
    const settings = source.settings;
    const missing = ['geometry', 'stars', 'launch'].filter((key) => !(key in settings));
    result = missing.length
      ? {
          ok: false,
          diagnostics: missing.map((key) => ({
            path: [key],
            message: 'Missing from the saved render snapshot.',
          })),
        }
      : validateFireworkDesign({ variantOverrides: source.settings });
  } else if (!isFireworkStyleDefaultKind(source.styleKind)) {
    result = {
      ok: false,
      diagnostics: [{ path: ['kind'], message: 'This preset part is not supported.' }],
    };
  } else {
    try {
      const fragment = validateFireworkDesign({ variantOverrides: source.settings });
      if (!fragment.ok) throw new RendererValidationError(fragment.diagnostics);
      result = {
        ok: true,
        design: compileStyleDefaultPreviewDesign(
          source.styleKind,
          source.settings,
          source.styleKind === 'trail' || source.styleKind === 'innerTrail'
            ? makeTrailPreviewStarDefaults(source.styleKind === 'innerTrail' ? 'core' : 'outer')
            : undefined,
        ),
      };
    } catch (error) {
      if (!(error instanceof RendererValidationError)) throw error;
      result = { ok: false, diagnostics: error.diagnostics };
    }
  }
  return result.ok
    ? result
    : {
        ok: false,
        diagnostics: result.diagnostics.map((issue) => ({ ...issue, recordId: source.recordId })),
      };
}
