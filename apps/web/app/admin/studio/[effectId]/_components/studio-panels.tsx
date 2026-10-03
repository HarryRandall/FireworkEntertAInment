/** The authored panels and live stage occupy the shared Studio layout. */
import { useRef } from 'react';
import type { Design } from '@showcrafter/fireworks';
import type { SavedPart } from '@/lib/studio/library';
import { Button } from '@/ui/primitives/button';
import { StudioSidebar } from './studio-sidebar';
import { StudioBudget } from './studio-checks';
import { StudioVariations } from './studio-variations';
import type { useStudioChecks } from './use-studio-checks';
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
  mode,
  checks,
}: {
  editing: ReturnType<typeof useStudioEditing>;
  preview: Design;
  published: { document: Design; number: number } | null;
  editable: boolean;
  libraryParts: SavedPart[];
  previewing: boolean;
  mode: string;
  checks: ReturnType<typeof useStudioChecks>;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  function showPanel(selector: string) {
    const container = sheet.current;
    const panel = container?.querySelector<HTMLElement>(selector);
    const navigation = container?.querySelector<HTMLElement>('.sc-studio-panel-navigation');
    if (container && panel && navigation)
      container.scrollTo({ top: panel.offsetTop - navigation.offsetHeight });
  }
  return (
    <div
      className="sc-studio sc-studio-panels"
      data-studio
      data-hydrated={editing.hydrated}
      data-design-seed={editing.history.document.seed}
    >
      <div className="sc-studio-centre">
        <StudioStage
          mode={mode}
          published={published}
          document={preview}
          hidden={!previewing && editing.hidden.has('ground')}
          listenerDistanceM={editing.listenerDistanceM}
        />
        <StudioVariations
          document={editing.history.document}
          editable={editable}
          dispatch={editing.dispatch}
        />
      </div>
      <div className="sc-studio-panel-sheet" ref={sheet}>
        <nav aria-label="Editor panels" className="sc-studio-panel-navigation">
          <Button
            variant="ghost"
            onClick={() => {
              showPanel('.sc-studio-layers');
            }}
          >
            Layers and Library
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              showPanel('.sc-studio-inspector');
            }}
          >
            Inspector
          </Button>
        </nav>
        <StudioSidebar
          footer={<StudioBudget document={editing.history.document} result={checks} />}
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
        <StudioInspector
          document={editing.history.document}
          selected={editing.selected}
          editable={editable}
          listenerDistanceM={editing.listenerDistanceM}
          onListenerDistanceChange={editing.setListenerDistanceM}
          dispatch={editing.dispatch}
        />
      </div>
    </div>
  );
}
