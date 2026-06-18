'use client';

/** Labelled slider with a live value readout and helper text, use for bounded numeric tuning controls. */
import { useId, type ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { Input } from '@/app/components/ui/Input';

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
  /** Shows a compact number input instead of a read-only value for precise entry. */
  showNumberInput?: boolean;
  /** Optional maximum for the number input. Use null when typed values may exceed the slider range. */
  numberInputMax?: number | null;
  inputAriaLabel?: string;
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
  showNumberInput = false,
  numberInputMax,
  inputAriaLabel,
  onChange,
}: SliderFieldProps) {
  const id = useId();
  const display = formatValue ? formatValue(value) : String(value);
  const inputMax = numberInputMax === undefined ? max : numberInputMax;
  const sliderValue = Math.min(max, Math.max(min, value));

  function setNumberValue(next: number) {
    if (!Number.isFinite(next)) return;
    const upperBound = inputMax == null ? Number.POSITIVE_INFINITY : inputMax;
    const clamped = Math.min(upperBound, Math.max(min, next));
    const stepped = step >= 1 ? Math.round(clamped / step) * step : clamped;
    onChange(Math.min(upperBound, Math.max(min, stepped)));
  }

  return (
    <Field className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <FieldLabel htmlFor={id} className="truncate text-xs">
            {label}
          </FieldLabel>
          {hint ? <InfoTooltip text={hint} /> : null}
        </div>
        {showNumberInput ? (
          <Input
            type="number"
            inputMode="decimal"
            min={min}
            max={inputMax ?? undefined}
            step="any"
            value={value}
            disabled={disabled}
            aria-label={
              inputAriaLabel ?? (typeof label === 'string' ? `${label} value` : undefined)
            }
            className="h-7 w-14 [appearance:textfield] rounded-md px-1.5 text-right font-mono text-xs tabular-nums [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setNumberValue(event.currentTarget.valueAsNumber)}
            onBlur={(event) => {
              if (event.currentTarget.value === '') setNumberValue(min);
            }}
          />
        ) : (
          <span className="rounded-md bg-[color:var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-xs text-[color:var(--color-content-emphasis)] tabular-nums">
            {display}
          </span>
        )}
      </div>
      <Slider
        id={id}
        value={[sliderValue]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => onChange(next[0] ?? value)}
        aria-label={typeof label === 'string' ? label : undefined}
        className="py-1 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5"
      />
    </Field>
  );
}
