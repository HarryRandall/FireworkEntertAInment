"use client";

import { useId, useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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
        "group flex cursor-pointer items-start gap-4 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-4 transition-colors hover:bg-[color:var(--color-bg-muted)]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {icon ? (
        <span className="mt-0.5 shrink-0 text-[color:var(--color-content-subtle)]">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        {label ? (
          <span className="block text-sm font-medium text-[color:var(--color-content-emphasis)]">
            {label}
          </span>
        ) : null}
        {description ? (
          <span className="mt-1 block text-sm text-[color:var(--color-content-subtle)]">
            {description}
          </span>
        ) : null}
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center justify-center">
        <Switch
          id={id}
          name={name}
          checked={value}
          onCheckedChange={handle}
          disabled={disabled}
          className="h-6 w-11 data-checked:bg-[color:var(--color-accent)] data-unchecked:bg-[color:var(--color-border-default)] [&_[data-slot=switch-thumb]]:size-5 [&_[data-slot=switch-thumb]]:bg-white [&_[data-slot=switch-thumb]]:data-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
