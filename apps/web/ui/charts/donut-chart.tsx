/** Nivo donut and progress ring, with visible totals and exact accessible values. */
'use client';
import { ResponsivePie } from '@nivo/pie';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { ChartFrame, ChartLegend } from './chart-frame';
import { CHART_COLOURS, CHART_RADIUS_PX, CHART_THEME, DONUT_INNER_RATIO } from './chart-theme';
// Progress is expressed in per cent, matching the prototype ring's scale.
const FULL_PERCENT = 100;
/** Displays non-negative category counts with their total and a text legend. */
export function DonutChart({
  title,
  data,
}: {
  title: string;
  data: { id: string; value: number }[];
}) {
  const reduced = usePrefersReducedMotion();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <ChartFrame
      title={title}
      description={`Total: ${total.toLocaleString('en-GB')}`}
      rows={data.map((item) => ({ label: item.id, value: item.value }))}
      legend={<ChartLegend labels={data.map((item) => item.id)} colours={CHART_COLOURS} />}
    >
      <ResponsivePie
        data={data}
        innerRadius={DONUT_INNER_RATIO}
        cornerRadius={CHART_RADIUS_PX}
        colors={CHART_COLOURS}
        theme={CHART_THEME}
        enableArcLabels={false}
        enableArcLinkLabels={false}
        animate={!reduced}
      />
    </ChartFrame>
  );
}
/** Displays a finite completion percentage between zero and 100. */
export function RingChart({ title, value }: { title: string; value: number }) {
  if (!Number.isFinite(value) || value < 0 || value > FULL_PERCENT)
    throw new RangeError('Invalid completion percentage');
  const reduced = usePrefersReducedMotion();
  return (
    <ChartFrame
      title={title}
      description={`${String(value)}% of scans`}
      rows={[{ label: 'Completed', value: `${String(value)}%` }]}
    >
      <div className="relative h-full">
        <ResponsivePie
          data={[
            { id: 'Completed', value },
            { id: 'Remaining', value: FULL_PERCENT - value },
          ]}
          innerRadius={DONUT_INNER_RATIO}
          colors={[CHART_COLOURS[0], 'var(--muted)']}
          theme={CHART_THEME}
          enableArcLabels={false}
          enableArcLinkLabels={false}
          cornerRadius={CHART_RADIUS_PX}
          animate={!reduced}
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-2xl font-semibold">
          {value}%
        </span>
      </div>
    </ChartFrame>
  );
}
