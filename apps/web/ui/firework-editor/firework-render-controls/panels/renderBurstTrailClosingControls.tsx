'use client';
import { SwitchField } from '@/ui/firework-editor/firework-render-controls/ControlFields';
import {
  CONTROL_GRID_CLASS,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { SelectField } from '@/ui/patterns/SelectField';
import {
  formatDegrees,
  formatMultiplier,
  formatPercent,
  formatSeconds,
  round2,
  STAR_CLOSING_END_PERCENT_MAX,
  STAR_CLOSING_END_PERCENT_MIN,
  STAR_CLOSING_PERCENT_MAX,
  STAR_CLOSING_PERCENT_MIN,
  TRAIL_LIFETIME_MODE_OPTIONS,
  TRAIL_PARTICLE_LIFE_MAX,
  TRAIL_SPREAD_ANGLE_MAX,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import { RendererField as SliderField } from '../RendererField';

export function renderBurstTrailClosingControls(
  context: RendererControlsContext,
  layerKey: StarLayerKey | undefined,
) {
  const { currentBurstTrail, disabled, design, setBurstTrailNested, setBurstTrailClosingValue } =
    context;
  const trail = currentBurstTrail(layerKey);
  const closing = trail.closing;
  const trailsEnabled = trail.enabled;
  const controlDisabled =
    disabled || !trailsEnabled || (layerKey ? !design.stars[layerKey].enabled : false);
  const sizeEnabled = closing.size.enabled;
  const spreadFadeEnabled = closing.spreadFade.enabled;

  return (
    <SubSection title="Closing">
      <div className={CONTROL_GRID_CLASS}>
        <Field>
          <div className="flex items-center gap-1.5">
            <FieldLabel>Lifetime model</FieldLabel>
            <InfoTooltip text="Follow star life scales every particle from its parent star's remaining burn. Fixed duration gives every emitted particle its own duration." />
          </div>
          <SelectField
            value={trail.lifetime.mode}
            onChange={(value) => setBurstTrailNested(layerKey, 'lifetime', 'mode', value)}
            options={TRAIL_LIFETIME_MODE_OPTIONS}
            ariaLabel="Trail lifetime model"
            disabled={controlDisabled}
          />
        </Field>
        {trail.lifetime.mode === 'dynamic' ? (
          <SliderField
            label="Star-life share"
            min={0}
            max={TRAIL_PARTICLE_LIFE_MAX}
            step={0.05}
            value={trail.lifetime.percent}
            formatValue={formatMultiplier}
            showNumberInput
            inputAriaLabel="Trail star life share value"
            disabled={controlDisabled}
            hint="Multiplier of the parent star's remaining life. 1x dies with that star; 2x lasts twice as long."
            onChange={(value) =>
              setBurstTrailNested(layerKey, 'lifetime', 'percent', round2(value))
            }
          />
        ) : (
          <SliderField
            label="Fixed life"
            min={0.05}
            max={8}
            step={0.05}
            value={trail.lifetime.baseSeconds}
            formatValue={formatSeconds}
            showNumberInput
            inputAriaLabel="Trail fixed life value"
            disabled={controlDisabled}
            hint="Base lifetime of every newly emitted trail particle."
            onChange={(value) =>
              setBurstTrailNested(layerKey, 'lifetime', 'baseSeconds', round2(value))
            }
          />
        )}
        <SliderField
          label="Life random"
          min={0}
          max={100}
          step={1}
          value={trail.lifetime.variationPercent}
          formatValue={formatPercent}
          showNumberInput
          inputAriaLabel="Life random value"
          disabled={controlDisabled}
          hint="Seeded variation in each particle's individual life. Replay stays deterministic."
          onChange={(value) =>
            setBurstTrailNested(layerKey, 'lifetime', 'variationPercent', round2(value))
          }
        />
        <SliderField
          label="Afterglow"
          min={0}
          max={6}
          step={0.05}
          value={trail.lifetime.afterglowSeconds}
          formatValue={formatSeconds}
          showNumberInput
          inputAriaLabel="Trail afterglow value"
          disabled={controlDisabled}
          hint="Extra time added after the selected lifetime model, useful for hanging embers."
          onChange={(value) =>
            setBurstTrailNested(layerKey, 'lifetime', 'afterglowSeconds', round2(value))
          }
        />
        <SwitchField
          label="Size close"
          checked={sizeEnabled}
          disabled={controlDisabled}
          hint="Shrink or hold each trail particle through the final part of its burn."
          onChange={(value) => setBurstTrailClosingValue(layerKey, 'size', 'enabled', value)}
        />
        <SwitchField
          label="Wide tail fade"
          checked={spreadFadeEnabled}
          disabled={controlDisabled}
          hint="Fade the far tail when the tail angle gets very wide."
          onChange={(value) => setBurstTrailClosingValue(layerKey, 'spreadFade', 'enabled', value)}
        />
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
              inputAriaLabel="Trail closing final size value"
              disabled={controlDisabled}
              hint="Trail particle size at the moment it dies, as a percentage of normal size."
              onChange={(value) =>
                setBurstTrailClosingValue(layerKey, 'size', 'endPercent', round2(value))
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
              inputAriaLabel="Trail closing shrink time value"
              disabled={controlDisabled}
              hint="Percentage of the star life used after each trail particle appears to shrink into the final size."
              onChange={(value) =>
                setBurstTrailClosingValue(layerKey, 'size', 'shrinkPercent', round2(value))
              }
            />
          </>
        ) : null}
        {spreadFadeEnabled ? (
          <>
            <SliderField
              label="Fade angle"
              min={0}
              max={TRAIL_SPREAD_ANGLE_MAX}
              step={1}
              value={closing.spreadFade.startAngle}
              formatValue={formatDegrees}
              showNumberInput
              inputAriaLabel="Wide tail fade angle value"
              disabled={controlDisabled}
              hint="Tail angle where the far tail starts fading."
              onChange={(value) =>
                setBurstTrailClosingValue(layerKey, 'spreadFade', 'startAngle', round2(value))
              }
            />
            <SliderField
              label="Tail opacity"
              min={0}
              max={100}
              step={1}
              value={closing.spreadFade.endOpacityPercent}
              formatValue={formatPercent}
              showNumberInput
              inputAriaLabel="Wide tail opacity value"
              disabled={controlDisabled}
              hint="Opacity of the far tail when the tail angle is at maximum spread."
              onChange={(value) =>
                setBurstTrailClosingValue(
                  layerKey,
                  'spreadFade',
                  'endOpacityPercent',
                  round2(value),
                )
              }
            />
          </>
        ) : null}
      </div>
    </SubSection>
  );
}
