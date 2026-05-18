import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SelectField, type SelectOption } from "@/app/components/ui/SelectField";

const controlBase =
  "h-10 w-full rounded-md border bg-[color:var(--color-bg-default)] text-sm text-[color:var(--color-content-emphasis)] transition-colors placeholder:text-[color:var(--color-content-muted)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  iconLeft?: ReactNode;
  invalid?: boolean;
};

export function Input({ className, iconLeft, invalid = false, ...rest }: InputProps) {
  return (
    <div className="relative">
      {iconLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[color:var(--color-content-subtle)]">
          {iconLeft}
        </div>
      ) : null}
      <input
        {...rest}
        aria-invalid={invalid || rest["aria-invalid"] || undefined}
        className={cn(
          controlBase,
          invalid
            ? "border-[color:var(--color-status-danger)] focus:border-[color:var(--color-status-danger)]"
            : "border-[color:var(--color-border-default)] focus:border-[color:var(--color-content-emphasis)]",
          iconLeft ? "pl-10 pr-3" : "px-3",
          className,
        )}
      />
    </div>
  );
}

type TextareaProps = ComponentPropsWithoutRef<"textarea"> & { invalid?: boolean };

export function Textarea({ className, invalid = false, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
      className={cn(
        "w-full resize-y rounded-md border bg-[color:var(--color-bg-default)] p-3 text-sm text-[color:var(--color-content-emphasis)] placeholder:text-[color:var(--color-content-muted)] transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        invalid
          ? "border-[color:var(--color-status-danger)] focus:border-[color:var(--color-status-danger)]"
          : "border-[color:var(--color-border-default)] focus:border-[color:var(--color-content-emphasis)]",
        className,
      )}
    />
  );
}

type SelectProps = ComponentPropsWithoutRef<"select">;

export function Select({
  className,
  children,
  name,
  value,
  defaultValue,
  required,
  disabled,
  "aria-label": ariaLabel,
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
        value: String(childProps.value ?? ""),
        label: String(childProps.children ?? ""),
        disabled: Boolean(childProps.disabled),
      };
    });

  return (
    <SelectField
      name={name}
      value={typeof value === "string" ? value : undefined}
      defaultValue={defaultValue != null ? String(defaultValue) : undefined}
      required={required}
      disabled={disabled}
      ariaLabel={ariaLabel}
      options={options}
      className={cn("w-full", className)}
    />
  );
}
