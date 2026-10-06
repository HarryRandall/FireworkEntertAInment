/** Trail presets and emission controls apply to the selected star group only. */
'use client';
import { TRAIL_CONTROLS } from '@/lib/renderer-editor/trail-controls';
import { trailLook, trailLooks } from '@/lib/renderer-editor/trail-looks';
import { setTrailEnabled } from '@/lib/renderer-editor/inspector';
import {
  InspectorColour,
  InspectorChoices,
  InspectorSection,
  InspectorToggle,
  RelativeSlider,
  type LayerContext,
} from './inspector-controls';

import { libraryChipPreview } from './chip-preview';

const COLOURS = ['house', 'star', 'custom'] as const;
const CUSTOM_COLOUR = '#ffe2a8'; // Prototype pale gold sRGB, used when starting an explicit spark colour.
const FINE_CONTROL_START = 4; // The first four reference editor trail rows are primary adjustments.
/** Edits on/off, preset looks, colours and the renderer's trail emission and fall controls. */
export function TrailInspector(context: LayerContext) {
  const { layer, disabled, changeLayer } = context;
  const on = layer.trail.sparks > 0;
  const colourMode = COLOURS.find((mode) => mode === layer.trail.colour) ?? 'custom';
  return (
    <div>
      <InspectorSection title="Trail">
        <InspectorToggle
          label="Trail on"
          value={on}
          disabled={disabled}
          onChange={(enabled) => {
            changeLayer((target) => {
              setTrailEnabled(target, enabled);
            });
          }}
        />
        <InspectorChoices
          label="Trail look"
          previewAddress={context.previewAddress}
          preview={(key) => libraryChipPreview(context.document, layer, 'trails', key)}
          items={trailLooks.map((look) => look.key)}
          value={trailLook(layer.trail)}
          disabled={disabled || !on}
          onChange={(key) => {
            const look = trailLooks.find((item) => item.key === key);
            if (look)
              changeLayer((target) => {
                target.trail = structuredClone(look.trail);
              });
          }}
        />
        <InspectorChoices
          label="Spark colour"
          labels={{ house: 'Pale gold', star: 'Star colour', custom: 'Custom' }}
          items={COLOURS}
          value={colourMode}
          disabled={disabled || !on}
          onChange={(mode) => {
            changeLayer((target) => {
              target.trail.colour = mode === 'custom' ? CUSTOM_COLOUR : mode;
            });
          }}
        />
        {colourMode === 'custom' && (
          <InspectorColour
            label="Custom colour"
            name="Custom spark colour"
            value={layer.trail.colour}
            disabled={disabled || !on}
            onChange={(colour) => {
              changeLayer((target) => {
                target.trail.colour = colour;
              });
            }}
          />
        )}
      </InspectorSection>
      <InspectorSection title="Trail adjustments">
        {TRAIL_CONTROLS.slice(0, FINE_CONTROL_START).map((control) => (
          <RelativeSlider
            key={control.key}
            control={control}
            value={layer.trail[control.key]}
            disabled={disabled || !on}
            onChange={(value) => {
              changeLayer((target) => {
                target.trail[control.key] = value;
              });
            }}
          />
        ))}
      </InspectorSection>
      <InspectorSection title="Trail fine controls" open={false}>
        {TRAIL_CONTROLS.slice(FINE_CONTROL_START).map((control) => (
          <RelativeSlider
            key={control.key}
            control={control}
            value={layer.trail[control.key]}
            disabled={disabled || !on}
            onChange={(value) => {
              changeLayer((target) => {
                target.trail[control.key] = value;
              });
            }}
          />
        ))}
      </InspectorSection>
    </div>
  );
}
