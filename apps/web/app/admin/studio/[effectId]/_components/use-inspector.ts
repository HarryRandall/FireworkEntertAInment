/** Scoped validated edits connect inspector controls to the single document history. */
'use client';
import { useState, type Dispatch } from 'react';
import { resolveDesign, type Design } from '@showcrafter/fireworks';
import { selectedLayer } from '@/lib/studio/layers';
import { editDesign, inspectorLayer, setAdjustment } from '@/lib/studio/inspector';
import type { StudioEdit } from '@/lib/studio/document';
import type { InspectorContext, LayerContext } from './inspector-controls';

/** Resolves inherited values and reports rejected edits without replacing the last valid draft. */
export function useInspector(
  document: Design,
  selected: string,
  editable: boolean,
  dispatch: Dispatch<StudioEdit>,
) {
  const [failure, setFailure] = useState('');
  const effective = resolveDesign(document);
  const selection = selectedLayer(effective, selected) ?? firstSelection(effective);
  const layer = selection ? inspectorLayer(effective, selection) : undefined;
  const context: InspectorContext = {
    document: effective,
    disabled: !editable,
    levels: document.adjustments ?? {},
    adjust: (key, level) => {
      if (!editable) return;
      const result = setAdjustment(document, key, level);
      if (result.kind === 'invalid') {
        setFailure(result.message);
        return;
      }
      setFailure('');
      dispatch({ type: 'replace', document: result.document });
    },
    edit: (change) => {
      if (!editable) return;
      const result = editDesign(document, change);
      if (result.kind === 'invalid') {
        setFailure(result.message);
        return;
      }
      setFailure('');
      dispatch({ type: 'replace', document: result.document });
    },
  };
  const layerContext: LayerContext | null =
    layer && selection
      ? {
          ...context,
          layer,
          changeLayer: (change) => {
            context.edit((draft) => {
              const target = inspectorLayer(draft, selection);
              if (target) change(target);
            });
          },
        }
      : null;
  return { failure, effective, selection, context, layerContext };
}
function firstSelection(document: Design) {
  const layer = document.breaks.at(0)?.layers.at(0);
  return layer ? { breakIndex: 0, layerId: layer.id } : null;
}
