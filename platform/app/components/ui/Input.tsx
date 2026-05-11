import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { uiStyles } from "@/app/components/ui/styles";
import { SelectField, type SelectOption } from "@/app/components/ui/SelectField";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  iconLeft?: ReactNode;
  invalid?: boolean;
};

export function Input({ className, iconLeft, invalid = false, ...rest }: InputProps) {
  return (
    <div className="relative">
      {iconLeft ? (
        <div className={uiStyles.control.icon}>
          {iconLeft}
        </div>
      ) : null}
      <ShadcnInput
        {...rest}
        aria-invalid={invalid || rest["aria-invalid"] || undefined}
        className={cn(
          uiStyles.focus.field,
          "h-11 w-full rounded-xl border bg-surface text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all duration-200",
          invalid ? "border-error/60" : "border-outline/55",
          iconLeft ? "pl-11 pr-4" : "px-4",
          className,
        )}
      />
    </div>
  );
}

type TextareaProps = ComponentPropsWithoutRef<"textarea">;

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <ShadcnTextarea
      {...rest}
      className={cn(
        uiStyles.focus.field,
        "w-full resize-none rounded-xl border border-outline/55 bg-surface p-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all duration-200",
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
