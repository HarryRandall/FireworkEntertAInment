'use client';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { SelectField } from '@/ui/patterns/SelectField';
import { BOOM_OPTIONS } from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';

export function renderBoomControl(context: RendererControlsContext) {
  const { boomValue, setNestedRenderValue, disabled } = context;
  return (
    <Field>
      <div className="flex items-center gap-1.5">
        <FieldLabel>Burst report</FieldLabel>
        <InfoTooltip text="Explosion sound at the top, when the shell opens." />
      </div>
      <SelectField
        value={boomValue}
        onChange={(value) => setNestedRenderValue('sound', 'boom', value)}
        options={BOOM_OPTIONS}
        ariaLabel="Burst report"
        disabled={disabled}
      />
    </Field>
  );
}
