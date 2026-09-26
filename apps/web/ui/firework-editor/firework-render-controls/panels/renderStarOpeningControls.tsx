'use client';
import { ColorField } from '@/ui/firework-editor/ColorField';
import { SwitchField } from '@/ui/firework-editor/firework-render-controls/ControlFields';
import {
  CONTROL_GRID_CLASS,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import {
  formatPercent,
  hexToRgbObject,
  rgbObjectToHex,
  round2,
  STAR_OPENING_COLOUR_HEX,
  STAR_OPENING_PERCENT_MAX,
  STAR_OPENING_PERCENT_MIN,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { RendererField as SliderField } from '../RendererField';

export function renderStarOpeningControls(
  context: RendererControlsContext,
  layerKey: StarLayerKey,
  controlDisabled: boolean,
) {
  const { design, setLayerHeadOpeningValue } = context;
  const opening = design.stars[layerKey].head.opening;
  const colourEnabled = opening.colour.enabled;
  const sizeEnabled = opening.size.enabled;

  return (
    <SubSection title="Opening">
      <div className={CONTROL_GRID_CLASS}>
        <SwitchField
          label="Colour fade"
          checked={colourEnabled}
          disabled={controlDisabled}
          hint="Starts orange, then reaches the star colour over a percentage of this star's burn time."
          onChange={(value) => setLayerHeadOpeningValue(layerKey, 'colour', 'enabled', value)}
        />
        <SwitchField
          label="Size growth"
          checked={sizeEnabled}
          disabled={controlDisabled}
          hint="Starts smaller, then reaches the full star size over a percentage of this star's burn time."
          onChange={(value) => setLayerHeadOpeningValue(layerKey, 'size', 'enabled', value)}
        />
        <ColorField
          label="Opening colour"
          value={rgbObjectToHex(opening.colour.color) ?? STAR_OPENING_COLOUR_HEX}
          disabled={controlDisabled || !colourEnabled}
          hint="Colour used at the instant this star opens."
          onChange={(value) =>
            setLayerHeadOpeningValue(
              layerKey,
              'colour',
              'color',
              hexToRgbObject(value ?? STAR_OPENING_COLOUR_HEX),
            )
          }
        />
        <SliderField
          label="Colour fade time"
          min={STAR_OPENING_PERCENT_MIN}
          max={STAR_OPENING_PERCENT_MAX}
          step={1}
          value={opening.colour.fadePercent}
          formatValue={formatPercent}
          showNumberInput
          inputAriaLabel="Colour fade time value"
          disabled={controlDisabled || !colourEnabled}
          hint="How much of the star's life is spent fading from the opening colour into the final colour."
          onChange={(value) =>
            setLayerHeadOpeningValue(layerKey, 'colour', 'fadePercent', round2(value))
          }
        />
        <SliderField
          label="Start size"
          min={STAR_OPENING_PERCENT_MIN}
          max={STAR_OPENING_PERCENT_MAX}
          step={1}
          value={opening.size.startPercent}
          formatValue={formatPercent}
          showNumberInput
          inputAriaLabel="Start size value"
          disabled={controlDisabled || !sizeEnabled}
          hint="Star size at the instant it opens, as a percentage of the final star size."
          onChange={(value) =>
            setLayerHeadOpeningValue(layerKey, 'size', 'startPercent', round2(value))
          }
        />
        <SliderField
          label="Grow time"
          min={STAR_OPENING_PERCENT_MIN}
          max={STAR_OPENING_PERCENT_MAX}
          step={1}
          value={opening.size.growPercent}
          formatValue={formatPercent}
          showNumberInput
          inputAriaLabel="Grow time value"
          disabled={controlDisabled || !sizeEnabled}
          hint="How much of the star's life is spent growing to the full star size."
          onChange={(value) =>
            setLayerHeadOpeningValue(layerKey, 'size', 'growPercent', round2(value))
          }
        />
      </div>
    </SubSection>
  );
}
