/** Preview edits are resolved copies and never dispatch into authored history. */
import { layerSchema, type Design, type Layer } from '@showcrafter/fireworks/schema';
import { editDesign, inspectorLayer, toggleModifier } from '@/lib/studio/inspector';
import { applyLibrary } from '@/lib/studio/library';
import { layerAddress } from '@/lib/studio/layers';
import type { Modifier } from '@showcrafter/fireworks/schema';

/** Swaps a library look into the current firework's selected layer without changing its siblings. */
export function libraryChipPreview(
  document: Design,
  layer: Layer | null,
  category: 'tails' | 'trails',
  option: string,
): Design | null {
  const index = layer ? document.breaks.findIndex((burst) => burst.layers.includes(layer)) : 0;
  const address = layer ? layerAddress(index, layer.id) : 'launch';
  const result = applyLibrary(document, address, { id: option, name: option, category, option });
  return result.kind === 'edited' ? result.document : null;
}
/** Swaps a shape or modifier into an independent copy, preserving every other selected-layer field. */
export function layerChipPreview(
  document: Design,
  layer: Layer,
  option: { shape: string } | { modifier: Modifier['kind'] },
): Design | null {
  const index = document.breaks.findIndex((burst) => burst.layers.includes(layer));
  const result = editDesign(document, (draft) => {
    const target = inspectorLayer(draft, { breakIndex: index, layerId: layer.id });
    if (!target) return;
    if ('modifier' in option) toggleModifier(target, option.modifier);
    else {
      const shape = layerSchema.shape.pattern.safeParse(option.shape);
      if (shape.success) target.pattern = shape.data;
    }
  });
  return result.kind === 'edited' ? result.document : null;
}
