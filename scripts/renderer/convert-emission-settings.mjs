/** One-off data conversion only. Never imported by the renderer or editor. */
import {
  compileFireworkDesign,
  extractBaseDefaults,
} from '../../packages/fireworks/src/model/compile.ts';

import { deepMergeDesign } from '../../packages/fireworks/src/model/records.ts';
import {
  extractStyleDefaultsFromDesign,
  isFireworkStyleDefaultKind,
} from '../../packages/fireworks/src/style-defaults.ts';

const countRules = {
  ring: ['ring', 72],
  radial_arms: ['radialArms', 46],
  falling_tail: ['fallingTail', 62],
  pearls: ['pearls', 18],
  fragment_cloud: ['fragmentCloud', 90],
  heart: ['heart', 88],
  five_point_star: ['fivePointStar', 86],
  bowtie: ['bowtie', 82],
  fish: ['fish', 72],
  waterfall: ['waterfall', 78],
  whirl: ['whirl', 28, 32],
  upward_fan: ['upwardFan', 90, 36],
  roman_candle: ['romanCandle', 8, 4],
};
const removed = new Set([
  'countPercent',
  'minCount',
  'shotsPercent',
  'minShots',
  'ratePercent',
  'minRatePerSecond',
  'durationPercent',
  'durationMinSeconds',
  'durationMaxSeconds',
]);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function cleanTuning(tuning) {
  for (const group of Object.values(tuning ?? {})) {
    if (object(group)) for (const key of removed) delete group[key];
  }
}
function duration(source, group) {
  const tuning = source.geometryTuning?.[group] ?? {};
  if (tuning.durationSeconds != null) return tuning.durationSeconds;
  const fountain = group === 'fountain';
  return Math.max(
    tuning.durationMinSeconds ?? (fountain ? 2.5 : 3),
    Math.min(
      tuning.durationMaxSeconds ?? 10,
      ((source.shellLife ?? 20) * (tuning.durationPercent ?? (fountain ? 26 : 40))) / 100,
    ),
  );
}
function rate(source, count, key) {
  const tuning = source.geometryTuning?.fountain ?? {};
  return Math.max(
    key === 'outer' ? (tuning.minRatePerSecond ?? 40) : 0,
    (count * (tuning.ratePercent ?? 140)) / 100,
  );
}

function convertWaterfallWidth(result, source, count) {
  result.geometryTuning ??= {};
  const original = source.geometryTuning?.waterfall ?? {};
  result.geometryTuning.waterfall = {
    ...result.geometryTuning.waterfall,
    width: original.width ?? Number((count * (original.curtainWidth ?? 2.2)).toPrecision(12)),
  };
  delete result.geometryTuning.waterfall.curtainWidth;
}

export function convertEmissionDesign(input, { includeProvenance = true } = {}) {
  if (!object(input)) throw new Error('Expected an object containing renderer settings.');
  const source = extractBaseDefaults(input);
  const result = structuredClone(source);
  // The explicit rates distinguish already converted complete snapshots. The
  // conversion never changes a document edited with the new controls.
  const parsed = compileFireworkDesign({ variantOverrides: source });
  result.stars ??= {};
  for (const key of ['outer', 'core']) {
    const original = source.stars?.[key];
    if (original?.emissionRate != null) continue;
    const count = parsed.stars[key].count;
    let actual = count;
    const rule = countRules[parsed.geometry];
    if (parsed.geometry === 'single_tail') actual = 1;
    else if (rule) {
      const [group, percent, minimum = 1] = rule;
      const tuning = source.geometryTuning?.[group] ?? {};
      const candle = group === 'romanCandle';
      actual = Math.max(
        key === 'core' ? 1 : (tuning[candle ? 'minShots' : 'minCount'] ?? minimum),
        Math.round((count * (tuning[candle ? 'shotsPercent' : 'countPercent'] ?? percent)) / 100),
      );
    }
    result.stars[key] = { ...original, count: actual, emissionRate: rate(source, count, key) };
  }
  result.geometryTuning ??= {};
  for (const group of ['fountain', 'romanCandle']) {
    result.geometryTuning[group] = {
      ...result.geometryTuning[group],
      durationSeconds: duration(source, group),
    };
  }
  cleanTuning(result.geometryTuning);
  convertWaterfallWidth(result, source, parsed.stars.outer.count);
  if (includeProvenance) convertProvenance(result, source);
  // Reject converted values outside the new supported ranges, never clamp them.
  compileFireworkDesign({ variantOverrides: result });
  return object(input.renderDefaults) ? { ...input, renderDefaults: result } : result;
}

export function convertEmissionPart(input) {
  if (!object(input)) throw new Error('Expected an object containing part settings.');
  const result = structuredClone(input);
  for (const key of ['outer', 'core']) {
    const layer = result.stars?.[key];
    if (layer?.count != null && layer.emissionRate == null) {
      // A star-only preset has no owning shape. Keep its authored count rather
      // than inventing a geometry, and initialise its independent fountain rate.
      layer.emissionRate = rate(input, layer.count, key);
    }
  }
  if (result.geometryTuning) {
    for (const group of ['fountain', 'romanCandle']) {
      if (result.geometryTuning[group])
        result.geometryTuning[group].durationSeconds = duration(input, group);
    }
    cleanTuning(result.geometryTuning);
    if (result.geometryTuning.waterfall)
      convertWaterfallWidth(result, input, input.stars?.outer?.count ?? 100);
  }
  convertProvenance(result, input);
  compileFireworkDesign({ variantOverrides: result });
  return result;
}

export function convertEmissionHistory(snapshot) {
  if (snapshot == null) return snapshot;
  if (!object(snapshot)) throw new Error('Expected an editor history snapshot.');
  if (snapshot.kind === 'effect')
    return { ...snapshot, modelJson: convertEmissionDesign(snapshot.modelJson) };
  if (snapshot.kind === 'style_default')
    return { ...snapshot, defaultsJson: convertEmissionPart(snapshot.defaultsJson) };
  if (snapshot.kind === 'firework') {
    // Older history can contain only overrides against a mutable effect. It
    // cannot be reconstructed honestly from today's effect. Stop for review.
    if (!snapshot.renderOverridesJson?.geometry)
      throw new Error(
        'History has unresolved firework overrides; resolve its original effect before conversion.',
      );
    return {
      ...snapshot,
      renderOverridesJson: convertEmissionDesign(snapshot.renderOverridesJson),
    };
  }
  throw new Error('Unknown editor history snapshot kind.');
}

function convertProvenance(result, context) {
  if (context.presetSources == null) return;
  if (!object(context.presetSources)) throw new Error('Preset provenance must be an object.');
  result.presetSources = {};
  for (const [kind, source] of Object.entries(context.presetSources)) {
    if (!isFireworkStyleDefaultKind(kind) || !object(source) || !object(source.settings)) {
      throw new Error(`Invalid copied preset source: ${kind}.`);
    }
    const combined = deepMergeDesign(context, source.settings);
    // A copied source is converted in its owning document's geometry. A source
    // star count therefore resets to the same effective count after conversion.
    const converted = convertEmissionDesign(combined, { includeProvenance: false });
    result.presetSources[kind] = {
      ...source,
      settings: extractStyleDefaultsFromDesign(
        compileFireworkDesign({ variantOverrides: converted }),
        kind,
      ),
    };
  }
}
