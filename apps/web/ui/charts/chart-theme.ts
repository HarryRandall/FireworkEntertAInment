/** Shared Nivo styling mirrors the prototype's dashed grids and card tooltips. */
// CSS-pixel layout and opacity values are visual tuning from prototype/charts.js.
const CHART_TOP_PX = 16;
const CHART_RIGHT_PX = 12;
const CHART_BOTTOM_PX = 36;
const CHART_LEFT_PX = 48;
export const CHART_MARGIN = {
  top: CHART_TOP_PX,
  right: CHART_RIGHT_PX,
  bottom: CHART_BOTTOM_PX,
  left: CHART_LEFT_PX,
};
export const CHART_HEIGHT_PX = 240;
export const SPARK_HEIGHT_PX = 36;
export const CHART_RADIUS_PX = 6;
export const LINE_WIDTH_PX = 2;
export const AREA_OPACITY = 0.35;
export const DONUT_INNER_RATIO = 0.68;
export const CHART_COLOURS = [
  'var(--highlight)',
  'var(--info)',
  'var(--warning)',
  'var(--destructive)',
];
// Four-CSS-pixel dash and gap match the prototype horizontal grid.
const GRID_DASH = '4 4';
export const CHART_THEME = {
  text: { fill: 'var(--foreground)', fontFamily: 'var(--font-geist-sans), sans-serif' },
  axis: {
    ticks: { text: { fill: 'var(--muted-foreground)' }, line: { stroke: 'transparent' } },
    domain: { line: { stroke: 'transparent' } },
  },
  grid: { line: { stroke: 'var(--border)', strokeDasharray: GRID_DASH } },
  tooltip: {
    container: {
      background: 'var(--card)',
      color: 'var(--foreground)',
      border: '1px solid var(--border)',
      borderRadius: CHART_RADIUS_PX,
      boxShadow: 'var(--shadow-card)',
    },
  },
};
