'use client';
import {
  CONTROL_GRID_CLASS,
  PanelSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { SelectField } from '@/ui/patterns/SelectField';
import { Switch } from '@/ui/primitives/switch';
import {
  CRACKLE_COLOUR_OPTIONS,
  CRACKLE_SOUND_OPTIONS,
  formatPercent,
  formatProbability,
  formatSeconds,
  round2,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { RendererField as SliderField } from '../RendererField';

export function renderCrackleControls(context: RendererControlsContext) {
  const {
    crackleEnabled,
    crackleToggleId,
    setNestedRenderValue,
    disabled,
    design,
    sectionDisabled,
  } = context;
  return (
    <PanelSection
      title="Crackle"
      inactive={!crackleEnabled}
      titleAccessory={<InfoTooltip text="Stars pop into crackling silver fragments as they die." />}
      action={
        <Switch
          id={crackleToggleId}
          aria-label="Crackle"
          checked={crackleEnabled}
          onCheckedChange={(value) => setNestedRenderValue('crackle', 'enabled', value)}
          disabled={disabled}
        />
      }
    >
      <div className={CONTROL_GRID_CLASS}>
        <SliderField
          label="Ignition chance"
          min={0}
          max={1}
          step={0.01}
          value={design.crackle.probability}
          formatValue={formatProbability}
          showNumberInput
          inputAriaLabel="Crackle ignition chance value"
          disabled={sectionDisabled.crackle}
          hint="Time-normalised chance that an eligible dying star ignites its crackle."
          onChange={(value) => setNestedRenderValue('crackle', 'probability', round2(value))}
        />
        <SliderField
          label="Trigger window"
          min={0.1}
          max={4}
          step={0.05}
          value={design.crackle.triggerWindowSeconds}
          formatValue={formatSeconds}
          showNumberInput
          inputAriaLabel="Crackle trigger window value"
          disabled={sectionDisabled.crackle}
          hint="How early before star death the crackle may ignite."
          onChange={(value) =>
            setNestedRenderValue('crackle', 'triggerWindowSeconds', round2(value))
          }
        />
        <SliderField
          label="Fragment count"
          min={1}
          max={200}
          step={1}
          value={design.crackle.fragmentCount}
          showNumberInput
          inputAriaLabel="Crackle fragment count value"
          disabled={sectionDisabled.crackle}
          hint="Base number of hot fragments released by each crackle event."
          onChange={(value) => setNestedRenderValue('crackle', 'fragmentCount', Math.round(value))}
        />
        <SliderField
          label="Count variation"
          min={0}
          max={100}
          step={1}
          value={design.crackle.fragmentCountVariationPercent}
          formatValue={formatPercent}
          showNumberInput
          inputAriaLabel="Crackle fragment count variation value"
          disabled={sectionDisabled.crackle}
          hint="Seeded variation in fragment count between crackle events."
          onChange={(value) =>
            setNestedRenderValue('crackle', 'fragmentCountVariationPercent', round2(value))
          }
        />
        <SliderField
          label="Fragment size"
          min={1}
          max={120}
          step={1}
          value={design.crackle.fragmentSize}
          showNumberInput
          inputAriaLabel="Crackle fragment size value"
          disabled={sectionDisabled.crackle}
          hint="Base luminous size of each crackle fragment."
          onChange={(value) => setNestedRenderValue('crackle', 'fragmentSize', round2(value))}
        />
        <SliderField
          label="Size variation"
          min={0}
          max={100}
          step={1}
          value={design.crackle.fragmentSizeVariationPercent}
          formatValue={formatPercent}
          showNumberInput
          inputAriaLabel="Crackle fragment size variation value"
          disabled={sectionDisabled.crackle}
          hint="Seeded size variation within each crackle cloud."
          onChange={(value) =>
            setNestedRenderValue('crackle', 'fragmentSizeVariationPercent', round2(value))
          }
        />
        <SliderField
          label="Fragment speed"
          min={0}
          max={6}
          step={0.05}
          value={design.crackle.fragmentSpeed}
          showNumberInput
          inputAriaLabel="Crackle fragment speed value"
          disabled={sectionDisabled.crackle}
          hint="Base force pushing fragments away from the parent star."
          onChange={(value) => setNestedRenderValue('crackle', 'fragmentSpeed', round2(value))}
        />
        <SliderField
          label="Speed variation"
          min={0}
          max={100}
          step={1}
          value={design.crackle.fragmentSpeedVariationPercent}
          formatValue={formatPercent}
          showNumberInput
          inputAriaLabel="Crackle fragment speed variation value"
          disabled={sectionDisabled.crackle}
          hint="Seeded speed variation that breaks up a uniform spherical pop."
          onChange={(value) =>
            setNestedRenderValue('crackle', 'fragmentSpeedVariationPercent', round2(value))
          }
        />
        <SliderField
          label="Fragment life"
          min={0.05}
          max={4}
          step={0.05}
          value={design.crackle.fragmentLifeSeconds}
          formatValue={formatSeconds}
          showNumberInput
          inputAriaLabel="Crackle fragment life value"
          disabled={sectionDisabled.crackle}
          hint="Base burn time of each crackle fragment."
          onChange={(value) =>
            setNestedRenderValue('crackle', 'fragmentLifeSeconds', round2(value))
          }
        />
        <SliderField
          label="Life variation"
          min={0}
          max={100}
          step={1}
          value={design.crackle.fragmentLifeVariationPercent}
          formatValue={formatPercent}
          showNumberInput
          inputAriaLabel="Crackle fragment life variation value"
          disabled={sectionDisabled.crackle}
          hint="Seeded burn-time variation across the fragment cloud."
          onChange={(value) =>
            setNestedRenderValue('crackle', 'fragmentLifeVariationPercent', round2(value))
          }
        />
        <SliderField
          label="Fragment gravity"
          min={-2}
          max={1}
          step={0.01}
          value={design.crackle.fragmentGravity}
          showNumberInput
          inputAriaLabel="Crackle fragment gravity value"
          disabled={sectionDisabled.crackle}
          hint="Gravity applied to fragments independently of the parent star."
          onChange={(value) => setNestedRenderValue('crackle', 'fragmentGravity', round2(value))}
        />
        <Field>
          <div className="flex items-center gap-1.5">
            <FieldLabel>Fragment colour</FieldLabel>
            <InfoTooltip text="Use metallic silver or gold, or inherit each parent star's colour." />
          </div>
          <SelectField
            value={design.crackle.colourMode}
            onChange={(value) => setNestedRenderValue('crackle', 'colourMode', value)}
            options={CRACKLE_COLOUR_OPTIONS}
            ariaLabel="Crackle fragment colour"
            disabled={sectionDisabled.crackle}
          />
        </Field>
        <Field>
          <div className="flex items-center gap-1.5">
            <FieldLabel>Crackle sound</FieldLabel>
            <InfoTooltip text="Sound event eligible to play when a crackle cloud ignites." />
          </div>
          <SelectField
            value={design.crackle.sound}
            onChange={(value) => setNestedRenderValue('crackle', 'sound', value)}
            options={CRACKLE_SOUND_OPTIONS}
            ariaLabel="Crackle sound"
            disabled={sectionDisabled.crackle}
          />
        </Field>
        <SliderField
          label="Sound chance"
          min={0}
          max={1}
          step={0.01}
          value={design.crackle.soundChance}
          formatValue={formatProbability}
          showNumberInput
          inputAriaLabel="Crackle sound chance value"
          disabled={sectionDisabled.crackle}
          hint="Chance that an audible crackle event plays its selected sound."
          onChange={(value) => setNestedRenderValue('crackle', 'soundChance', round2(value))}
        />
        <SliderField
          label="Sound volume"
          min={0}
          max={1}
          step={0.01}
          value={design.crackle.soundVolume}
          formatValue={formatProbability}
          showNumberInput
          inputAriaLabel="Crackle sound volume value"
          disabled={sectionDisabled.crackle}
          hint="Volume multiplier for the selected crackle sound."
          onChange={(value) => setNestedRenderValue('crackle', 'soundVolume', round2(value))}
        />
      </div>
    </PanelSection>
  );
}
