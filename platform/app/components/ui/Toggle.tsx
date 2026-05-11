"use client";

import { useId, useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center justify-center">
        <Switch
          id={id}
          name={name}
          checked={value}
          onCheckedChange={handle}
          disabled={disabled}
          className="h-6 w-11 data-checked:bg-primary data-unchecked:bg-outline/45 [&_[data-slot=switch-thumb]]:size-5 [&_[data-slot=switch-thumb]]:bg-surface [&_[data-slot=switch-thumb]]:data-checked:bg-on-primary [&_[data-slot=switch-thumb]]:data-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
