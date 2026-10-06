'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { DraftHistoryControls } from '@showcrafter/firework-editor/use-draft-history';
import { createHistory, editorReducer, type EditorEdit } from '@/lib/renderer-editor/document';

/** Adapts the ported reducer to all fields in main's existing editor snapshot. */
export function useDesignHistory<T>({
  recordKey,
  value,
  restore,
}: {
  recordKey: string;
  value: T;
  signature: string;
  restore: (value: T) => void;
}): DraftHistoryControls {
  const state = useRef({ key: recordKey, history: createHistory(value) });
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });
  useLayoutEffect(() => {
    if (state.current.key !== recordKey)
      state.current = { key: recordKey, history: createHistory(value) };
    else {
      const next = editorReducer(state.current.history, { type: 'replace', document: value });
      if (JSON.stringify(next) === JSON.stringify(state.current.history)) return;
      state.current.history = next;
    }
    setAvailability({
      canUndo: state.current.history.undo.length > 0,
      canRedo: state.current.history.redo.length > 0,
    });
  }, [recordKey, value]);
  function dispatch(action: EditorEdit<T>) {
    const before = state.current.history.document;
    state.current.history = editorReducer(state.current.history, action);
    if (before !== state.current.history.document) restore(state.current.history.document);
    setAvailability({
      canUndo: state.current.history.undo.length > 0,
      canRedo: state.current.history.redo.length > 0,
    });
  }
  return {
    ...availability,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    begin: () => dispatch({ type: 'begin' }),
    commit: () => dispatch({ type: 'commit' }),
    cancel: () => dispatch({ type: 'cancel' }),
  };
}
