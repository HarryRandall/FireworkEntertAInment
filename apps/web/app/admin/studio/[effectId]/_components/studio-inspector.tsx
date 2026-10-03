/** Chronological inspector controls edit one validated v1 document through the shared reducer. */
'use client';
import type { Dispatch } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { Tabs } from '@/ui/kit/overlays';
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
  const items = inspectorItems(context, layerContext);
  const defaultValue = defaultSection(effective, selected);
  return (
    <section aria-label="Inspector" className="sc-studio-inspector bg-card">
      <h2 className="mb-3 font-semibold">Inspector</h2>
      <InspectorGestures dispatch={dispatch}>
        {layerContext && (
          <label className="mb-4 grid gap-2 text-sm">
            Star group name
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
            <span className="text-muted-foreground">
              Star group in Break {(selection?.breakIndex ?? 0) + 1}
            </span>
          </label>
        )}
        {selected === 'launch' && (
          <p className="text-muted-foreground mb-4 text-sm">From the tube to the break</p>
        )}
        <Tabs
          key={`${selected}:${effective.kind}`}
          defaultValue={defaultValue}
          items={items.map((item) => ({
            ...item,
            content: (
              <div>
                <h3 className="mb-2 font-medium">{item.label} settings</h3>
                {item.content}
              </div>
            ),
          }))}
        />
        <SoundInspector
          {...context}
          listenerDistanceM={listenerDistanceM}
          onListenerDistanceChange={onListenerDistanceChange}
        />
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
