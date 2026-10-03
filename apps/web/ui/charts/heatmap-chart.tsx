/** Nivo day-by-hour activity map with exact values available without hover. */
'use client';
import { ResponsiveHeatMap, type CellComponentProps } from '@nivo/heatmap';
import { ChartFrame } from './chart-frame';
import { CHART_THEME } from './chart-theme';
// Cell radius and margin are CSS-pixel visual tuning from the compact prototype heatmap.
const CELL_RADIUS_PX = 3;
const HEAT_TOP_PX = 4;
const HEAT_RIGHT_PX = 8;
const HEAT_BOTTOM_PX = 32;
const HEAT_LEFT_PX = 40;
const HEAT_MARGIN = {
  top: HEAT_TOP_PX,
  right: HEAT_RIGHT_PX,
  bottom: HEAT_BOTTOM_PX,
  left: HEAT_LEFT_PX,
};
const PERCENT = 100;
/** One day of hourly counts or percentages, using labelled hours as categories. */
export interface HeatmapDay {
  id: string;
  data: { x: string; y: number }[];
}
/* React Spring parses animated colour strings and cannot preserve nested colour-mix/var
   expressions. This non-animated chart passes CSS colours straight to SVG instead. */
function HeatmapCell({
  cell,
  borderWidth,
  borderRadius,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onClick,
}: CellComponentProps<HeatmapDay['data'][number]>) {
  return (
    <rect
      x={cell.x - cell.width / 2}
      y={cell.y - cell.height / 2}
      width={cell.width}
      height={cell.height}
      rx={borderRadius}
      ry={borderRadius}
      fill={cell.color}
      opacity={cell.opacity}
      stroke={cell.borderColor}
      strokeWidth={borderWidth}
      onMouseEnter={onMouseEnter?.(cell)}
      onMouseMove={onMouseMove?.(cell)}
      onMouseLeave={onMouseLeave?.(cell)}
      onClick={onClick?.(cell)}
    />
  );
}

/** Renders hourly percentages of peak activity; input values range from zero to 100. */
export function HeatmapChart({ title, data }: { title: string; data: HeatmapDay[] }) {
  return (
    <ChartFrame
      title={title}
      description="Activity by day and hour, as a percentage of peak scans."
      rows={data.flatMap((day) =>
        day.data.map((hour) => ({ label: `${day.id} ${hour.x}`, value: `${String(hour.y)}%` })),
      )}
    >
      <ResponsiveHeatMap
        data={data}
        cellComponent={HeatmapCell}
        margin={HEAT_MARGIN}
        theme={CHART_THEME}
        animate={false}
        colors={(cell) =>
          `color-mix(in srgb, var(--highlight) ${String(cell.value ?? 0)}%, var(--muted))`
        }
        emptyColor="var(--muted)"
        borderColor="var(--card)"
        borderWidth={2}
        borderRadius={CELL_RADIUS_PX}
        enableLabels={false}
        axisTop={null}
        axisRight={null}
        axisBottom={{ tickSize: 0, tickValues: ['0:00', '6:00', '12:00', '18:00'] }}
        axisLeft={{ tickSize: 0 }}
        valueFormat={(value) => `${String(Math.min(PERCENT, value))}%`}
      />
    </ChartFrame>
  );
}
