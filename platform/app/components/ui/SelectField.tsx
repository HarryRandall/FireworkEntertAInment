"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SelectFieldProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  iconLeft?: ReactNode;
};

export function SelectField({
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder = "Select...",
  required,
  disabled,
  className,
  ariaLabel,
  iconLeft,
}: SelectFieldProps) {
  const isControlled = typeof value === "string";
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = isControlled ? value! : internal;

  const selected = useMemo(
    () => options.find((option) => option.value === current),
    [current, options],
  );

  const handleChange = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={current}
          required={required}
          disabled={disabled}
        />
      ) : null}
      <Select value={current} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger
          aria-label={ariaLabel}
          className={cn(
            "h-10 w-full cursor-pointer rounded-md border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] px-3 text-sm text-[color:var(--color-content-emphasis)] transition-colors focus:outline-none focus:ring-1 focus:ring-[color:var(--color-content-emphasis)] focus:border-[color:var(--color-content-emphasis)]",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          {iconLeft ? (
            <span className="text-[color:var(--color-content-subtle)]">{iconLeft}</span>
          ) : null}
          <SelectValue placeholder={placeholder}>
            {selected?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-1 shadow-[var(--shadow-modal)]"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[color:var(--color-content-subtle)]">
              No options
            </div>
          ) : null}
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="rounded-md text-sm text-[color:var(--color-content-default)] focus:bg-[color:var(--color-bg-muted)] focus:text-[color:var(--color-content-emphasis)] data-[state=checked]:font-medium data-[state=checked]:text-[color:var(--color-content-emphasis)]"
            >
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block truncate text-xs text-[color:var(--color-content-subtle)]">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
