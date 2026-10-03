/** Chronological inspector controls edit one validated v1 document through the shared reducer. */
'use client';
import { MoreHorizontal } from 'lucide-react';
import { ActionMenu } from '@/ui/kit/overlays';
import { Button } from '@/ui/primitives/button';
import { gradientCss } from '@/ui/kit/editor-maths';
import { useState, type Dispatch } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { Tabs } from 'radix-ui';
import { Input } from '@/ui/primitives/input';
import { isGroundEffect } from '@/lib/studio/layers';
import { useInspector } from './use-inspector';
import type { StudioEdit } from '@/lib/studio/document';
import { InspectorGestures, type InspectorContext, type LayerContext } from './inspector-controls';
import { LaunchInspector } from './launch-inspector';
import { BurstInspector } from './burst-inspector';
import { StarsInspector } from './stars-inspector';
import { TrailInspector } from './trail-inspector';
import { EffectInspector } from './effect-inspector';
import { GroundInspector } from './ground-inspector';
import { SoundInspector } from './sound-inspector';

const MAX_LAYER_NAME_LENGTH = 120; // Characters, the v1 layer-name bound.
/** Shows every authored inspector section, with source selection and gesture-aware history. */
export function StudioInspector({
  document,
  selected,
  editable,
  dispatch,
  listenerDistanceM,
  onListenerDistanceChange,
}: {
  document: Design;
  selected: string;
  editable: boolean;
  dispatch: Dispatch<StudioEdit>;
  listenerDistanceM: number | null;
  onListenerDistanceChange: (distanceM: number) => void;
}) {
  const { failure, effective, selection, context, layerContext } = useInspector(
    document,
    selected,
    editable,
    dispatch,
  );
  const [section, setSection] = useState({ selection: '', value: '' });
  const selectionKey = `${selected}:${effective.kind}`;
  const items = inspectorItems(context, layerContext);
  const defaultValue = defaultSection(effective, selected);
  return (
    <section aria-label="Inspector" className="sc-studio-inspector bg-card">
      <h2 className="sr-only">Inspector</h2>
      <InspectorGestures dispatch={dispatch}>
        <InspectorHeader
          layerContext={layerContext}
          selected={selected}
          kind={effective.kind}
          breakIndex={selection?.breakIndex ?? 0}
          editable={editable}
          actions={items.map((item) => ({
            label: `${item.label} settings`,
            onSelect: () => {
              setSection({ selection: selectionKey, value: item.value });
            },
          }))}
        />
        <div className="sc-studio-inspector-body">
          {selected === 'launch' && (
            <p className="text-muted-foreground mb-4 text-sm">From the tube to the break</p>
          )}
          <Tabs.Root
            value={section.selection === selectionKey ? section.value : defaultValue}
            onValueChange={(value) => {
              setSection({ selection: selectionKey, value });
            }}
          >
            <Tabs.List aria-label="Sections" className="sc-studio-inspector-tabs">
              {items.map((item) => (
                <Tabs.Trigger key={item.value} value={item.value} data-section={item.value}>
                  {item.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {items.map((item) => (
              <Tabs.Content
                key={item.value}
                value={item.value}
                className="sc-studio-inspector-content"
              >
                <h3 className="sr-only">{item.label} settings</h3>
                {item.content}
              </Tabs.Content>
            ))}
          </Tabs.Root>
          <SoundInspector
            {...context}
            listenerDistanceM={listenerDistanceM}
            onListenerDistanceChange={onListenerDistanceChange}
          />
        </div>
      </InspectorGestures>
      {failure !== '' && (
        <p role="alert" className="text-destructive text-sm">
          {failure}
        </p>
      )}
    </section>
  );
}
function defaultSection(document: Design, selected: string): string {
  if (isGroundEffect(document)) return 'Ground';
  if (selected === 'launch') return 'Launch';
  if (selected.startsWith('break:') || selected.startsWith('core:')) return 'Burst';
  return 'Stars';
}
function inspectorItems(context: InspectorContext, layer: LayerContext | null) {
  if (isGroundEffect(context.document))
    return [{ value: 'Ground', label: 'Ground', content: <GroundInspector {...context} /> }];
  const noLayer = <p className="text-muted-foreground">This firework has no burst star groups.</p>;
  return [
    { value: 'Launch', label: 'Launch', content: <LaunchInspector {...context} /> },
    { value: 'Burst', label: 'Burst', content: <BurstInspector {...context} /> },
    {
      value: 'Stars',
      label: 'Stars',
      content: layer ? <StarsInspector {...layer} /> : <GroundInspector {...context} />,
    },
    { value: 'Trail', label: 'Trail', content: layer ? <TrailInspector {...layer} /> : noLayer },
    { value: 'Effect', label: 'Effect', content: layer ? <EffectInspector {...layer} /> : noLayer },
  ];
}

function InspectorHeader({
  layerContext,
  selected,
  kind,
  breakIndex,
  editable,
  actions,
}: {
  layerContext: LayerContext | null;
  selected: string;
  kind: string;
  breakIndex: number;
  editable: boolean;
  actions: Parameters<typeof ActionMenu>[0]['actions'];
}) {
  return (
    <header className="sc-studio-inspector-header">
      <span
        aria-hidden="true"
        className="sc-studio-layer-swatch"
        style={layerContext ? { background: gradientCss(layerContext.layer.colour, 1) } : undefined}
      />
      {layerContext ? (
        <label className="min-w-0 flex-1 text-sm">
          <span className="sr-only">Star group name</span>
          <Input
            aria-label="Star group name"
            value={layerContext.layer.name}
            disabled={!editable}
            maxLength={MAX_LAYER_NAME_LENGTH}
            onChange={(event) => {
              layerContext.changeLayer((target) => {
                target.name = event.target.value;
              });
            }}
          />
          <span className="text-muted-foreground">Star group in Break {breakIndex + 1}</span>
        </label>
      ) : (
        <span className="min-w-0 flex-1 font-semibold">
          {selected === 'launch' ? 'Launch' : kind}
        </span>
      )}
      <ActionMenu
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Layer actions">
            <MoreHorizontal />
          </Button>
        }
        actions={actions}
      />
    </header>
  );
}
