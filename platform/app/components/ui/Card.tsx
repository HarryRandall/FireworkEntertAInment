import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type Radius = "md" | "lg" | "xl";

const radiusClasses: Record<Radius, string> = {
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
};

type CardProps = ComponentPropsWithoutRef<"div"> & {
  radius?: Radius;
  bordered?: boolean;
  hoverable?: boolean;
  shadow?: boolean;
  /** @deprecated kept for backwards compatibility — no longer affects styling */
  elevation?: "low" | "high";
};

export function Card({
  radius = "lg",
  bordered = true,
  hoverable = false,
  shadow = false,
  className,
  children,
  elevation: _elevation,
  ...rest
}: CardProps) {
  void _elevation;
  return (
    <div
      className={cn(
        radiusClasses[radius],
        "bg-[color:var(--color-bg-default)]",
        bordered && "border border-[color:var(--color-border-default)]",
        shadow && "shadow-[var(--shadow-card)]",
        hoverable && "transition-colors hover:bg-[color:var(--color-bg-muted)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
