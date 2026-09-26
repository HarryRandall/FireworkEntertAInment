'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { DraftHistory } from './draft-history.ts';

export type DraftHistoryControls = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  begin: (label?: string) => void;
  commit: () => void;
  cancel: () => void;
};

/** Adapts controlled editor snapshots without taking ownership of persistence. */
export function useDraftHistory<T>({
  recordKey,
  value,
  signature,
  restore,
}: {
  recordKey: string;
  value: T;
  signature: string;
  restore: (value: T) => void;
}): DraftHistoryControls {
  const state = useRef({ recordKey, history: new DraftHistory(value, signature) });
  const [, refresh] = useState(0);
  useLayoutEffect(() => {
    if (state.current.recordKey !== recordKey) {
      state.current = { recordKey, history: new DraftHistory(value, signature) };
      refresh((n) => n + 1);
    } else if (state.current.history.observe(value, signature)) refresh((n) => n + 1);
  }, [recordKey, value, signature]);

  function apply(next: T | null) {
    if (next !== null) restore(next);
    refresh((n) => n + 1);
  }

  return {
    canUndo: state.current.history.canUndo,
    canRedo: state.current.history.canRedo,
    undo: () => apply(state.current.history.undo()),
    redo: () => apply(state.current.history.redo()),
    begin: (label) => state.current.history.begin(label),
    commit: () => {
      state.current.history.commit();
      refresh((n) => n + 1);
    },
    cancel: () => apply(state.current.history.cancel()),
  };
}
