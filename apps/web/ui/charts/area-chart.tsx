/** Nivo area and sparkline wrappers keep chart-library imports out of pages. */
'use client';
import { useId } from 'react';
import { ResponsiveLine, type LineCustomSvgLayerProps } from '@nivo/line';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { ChartFrame, ChartLegend } from './chart-frame';
import {
  AREA_OPACITY,
  CHART_COLOURS,
  CHART_MARGIN,
  CHART_THEME,
  LINE_WIDTH_PX,
  SPARK_HEIGHT_PX,
} from './chart-theme';

// Tick spacing is 12 CSS pixels, following the prototype; gradient offsets use per cent.
const TICK_PADDING_PX = 12;
// Nivo gradient offsets are percentages, ending at full height.
const GRADIENT_END_PERCENT = 100;
// Six-pixel strokes with four-pixel gaps distinguish the prototype comparison.
const COMPARISON_DASH = '6 4';
/** One labelled measurement series; x is a calendar/category label and y a finite count. */
export interface AreaSeries {
  id: string;
  data: { x: string; y: number }[];
  comparison?: boolean;
}
function SeriesPaths({
  series,
  lineGenerator,
  areaGenerator,
  data,
}: LineCustomSvgLayerProps<AreaSeries>) {
  const gradientId = useId().replaceAll(':', '');
  return (
    <g>
      {series.map((seriesItem, index) => {
        const positions = seriesItem.data.map((point) => point.position);
        const comparison = data.find((item) => item.id === seriesItem.id)?.comparison === true;
        return (
          <g key={seriesItem.id}>
            <defs>
              <linearGradient id={`${gradientId}-${String(index)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={seriesItem.color} />
                <stop offset="100%" stopColor={seriesItem.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {!comparison && (
              <path
                d={areaGenerator(positions) ?? undefined}
                fill={`url(#${gradientId}-${String(index)})`}
                opacity={AREA_OPACITY}
              />
            )}
            <path
              d={lineGenerator(positions) ?? undefined}
              fill="none"
              stroke={seriesItem.color}
              strokeWidth={LINE_WIDTH_PX}
              strokeDasharray={comparison ? COMPARISON_DASH : undefined}
            />
          </g>
        );
      })}
    </g>
  );
}
/** Renders counts over labelled dates with an unfilled dashed comparison and gradient current area. */
export function AreaChart({ title, series }: { title: string; series: AreaSeries[] }) {
  const reduced = usePrefersReducedMotion();
  return (
    <ChartFrame
      title={title}
      description={
        series.some((item) => item.comparison === true)
          ? 'Solid current season; dashed last season.'
          : 'Current season counts.'
      }
      rows={series.flatMap((item) =>
        item.data.map((point) => ({ label: `${item.id}: ${point.x}`, value: point.y })),
      )}
      legend={<ChartLegend labels={series.map((item) => item.id)} colours={CHART_COLOURS} />}
    >
      <ResponsiveLine
        data={series}
        margin={CHART_MARGIN}
        theme={CHART_THEME}
        colors={CHART_COLOURS}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 0, max: 'auto' }}
        axisBottom={{ tickSize: 0, tickPadding: TICK_PADDING_PX }}
        axisLeft={{ tickSize: 0 }}
        enableGridX={false}
        enablePoints={false}
        useMesh
        animate={!reduced}
        enableArea
        layers={['grid', 'axes', SeriesPaths, 'mesh']}
      />
    </ChartFrame>
  );
}
/** Decorative finite-value trend in measurement order; the parent supplies its accessible summary. */
export function Sparkline({ values }: { values: readonly number[] }) {
  const gradientId = useId().replaceAll(':', '');
  return (
    <div aria-hidden="true" style={{ height: SPARK_HEIGHT_PX }}>
      <ResponsiveLine
        data={[{ id: 'Trend', data: values.map((y, index) => ({ x: String(index), y })) }]}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        colors={[CHART_COLOURS[0]]}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        axisBottom={null}
        axisLeft={null}
        enableGridX={false}
        enableGridY={false}
        enablePoints={false}
        enableArea
        areaOpacity={AREA_OPACITY}
        defs={[
          {
            id: gradientId,
            type: 'linearGradient',
            colors: [
              { offset: 0, color: 'inherit' },
              { offset: GRADIENT_END_PERCENT, color: 'inherit', opacity: 0 },
            ],
          },
        ]}
        fill={[{ match: '*', id: gradientId }]}
        lineWidth={LINE_WIDTH_PX}
        isInteractive={false}
        animate={false}
      />
    </div>
  );
}
