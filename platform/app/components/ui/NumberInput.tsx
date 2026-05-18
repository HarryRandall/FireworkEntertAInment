"use client";

import { useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
  if (typeof min === "number" && next < min) next = min;
  if (typeof max === "number" && next > max) next = max;
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
  const isControlled = typeof value === "number";
  const current = isControlled ? value! : internal;

  const commit = (next: number) => {
    const clamped = clamp(next, min, max);
    if (!isControlled) setInternal(clamped);
    onChange?.(clamped);
  };

  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-md border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-emphasis)] transition-colors focus-within:border-[color:var(--color-content-emphasis)]",
        disabled && "opacity-60",
        className,
      )}
    >
      {iconLeft ? (
        <span className="pl-3 text-[color:var(--color-content-subtle)]">{iconLeft}</span>
      ) : null}
      <input
        type="number"
        name={name}
        value={Number.isFinite(current) ? current : ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
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
        className="h-full w-full appearance-none border-0 bg-transparent px-3 text-sm font-medium tabular-nums text-[color:var(--color-content-emphasis)] shadow-none outline-none placeholder:text-[color:var(--color-content-muted)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex h-full shrink-0 flex-col border-l border-[color:var(--color-border-subtle)]">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase"
          disabled={disabled || (typeof max === "number" && current >= max)}
          onClick={() => commit((Number.isFinite(current) ? current : 0) + step)}
          className="flex h-1/2 w-8 items-center justify-center text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease"
          disabled={disabled || (typeof min === "number" && current <= min)}
          onClick={() => commit((Number.isFinite(current) ? current : 0) - step)}
          className="flex h-1/2 w-8 items-center justify-center border-t border-[color:var(--color-border-subtle)] text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
