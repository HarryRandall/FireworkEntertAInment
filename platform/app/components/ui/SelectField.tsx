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
import { uiStyles } from "@/app/components/ui/styles";

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
            uiStyles.focus.field,
            "h-11 w-full cursor-pointer rounded-xl border-outline/55 bg-surface px-3 text-sm font-semibold text-on-surface transition-all duration-200",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          {iconLeft ? (
            <span className="text-on-surface-variant">{iconLeft}</span>
          ) : null}
          <SelectValue placeholder={placeholder}>
            {selected?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          className="rounded-xl border-outline/55 bg-surface p-1.5 text-on-surface shadow-[var(--shadow-modal)]"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-on-surface-variant">
              No options
            </div>
          ) : null}
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="rounded-lg text-on-surface-variant focus:bg-surface-container-high focus:text-on-surface data-[state=checked]:text-primary"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
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
