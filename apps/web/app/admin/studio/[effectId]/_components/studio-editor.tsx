/** Studio composes the existing editor frame around document history, layers and live preview. */
'use client';
import { useMemo } from 'react';
import type { Design } from '@showcrafter/fireworks';
import type { ShellIdentity } from '@/ui/shell/config/types';
import { StudioFrame } from './studio-frame';
import type { loadStudioHistory } from '@/lib/studio/history-load';
import { useStudioLifecycle } from './use-studio-lifecycle';
import { StudioLifecycle } from './studio-lifecycle';
import { StudioPanels } from './studio-panels';
import type { SavedPart } from '@/lib/studio/library';
import { StudioChecks } from './studio-checks';
import { StudioVariations } from './studio-variations';
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
  const editing = useStudioEditing(initialDocument);
  const { history, dispatch, hydrated, hidden } = editing;
  const { status, save, settle } = useDraftSave({
    document: history.document,
    gesture: history.gesture,
    effectId,
    versionId,
    sourceVersionId,
    editable,
  });
  const lifecycle = useStudioLifecycle({
    effectId,
    title,
    document: history.document,
    sourceVersionId,
    versionNumber: versionId === null ? versionNumber + 1 : versionNumber,
    settle,
    published,
  });
  const publishedDocument = published === null ? null : published.document;
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
    >
      <div
        className="sc-studio"
        data-studio
        data-hydrated={hydrated}
        data-design-seed={history.document.seed}
      >
        <StudioToolbar
          title={title}
          editable={canEdit}
          status={status}
          history={history}
          dispatch={dispatch}
        />
        <StudioLifecycle
          state={lifecycle}
          document={history.document}
          published={publishedDocument}
          title={title}
          number={versionId === null ? versionNumber + 1 : versionNumber}
          editable={editable}
          missingPosters={historyData.missingPosters}
          versions={versions}
          usage={historyData.usage}
          currentId={versions.currentId ?? sourceVersionId}
        />
        <StudioPanels
          editing={editing}
          preview={preview}
          published={published}
          editable={canEdit}
          libraryParts={libraryParts}
          previewing={lifecycle.preview !== null}
        />
        <StudioChecks document={history.document} title={title} />
        <StudioVariations document={history.document} editable={canEdit} dispatch={dispatch} />
      </div>
    </StudioFrame>
  );
}
