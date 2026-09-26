'use client';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { SelectField } from '@/ui/patterns/SelectField';
import { Switch } from '@/ui/primitives/switch';
import {
  CRACKLE_COLOUR_OPTIONS,
  CRACKLE_SOUND_OPTIONS,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { PanelSection, SubSection } from '../ControlSections';
import { EffectNumericFields } from '../EffectNumericFields';

export function renderCrackleControls(context: RendererControlsContext) {
  const { design, disabled, sectionDisabled, setNestedRenderValue } = context;
  return (
    <PanelSection
      title="Crackling sparks"
      inactive={!design.crackle.enabled}
      action={
        <Switch
          aria-label="Crackle"
          checked={design.crackle.enabled}
          onCheckedChange={(value) => setNestedRenderValue('crackle', 'enabled', value)}
          disabled={disabled}
        />
      }
    >
      <div className="space-y-4">
        <p className="text-muted-foreground text-xs">
          An affected star ends in a pop of smaller sparks. This can shorten the star and its trail.
        </p>
        <SubSection title="When stars crackle" defaultExpanded>
          <EffectNumericFields
            context={context}
            section="crackle"
            fields={['probability', 'triggerWindowSeconds']}
          />
        </SubSection>
        <SubSection title="Spark appearance" defaultExpanded>
          <div className="space-y-4">
            <EffectNumericFields
              context={context}
              section="crackle"
              fields={['fragmentCount', 'fragmentSize']}
            />
            <Field>
              <FieldLabel>Fragment colour</FieldLabel>
              <SelectField
                value={design.crackle.colourMode}
                onChange={(value) => setNestedRenderValue('crackle', 'colourMode', value)}
                options={CRACKLE_COLOUR_OPTIONS}
                ariaLabel="Crackle fragment colour"
                disabled={sectionDisabled.crackle}
              />
            </Field>
          </div>
        </SubSection>
        <SubSection title="Spark movement and burn time">
          <EffectNumericFields
            context={context}
            section="crackle"
            fields={['fragmentSpeed', 'fragmentGravity', 'fragmentLifeSeconds']}
          />
        </SubSection>
        <SubSection title="Natural variation">
          <EffectNumericFields
            context={context}
            section="crackle"
            fields={[
              'fragmentCountVariationPercent',
              'fragmentSizeVariationPercent',
              'fragmentSpeedVariationPercent',
              'fragmentLifeVariationPercent',
            ]}
          />
        </SubSection>
        <SubSection title="Crackle sound">
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs">
              Heard only when replay audio is enabled. Several simultaneous pops may share a sound.
            </p>
            <Field>
              <FieldLabel>Sound sample</FieldLabel>
              <SelectField
                value={design.crackle.sound}
                onChange={(value) => setNestedRenderValue('crackle', 'sound', value)}
                options={CRACKLE_SOUND_OPTIONS}
                ariaLabel="Crackle sound sample"
                disabled={sectionDisabled.crackle}
              />
            </Field>
            <EffectNumericFields
              context={context}
              section="crackle"
              fields={['soundChance', 'soundVolume']}
            />
          </div>
        </SubSection>
      </div>
    </PanelSection>
  );
}
