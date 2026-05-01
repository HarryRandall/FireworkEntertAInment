import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  iconLeft?: ReactNode;
  invalid?: boolean;
};

export function Input({ className, iconLeft, invalid = false, ...rest }: InputProps) {
  return (
    <div className="relative">
      {iconLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
          {iconLeft}
        </div>
      ) : null}
      <input
        {...rest}
        className={cn(
          "focus-glow-field h-11 w-full rounded-lg border bg-surface text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all duration-200 focus:outline-none focus-visible:outline-none",
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
        "focus-glow-field w-full resize-none rounded-lg border border-outline/55 bg-surface p-4 text-sm text-on-surface placeholder:text-on-surface-variant transition-all duration-200 focus:outline-none focus-visible:outline-none",
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
        "focus-glow-field h-11 w-full cursor-pointer rounded-lg border border-outline/55 bg-surface px-3 text-sm font-semibold text-on-surface transition-all duration-200 focus:outline-none focus-visible:outline-none",
        className,
      )}
    />
  );
}
