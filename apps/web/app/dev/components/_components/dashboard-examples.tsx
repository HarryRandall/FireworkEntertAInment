/** Interactive synthetic dashboard connects facets, comparisons, charts and grid records. */
'use client';
import { useEffect, useState } from 'react';
import { DashboardFilterBar } from '@/ui/kit/dashboard-filter';
import { ActivityFeed, BreakdownCard, KpiRow } from '@/ui/kit/dashboard-pieces';
import {
  compareRange,
  dashboardLink,
  exportCsv,
  readDashboardState,
  setFacet,
  type DashboardState,
} from '@/ui/kit/dashboard-logic';
import { AreaChart } from '@/ui/charts/area-chart';
import { StackedBarChart } from '@/ui/charts/bar-chart';
import { DonutChart, RingChart } from '@/ui/charts/donut-chart';
import { HeatmapChart } from '@/ui/charts/heatmap-chart';
import { FunnelChart } from '@/ui/charts/funnel-chart';
import { Input } from '@/ui/primitives/input';
import { Group, Example } from './example';
import { GridGallery } from './grid-examples';
import {
  breakdownTabs,
  dashboardFacets,
  dashboardToday,
  heatmapData,
  initialDashboardState,
  scanRecords,
  type ScanRecord,
} from './dashboard-fixtures';

// Synthetic last-season values are 82% of current counts, purely for visual comparison.
const LAST_SEASON_RATIO = 0.82;
const PERCENT = 100;
// Last five ISO-date characters show month and day on the compact x axis.
const SHORT_DATE_CHARACTERS = 5;
const ACTIVITY_ITEMS = [
  {
    id: 'scan',
    title: 'Counter code scanned',
    description: 'North shop · synthetic visit',
    at: '2026-11-09T12:00:00Z',
    when: '2 minutes ago',
  },
  {
    id: 'plan',
    title: 'Show planned',
    description: 'South shop · synthetic session',
    at: '2026-11-09T11:50:00Z',
    when: '12 minutes ago',
  },
];

function filteredRecords(state: DashboardState) {
  return scanRecords.filter(
    (row) =>
      row.day >= state.range.from &&
      row.day <= state.range.to &&
      state.filters.every(
        (filter) => (filter.facet === 'Placement' ? row.placement : row.store) === filter.value,
      ),
  );
}
function areaSeries(records: ScanRecord[], compare: boolean) {
  const dates = [...new Set(records.map((row) => row.day))];
  const current = {
    id: 'This season',
    data: dates.map((day) => ({
      x: day.slice(-SHORT_DATE_CHARACTERS),
      y: records.filter((row) => row.day === day).reduce((sum, row) => sum + row.scans, 0),
    })),
  };
  return compare
    ? [
        current,
        {
          id: 'Last season',
          comparison: true,
          data: current.data.map((point) => ({
            ...point,
            y: Math.round(point.y * LAST_SEASON_RATIO),
          })),
        },
      ]
    : [current];
}
function downloadRecords(records: ScanRecord[]) {
  const csv = exportCsv(
    ['Day', 'Placement', 'Store', 'Scans', 'Plays'],
    records.map((row) => [row.day, row.placement, row.store, row.scans, row.plays]),
  );
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'synthetic-scans.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
/** Shows every dashboard and chart family with shared, filterable synthetic rollups. */
export function DashboardExamples() {
  const [state, setState] = useState(initialDashboardState);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const shared = new URL(window.location.href).searchParams.get('dashboard');
    if (shared === null) return;
    const next = readDashboardState(shared, dashboardFacets);
    if (next === null) setMessage('The dashboard link contains invalid filters or dates.');
    else setState(next);
  }, []);
  const records = filteredRecords(state);
  return (
    <>
      <Group id="dashboard" title="Dashboard">
        <Example
          id="dashboard-filters"
          title="Dashboard filters"
          source="Shared Radix kit / dash.js"
          description="Facets, inclusive dates, same dates last season and local view links. All data is synthetic."
        >
          <DashboardFilterBar
            state={state}
            facets={dashboardFacets}
            today={dashboardToday}
            presets={[
              { label: 'This season', range: { from: '2026-10-01', to: dashboardToday } },
              { label: 'Last season', range: { from: '2025-10-01', to: '2025-11-09' } },
              { label: 'All time', range: { from: scanRecords[0].day, to: dashboardToday } },
            ]}
            onChange={setState}
            onShare={() => {
              setLink(dashboardLink(window.location.href, state));
              setMessage('Local view link ready. It grants no data access.');
            }}
            onExport={() => {
              try {
                downloadRecords(records);
                setMessage('Synthetic CSV exported.');
              } catch {
                setMessage('CSV export failed. Please try again.');
              }
            }}
          />
          {state.compare && (
            <p className="text-muted-foreground text-xs">
              Comparison: {compareRange(state.range).from} to {compareRange(state.range).to}
            </p>
          )}
          {link.length > 0 && (
            <label className="grid gap-2 text-sm">
              Share this local view
              <Input
                readOnly
                value={link}
                onFocus={(event) => {
                  event.target.select();
                }}
              />
            </label>
          )}
          <p role="status" className="text-muted-foreground text-sm">
            {message}
          </p>
        </Example>
        <DashboardMetrics records={records} />
        <Example
          id="dashboard-breakdowns"
          title="Breakdowns and activity"
          source="Shared Radix kit / dash.js"
          description="Choose a breakdown row to add a filter chip above. Tabs stay on this page."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <BreakdownCard
              title="Where scans happen"
              tabs={breakdownTabs}
              onPick={(facet, value) => {
                setState({ ...state, filters: setFacet(state.filters, { facet, value }) });
              }}
            />
            <ActivityFeed title="Recent activity" items={ACTIVITY_ITEMS} />
          </div>
        </Example>
      </Group>
      <GridGallery records={records} />
      <DashboardCharts records={records} compare={state.compare} />
    </>
  );
}
function DashboardMetrics({ records }: { records: ScanRecord[] }) {
  const scans = records.reduce((sum, row) => sum + row.scans, 0);
  const plays = records.reduce((sum, row) => sum + row.plays, 0);
  return (
    <Example
      id="dashboard-kpis"
      title="KPI row and sparklines"
      source="Shared stat cards / Nivo"
      description="Counts follow the current filters. Trends use the same underlying records."
    >
      <KpiRow
        metrics={[
          {
            title: 'Scans',
            value: scans.toLocaleString('en-GB'),
            change: 'Synthetic count',
            series: records.map((row) => row.scans),
          },
          {
            title: 'Plays',
            value: plays.toLocaleString('en-GB'),
            change: 'Synthetic count',
            series: records.map((row) => row.plays),
          },
        ]}
      />
    </Example>
  );
}
function DashboardCharts({ records, compare }: { records: ScanRecord[]; compare: boolean }) {
  const scans = records.reduce((sum, row) => sum + row.scans, 0);
  const plays = records.reduce((sum, row) => sum + row.plays, 0);
  const placements = dashboardFacets.Placement.map((id) => ({
    id,
    value: records.filter((row) => row.placement === id).reduce((sum, row) => sum + row.scans, 0),
  }));
  return (
    <Group id="charts" title="Charts">
      <Example
        id="season-charts"
        title="Season and placement charts"
        source="Nivo wrappers / charts.js"
        description="Dashed horizontal grids, gradient current season, dashed comparison, rounded bars and card tooltips. Expand exact data with the keyboard."
      >
        {records.length === 0 ? (
          <p>No chart data in this range.</p>
        ) : (
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <AreaChart title="Scans" series={areaSeries(records, compare)} />
            <StackedBarChart
              title="Scans and plays"
              keys={['Scans', 'Plays']}
              data={placements.map((item) => ({
                label: item.id,
                Scans: item.value,
                Plays: records
                  .filter((row) => row.placement === item.id)
                  .reduce((sum, row) => sum + row.plays, 0),
              }))}
            />
            <DonutChart title="Placements" data={placements} />
            <RingChart
              title="Played after scanning"
              value={scans === 0 ? 0 : Math.round((plays / scans) * PERCENT)}
            />
          </div>
        )}
      </Example>
      <Example
        id="conversion-charts"
        title="Heatmap and funnel"
        source="Nivo wrappers / dash.js"
        description="Standalone synthetic day-by-hour activity and ordered conversion, with equivalent data tables."
      >
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <HeatmapChart title="Day and hour" data={heatmapData} />
          <FunnelChart
            title="Shopper conversion"
            steps={[
              { id: 'Scanned', value: scans },
              { id: 'Played', value: plays },
              { id: 'Saved a list', value: Math.round(plays / 2) },
            ]}
          />
        </div>
      </Example>
    </Group>
  );
}
