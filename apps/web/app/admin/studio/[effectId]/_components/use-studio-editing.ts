/** Authored history and non-persistent layer selection share one editor lifetime. */
'use client';
import { useEffect, useReducer, useState } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { createHistory, studioReducer } from '@/lib/studio/document';
import { layerAddress, studioSelection } from '@/lib/studio/layers';
function toggleSet(current: ReadonlySet<string>, id: string, enabled: boolean): Set<string> {
  const next = new Set(current);
  if (enabled) next.add(id);
  else next.delete(id);
  return next;
}
/** Owns undo history, layer selection and preview-only visibility without mutating stored designs. */
export function useStudioEditing(initialDocument: Design) {
  const [history, dispatch] = useReducer(studioReducer, initialDocument, createHistory);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const firstLayer = initialDocument.breaks.at(0)?.layers.at(0);
  const [requestedSelection, setSelected] = useState(
    firstLayer ? layerAddress(0, firstLayer.id) : 'ground',
  );
  const [listenerDistanceM, setListenerDistanceM] = useState<number | null>(null);
  const [hidden, setHidden] = useState(new Set<string>());
  const [collapsed, setCollapsed] = useState(new Set<string>());
  return {
    history,
    dispatch,
    hydrated,
    selected: studioSelection(history.document, requestedSelection),
    setSelected,
    listenerDistanceM,
    setListenerDistanceM,
    hidden,
    collapsed,
    resetVisibility: () => {
      setHidden(new Set());
    },
    changeVisibility: (id: string, visible: boolean) => {
      setHidden((current) => toggleSet(current, id, !visible));
    },
    changeExpanded: (id: string, expanded: boolean) => {
      setCollapsed((current) => toggleSet(current, id, !expanded));
    },
  };
}
