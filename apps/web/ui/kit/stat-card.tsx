/** Compact metric cards with decorative Nivo line sparklines. */
'use client';
import { ResponsiveLine } from '@nivo/line';
import { Badge, type Tone } from './feedback';

// The prototype's compact sparkline is a two-CSS-pixel stroke with no axes or labels.
const LINE_WIDTH_PX = 2;

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
  const data = [
    { id: title, data: series.map((measurement, index) => ({ x: index, y: measurement })) },
  ];
  return (
    <div className="border-border bg-card grid min-w-0 gap-3 rounded-lg border p-4">
      <span className="text-muted-foreground text-xs">{title}</span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-2xl font-semibold tabular-nums">{value}</b>
        <Badge tone={tone}>{change}</Badge>
      </div>
      <div className="h-9 min-w-0" aria-hidden="true">
        <ResponsiveLine
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          axisBottom={null}
          axisLeft={null}
          enableGridX={false}
          enableGridY={false}
          enablePoints={false}
          isInteractive={false}
          animate={false}
          lineWidth={LINE_WIDTH_PX}
          colors={['var(--highlight)']}
        />
      </div>
    </div>
  );
}
