'use client';

/** SelectField — styled wrapper around the shadcn Select primitive — use for all dropdowns inside forms. */
import { useState, type ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
  placeholder = 'Select...',
  required,
  disabled,
  className,
  ariaLabel,
  iconLeft,
}: SelectFieldProps) {
  const isControlled = typeof value === 'string';
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? value! : internal;

  const handleChange = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <>
      {name ? (
        <input type="hidden" name={name} value={current} required={required} disabled={disabled} />
      ) : null}
      <Select value={current} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger
          aria-label={ariaLabel}
          className={cn(
            'border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full cursor-pointer rounded-md border px-3 text-sm shadow-xs transition-[color,box-shadow] focus:outline-none focus-visible:ring-3',
            disabled && 'cursor-not-allowed opacity-60',
            className,
          )}
        >
          {iconLeft ? <span className="text-muted-foreground">{iconLeft}</span> : null}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          align="start"
          className="border-border bg-popover text-popover-foreground rounded-lg border p-1 shadow-md"
        >
          {options.length === 0 ? (
            <div className="text-muted-foreground px-3 py-2 text-sm">No options</div>
          ) : null}
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="text-foreground focus:bg-muted focus:text-foreground rounded-md text-sm data-[state=checked]:font-medium"
            >
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.description ? (
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
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
