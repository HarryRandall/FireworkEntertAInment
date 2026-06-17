/** Static guards for the admin overview date-range selector. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('admin overview range selector is URL-backed', () => {
  const page = read('app/(admin)/admin/page.tsx');
  const tabs = read('app/(admin)/admin/AdminOverviewTabs.tsx');
  const toolbar = read('app/(admin)/admin/AdminOverviewToolbar.tsx');
  const ranges = read('lib/admin/overview-range.ts');
  const tabOptions = read('lib/admin/overview-tabs.ts');

  assert.match(page, /searchParams: Promise<\{ range\?: string; tab\?: string \}>/);
  assert.match(page, /parseAdminOverviewRange\(params\.range\)/);
  assert.match(page, /parseAdminOverviewTab\(params\.tab\)/);
  assert.match(page, /getAdminOverviewMetrics\(range\.key\)/);
  assert.match(page, /<AdminOverviewToolbar range=\{range\.key\} \/>/);
  assert.match(page, /<AdminOverviewTabs tab=\{tab\}>/);
  assert.match(page, /className="cursor-pointer"/);

  assert.match(toolbar, /useSearchParams/);
  assert.match(toolbar, /Select value=\{range\}/);
  assert.match(toolbar, /params\.set\(ADMIN_OVERVIEW_RANGE_PARAM, nextRange\)/);
  assert.match(toolbar, /params\.delete\(ADMIN_OVERVIEW_RANGE_PARAM\)/);

  for (const key of ['last-7-days', 'last-4-weeks', 'last-3-months', 'year-to-date']) {
    assert.match(ranges, new RegExp(`key: '${key}'`));
  }

  assert.match(tabs, /useSearchParams/);
  assert.match(tabs, /Tabs\s+value=\{selectedTab\}/);
  assert.match(tabs, /params\.set\(ADMIN_OVERVIEW_TAB_PARAM, nextTab\)/);
  assert.match(tabs, /params\.delete\(ADMIN_OVERVIEW_TAB_PARAM\)/);

  for (const key of ['overview', 'catalogue', 'imports', 'generation']) {
    assert.match(tabOptions, new RegExp(`key: '${key}'`));
  }
  assert.doesNotMatch(tabOptions, /key: 'users'/);
});

test('admin overview server metrics use the selected current and previous periods', () => {
  const server = read('lib/admin/overview.server.ts');
  const cacheKeys = read('lib/admin/cache-keys.ts');

  assert.match(server, /getAdminOverviewRangeWindow\(range\.key\)/);
  assert.match(server, /getAdminOverviewCacheKey\(range\.key\)/);
  assert.match(
    server,
    /\.gte\('created_at', rangeWindow\.startIso\)\s*\.lt\('created_at', rangeWindow\.endIso\)/s,
  );
  assert.match(
    server,
    /\.gte\('created_at', rangeWindow\.previousStartIso\)\s*\.lt\('created_at', rangeWindow\.previousEndIso\)/s,
  );
  assert.match(server, /previousShows: previousShowsResult\.count \?\? 0/);
  assert.match(server, /previousShowCues: previousShowCuesResult\.count \?\? 0/);
  assert.match(server, /previousMusicAnalyses: previousMusicAnalysesResult\.count \?\? 0/);

  assert.match(cacheKeys, /overview:\$\{rangeKey\}/);
});

test('admin overview chart buckets follow the selected range window', () => {
  const page = read('app/(admin)/admin/page.tsx');
  const charts = read('app/(admin)/admin/AdminOverviewCharts.tsx');

  assert.match(page, /buildActivityData\(overview, rangeWindow\)/);
  assert.match(page, /buildPulseData\(activityData\)/);
  assert.match(page, /activityGranularity\(rangeWindow\)/);
  assert.match(page, /rangeWindow\.chartDays > 120/);
  assert.match(page, /rangeWindow\.chartDays > 35/);
  assert.match(page, /nextActivityBucketStart\(cursor, granularity, afterLastDay\)/);

  assert.match(charts, /buildActivityTicks\(data\.length\)/);
  assert.match(charts, /domain=\{\[1, Math\.max\(data\.length, 1\)\]\}/);
  assert.match(charts, /formatActivityTick\(value, data\)/);
  assert.match(charts, /function GenerationPulseBars/);
  assert.match(charts, /aria-label="Cue generation by period"/);
  assert.doesNotMatch(charts, /BarChart/);
});

test('admin overview layout avoids narrow-width overflow', () => {
  const page = read('app/(admin)/admin/page.tsx');
  const charts = read('app/(admin)/admin/AdminOverviewCharts.tsx');
  const skeleton = read('app/components/app/RouteSkeletons.tsx');

  assert.doesNotMatch(page, /title: 'Users'/);
  assert.doesNotMatch(page, /TabsTrigger value="users"/);
  assert.doesNotMatch(page, /listAdminUsers/);
  assert.match(page, /xl:grid-cols-4/);
  assert.match(page, /h-auto min-h-5 max-w-full shrink text-left leading-tight whitespace-normal/);

  assert.match(charts, /flex flex-wrap items-end justify-between gap-3/);
  assert.match(charts, /grid-cols-\[repeat\(auto-fit,minmax\(8\.5rem,1fr\)\)\]/);

  assert.match(skeleton, /xl:grid-cols-4/);
  assert.match(skeleton, /Array\.from\(\{ length: 4 \}\)/);
});

test('admin overview only loads data for the active tab', () => {
  const page = read('app/(admin)/admin/page.tsx');

  assert.match(page, /tab === 'overview' \? <OverviewTabContent range=\{range\} \/> : null/);
  assert.match(page, /tab === 'catalogue' \? <CatalogueTabContent \/> : null/);
  assert.match(page, /tab === 'imports' \? <ImportsTabContent \/> : null/);
  assert.match(page, /tab === 'generation' \? <GenerationTabContent range=\{range\} \/> : null/);
  assert.match(page, /async function GenerationTabContent/);
  assert.match(page, /getAnalyserWarmthState\(\)/);
  assert.match(page, /async function ImportsTabContent/);
  assert.match(page, /const imports = await listImportJobs\(\)/);
});
