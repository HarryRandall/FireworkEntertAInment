import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StatTileProps = {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  className?: string;
};

export function StatTile({ label, value, unit, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-outline-variant/10 bg-surface-container-highest px-4 py-3",
        className,
      )}
    >
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
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
