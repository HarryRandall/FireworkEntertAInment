'use client';

/** Switch primitive with optional label/description/icon — use for boolean preferences. */
import { useId, useState, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

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
  const isControlled = typeof checked === 'boolean';
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
        'group border-border bg-card text-card-foreground hover:bg-muted/60 flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {icon ? <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        {label ? <span className="text-foreground block text-sm font-medium">{label}</span> : null}
        {description ? (
          <span className="text-muted-foreground mt-1 block text-sm">{description}</span>
        ) : null}
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center justify-center">
        <Switch
          id={id}
          name={name}
          checked={value}
          onCheckedChange={handle}
          disabled={disabled}
          className="data-checked:bg-primary data-unchecked:bg-input [&_[data-slot=switch-thumb]]:bg-background h-6 w-11 [&_[data-slot=switch-thumb]]:size-5 [&_[data-slot=switch-thumb]]:data-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
