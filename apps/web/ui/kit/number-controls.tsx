/** Token-styled shadcn slider and a bounded quantity control. */
'use client';
import { useId } from 'react';
import { Slider as RadixSlider } from 'radix-ui';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { stepValue } from './input-logic';

/** Edits a quantity in caller-defined units with explicit inclusive bounds and positive step. */
export function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="border-input bg-card inline-flex w-fit items-center rounded-md border"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label}`}
        onClick={() => {
          onChange(stepValue(value, -1, { min, max, step }));
        }}
      >
        <Minus />
      </Button>
      <output aria-live="polite" className="min-w-10 text-center text-sm tabular-nums">
        {value}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled || value >= max}
        aria-label={`Increase ${label}`}
        onClick={() => {
          onChange(stepValue(value, 1, { min, max, step }));
        }}
      >
        <Plus />
      </Button>
    </div>
  );
}
/** Edits a scalar in caller-defined units; optional ticks describe the same bounds. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
  ticks = [],
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  ticks?: readonly string[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-3">
      <div className="flex justify-between text-sm">
        <label id={id}>{label}</label>
        <output className="tabular-nums">{format(value)}</output>
      </div>
      <RadixSlider.Root
        aria-labelledby={id}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(values) => {
          const next = values.at(0);
          if (next !== undefined) {
            onChange(next);
          }
        }}
        className="relative flex h-5 touch-none items-center select-none data-[disabled]:opacity-50"
      >
        <RadixSlider.Track className="bg-muted relative h-1.5 flex-1 rounded-full">
          <RadixSlider.Range className="bg-highlight absolute h-full rounded-full" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-labelledby={id}
          className="border-highlight bg-card size-4 rounded-full border-2 shadow-sm"
        />
      </RadixSlider.Root>
      <div className="text-muted-foreground flex justify-between text-xs">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}
