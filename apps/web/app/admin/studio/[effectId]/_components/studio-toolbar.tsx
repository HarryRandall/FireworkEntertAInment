/** Editor status and document history controls are independent of preview selection. */
import { Undo2, Redo2 } from 'lucide-react';
import type { Dispatch } from 'react';
import { Badge } from '@/ui/kit/feedback';
import { Button } from '@/ui/primitives/button';
import type { SaveStatus } from '@/lib/studio/autosave';
import type { StudioHistory, StudioEdit } from '@/lib/studio/document';

/** Shows draft status, browser change count and persistence failures in the shared header. */
export function StudioToolbar({
  editable,
  status,
  history,
}: {
  editable: boolean;
  status: SaveStatus;
  history: StudioHistory;
}) {
  return (
    <div className="sc-studio-toolbar">
      <Badge>{editable ? 'Draft' : 'Read only'}</Badge>
      <span role="status" className="border-border bg-card rounded-full border px-3 py-1 text-xs">
        {status.label}
      </span>
      <span className="sc-studio-change-count text-muted-foreground text-xs">
        {history.undo.length} changes
      </span>
      {status.message !== '' && (
        <p role="alert" className="w-full text-sm">
          {status.message} Use Save to retry.
        </p>
      )}
      {!editable && (
        <p className="text-muted-foreground w-full text-sm">
          Only catalogue editors can change active fireworks.
        </p>
      )}
    </div>
  );
}

/** Keeps keyboard history commands available beside the editor's lifecycle actions. */
export function StudioHistoryControls({
  editable,
  history,
  dispatch,
}: {
  editable: boolean;
  history: StudioHistory;
  dispatch: Dispatch<StudioEdit>;
}) {
  const undoAvailable = history.undo.length > 0 || history.gesture !== null;
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!editable || !undoAvailable}
        aria-label="Undo"
        title="Undo (Ctrl+Z or Command+Z)"
        aria-keyshortcuts="Control+Z Meta+Z"
        onClick={() => {
          dispatch({ type: 'commit' });
          dispatch({ type: 'undo' });
        }}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!editable || history.redo.length === 0 || history.gesture !== null}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z, Command+Shift+Z or Ctrl+Y)"
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        onClick={() => {
          dispatch({ type: 'redo' });
        }}
      >
        <Redo2 />
      </Button>
    </div>
  );
}
