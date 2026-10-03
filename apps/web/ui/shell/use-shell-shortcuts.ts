/** Global workspace keys, ignoring text entry and removing listeners on unmount. */
'use client';
import { useEffect } from 'react';

/** Binds command search and help without intercepting typing or other modifiers. */
export function useShellShortcuts(open: (panel: 'command' | 'shortcuts') => void) {
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.closest('input, textarea, select, [role="textbox"], [role="dialog"]') !== null);
    const keydown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open('command');
      }
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        open('shortcuts');
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('keydown', keydown);
    };
  }, [open]);
}
