/** Editor status and document history controls are independent of preview selection. */
import type { Dispatch } from 'react';
import { Badge } from '@/ui/kit/feedback';
import { Button } from '@/ui/primitives/button';
import type { SaveStatus } from '@/lib/studio/autosave';
import type { StudioHistory, StudioEdit } from '@/lib/studio/document';

/** Shows persistence failures honestly and offers undo/redo for committed snapshots. */
export function StudioToolbar({
  title,
  editable,
  status,
  history,
  dispatch,
}: {
  title: string;
  editable: boolean;
  status: SaveStatus;
  history: StudioHistory;
  dispatch: Dispatch<StudioEdit>;
}) {
  const undoAvailable = history.undo.length > 0 || history.gesture !== null;
  return (
    <header className="sc-studio-toolbar">
      <h1 className="min-w-0 text-lg font-semibold break-words">{title}</h1>
      <Badge>{editable ? 'Draft' : 'Read only'}</Badge>
      <span role="status" className="border-border bg-card rounded-full border px-3 py-1 text-xs">
        {status.label}
      </span>
      <div className="ml-auto flex gap-2">
        <Button
          variant="outline"
          disabled={!undoAvailable}
          onClick={() => {
            dispatch({ type: 'commit' });
            dispatch({ type: 'undo' });
          }}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          disabled={history.redo.length === 0 || history.gesture !== null}
          onClick={() => {
            dispatch({ type: 'redo' });
          }}
        >
          Redo
        </Button>
      </div>
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
    </header>
  );
}
