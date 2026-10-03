/** Star shape, colour stops, brightness keys and analytic motion share the renderer document. */
'use client';
import { layerSchema, colourSchema } from '@showcrafter/fireworks/schema';
import { STARS_CONTROLS, HEAD_CONTROLS } from '@/lib/studio/star-controls';
import { GradientEditor } from '@/ui/kit/gradient-editor';
import { CurveEditor } from '@/ui/kit/curve-editor';
import {
  InspectorChoices,
  InspectorSection,
  RelativeSlider,
  type LayerContext,
} from './inspector-controls';

import { QuickAdjustments, STAR_QUICK } from './quick-adjustments';

import { layerChipPreview } from './chip-preview';

const FINE_CONTROL_START = 5; // First five prototype rows are primary star adjustments.
const SHAPES = layerSchema.shape.pattern.options;
const COLOUR_MODES = colourSchema.shape.mode.options;
const MAX_BRIGHTNESS = 10; // Dimensionless multiplier, v1 schema bound for authored brightness keys.
/** Edits star shapes and motion plus the kit's ordered gradient and brightness editors. */
export function StarsInspector(context: LayerContext) {
  const { layer, disabled, changeLayer } = context;
  return (
    <div>
      <ShapeControls context={context} />
      <InspectorSection title="Colour over life">
        <InspectorChoices
          label="Colour mix"
          items={COLOUR_MODES}
          value={layer.colour.mode}
          disabled={disabled}
          onChange={(mode) => {
            changeLayer((target) => {
              target.colour.mode = mode;
            });
          }}
        />
        <GradientEditor
          label="Star colour"
          value={layer.colour}
          maxTime={Math.max(1, ...layer.colour.stops.map((stop) => stop[0]))}
          disabled={disabled}
          onChange={(colour) => {
            changeLayer((target) => {
              target.colour = colour;
            });
          }}
        />
      </InspectorSection>
      <InspectorSection title="Brightness over life">
        <CurveEditor
          label="Brightness"
          value={layer.brightness}
          maxValue={MAX_BRIGHTNESS}
          disabled={disabled}
          onChange={(brightness) => {
            changeLayer((target) => {
              target.brightness = brightness;
            });
          }}
        />
        {HEAD_CONTROLS.map((control) => (
          <RelativeSlider
            key={control.key}
            control={control}
            value={layer.head[control.key]}
            disabled={disabled}
            onChange={(value) => {
              changeLayer((target) => {
                target.head[control.key] = value;
              });
            }}
          />
        ))}
      </InspectorSection>
      <QuickAdjustments context={context} controls={STAR_QUICK} layerId={layer.id} open={false} />
      <InspectorSection title="Physics and fine controls" open={false}>
        {STARS_CONTROLS.slice(FINE_CONTROL_START).map((control) => (
          <RelativeSlider
            key={control.key}
            control={control}
            value={layer[control.key]}
            disabled={disabled}
            onChange={(value) => {
              changeLayer((target) => {
                target[control.key] = value;
              });
            }}
          />
        ))}
      </InspectorSection>
    </div>
  );
}

function ShapeControls({ context }: { context: LayerContext }) {
  const { layer, disabled, changeLayer } = context;
  return (
    <InspectorSection title="Shape">
      <InspectorChoices
        label="Shape"
        previewAddress={context.previewAddress}
        preview={(shape) => layerChipPreview(context.document, layer, { shape })}
        items={SHAPES}
        value={layer.pattern}
        disabled={disabled}
        onChange={(pattern) => {
          changeLayer((target) => {
            target.pattern = pattern;
          });
        }}
      />
      {STARS_CONTROLS.slice(0, FINE_CONTROL_START).map((control) => (
        <RelativeSlider
          key={control.key}
          control={control}
          value={layer[control.key]}
          disabled={disabled}
          onChange={(value) => {
            changeLayer((target) => {
              target[control.key] = value;
            });
          }}
        />
      ))}
    </InspectorSection>
  );
}
