import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const chartPath = new URL(
  '../../app/(admin)/admin/users/[id]/UserActivityChart.tsx',
  import.meta.url,
);
const plotPath = new URL(
  '../../app/(admin)/admin/users/[id]/UserActivityChartPlot.tsx',
  import.meta.url,
);

test('the admin user activity plot is kept out of the initial route bundle', async () => {
  const [chart, plot] = await Promise.all([
    readFile(chartPath, 'utf8'),
    readFile(plotPath, 'utf8'),
  ]);

  assert.match(chart, /dynamic\(/);
  assert.match(chart, /import\('\.\/UserActivityChartPlot'\)/);
  assert.match(chart, /ssr: false/);
  assert.doesNotMatch(chart, /from 'recharts'/);
  assert.match(plot, /from 'recharts'/);
});

test('the empty state returns before the lazy chart is rendered', async () => {
  const chart = await readFile(chartPath, 'utf8');
  const emptyStateIndex = chart.indexOf('if (total === 0)');
  const lazyPlotIndex = chart.indexOf('<LazyUserActivityChartPlot');

  assert.ok(emptyStateIndex >= 0);
  assert.ok(lazyPlotIndex > emptyStateIndex);
  assert.match(chart, /className="h-44/);
  assert.match(chart, /Loading activity chart/);
});
