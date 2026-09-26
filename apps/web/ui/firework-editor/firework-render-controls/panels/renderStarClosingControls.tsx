'use client';
import { ColorField } from '@/ui/firework-editor/ColorField';
import { SwitchField } from '@/ui/firework-editor/firework-render-controls/ControlFields';
import {
  CONTROL_GRID_CLASS,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import {
  formatLifeVariation,
  formatPercent,
  formatSeconds,
  hexToRgbObject,
  rangeHalfWidth,
  rangeMid,
  rgbObjectToHex,
  round2,
  STAR_CLOSING_COLOUR_HEX,
  STAR_CLOSING_END_PERCENT_MAX,
  STAR_CLOSING_END_PERCENT_MIN,
  STAR_CLOSING_PERCENT_MAX,
  STAR_CLOSING_PERCENT_MIN,
  STAR_LIFE_MAX,
  STAR_LIFE_MIN,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { RendererField as SliderField } from '../RendererField';

export function renderStarClosingControls(
  context: RendererControlsContext,
  layerKey: StarLayerKey,
  controlDisabled: boolean,
) {
  const { design, setLayerBurstLifeMid, setLayerBurstLifeHalfWidth, setLayerHeadClosingValue } =
    context;
  const layer = design.stars[layerKey];
  const closing = layer.head.closing;
  const colourEnabled = closing.colour.enabled;
  const sizeEnabled = closing.size.enabled;

  return (
    <SubSection title="Closing">
      <div className={CONTROL_GRID_CLASS}>
        <SliderField
          label="Burn time"
          min={STAR_LIFE_MIN}
          max={STAR_LIFE_MAX}
          step={0.05}
          value={round2(rangeMid(layer.burst.life))}
          formatValue={formatSeconds}
          showNumberInput
          inputAriaLabel="Burn time value"
          disabled={controlDisabled}
          hint="How long stars in this layer stay alive before the closing fade finishes."
          onChange={(value) => setLayerBurstLifeMid(layerKey, value)}
        />
        <SliderField
          label="Burn spread"
          min={0}
          max={Math.max(
            0,
            Math.min(
              rangeMid(layer.burst.life) - STAR_LIFE_MIN,
              STAR_LIFE_MAX - rangeMid(layer.burst.life),
            ),
          )}
          step={0.05}
          value={round2(rangeHalfWidth(layer.burst.life))}
          formatValue={formatLifeVariation}
          showNumberInput
          inputAriaLabel="Burn spread value"
          disabled={controlDisabled}
          hint="Random spread around the burn time. 0 makes every star in this layer die together."
          onChange={(value) => setLayerBurstLifeHalfWidth(layerKey, round2(value))}
        />
        <SwitchField
          label="Fade colour"
          checked={colourEnabled}
          disabled={controlDisabled}
          hint="Fade each star into a chosen colour at the end instead of using the automatic late colour shift."
          onChange={(value) => setLayerHeadClosingValue(layerKey, 'colour', 'enabled', value)}
        />
        <SwitchField
          label="Size close"
          checked={sizeEnabled}
          disabled={controlDisabled}
          hint="Shrink or hold each star through the final part of its burn."
          onChange={(value) => setLayerHeadClosingValue(layerKey, 'size', 'enabled', value)}
        />
        {colourEnabled ? (
          <>
            <ColorField
              label="Closing colour"
              value={rgbObjectToHex(closing.colour.color) ?? STAR_CLOSING_COLOUR_HEX}
              disabled={controlDisabled}
              hint="Colour the star reaches as it dies."
              onChange={(value) =>
                setLayerHeadClosingValue(
                  layerKey,
                  'colour',
                  'color',
                  hexToRgbObject(value ?? STAR_CLOSING_COLOUR_HEX),
                )
              }
            />
            <SliderField
              label="Colour close time"
              min={STAR_CLOSING_PERCENT_MIN}
              max={STAR_CLOSING_PERCENT_MAX}
              step={1}
              value={closing.colour.fadePercent}
              formatValue={formatPercent}
              showNumberInput
              inputAriaLabel="Closing colour fade time value"
              disabled={controlDisabled}
              hint="How much of the star's life is spent fading into the closing colour."
              onChange={(value) =>
                setLayerHeadClosingValue(layerKey, 'colour', 'fadePercent', round2(value))
              }
            />
          </>
        ) : null}
        {sizeEnabled ? (
          <>
            <SliderField
              label="Final size"
              min={STAR_CLOSING_END_PERCENT_MIN}
              max={STAR_CLOSING_END_PERCENT_MAX}
              step={1}
              value={closing.size.endPercent}
              formatValue={formatPercent}
              showNumberInput
              inputAriaLabel="Final size value"
              disabled={controlDisabled}
              hint="Star size at the moment it dies, as a percentage of the full star size."
              onChange={(value) =>
                setLayerHeadClosingValue(layerKey, 'size', 'endPercent', round2(value))
              }
            />
            <SliderField
              label="Shrink time"
              min={STAR_CLOSING_PERCENT_MIN}
              max={STAR_CLOSING_PERCENT_MAX}
              step={1}
              value={closing.size.shrinkPercent}
              formatValue={formatPercent}
              showNumberInput
              inputAriaLabel="Shrink time value"
              disabled={controlDisabled}
              hint="How much of the star's life is spent shrinking into the final size."
              onChange={(value) =>
                setLayerHeadClosingValue(layerKey, 'size', 'shrinkPercent', round2(value))
              }
            />
          </>
        ) : null}
      </div>
    </SubSection>
  );
}
