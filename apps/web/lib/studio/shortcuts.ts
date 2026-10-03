/** Document shortcuts leave native text editing, composition and unrelated commands alone. */
/** Classifies a command key in the browser without intercepting editable controls. */
export function historyShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'isComposing'>,
  editableTarget: boolean,
): 'undo' | 'redo' | null {
  if (editableTarget || event.isComposing || event.altKey || !hasCommand(event)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey && !event.shiftKey) return 'redo';
  return null;
}

function hasCommand(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey'>): boolean {
  return event.metaKey || event.ctrlKey;
}
