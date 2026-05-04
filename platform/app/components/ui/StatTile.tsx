import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

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
        "rounded-xl border border-outline-variant/55 bg-surface-container-low px-4 py-3 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        <span>{label}</span>
        {labelAddon}
      </div>
      <div className="text-xl font-bold tabular-nums text-on-surface">
        {value}
        {unit ? (
          <span className="ml-0.5 text-sm font-medium text-primary">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}
