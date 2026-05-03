import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { uiStyles } from "@/app/components/ui/styles";

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
      <input
        {...rest}
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
    <textarea
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

export function Select({ className, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      className={cn(
        uiStyles.focus.field,
        uiStyles.control.select,
        className,
      )}
    />
  );
}
