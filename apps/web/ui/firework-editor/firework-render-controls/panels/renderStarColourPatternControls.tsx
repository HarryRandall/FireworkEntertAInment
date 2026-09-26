'use client';
import { ColorField } from '@/ui/firework-editor/ColorField';
import {
  CONTROL_GRID_CLASS,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { SelectField } from '@/ui/patterns/SelectField';
import {
  formatPercent,
  hexToRgbObject,
  rgbObjectToHex,
  STAR_COLOUR_AXIS_OPTIONS,
  STAR_COLOUR_PATTERN_MAX_COLOURS,
  STAR_COLOUR_PATTERN_OPTIONS,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { RendererField as SliderField } from '../RendererField';

export function renderStarColourPatternControls(
  context: RendererControlsContext,
  layerKey: StarLayerKey,
  controlDisabled: boolean,
) {
  const {
    design,
    setStarLayerColour,
    setStarColourPatternValue,
    updateStarColourPatternEntry,
    removeStarColourPatternEntry,
    addStarColourPatternEntry,
  } = context;
  const layer = design.stars[layerKey];
  const pattern = layer.colourPattern;
  const positionalPattern = pattern.mode === 'bands' || pattern.mode === 'stripes';

  return (
    <SubSection title="Colour pattern">
      <div className="space-y-4">
        <div className={CONTROL_GRID_CLASS}>
          <ColorField
            label="Base colour"
            value={rgbObjectToHex(layer.color)}
            allowClear
            disabled={controlDisabled}
            hint="Leave clear to inherit the firework's accent colour. Pattern colours override it where configured."
            onChange={(value) => setStarLayerColour(layerKey, value)}
          />
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Pattern</FieldLabel>
              <InfoTooltip text="Solid uses the base colour. Random mixes the palette per star; bands and stripes place it across the burst." />
            </div>
            <SelectField
              value={pattern.mode}
              onChange={(value) => setStarColourPatternValue(layerKey, 'mode', value)}
              options={[...STAR_COLOUR_PATTERN_OPTIONS]}
              ariaLabel="Star Inner colour pattern"
              disabled={controlDisabled}
            />
          </Field>
          {positionalPattern ? (
            <>
              <Field>
                <div className="flex items-center gap-1.5">
                  <FieldLabel>Direction</FieldLabel>
                  <InfoTooltip text="Direction used to place the colour bands or stripes across the burst." />
                </div>
                <SelectField
                  value={pattern.axis}
                  onChange={(value) => setStarColourPatternValue(layerKey, 'axis', value)}
                  options={[...STAR_COLOUR_AXIS_OPTIONS]}
                  ariaLabel="Star Inner colour pattern direction"
                  disabled={controlDisabled}
                />
              </Field>
              <SliderField
                label={pattern.mode === 'bands' ? 'Band count' : 'Stripe count'}
                min={1}
                max={6}
                step={1}
                value={pattern.count}
                showNumberInput
                inputAriaLabel="Star Inner colour pattern count"
                disabled={controlDisabled}
                hint="How often the palette repeats across this inner layer."
                onChange={(value) =>
                  setStarColourPatternValue(
                    layerKey,
                    'count',
                    Math.min(6, Math.max(1, Math.round(value))),
                  )
                }
              />
            </>
          ) : null}
        </div>

        {pattern.mode !== 'solid' ? (
          <div className="space-y-3">
            {pattern.colours.length > 0 ? (
              pattern.colours.map((entry, index) => (
                <div
                  key={`${layerKey}-pattern-colour-${index}`}
                  className="space-y-3 rounded-lg border border-[color:var(--color-border-subtle)] p-3"
                >
                  <div className={CONTROL_GRID_CLASS}>
                    <ColorField
                      label={`Palette colour ${index + 1}`}
                      value={rgbObjectToHex(entry.color) ?? '#ffffff'}
                      disabled={controlDisabled}
                      hint="Colour available to this pattern."
                      onChange={(value) => {
                        if (!value) return;
                        updateStarColourPatternEntry(layerKey, index, {
                          color: hexToRgbObject(value),
                        });
                      }}
                    />
                    <SliderField
                      label="Weight"
                      min={0}
                      max={100}
                      step={1}
                      value={entry.weight}
                      formatValue={formatPercent}
                      showNumberInput
                      inputAriaLabel={`Palette colour ${index + 1} weight`}
                      disabled={controlDisabled}
                      hint="Relative share of this colour when the pattern selects from the palette."
                      onChange={(value) =>
                        updateStarColourPatternEntry(layerKey, index, {
                          weight: Math.min(100, Math.max(0, Math.round(value))),
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-[color:var(--color-content-subtle)] underline-offset-2 hover:text-[color:var(--color-content-emphasis)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={controlDisabled}
                    onClick={() => removeStarColourPatternEntry(layerKey, index)}
                  >
                    Remove colour
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm leading-relaxed text-[color:var(--color-content-muted)]">
                Add at least one palette colour for this pattern.
              </p>
            )}
            <button
              type="button"
              className="min-h-9 rounded-lg border border-[color:var(--color-border-default)] px-3 text-sm font-medium text-[color:var(--color-content-emphasis)] transition-colors hover:bg-[color:var(--color-bg-subtle)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                controlDisabled || pattern.colours.length >= STAR_COLOUR_PATTERN_MAX_COLOURS
              }
              onClick={() => addStarColourPatternEntry(layerKey)}
            >
              Add colour
            </button>
          </div>
        ) : null}
      </div>
    </SubSection>
  );
}
