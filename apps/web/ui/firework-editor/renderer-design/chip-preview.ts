/** Preview edits are resolved copies and never dispatch into authored history. */
import { layerSchema, type Design, type Layer } from '@showcrafter/renderer/schema';
import { editDesign, inspectorLayer, toggleModifier } from '@/lib/renderer-editor/inspector';
import { launchSchema } from '@showcrafter/renderer/schema';
import { trailLooks } from '@/lib/renderer-editor/trail-looks';
import type { Modifier } from '@showcrafter/renderer/schema';

/** Swaps a library look into the current firework's selected layer without changing its siblings. */
export function libraryChipPreview(
  document: Design,
  layer: Layer | null,
  category: 'tails' | 'trails',
  option: string,
): Design | null {
  const index = layer
    ? document.breaks.findIndex((burst) =>
        burst.layers.some((candidate) => candidate.id === layer.id),
      )
    : 0;
  if (index < 0) return null;
  const result = editDesign(document, (draft) => {
    if (category === 'tails' && draft.launch) {
      const tail = launchSchema.shape.tail.safeParse(option);
      if (tail.success) draft.launch.tail = tail.data;
    } else if (layer) {
      const target = inspectorLayer(draft, { breakIndex: index, layerId: layer.id });
      const look = trailLooks.find((item) => item.key === option);
      if (target && look) target.trail = structuredClone(look.trail);
    }
  });
  return result.kind === 'edited' ? result.document : null;
}
/** Swaps a shape or modifier into an independent copy, preserving every other selected-layer field. */
export function layerChipPreview(
  document: Design,
  layer: Layer,
  option: { shape: string } | { modifier: Modifier['kind'] },
): Design | null {
  const index = document.breaks.findIndex((burst) =>
    burst.layers.some((candidate) => candidate.id === layer.id),
  );
  if (index < 0) return null;
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
