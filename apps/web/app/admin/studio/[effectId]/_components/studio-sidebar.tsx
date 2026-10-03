/** Layers and Library share the existing editor side panel. */
'use client';
import { useState, type Dispatch, type ReactNode } from 'react';
import { Tabs } from 'radix-ui';
import type { Design } from '@showcrafter/fireworks';
import type { SavedPart } from '@/lib/studio/library';
import type { StudioEdit } from '@/lib/studio/document';
import { studioLayers } from '@/lib/studio/layers';
import { LayerList } from '@/ui/kit/layer-list';
import { StudioLibrary } from './studio-library';

/** Keeps preview-only layer visibility separate from the authored Library edits. */
export function StudioSidebar({
  footer,
  document,
  selected,
  editable,
  initialParts,
  dispatch,
  hidden,
  collapsed,
  onSelect,
  onVisibilityChange,
  onExpandedChange,
}: {
  footer: ReactNode;
  document: Design;
  selected: string;
  editable: boolean;
  initialParts: SavedPart[];
  dispatch: Dispatch<StudioEdit>;
  hidden: ReadonlySet<string>;
  collapsed: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onVisibilityChange: (id: string, visible: boolean) => void;
  onExpandedChange: (id: string, expanded: boolean) => void;
}) {
  const [parts, setParts] = useState(initialParts);
  return (
    <div className="sc-studio-layers bg-card">
      <Tabs.Root defaultValue="layers" className="sc-studio-sidebar-tabs">
        <Tabs.List aria-label="Studio sidebar" className="mb-3 flex gap-3 border-b">
          <Tabs.Trigger
            value="layers"
            className="data-[state=active]:border-foreground border-b-2 border-transparent p-2"
          >
            Layers
          </Tabs.Trigger>
          <Tabs.Trigger
            value="library"
            className="data-[state=active]:border-foreground border-b-2 border-transparent p-2"
          >
            Library
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="layers">
          <section aria-label="Layers">
            <h2 className="mb-3 font-semibold">Layers</h2>
            <LayerList
              items={studioLayers(document, collapsed, hidden)}
              selected={selected}
              onSelect={onSelect}
              onVisibilityChange={onVisibilityChange}
              onExpandedChange={onExpandedChange}
            />
            <p className="text-muted-foreground mt-4 text-xs">
              Visibility affects the preview only.
            </p>
          </section>
        </Tabs.Content>
        <Tabs.Content value="library">
          <StudioLibrary
            document={document}
            selected={selected}
            editable={editable}
            parts={parts}
            onSaved={(part) => {
              setParts((current) => [part, ...current]);
            }}
            dispatch={dispatch}
          />
        </Tabs.Content>
      </Tabs.Root>
      {footer}
    </div>
  );
}
