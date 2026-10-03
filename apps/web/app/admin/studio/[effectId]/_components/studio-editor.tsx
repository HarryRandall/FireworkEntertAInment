/** Studio composes the existing editor frame around document history, layers and live preview. */
'use client';
import { useMemo, useState } from 'react';
import type { Design } from '@showcrafter/fireworks';
import type { ShellIdentity } from '@/ui/shell/config/types';
import { StudioFrame } from './studio-frame';
import type { loadStudioHistory } from '@/lib/studio/history-load';
import { useStudioLifecycle } from './use-studio-lifecycle';
import { StudioHeaderActions } from './studio-header-actions';
import { StudioPanels } from './studio-panels';
import type { SavedPart } from '@/lib/studio/library';
import { useStudioChecks } from './use-studio-checks';
import { StageModes } from './studio-stage';
import { useHistoryShortcuts } from './use-history-shortcuts';
import { useVersionHistory } from './use-version-history';
import { useStudioEditing } from './use-studio-editing';
import { previewDocument } from '@/lib/studio/layers';
import { StudioToolbar } from './studio-toolbar';
import { useDraftSave } from './use-draft-save';
import './studio.css';

interface StudioEditorProps {
  published: { id: string; document: Design; number: number } | null;
  effectId: string;
  versionNumber: number;
  historyData: Awaited<ReturnType<typeof loadStudioHistory>>;
  title: string;
  initialDocument: Design;
  versionId: string | null;
  sourceVersionId: string;
  editable: boolean;
  identity: ShellIdentity;
  libraryParts: SavedPart[];
}

/** Opens a validated v1 document; preview visibility and selection stay outside authored history. */
export function StudioEditor({
  effectId,
  versionNumber,
  historyData,
  published,
  title,
  initialDocument,
  versionId,
  sourceVersionId,
  editable,
  identity,
  libraryParts,
}: StudioEditorProps) {
  const [mode, setMode] = useState('design');
  const editing = useStudioEditing(initialDocument);
  const checks = useStudioChecks(editing.history.document);
  const { history, dispatch, hidden } = editing;
  const { status, save, settle } = useDraftSave({
    document: history.document,
    gesture: history.gesture,
    effectId,
    versionId,
    sourceVersionId,
    editable,
  });
  const draftVersionNumber = versionId === null ? versionNumber + 1 : versionNumber;
  const lifecycle = useStudioLifecycle({
    effectId,
    title,
    document: history.document,
    sourceVersionId,
    versionNumber: draftVersionNumber,
    settle,
    published,
  });
  const versions = useVersionHistory(effectId, historyData, settle);
  const historyBusy = [lifecycle.busy, versions.busy].some((pending) => pending);
  const canEdit = editable && !historyBusy && lifecycle.preview === null;
  useHistoryShortcuts(canEdit, dispatch);
  const preview = useMemo(
    () => lifecycle.preview?.document ?? previewDocument(history.document, hidden),
    [history.document, hidden, lifecycle.preview],
  );
  return (
    <StudioFrame
      title={title}
      identity={identity}
      onHistory={versions.show}
      historyBusy={historyBusy}
      save={save}
      saving={status.label === 'Saving...'}
      saveDisabled={!canEdit || history.gesture !== null}
      onResetVisibility={editing.resetVisibility}
      posterRetry={
        historyData.missingPosters
          ? { onSelect: lifecycle.retry, disabled: !editable || historyBusy }
          : null
      }
      header={{
        status: <StudioToolbar editable={canEdit} status={status} history={history} />,
        centre: <StageModes mode={mode} onChange={setMode} />,
        controls: (
          <StudioHeaderActions
            history={{ editable: canEdit, history, dispatch }}
            checks={{ document: history.document, title, result: checks }}
            historyBusy={historyBusy}
            lifecycle={{
              state: lifecycle,
              document: history.document,
              published: published?.document ?? null,
              title,
              number: draftVersionNumber,
              editable,
              versions,
              usage: historyData.usage,
              currentId: versions.currentId ?? sourceVersionId,
            }}
          />
        ),
      }}
    >
      <StudioPanels
        mode={mode}
        checks={checks}
        editing={editing}
        preview={preview}
        published={published}
        editable={canEdit}
        libraryParts={libraryParts}
        previewing={lifecycle.preview !== null}
      />
    </StudioFrame>
  );
}
