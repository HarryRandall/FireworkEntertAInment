import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  labelAddon?: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  className?: string;
};

export function StatTile({ label, labelAddon, value, unit, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-4 py-3",
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-content-subtle)]">
        <span>{label}</span>
        {labelAddon}
      </div>
      <div className="text-2xl font-semibold tabular-nums text-[color:var(--color-content-emphasis)]">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-normal text-[color:var(--color-content-subtle)]">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}
