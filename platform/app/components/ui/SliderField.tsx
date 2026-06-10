'use client';

/** Labelled slider with a live value readout and helper text — use for bounded numeric tuning controls. */
import { useId, type ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';

type SliderFieldProps = {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** Helper text explaining what the control does, with examples. */
  hint?: ReactNode;
  /** Formats the live readout; defaults to the raw number. */
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
};

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  hint,
  formatValue,
  onChange,
}: SliderFieldProps) {
  const id = useId();
  const display = formatValue ? formatValue(value) : String(value);

  return (
    <Field>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {hint ? <InfoTooltip text={hint} /> : null}
        </div>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{display}</span>
      </div>
      <Slider
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => onChange(next[0] ?? value)}
        aria-label={typeof label === 'string' ? label : undefined}
      />
    </Field>
  );
}
