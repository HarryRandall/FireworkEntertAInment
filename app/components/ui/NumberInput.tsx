'use client';

/** NumberInput — stepper input with +/- buttons and min/max/step clamping. Use for any bounded numeric form field. */
import { useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type NumberInputProps = {
  name?: string;
  defaultValue?: number;
  value?: number;
  onChange?: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  iconLeft?: ReactNode;
  ariaLabel?: string;
};

function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (typeof min === 'number' && next < min) next = min;
  if (typeof max === 'number' && next > max) next = max;
  return next;
}

export function NumberInput({
  name,
  defaultValue = 0,
  value,
  onChange,
  min,
  max,
  step = 1,
  required,
  disabled,
  className,
  iconLeft,
  ariaLabel,
}: NumberInputProps) {
  const [internal, setInternal] = useState<number>(defaultValue);
  const isControlled = typeof value === 'number';
  const current = isControlled ? value! : internal;

  const commit = (next: number) => {
    const clamped = clamp(next, min, max);
    if (!isControlled) setInternal(clamped);
    onChange?.(clamped);
  };

  return (
    <div
      className={cn(
        'border-input bg-background text-foreground focus-within:border-ring focus-within:ring-ring/50 flex h-10 items-center rounded-md border shadow-xs transition-[color,box-shadow] focus-within:ring-3',
        disabled && 'opacity-60',
        className,
      )}
    >
      {iconLeft ? <span className="text-muted-foreground pl-3">{iconLeft}</span> : null}
      <input
        type="number"
        name={name}
        value={Number.isFinite(current) ? current : ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            if (!isControlled) setInternal(NaN as unknown as number);
            return;
          }
          commit(Number(raw));
        }}
        onBlur={() => {
          if (!Number.isFinite(current)) commit(min ?? 0);
        }}
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        className="text-foreground placeholder:text-muted-foreground h-full w-full [appearance:textfield] appearance-none border-0 bg-transparent px-3 text-sm font-medium tabular-nums shadow-none outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="border-border/50 flex h-full shrink-0 flex-col border-l">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase"
          disabled={disabled || (typeof max === 'number' && current >= max)}
          onClick={() => commit((Number.isFinite(current) ? current : 0) + step)}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-1/2 w-8 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease"
          disabled={disabled || (typeof min === 'number' && current <= min)}
          onClick={() => commit((Number.isFinite(current) ? current : 0) - step)}
          className="border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground flex h-1/2 w-8 items-center justify-center border-t transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
