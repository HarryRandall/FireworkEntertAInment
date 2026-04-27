import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  iconLeft?: ReactNode;
};

export function Input({ className, iconLeft, ...rest }: InputProps) {
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
          "h-11 w-full rounded-md border border-outline-variant/30 bg-surface-container-highest text-on-surface placeholder:text-on-surface-variant/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
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
        "w-full resize-none rounded-xl border-none bg-surface-container-highest p-4 text-on-surface placeholder:text-on-surface-variant transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30",
        className,
      )}
    />
  );
}
