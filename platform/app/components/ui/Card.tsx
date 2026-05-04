import type { ComponentPropsWithoutRef } from "react";
import { Card as ShadcnCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Elevation = "low" | "high";
type Radius = "md" | "lg" | "xl";

const elevationClasses: Record<Elevation, string> = {
  low: "bg-surface-container-low/88",
  high: "bg-surface-container-high/92",
};

const radiusClasses: Record<Radius, string> = {
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-[var(--radius-hero)]",
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
    <ShadcnCard
      className={cn(
        elevationClasses[elevation],
        radiusClasses[radius],
        bordered && "border border-outline-variant/55",
        "gap-0 py-0 shadow-[var(--shadow-card)] backdrop-blur-xl",
        hoverable &&
          "transition-all duration-200 ease-out hover:border-primary/55 hover:bg-surface-container-high hover:shadow-[var(--shadow-card-hover)] focus-visible:border-primary/65 focus-visible:shadow-[var(--shadow-card-hover)]",
        className,
      )}
      {...rest}
    >
      {children}
    </ShadcnCard>
  );
}
