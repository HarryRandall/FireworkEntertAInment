'use client';

import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Switch } from '@/ui/primitives/switch';
import type { CalibratedRange } from '@showcrafter/firework-editor/calibrated-slider';
import { useId, type ReactNode } from 'react';
import { RendererField as SliderField } from './RendererField';

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function CalibratedSliderField({
  label,
  value,
  range,
  disabled,
  hint,
  fullWidth,
  onChange,
}: {
  label: string;
  value: number;
  range: CalibratedRange;
  disabled?: boolean;
  hint: ReactNode;
  fullWidth?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <SliderField
      label={label}
      min={range.min}
      max={range.max}
      step={range.max <= 10 ? 0.01 : 1}
      value={value}
      formatValue={(number) =>
        label.toLowerCase().includes('strength') ? `${number.toFixed(2)}×` : `${number}%`
      }
      disabled={disabled}
      fullWidth={fullWidth}
      hint={hint}
      onChange={onChange}
    />
  );
}

export function SwitchField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();

  return (
    <Field>
      <div className="flex min-h-9 items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <InfoTooltip text={hint} />
        </div>
        <Switch
          id={id}
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      </div>
    </Field>
  );
}
