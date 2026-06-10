/** Text Input / Textarea / native Select primitives — use these for all plain form fields. */
import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SelectField, type SelectOption } from '@/app/components/ui/SelectField';

const controlBase =
  'h-10 w-full rounded-md border bg-background text-sm text-foreground shadow-xs transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-3';

type InputProps = ComponentPropsWithoutRef<'input'> & {
  iconLeft?: ReactNode;
  invalid?: boolean;
};

/** Styled `<input>` with optional left icon + invalid state. */
export function Input({ className, iconLeft, invalid = false, ...rest }: InputProps) {
  return (
    <div className="relative">
      {iconLeft ? (
        <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {iconLeft}
        </div>
      ) : null}
      <input
        {...rest}
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        className={cn(
          controlBase,
          invalid
            ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
            : 'border-input focus-visible:border-ring focus-visible:ring-ring/50',
          iconLeft ? 'pr-3 pl-10' : 'px-3',
          className,
        )}
      />
    </div>
  );
}

type TextareaProps = ComponentPropsWithoutRef<'textarea'> & { invalid?: boolean };

/** Styled `<textarea>` matching the Input visual. */
export function Textarea({ className, invalid = false, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
      className={cn(
        'bg-background text-foreground placeholder:text-muted-foreground w-full resize-y rounded-md border p-3 text-sm shadow-xs transition-[color,box-shadow] focus:outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60',
        invalid
          ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
          : 'border-input focus-visible:border-ring focus-visible:ring-ring/50',
        className,
      )}
    />
  );
}

type SelectProps = ComponentPropsWithoutRef<'select'>;

/** Native `<select>` primitive — prefer SelectField for richer dropdowns. */
export function Select({
  className,
  children,
  name,
  value,
  defaultValue,
  required,
  disabled,
  'aria-label': ariaLabel,
}: SelectProps) {
  const options: SelectOption[] = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const childProps = child.props as {
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      };
      return {
        value: String(childProps.value ?? ''),
        label: String(childProps.children ?? ''),
        disabled: Boolean(childProps.disabled),
      };
    });

  return (
    <SelectField
      name={name}
      value={typeof value === 'string' ? value : undefined}
      defaultValue={defaultValue != null ? String(defaultValue) : undefined}
      required={required}
      disabled={disabled}
      ariaLabel={ariaLabel}
      options={options}
      className={cn('w-full', className)}
    />
  );
}
