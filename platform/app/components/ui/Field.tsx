import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { uiStyles } from "@/app/components/ui/styles";

export function Field({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("space-y-2", className)} {...rest}>
      {children}
    </div>
  );
}

export function FieldLabel({
  className,
  children,
  htmlFor,
  ...rest
}: ComponentPropsWithoutRef<"label">) {
  if (!htmlFor) {
    return (
      <span className={cn(uiStyles.text.label, className)}>
        {children}
      </span>
    );
  }

  return (
    <label
      htmlFor={htmlFor}
      className={cn(uiStyles.text.label, className)}
      {...rest}
    >
      {children}
    </label>
  );
}

export function FieldHint({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p className={cn(uiStyles.text.hint, className)} {...rest}>
      {children}
    </p>
  );
}

export function FieldError({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"p"> & { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className={cn(uiStyles.text.error, className)} {...rest}>
      {children}
    </p>
  );
}
