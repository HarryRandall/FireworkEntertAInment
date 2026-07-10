'use client';

/** Labelled slider with a live value readout and helper text, use for bounded numeric tuning controls. */
import { useId, type ReactNode } from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
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
  /** Span the full width of the surrounding control grid, for fields with no natural pair. */
  fullWidth?: boolean;
  onChange: (value: number) => void;
  /** Called when pointer or keyboard interaction commits the current value. */
  onCommit?: (value: number) => void;
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
  fullWidth = false,
  onChange,
  onCommit,
}: SliderFieldProps) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const sliderId = `${generatedId}-slider`;
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
    <Field className={fullWidth ? 'col-span-full space-y-1.5' : 'space-y-1.5'}>
      <div className="flex items-center gap-1.5">
        <FieldLabel id={labelId} htmlFor={sliderId} className="text-xs whitespace-nowrap">
          {label}
        </FieldLabel>
        {hint ? <InfoTooltip text={hint} /> : null}
      </div>
      <div className="flex items-center gap-3">
        <SliderPrimitive.Root
          id={sliderId}
          data-slot="slider"
          value={[sliderValue]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={(next) => onChange(next[0] ?? value)}
          onValueCommit={(next) => onCommit?.(next[0] ?? value)}
          className="relative flex min-w-0 flex-1 touch-none items-center py-1 select-none data-disabled:opacity-50"
        >
          <SliderPrimitive.Track
            data-slot="slider-track"
            className="bg-muted relative h-1.5 grow overflow-hidden rounded-full"
          >
            <SliderPrimitive.Range
              data-slot="slider-range"
              className="bg-primary absolute h-full"
            />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            aria-labelledby={labelId}
            className="border-primary bg-background ring-ring/50 block size-3.5 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        </SliderPrimitive.Root>
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
            className="h-7 w-14 shrink-0 [appearance:textfield] rounded-md px-1.5 text-right font-mono text-xs tabular-nums [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setNumberValue(event.currentTarget.valueAsNumber)}
            onBlur={(event) => {
              const next =
                event.currentTarget.value === '' ? min : event.currentTarget.valueAsNumber;
              const upperBound = inputMax == null ? Number.POSITIVE_INFINITY : inputMax;
              const clamped = Math.min(upperBound, Math.max(min, next));
              const committed = step >= 1 ? Math.round(clamped / step) * step : clamped;
              if (Number.isFinite(committed)) {
                if (event.currentTarget.value === '') onChange(committed);
                onCommit?.(committed);
              }
            }}
          />
        ) : (
          <span className="shrink-0 rounded-md bg-[color:var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-[color:var(--color-content-emphasis)] tabular-nums">
            {display}
          </span>
        )}
      </div>
    </Field>
  );
}
