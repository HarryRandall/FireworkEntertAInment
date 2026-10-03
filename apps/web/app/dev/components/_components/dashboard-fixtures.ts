/** Deterministic synthetic rollup-style counts for the dashboard review surface. */
import type { BreakdownTab } from '@/ui/kit/dashboard-pieces';
import type { DashboardState } from '@/ui/kit/dashboard-logic';
import type { HeatmapDay } from '@/ui/charts/heatmap-chart';
/** Synthetic records contain no personal or production data. */
export interface ScanRecord {
  id: string;
  placement: string;
  store: string;
  day: string;
  scans: number;
  plays: number;
}
/** Facets offered by the synthetic dashboard. */
export const dashboardFacets = {
  Placement: ['Shelf', 'Counter', 'Window', 'Bag'],
  Store: ['North shop', 'South shop'],
};
/** Stable fixture reference date, independent of the browser clock. */
export const dashboardToday = '2026-11-09';
/** Initial inclusive review period and comparison. */
export const initialDashboardState: DashboardState = {
  filters: [],
  range: { from: '2026-10-20', to: dashboardToday },
  compare: true,
};
// Synthetic data tuning: 21 days, four placements and two stores, with deterministic seasonal growth.
const REVIEW_DAYS = 21;
const START_DAY = 20;
const UTC_DAY_MS = 86_400_000;
// Calendar origin and opening-hour/activity tuning for synthetic counts, not observed data.
const FIXTURE_YEAR = 2026;
const OCTOBER_INDEX = 9;
const ISO_DATE_LENGTH = 10;
const OPEN_HOUR = 9;
const CLOSE_HOUR = 20;
const CLOSED_ACTIVITY_PERCENT = 4;
const BASE_ACTIVITY_PERCENT = 30;
const ACTIVITY_VARIATIONS = 7;
const ACTIVITY_INCREMENT_PERCENT = 10;
const BASE_SCANS = 80;
const DAILY_GROWTH = 12;
const PLACEMENT_WEIGHT = 25;
const PLAY_RATIO = 0.6;
const HOURS_PER_DAY = 24;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Filterable records in chronological fixture order. */
export const scanRecords: ScanRecord[] = Array.from({ length: REVIEW_DAYS }, (_, index) =>
  dashboardFacets.Placement.map((placement, placementIndex) => ({
    id: `${String(index)}-${placement}`,
    placement,
    store: index % 2 === 0 ? 'North shop' : 'South shop',
    day: new Date(Date.UTC(FIXTURE_YEAR, OCTOBER_INDEX, START_DAY) + index * UTC_DAY_MS)
      .toISOString()
      .slice(0, ISO_DATE_LENGTH),
    scans: BASE_SCANS + index * DAILY_GROWTH + placementIndex * PLACEMENT_WEIGHT,
    plays: Math.round(
      (BASE_SCANS + index * DAILY_GROWTH + placementIndex * PLACEMENT_WEIGHT) * PLAY_RATIO,
    ),
  })),
).flat();
/** Tabbed rankings for adding dashboard facets. */
export const breakdownTabs: BreakdownTab[] = Object.entries(dashboardFacets).map(
  ([facet, labels]) => ({
    label: facet,
    facet,
    rows: labels.map((label) => ({
      label,
      value: scanRecords
        .filter((row) => row.placement === label || row.store === label)
        .reduce((sum, row) => sum + row.scans, 0),
    })),
  }),
);
/** Seven days by 24 labelled hours of synthetic peak activity percentages. */
export const heatmapData: HeatmapDay[] = DAY_LABELS.map((id, day) => ({
  id,
  data: Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
    x: `${String(hour)}:00`,
    y:
      hour < OPEN_HOUR || hour > CLOSE_HOUR
        ? CLOSED_ACTIVITY_PERCENT
        : BASE_ACTIVITY_PERCENT + ((hour + day) % ACTIVITY_VARIATIONS) * ACTIVITY_INCREMENT_PERCENT,
  })),
}));
