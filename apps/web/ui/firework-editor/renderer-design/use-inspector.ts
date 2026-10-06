/** Scoped validated edits connect inspector controls to the single document history. */
'use client';
import { useState, type Dispatch } from 'react';
import { resolveDesign, type Design } from '@showcrafter/renderer';
import { selectedLayer, layerAddress } from '@/lib/renderer-editor/layers';
import { editDesign, inspectorLayer, setAdjustment } from '@/lib/renderer-editor/inspector';
import type { EditorEdit } from '@/lib/renderer-editor/document';
import type { InspectorContext, LayerContext } from './inspector-controls';

/** Resolves inherited values and reports rejected edits without replacing the last valid draft. */
export function useInspector(
  document: Design,
  selected: string,
  editable: boolean,
  dispatch: Dispatch<EditorEdit>,
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
          previewAddress: layerAddress(selection.breakIndex, selection.layerId),
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
