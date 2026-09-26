import {
  displayedFieldValue,
  EFFECT_FIELDS,
  formatFieldValue,
  storedFieldValue,
  type NumericEffectSection,
  type NumericFieldDefinition,
} from '@showcrafter/firework-editor/effect-fields';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { CONTROL_GRID_CLASS } from './ControlSections';
import { RendererField } from './RendererField';

type Props<S extends NumericEffectSection> = {
  context: RendererControlsContext;
  section: S;
  fields: readonly (keyof (typeof EFFECT_FIELDS)[S])[];
};

export function EffectNumericFields<S extends NumericEffectSection>({
  context,
  section,
  fields,
}: Props<S>) {
  return (
    <div className={CONTROL_GRID_CLASS}>
      {fields.map((key) => {
        const field = EFFECT_FIELDS[section][key] as NumericFieldDefinition;
        const settings = context.design[section];
        const value = Reflect.get(settings, String(key));
        if (typeof value !== 'number')
          throw new Error(`Invalid numeric field ${section}.${String(key)}`);
        const scale = field.displayScale ?? 1;
        return (
          <RendererField
            key={String(key)}
            label={field.label}
            hint={field.explanation}
            inputKind={field.input}
            min={field.min * scale}
            max={field.max * scale}
            step={field.step * scale}
            value={displayedFieldValue(value, field)}
            formatValue={(number) => formatFieldValue(number, field)}
            disabled={context.sectionDisabled[section]}
            onChange={(number) =>
              context.setNestedRenderValue(section, String(key), storedFieldValue(number, field))
            }
          />
        );
      })}
    </div>
  );
}
