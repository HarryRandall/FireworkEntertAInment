/** Stored quick-adjustment registry and pure design-resolution implementation. */
import type { Design } from './design.generated';

/** Stored integer strength from maximum reduction (-3) to maximum increase (3). */
export type AdjustmentLevel = -3 | -2 | -1 | 0 | 1 | 2 | 3;

import { adjustLayer } from './adjustment-layer';
import { adjustLaunch, adjustBreaks } from './adjustment-launch';
import { adjustGround } from './adjustment-ground';
import { ADJUSTMENT_REGISTRY } from './adjustment-registry';
export { ADJUSTMENT_REGISTRY, type AdjustmentDefinition } from './adjustment-registry';

type AdjustmentKey = keyof typeof ADJUSTMENT_REGISTRY;
const layerKey = /^layer\.([A-Za-z0-9][A-Za-z0-9_-]*)\.(.+)$/;

/** Looks up the documented definition for a stored adjustment key. */
export function adjustmentDefinition(
  key: string,
): (typeof ADJUSTMENT_REGISTRY)[AdjustmentKey] | undefined {
  if (key in ADJUSTMENT_REGISTRY) return ADJUSTMENT_REGISTRY[key as AdjustmentKey];
  const match = key.match(layerKey);
  if (!match) return undefined;
  const template = `layer.{id}.${match[2] ?? ''}` as AdjustmentKey;
  return ADJUSTMENT_REGISTRY[template];
}

/** Applies stored levels to a cloned design and returns resolved renderer inputs. */
export function resolveDesign(design: Design): Design {
  const resolved = JSON.parse(JSON.stringify(design)) as Design;
  const adjustments = resolved.adjustments as Record<string, AdjustmentLevel> | undefined;
  if (!adjustments || Object.keys(adjustments).length === 0) return resolved;
  for (const [key, level] of Object.entries(adjustments)) {
    if (!adjustmentDefinition(key)) throw new RangeError(`Unknown adjustment key: ${key}`);
    if (level === 0) continue;
    const layer = key.match(layerKey);
    if (layer) {
      resolveLayerAdjustment(resolved, layer, level);
      continue;
    }
    adjustLaunch(resolved, key, level);
    adjustBreaks(resolved, key, level);
    adjustGround(resolved, key, level);
  }
  delete resolved.adjustments;
  return resolved;
}

function resolveLayerAdjustment(resolved: Design, layer: RegExpMatchArray, level: number): void {
  const layerId = layer[1];
  const field = layer[2];
  if (layerId === undefined || field === undefined)
    throw new RangeError(`Unknown adjustment key: ${layer[0]}`);
  let found = false;
  for (const break_ of resolved.breaks)
    for (const candidate of break_.layers)
      if (candidate.id === layerId) {
        adjustLayer(candidate, field, level);
        found = true;
      }
  if (!found) throw new RangeError(`Adjustment layer does not exist: ${layerId}`);
}
