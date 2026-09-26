'use client';
import { ColorField } from '@/ui/firework-editor/ColorField';
import { CONTROL_GRID_CLASS } from '../ControlSections';
import { SwitchField } from '../ControlFields';
import { Button } from '@/ui/patterns/Button';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { SelectField } from '@/ui/patterns/SelectField';
import {
  ensureRecord,
  hexToRgbObject,
  rgbObjectToHex,
  STAR_COLOUR_AXIS_OPTIONS,
  STAR_COLOUR_PATTERN_MAX_COLOURS,
  STAR_COLOUR_PATTERN_OPTIONS,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { RendererField } from '../RendererField';

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
  const layerLabel = layerKey === 'core' ? 'Inner stars' : 'Outer stars';
  const positionalPattern = pattern.mode === 'bands' || pattern.mode === 'stripes';
  const disabled = controlDisabled || !design.colour.enabled;
  const visibleColours = pattern.mode === 'solid' ? pattern.colours.slice(0, 1) : pattern.colours;
  const totalWeight = visibleColours.reduce((sum, entry) => sum + entry.weight, 0);
  const usesBase = visibleColours.length === 0 || (visibleColours.length > 1 && totalWeight === 0);

  return (
    <div className="space-y-4">
      {layerKey === 'outer' ? (
        <SwitchField
          label="Colour enabled"
          hint="Applies to both star layers. Switching off uses white while keeping your saved colours."
          checked={design.colour.enabled}
          disabled={context.disabled}
          onChange={(enabled) =>
            context.mutate((draft) => {
              ensureRecord(draft, 'colour').enabled = enabled;
            })
          }
        />
      ) : null}
      {!design.colour.enabled ? (
        <p className="text-muted-foreground text-xs">
          Colour is off for this firework. Enable it in Outer stars / Colours to edit the palette.
        </p>
      ) : null}
      <div className={CONTROL_GRID_CLASS}>
        <Field>
          <FieldLabel>Pattern</FieldLabel>
          <SelectField
            value={pattern.mode}
            onChange={(value) => setStarColourPatternValue(layerKey, 'mode', value)}
            options={[...STAR_COLOUR_PATTERN_OPTIONS]}
            ariaLabel={`${layerLabel} colour pattern`}
            disabled={disabled}
          />
          <p className="text-muted-foreground text-xs">
            Solid uses the first palette colour. Random mixes colours per star. Bands arrange one
            palette across the burst; stripes repeat it.
          </p>
        </Field>
        {positionalPattern ? (
          <Field>
            <FieldLabel>Direction</FieldLabel>
            <SelectField
              value={pattern.axis}
              onChange={(value) => setStarColourPatternValue(layerKey, 'axis', value)}
              options={[...STAR_COLOUR_AXIS_OPTIONS]}
              ariaLabel={`${layerLabel} colour pattern direction`}
              disabled={disabled}
            />
          </Field>
        ) : null}
        {pattern.mode === 'stripes' ? (
          <RendererField
            inputKind="number"
            label="Palette repetitions"
            min={1}
            max={6}
            step={1}
            value={pattern.count}
            disabled={disabled}
            hint="Number of times the full palette repeats across this layer."
            onChange={(value) => setStarColourPatternValue(layerKey, 'count', value)}
          />
        ) : null}
        {usesBase ? (
          <ColorField
            label="Fallback colour"
            value={rgbObjectToHex(layer.color)}
            allowClear
            disabled={disabled}
            hint="Used when there is no active palette. Clear to inherit the document's colour settings. Add a palette colour for direct control of this layer."
            onChange={(value) => setStarLayerColour(layerKey, value)}
          />
        ) : null}
      </div>
      {usesBase ? (
        <p className="text-muted-foreground text-xs">
          No weighted palette is active. This layer uses its fallback and the document's inherited
          colour settings.
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">Colour distribution</p>
          <div
            className="border-border flex h-5 overflow-hidden rounded border"
            role="img"
            aria-label={visibleColours
              .map(
                (entry, index) =>
                  `Colour ${index + 1}: ${(visibleColours.length === 1 ? 100 : (entry.weight / totalWeight) * 100).toFixed(1)}%`,
              )
              .join(', ')}
          >
            {visibleColours.map((entry, index) => (
              <span
                key={index}
                style={{
                  flex: visibleColours.length === 1 ? 1 : entry.weight,
                  backgroundColor: rgbObjectToHex(entry.color) ?? undefined,
                }}
                className="bg-muted"
              />
            ))}
          </div>
        </div>
      )}
      {visibleColours.map((entry, index) => (
        <div
          key={`${layerKey}-pattern-colour-${index}`}
          className="border-border space-y-3 rounded-lg border p-3"
        >
          <ColorField
            label={`Palette colour ${index + 1}`}
            value={rgbObjectToHex(entry.color)}
            disabled={disabled}
            hint={
              entry.color === 'random'
                ? 'Currently random hues. Choose a colour to replace them.'
                : 'Colour used by this layer.'
            }
            onChange={(value) => {
              if (value)
                updateStarColourPatternEntry(layerKey, index, { color: hexToRgbObject(value) });
            }}
          />
          {entry.color === 'random' ? (
            <p className="text-muted-foreground text-xs">Random hues</p>
          ) : null}
          {pattern.mode !== 'solid' && visibleColours.length > 1 ? (
            <RendererField
              label="Relative weight"
              min={0}
              max={100}
              step={0.01}
              value={entry.weight}
              inputAriaLabel={`Palette colour ${index + 1} weight`}
              disabled={disabled}
              hint="Weights are relative: 10 and 30 give a 25% / 75% split. They do not need to add up to 100."
              onChange={(weight) => updateStarColourPatternEntry(layerKey, index, { weight })}
            />
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => removeStarColourPatternEntry(layerKey, index)}
          >
            Remove colour {index + 1}
          </Button>
        </div>
      ))}
      {pattern.mode === 'solid' && pattern.colours.length > 1 ? (
        <p className="text-muted-foreground text-xs">
          {pattern.colours.length - 1} other palette{' '}
          {pattern.colours.length === 2 ? 'colour is' : 'colours are'} kept for when you switch back
          to a mixed pattern.
        </p>
      ) : null}
      {pattern.mode !== 'solid' || pattern.colours.length === 0 ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || pattern.colours.length >= STAR_COLOUR_PATTERN_MAX_COLOURS}
          onClick={() => addStarColourPatternEntry(layerKey)}
        >
          Add colour
        </Button>
      ) : null}
    </div>
  );
}
