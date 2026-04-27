import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type Elevation = "low" | "high";
type Radius = "md" | "lg" | "xl";

const elevationClasses: Record<Elevation, string> = {
  low: "bg-surface-container-low",
  high: "bg-surface-container-high",
};

const radiusClasses: Record<Radius, string> = {
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
};

type CardProps = ComponentPropsWithoutRef<"div"> & {
  elevation?: Elevation;
  radius?: Radius;
  bordered?: boolean;
  hoverable?: boolean;
};

export function Card({
  elevation = "low",
  radius = "md",
  bordered = true,
  hoverable = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        elevationClasses[elevation],
        radiusClasses[radius],
        bordered && "border border-outline-variant/15",
        "shadow-[0_3px_5px_rgba(0,0,0,0.05)]",
        hoverable &&
          "transition-all duration-200 ease-out hover:border-outline-variant/25 hover:bg-surface-container-high hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
