/** Keyboard commands share the toolbar's reducer, outside native text editing. */
'use client';
import { useEffect, type Dispatch } from 'react';
import { historyShortcut } from '@/lib/studio/shortcuts';
import type { StudioEdit } from '@/lib/studio/document';

/** Installs undo/redo keys for the editable Studio and removes them on unmount. */
export function useHistoryShortcuts(editable: boolean, dispatch: Dispatch<StudioEdit>): void {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      const textEditing =
        target instanceof Element &&
        target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
        ) !== null;
      const action = historyShortcut(event, textEditing);
      if (!editable || action === null || event.defaultPrevented) return;
      event.preventDefault();
      dispatch({ type: 'commit' });
      dispatch({ type: action });
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('keydown', keydown);
    };
  }, [editable, dispatch]);
}
