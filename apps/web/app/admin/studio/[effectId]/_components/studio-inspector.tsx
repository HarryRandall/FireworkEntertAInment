/** Chronological inspector tabs reserve coherent sections around the selected source. */
'use client';
import type { Design } from '@showcrafter/fireworks';
import { Tabs } from '@/ui/kit/overlays';
import { selectedLayer, isGroundEffect } from '@/lib/studio/layers';
import { renameLayer, type StudioEdit } from '@/lib/studio/document';
import type { Dispatch } from 'react';

const MAX_LAYER_NAME_LENGTH = 120; // Characters, the renderer schema's layer-name limit.
const AIRBORNE_SECTIONS = ['Launch', 'Burst', 'Stars', 'Trail', 'Effect'];
/** Shows source naming and chronological section placeholders; ground designs have one panel. */
export function StudioInspector({
  document,
  selected,
  editable,
  dispatch,
}: {
  document: Design;
  selected: string;
  editable: boolean;
  dispatch: Dispatch<StudioEdit>;
}) {
  const selection = selectedLayer(document, selected);
  const layer = selection
    ? document.breaks[selection.breakIndex]?.layers.find((item) => item.id === selection.layerId)
    : null;
  const sections = isGroundEffect(document) ? ['Ground'] : AIRBORNE_SECTIONS;
  let description = 'Select a star group to name it.';
  if (selected === 'launch') description = 'From the tube to the break';
  if (isGroundEffect(document)) description = 'Ground effect';
  return (
    <section aria-label="Inspector" className="sc-studio-inspector bg-card">
      <h2 className="mb-3 font-semibold">Inspector</h2>
      {layer && selection ? (
        <label className="mb-4 grid gap-2 text-sm">
          Star group name
          <input
            key={selected}
            className="border-input bg-background w-full min-w-0 rounded-md border px-3 py-2"
            aria-label="Star group name"
            disabled={!editable}
            maxLength={MAX_LAYER_NAME_LENGTH}
            value={layer.name}
            onFocus={() => {
              dispatch({ type: 'begin' });
            }}
            onChange={(event) => {
              dispatch({
                type: 'replace',
                document: renameLayer(
                  document,
                  selection.breakIndex,
                  selection.layerId,
                  event.target.value,
                ),
              });
            }}
            onBlur={() => {
              dispatch({ type: 'commit' });
            }}
          />
          <span className="text-muted-foreground">
            Star group in Break {selection.breakIndex + 1}
          </span>
        </label>
      ) : (
        <p className="text-muted-foreground mb-4 text-sm">{description}</p>
      )}
      <Tabs
        key={isGroundEffect(document) ? 'ground' : 'airborne'}
        defaultValue={sections[0] ?? 'Stars'}
        items={sections.map((label) => ({
          value: label,
          label,
          content: (
            <div className="grid gap-2">
              <h3 className="font-medium">{label} settings</h3>
              <p className="text-muted-foreground">
                Detailed controls are not available in this editor.
              </p>
            </div>
          ),
        }))}
      />
    </section>
  );
}
