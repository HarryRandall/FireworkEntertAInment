"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { uiStyles } from "@/app/components/ui/styles";

type ToggleProps = {
  name?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
};

export function Toggle({
  name,
  defaultChecked = false,
  checked,
  onChange,
  disabled = false,
  label,
  description,
  icon,
}: ToggleProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isControlled = typeof checked === "boolean";
  const value = isControlled ? checked : internal;
  const id = useId();

  const handle = () => {
    if (disabled) return;
    const next = !value;
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <label
      htmlFor={id}
      className={cn(
        uiStyles.focus.fieldGroup,
        "group flex cursor-pointer items-start gap-4 rounded-xl border border-outline-variant/45 bg-surface-container-low p-4 transition-colors",
        "hover:border-primary/35 hover:bg-surface-container-high",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {icon ? (
        <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      ) : null}
      <span className="min-w-0 flex-1">
        {label ? (
          <span className="block font-bold text-on-surface">{label}</span>
        ) : null}
        {description ? (
          <span className="mt-1 block text-sm text-on-surface-variant">
            {description}
          </span>
        ) : null}
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          name={name}
          checked={value}
          onChange={handle}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "h-6 w-11 rounded-full transition-colors",
            value ? "bg-primary" : "bg-outline/45",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform duration-200",
            value
              ? "translate-x-5 bg-on-primary"
              : "translate-x-0 bg-surface",
          )}
        />
      </span>
    </label>
  );
}
