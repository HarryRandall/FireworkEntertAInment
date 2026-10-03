/** Studio composes the existing editor frame around document history, layers and live preview. */
'use client';
import { useMemo, useReducer, useState } from 'react';
import type { Design } from '@showcrafter/fireworks';
import type { ShellIdentity } from '@/ui/shell/config/types';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';
import { LayerList } from '@/ui/kit/layer-list';
import { createHistory, studioReducer } from '@/lib/studio/document';
import { previewDocument, studioLayers, layerAddress, studioSelection } from '@/lib/studio/layers';
import { StudioToolbar } from './studio-toolbar';
import { StudioStage } from './studio-stage';
import { StudioInspector } from './studio-inspector';
import { useDraftSave } from './use-draft-save';
import './studio.css';

/** Opens a validated v1 document; preview visibility and selection stay outside authored history. */
export function StudioEditor({
  effectId,
  title,
  initialDocument,
  versionId,
  sourceVersionId,
  editable,
  identity,
}: {
  effectId: string;
  title: string;
  initialDocument: Design;
  versionId: string | null;
  sourceVersionId: string;
  editable: boolean;
  identity: ShellIdentity;
}) {
  const [history, dispatch] = useReducer(studioReducer, initialDocument, createHistory);
  const firstLayer = initialDocument.breaks.at(0)?.layers.at(0);
  const [requestedSelection, setSelected] = useState(
    firstLayer ? layerAddress(0, firstLayer.id) : 'ground',
  );
  const selected = studioSelection(history.document, requestedSelection);
  const [listenerDistanceM, setListenerDistanceM] = useState<number | null>(null);
  const [hidden, setHidden] = useState(new Set<string>());
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const { status, save } = useDraftSave({
    document: history.document,
    gesture: history.gesture,
    effectId,
    versionId,
    sourceVersionId,
    editable,
  });
  const preview = useMemo(
    () => previewDocument(history.document, hidden),
    [history.document, hidden],
  );
  return (
    <WorkspaceShell
      area="admin"
      identity={identity}
      editorFrame={{
        title,
        onSave: save,
        saving: !editable || status.label === 'Saving...' || history.gesture !== null,
        actions: [
          {
            label: 'Reset preview visibility',
            onSelect: () => {
              setHidden(new Set());
            },
          },
        ],
      }}
    >
      <div className="sc-studio" data-studio>
        <StudioToolbar
          title={title}
          editable={editable}
          status={status}
          history={history}
          dispatch={dispatch}
        />
        <div className="sc-studio-panels">
          <section aria-label="Layers" className="sc-studio-layers bg-card">
            <h2 className="mb-3 font-semibold">Layers</h2>
            <LayerList
              items={studioLayers(history.document, collapsed, hidden)}
              selected={selected}
              onSelect={setSelected}
              onVisibilityChange={(id, visible) => {
                setHidden((current) => toggleSet(current, id, !visible));
              }}
              onExpandedChange={(id, expanded) => {
                setCollapsed((current) => toggleSet(current, id, !expanded));
              }}
            />
            <p className="text-muted-foreground mt-4 text-xs">
              Visibility affects the preview only.
            </p>
          </section>
          <StudioStage
            document={preview}
            hidden={hidden.has('ground')}
            listenerDistanceM={listenerDistanceM}
          />
          <StudioInspector
            document={history.document}
            selected={selected}
            editable={editable}
            listenerDistanceM={listenerDistanceM}
            onListenerDistanceChange={setListenerDistanceM}
            dispatch={dispatch}
          />
        </div>
      </div>
    </WorkspaceShell>
  );
}
function toggleSet(current: ReadonlySet<string>, id: string, enabled: boolean): Set<string> {
  const next = new Set(current);
  if (enabled) next.add(id);
  else next.delete(id);
  return next;
}
