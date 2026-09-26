'use client';
import {
  CONTROL_GRID_CLASS,
  PanelSection,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { SelectField } from '@/ui/patterns/SelectField';
import { PATTERN_OPTIONS, round2 } from '@showcrafter/firework-editor/control-values';
import {
  GEOMETRY_OPTIONS,
  GEOMETRY_TUNING_GROUPS,
  GEOMETRY_TUNING_SLIDERS,
} from '@showcrafter/firework-editor/geometry-fields';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { isGroundGeometry } from '@showcrafter/fireworks/behaviours';
import { MAX_BURST_FLASH_INTENSITY } from '@showcrafter/fireworks/design';
import { RendererField as SliderField } from '../RendererField';

export function renderGeometryControls(context: RendererControlsContext) {
  const { design, setRenderValue, disabled, setGeometryTuningValue, controlScope } = context;
  const group = GEOMETRY_TUNING_GROUPS[design.geometry];
  const durationField = group
    ? GEOMETRY_TUNING_SLIDERS[group].find((field) => field.key === 'durationSeconds')
    : undefined;
  const content = (
    <div className="space-y-5">
      <div className={CONTROL_GRID_CLASS}>
        <Field>
          <div className="flex items-center gap-1.5">
            <FieldLabel>Geometry</FieldLabel>
            <InfoTooltip text="The main trajectory layout. Ground emitters such as fountains and roman candles skip the shell-lift phase." />
          </div>
          <SelectField
            value={design.geometry}
            onChange={(value) => setRenderValue('geometry', value)}
            options={GEOMETRY_OPTIONS}
            ariaLabel="Firework geometry"
            disabled={disabled}
          />
        </Field>
        <Field>
          <div className="flex items-center gap-1.5">
            <FieldLabel>Star distribution</FieldLabel>
            <InfoTooltip text="Seeded distribution used inside the selected geometry. Strobe phase varies colour selection; configure actual blinking in the Strobe tab." />
          </div>
          <SelectField
            value={design.pattern}
            onChange={(value) => setRenderValue('pattern', value)}
            options={PATTERN_OPTIONS}
            ariaLabel="Star distribution pattern"
            disabled={disabled}
          />
        </Field>
      </div>
      {!isGroundGeometry(design.geometry) ? (
        <SliderField
          label="Scene flash"
          min={0}
          max={MAX_BURST_FLASH_INTENSITY}
          step={0.05}
          value={design.burstFlashIntensity}
          hint="How strongly the burst lights up the scenery. Zero turns the flash off; star brightness is controlled separately."
          disabled={disabled}
          onChange={(value) => setRenderValue('burstFlashIntensity', round2(value))}
        />
      ) : null}
      {group && durationField ? (
        <SliderField
          inputKind="number"
          label={durationField.label}
          min={durationField.min}
          max={durationField.max}
          step={durationField.step}
          value={(design.geometryTuning[group] as Record<string, number>).durationSeconds}
          formatValue={(value) => `${value} s`}
          hint={durationField.hint}
          disabled={disabled}
          onChange={(value) => setGeometryTuningValue(group, 'durationSeconds', round2(value))}
        />
      ) : null}
      {group ? (
        <SubSection title="Shape tuning">
          <div className={CONTROL_GRID_CLASS}>
            {GEOMETRY_TUNING_SLIDERS[group]
              .filter((field) => field.key !== 'durationSeconds')
              .map((slider) => {
                const values = design.geometryTuning[group] as Record<string, number>;
                return (
                  <SliderField
                    key={slider.key}
                    label={slider.label}
                    inputKind={slider.inputKind}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    unit={slider.unit}
                    value={round2(values[slider.key] ?? slider.min)}
                    disabled={disabled}
                    hint={slider.hint}
                    onChange={(value) => setGeometryTuningValue(group, slider.key, round2(value))}
                  />
                );
              })}
          </div>
        </SubSection>
      ) : (
        <p className="text-muted-foreground text-xs leading-5">
          This geometry uses the renderer's calibrated shape and has no additional tuning.
        </p>
      )}
    </div>
  );

  if (controlScope === 'geometry') return content;

  return (
    <PanelSection
      title="Geometry"
      titleAccessory={
        <InfoTooltip text="Shape tuning for this burst geometry. These values save with the effect JSON and were previously fixed inside the renderer." />
      }
    >
      {content}
    </PanelSection>
  );
}
