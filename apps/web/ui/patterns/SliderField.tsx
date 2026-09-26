'use client';

/** Labelled slider with a live value readout and helper text, use for bounded numeric tuning controls. */
import { useId, useRef, useState, type ReactNode } from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Input } from '@/ui/patterns/Input';

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
  layout?: 'inline' | 'stacked';
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
  layout = 'inline',
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
  const [draft, setDraft] = useState<string | null>(null);
  const editStart = useRef(value);
  const edited = useRef(false);
  const cancelled = useRef(false);
  const inputText = String(Number(value.toPrecision(12)));

  function boundedNumber(next: number) {
    const upperBound = inputMax == null ? Number.POSITIVE_INFINITY : inputMax;
    const clamped = Math.min(upperBound, Math.max(min, next));
    const stepped = step >= 1 ? Math.round(clamped / step) * step : clamped;
    return Math.min(upperBound, Math.max(min, stepped));
  }

  const valueControl = showNumberInput ? (
    <Input
      type="number"
      inputMode="decimal"
      min={min}
      max={inputMax ?? undefined}
      step="any"
      value={draft ?? inputText}
      disabled={disabled}
      aria-label={inputAriaLabel ?? (typeof label === 'string' ? `${label} value` : undefined)}
      className="h-7 w-14 shrink-0 [appearance:textfield] rounded-md px-1.5 text-right font-mono text-xs tabular-nums [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      onFocus={(event) => {
        editStart.current = value;
        edited.current = false;
        cancelled.current = false;
        setDraft(inputText);
        event.currentTarget.select();
      }}
      onChange={(event) => {
        edited.current = true;
        setDraft(event.currentTarget.value);
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next)) onChange(boundedNumber(next));
      }}
      onBlur={(event) => {
        if (edited.current && !cancelled.current) {
          const next = event.currentTarget.valueAsNumber;
          const committed = Number.isFinite(next) ? boundedNumber(next) : editStart.current;
          onChange(committed);
          onCommit?.(committed);
        }
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          cancelled.current = true;
          onChange(editStart.current);
          event.currentTarget.blur();
        }
      }}
    />
  ) : (
    <span className="shrink-0 rounded-md bg-[color:var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-[color:var(--color-content-emphasis)] tabular-nums">
      {display}
    </span>
  );

  return (
    <Field className={fullWidth ? 'col-span-full space-y-1.5' : 'space-y-1.5'}>
      <div className="flex items-center gap-1.5">
        <FieldLabel id={labelId} htmlFor={sliderId} className="min-w-0 text-xs">
          {label}
        </FieldLabel>
        {hint ? <InfoTooltip text={hint} /> : null}
        {layout === 'stacked' ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {formatValue ? <span className="text-muted-foreground text-xs">{display}</span> : null}
            {valueControl}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <SliderPrimitive.Root
          data-slot="slider"
          value={[sliderValue]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={(next) => onChange(next[0] ?? value)}
          onValueCommit={(next) => onCommit?.(next[0] ?? value)}
          className="relative flex min-h-8 min-w-0 flex-1 touch-none items-center py-2 select-none data-disabled:opacity-50"
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
            id={sliderId}
            data-slot="slider-thumb"
            aria-labelledby={labelId}
            className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        </SliderPrimitive.Root>
        {layout === 'inline' ? valueControl : null}
      </div>
      {layout === 'inline' && showNumberInput && formatValue ? (
        <span className="text-muted-foreground block text-right text-xs">{display}</span>
      ) : null}
    </Field>
  );
}
