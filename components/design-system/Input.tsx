/** Text Input / Textarea / native Select primitives — use these for all plain form fields. */
import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Input as BaseInput } from '@/components/ui/input';
import { Textarea as BaseTextarea } from '@/components/ui/textarea';
import { fieldControlClasses } from './styles';
import { SelectField, type SelectOption } from '@/components/design-system/SelectField';

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
      <BaseInput
        {...rest}
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        className={cn(
          fieldControlClasses(undefined, invalid),
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
    <BaseTextarea
      {...rest}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
      className={cn(fieldControlClasses('h-auto resize-y p-3', invalid), className)}
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
