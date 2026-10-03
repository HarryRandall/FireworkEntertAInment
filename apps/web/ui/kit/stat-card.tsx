/** Compact metric cards with decorative Nivo line sparklines. */
'use client';
import { Sparkline } from '@/ui/charts/area-chart';
import { Badge, type Tone } from './feedback';

/** Displays a formatted metric and trend; series contains finite measurements in one common unit. */
export function StatCard({
  title,
  value,
  change,
  tone = 'success',
  series,
}: {
  title: string;
  value: string;
  change: string;
  tone?: Tone;
  series: readonly number[];
}) {
  return (
    <div className="border-border bg-card grid min-w-0 gap-3 rounded-lg border p-4">
      <span className="text-muted-foreground text-xs">{title}</span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-2xl font-semibold tabular-nums">{value}</b>
        <Badge tone={tone}>{change}</Badge>
      </div>
      <Sparkline values={series} />
    </div>
  );
}
