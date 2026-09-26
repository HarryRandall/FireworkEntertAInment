import {
  compileFireworkDesign,
  extractBaseDefaults,
} from '../../packages/fireworks/src/model/compile.ts';
import { deepMergeDesign } from '../../packages/fireworks/src/model/records.ts';
import { convertEmissionDesign, convertEmissionPart } from './convert-emission-settings.mjs';

/** Prepare fresh-install content without reading or writing a live catalogue. */
export function convertBootstrapSettings(tables) {
  const effects = new Map(tables.firework_effects.map((row) => [row.id, row.model_json]));
  return {
    ...tables,
    firework_effects: tables.firework_effects.map((row) => ({
      ...row,
      model_json: convertEmissionDesign(row.model_json),
    })),
    firework_style_defaults: tables.firework_style_defaults.map((row) => ({
      ...row,
      defaults_json: convertEmissionPart(row.defaults_json),
    })),
    fireworks: tables.fireworks.map((row) => {
      if (row.render_snapshot_json)
        return { ...row, render_snapshot_json: convertEmissionDesign(row.render_snapshot_json) };
      const effect = effects.get(row.firework_effect_id);
      if (!effect) throw new Error(`Missing source effect for firework ${row.id}.`);
      // Resolve against the original effect before converting either side. The
      // original overrides remain available as provenance, separate from reads.
      const source = deepMergeDesign(extractBaseDefaults(effect), row.render_overrides_json);
      const converted = convertEmissionDesign(source);
      const resolved = compileFireworkDesign({
        variantOverrides: converted,
        primaryColor: row.primary_color,
        colorPalette: row.color_palette,
      });
      return {
        ...row,
        render_snapshot_json: {
          ...resolved,
          ...(converted.presetSources ? { presetSources: converted.presetSources } : {}),
        },
      };
    }),
  };
}
