/** StatTile — label + value + optional unit tile used in dashboards and headers. */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
        'border-border bg-card text-card-foreground rounded-lg border px-4 py-3',
        className,
      )}
    >
      <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
        <span>{label}</span>
        {labelAddon}
      </div>
      <div className="text-foreground text-2xl font-semibold tabular-nums">
        {value}
        {unit ? (
          <span className="text-muted-foreground ml-1 text-sm font-normal">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}
