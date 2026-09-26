import { compileFireworkDesign, validateFireworkDesign } from '@showcrafter/fireworks/design';
import { deepMergeDesign, isRecord } from '@showcrafter/fireworks/model/records';
import {
  extractStyleDefaultsFromDesign,
  removeStyleDefaultOverridesFromRecord,
  type FireworkStyleDefaultKind,
} from '@showcrafter/fireworks/style-defaults';
import type { JsonRecord } from './types.ts';

type PresetSource = { id: string; name: string; updatedAt?: string; defaultsJson: unknown };

/** Copy only the declared part. Provenance is descriptive and never a live dependency. */
export function applyCopiedPreset(
  draft: JsonRecord,
  kind: FireworkStyleDefaultKind,
  source: PresetSource,
): void {
  const resolved = compileFireworkDesign({ variantOverrides: source.defaultsJson });
  const settings = extractStyleDefaultsFromDesign(resolved, kind);
  removeStyleDefaultOverridesFromRecord(draft, kind);
  Object.assign(draft, deepMergeDesign(draft, settings));
  const provenance = isRecord(draft.presetSources) ? draft.presetSources : {};
  draft.presetSources = {
    ...provenance,
    [kind]: {
      id: source.id,
      name: source.name,
      updatedAt: source.updatedAt,
      settings: structuredClone(settings),
    },
  };
}

export function resetCopiedPreset(draft: JsonRecord, kind: FireworkStyleDefaultKind): boolean {
  const sources = isRecord(draft.presetSources) ? draft.presetSources : {};
  const source = sources[kind];
  if (!isRecord(source) || !isRecord(source.settings)) return false;
  removeStyleDefaultOverridesFromRecord(draft, kind);
  Object.assign(draft, deepMergeDesign(draft, structuredClone(source.settings)));
  return true;
}

export function presetSourceStatus(draft: JsonRecord, kind: FireworkStyleDefaultKind) {
  const sources = isRecord(draft.presetSources) ? draft.presetSources : {};
  const source = sources[kind];
  if (!isRecord(source) || typeof source.name !== 'string') return null;
  const result = validateFireworkDesign({ variantOverrides: draft });
  if (!result.ok) return { name: source.name, modified: true };
  const current = extractStyleDefaultsFromDesign(result.design, kind);
  return {
    name: source.name,
    modified: JSON.stringify(current) !== JSON.stringify(source.settings),
  };
}
