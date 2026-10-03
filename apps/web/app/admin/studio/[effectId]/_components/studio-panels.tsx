/** The authored panels and live stage occupy the shared Studio layout. */
import type { Design } from '@showcrafter/fireworks';
import type { SavedPart } from '@/lib/studio/library';
import { StudioSidebar } from './studio-sidebar';
import { StudioStage } from './studio-stage';
import { StudioInspector } from './studio-inspector';
import type { useStudioEditing } from './use-studio-editing';

/** Binds authored controls together while allowing a separate read-only history design on the stage. */
export function StudioPanels({
  editing,
  preview,
  published,
  editable,
  libraryParts,
  previewing,
}: {
  editing: ReturnType<typeof useStudioEditing>;
  preview: Design;
  published: { document: Design; number: number } | null;
  editable: boolean;
  libraryParts: SavedPart[];
  previewing: boolean;
}) {
  return (
    <div className="sc-studio-panels">
      <StudioSidebar
        document={editing.history.document}
        selected={editing.selected}
        editable={editable}
        initialParts={libraryParts}
        dispatch={editing.dispatch}
        hidden={editing.hidden}
        collapsed={editing.collapsed}
        onSelect={editing.setSelected}
        onVisibilityChange={editing.changeVisibility}
        onExpandedChange={editing.changeExpanded}
      />
      <StudioStage
        published={published}
        document={preview}
        hidden={!previewing && editing.hidden.has('ground')}
        listenerDistanceM={editing.listenerDistanceM}
      />
      <StudioInspector
        document={editing.history.document}
        selected={editing.selected}
        editable={editable}
        listenerDistanceM={editing.listenerDistanceM}
        onListenerDistanceChange={editing.setListenerDistanceM}
        dispatch={editing.dispatch}
      />
    </div>
  );
}
