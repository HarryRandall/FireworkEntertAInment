/** Rounded, stacked Nivo bars with dashed horizontal grids. */
'use client';
import { ResponsiveBar } from '@nivo/bar';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { ChartFrame, ChartLegend } from './chart-frame';
import { CHART_COLOURS, CHART_MARGIN, CHART_RADIUS_PX, CHART_THEME } from './chart-theme';
/** Displays stacked category counts; keys identify numeric fields on each record. */
export function StackedBarChart({
  title,
  data,
  keys,
}: {
  title: string;
  data: { label: string; [key: string]: string | number }[];
  keys: string[];
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <ChartFrame
      title={title}
      description="Counts grouped by placement."
      rows={data.flatMap((item) =>
        keys.map((key) => ({ label: `${item.label}: ${key}`, value: item[key] })),
      )}
      legend={<ChartLegend labels={keys} colours={CHART_COLOURS} />}
    >
      <ResponsiveBar
        data={data}
        keys={keys}
        indexBy="label"
        groupMode="stacked"
        colors={CHART_COLOURS}
        margin={CHART_MARGIN}
        theme={CHART_THEME}
        borderRadius={CHART_RADIUS_PX}
        animate={!reduced}
        axisBottom={{ tickSize: 0 }}
        axisLeft={{ tickSize: 0 }}
        enableLabel={false}
      />
    </ChartFrame>
  );
}
