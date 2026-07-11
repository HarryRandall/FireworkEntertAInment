/** Admin dashboard index summarising platform-wide stats. */

import { Suspense, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { AdminOverviewContentSkeleton } from '@/app/components/app/RouteSkeletons';
import { AnalyserWarmthControl } from './AnalyserWarmthControl';
import { AdminOverviewTabs } from './AdminOverviewTabs';
import { AdminOverviewToolbar } from './AdminOverviewToolbar';
import {
  CatalogueMixChart,
  GenerationPulseCard,
  ShowActivityChart,
  type AdminOverviewActivityDatum,
  type AdminOverviewBarDatum,
  type AdminOverviewPulseDatum,
  type AdminOverviewStatusDatum,
} from './AdminOverviewCharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getAdminOverviewMetrics,
  getCurrentProfile,
  listAdminEffects,
  listAdminFireworks,
  listCatalogueProducts,
  listImportJobs,
  listSuppliers,
  type AdminOverviewMetrics,
} from '@/lib/admin.server';
import {
  getAdminOverviewRangeWindow,
  parseAdminOverviewRange,
  type AdminOverviewRangeOption,
  type AdminOverviewRangeWindow,
} from '@/lib/admin/overview-range';
import {
  ADMIN_OVERVIEW_TAB_OPTIONS,
  parseAdminOverviewTab,
  type AdminOverviewTabKey,
} from '@/lib/admin/overview-tabs';
import { getAnalyserWarmthState } from '@/lib/analyser-warmth.server';
import { formatDurationWords } from '@/lib/show-domain';

type RecentShow = AdminOverviewMetrics['recentShows'][number];

type PageProps = {
  searchParams: Promise<{ range?: string; tab?: string }>;
};

type TrendTone = 'danger' | 'neutral' | 'positive';

type KpiTrend = {
  direction: 'down' | 'flat' | 'up';
  label: string;
  tone: TrendTone;
};

type KpiCardData = {
  title: string;
  value: ReactNode;
  trend: KpiTrend;
  footer: ReactNode;
};

const numberFormatter = new Intl.NumberFormat('en-AU');
const compactFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 1,
  notation: 'compact',
});
const currencyFormatter = new Intl.NumberFormat('en-AU', {
  currency: 'AUD',
  maximumFractionDigits: 0,
  style: 'currency',
});
const shortDateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
});
const monthDateFormatter = new Intl.DateTimeFormat('en-AU', {
  month: 'short',
});
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

type ActivityBucketGranularity = 'day' | 'month' | 'week';

export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = parseAdminOverviewRange(params.range);
  const tab = parseAdminOverviewTab(params.tab);

  return (
    <div className="space-y-4">
      <AdminOverviewData range={range} tab={tab.key} />
    </div>
  );
}

function AdminOverviewData({
  range,
  tab,
}: {
  range: AdminOverviewRangeOption;
  tab: AdminOverviewTabKey;
}) {
  return (
    <AdminOverviewTabs
      controls={<AdminOverviewTabControls range={range} />}
      pendingFallbacks={{
        overview: <AdminOverviewContentSkeleton tab="overview" />,
        catalogue: <AdminOverviewContentSkeleton tab="catalogue" />,
        imports: <AdminOverviewContentSkeleton tab="imports" />,
        generation: <AdminOverviewContentSkeleton tab="generation" />,
      }}
      tab={tab}
    >
      <Suspense key={`${range.key}:${tab}`} fallback={<AdminOverviewContentSkeleton tab={tab} />}>
        <AdminOverviewTabContent range={range} tab={tab} />
      </Suspense>
    </AdminOverviewTabs>
  );
}

function AdminOverviewTabControls({ range }: { range: AdminOverviewRangeOption }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1">
        {ADMIN_OVERVIEW_TAB_OPTIONS.map((option) => (
          <TabsTrigger className="cursor-pointer" key={option.key} value={option.key}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <AdminOverviewToolbar range={range.key} />
    </div>
  );
}

async function AdminOverviewTabContent({
  range,
  tab,
}: {
  range: AdminOverviewRangeOption;
  tab: AdminOverviewTabKey;
}) {
  return (
    <>
      {tab === 'overview' ? <OverviewTabContent range={range} /> : null}
      {tab === 'catalogue' ? <CatalogueTabContent /> : null}
      {tab === 'imports' ? <ImportsTabContent /> : null}
      {tab === 'generation' ? <GenerationTabContent range={range} /> : null}
    </>
  );
}

async function OverviewTabContent({ range }: { range: AdminOverviewRangeOption }) {
  const rangeWindow = getAdminOverviewRangeWindow(range.key);
  const [suppliers, imports, catalogue, fireworks, effects, overview] = await Promise.all([
    listSuppliers(),
    listImportJobs(),
    listCatalogueProducts(),
    listAdminFireworks(),
    listAdminEffects(),
    getAdminOverviewMetrics(range.key),
  ]);
  const recentShows = overview.recentShows.slice(0, 5);
  const activityData = buildActivityData(overview, rangeWindow);
  const pulseData = buildPulseData(activityData);
  const kpis: KpiCardData[] = [
    {
      title: 'Shows created',
      value: formatNumber(overview.totalShows),
      trend: trendFor(
        overview.totalShows,
        overview.previousShows,
        `${formatNumber(overview.totalShows)} ${range.metricLabel}`,
      ),
      footer: (
        <>
          from <span className="text-foreground">{formatNumber(overview.previousShows)}</span>{' '}
          {range.previousLabel}
        </>
      ),
    },
    {
      title: 'Cue output',
      value: formatNumber(overview.totalShowCues),
      trend: trendFor(
        overview.totalShowCues,
        overview.previousShowCues,
        `${formatNumber(overview.totalShowCues)} ${range.metricLabel}`,
      ),
      footer: (
        <>
          from <span className="text-foreground">{formatNumber(overview.previousShowCues)}</span>{' '}
          {range.previousLabel}
        </>
      ),
    },
    {
      title: 'Music analyses',
      value: formatNumber(overview.totalMusicAnalyses),
      trend: trendFor(
        overview.totalMusicAnalyses,
        overview.previousMusicAnalyses,
        `${formatNumber(overview.totalMusicAnalyses)} ${range.metricLabel}`,
      ),
      footer: (
        <>
          from{' '}
          <span className="text-foreground">{formatNumber(overview.previousMusicAnalyses)}</span>{' '}
          {range.previousLabel}
        </>
      ),
    },
    {
      title: 'Firework catalogue',
      value: formatNumber(catalogue.length),
      trend: {
        direction: 'flat',
        label: `${formatNumber(fireworks.length)} fireworks`,
        tone: 'neutral',
      },
      footer: (
        <>
          from <span className="text-foreground">{formatNumber(suppliers.length)}</span> suppliers
          and <span className="text-foreground">{formatNumber(effects.length)}</span> effects
        </>
      ),
    },
  ];
  const generationStatuses = buildGenerationStatuses(overview);
  const fireworkTypes = topBuckets(fireworks, (firework) => firework.effectName ?? 'Unclassified');
  const manufacturers = topBuckets(catalogue, (product) => product.manufacturer ?? 'Unknown maker');
  const importStatuses = topBuckets(imports, (job) => statusLabel(job.status));

  return (
    <TabsContent value="overview" className="flex flex-col gap-4">
      <KpiStrip items={kpis} />

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <ShowActivityChart data={activityData} />
        </div>
        <div className="xl:col-span-5">
          <GenerationPulseCard
            data={pulseData}
            statuses={generationStatuses}
            summaryLabel={`cues ${range.metricLabel}`}
            summaryValue={overview.totalShowCues}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <RecentShowsCard shows={recentShows} />
        </div>
        <div className="xl:col-span-5 xl:col-start-8">
          <CatalogueMixChart
            fireworkTypes={fireworkTypes}
            importStatuses={importStatuses}
            manufacturers={manufacturers}
            variant="compact"
          />
        </div>
      </div>
    </TabsContent>
  );
}

async function CatalogueTabContent() {
  const [imports, catalogue, fireworks] = await Promise.all([
    listImportJobs(),
    listCatalogueProducts(),
    listAdminFireworks(),
  ]);
  const fireworkTypes = topBuckets(fireworks, (firework) => firework.effectName ?? 'Unclassified');
  const manufacturers = topBuckets(catalogue, (product) => product.manufacturer ?? 'Unknown maker');
  const importStatuses = topBuckets(imports, (job) => statusLabel(job.status));

  return (
    <TabsContent value="catalogue">
      <CatalogueMixChart
        fireworkTypes={fireworkTypes}
        importStatuses={importStatuses}
        manufacturers={manufacturers}
      />
    </TabsContent>
  );
}

async function ImportsTabContent() {
  const imports = await listImportJobs();
  const completeImports = imports.filter((job) => job.status === 'complete').length;
  const needsReviewImports = imports.filter((job) => job.status === 'needs_review').length;
  const importRows = buildImportRows(imports);

  return (
    <TabsContent value="imports">
      <ImportPipelineCard
        complete={completeImports}
        needsReview={needsReviewImports}
        rows={importRows}
      />
    </TabsContent>
  );
}

async function GenerationTabContent({ range }: { range: AdminOverviewRangeOption }) {
  const rangeWindow = getAdminOverviewRangeWindow(range.key);
  const [overview, warmthState, profile] = await Promise.all([
    getAdminOverviewMetrics(range.key),
    getAnalyserWarmthState(),
    getCurrentProfile(),
  ]);
  const canManageAnalyser = profile?.permissions.includes('admin.manage_imports') ?? false;
  const activityData = buildActivityData(overview, rangeWindow);
  const pulseData = buildPulseData(activityData);
  const generationStatuses = buildGenerationStatuses(overview);

  return (
    <TabsContent value="generation" className="flex flex-col gap-4">
      <AnalyserWarmthControl initialState={warmthState} canManage={canManageAnalyser} />

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <ShowActivityChart data={activityData} />
        </div>
        <div className="xl:col-span-5">
          <GenerationPulseCard
            data={pulseData}
            statuses={generationStatuses}
            summaryLabel={`cues ${range.metricLabel}`}
            summaryValue={overview.totalShowCues}
          />
        </div>
      </div>
    </TabsContent>
  );
}

function KpiStrip({ items }: { items: KpiCardData[] }) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:shadow-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
        {items.map((item) => (
          <KpiCard key={item.title} {...item} />
        ))}
      </div>
    </div>
  );
}

function KpiCard({ footer, title, trend, value }: KpiCardData) {
  const TrendIcon = trend.direction === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-2xl leading-none tracking-tight whitespace-nowrap tabular-nums">
            {value}
          </div>
          <Badge
            className={`${trendBadgeClass(
              trend.tone,
            )} h-auto min-h-5 max-w-full shrink text-left leading-tight whitespace-normal`}
          >
            {trend.direction === 'flat' ? null : <TrendIcon aria-hidden />}
            {trend.label}
          </Badge>
        </div>

        <div className="text-muted-foreground text-xs leading-relaxed">{footer}</div>
      </CardContent>
    </Card>
  );
}

function RecentShowsCard({ shows }: { shows: RecentShow[] }) {
  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Recent shows</CardTitle>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 font-normal">Show</TableHead>
              <TableHead className="h-8 w-24 text-right font-normal">Cues</TableHead>
              <TableHead className="h-8 w-24 text-right font-normal">Spend</TableHead>
              <TableHead className="h-8 w-28 text-right font-normal">Created</TableHead>
              <TableHead className="h-8 w-28 text-right font-normal">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {shows.length > 0 ? (
              shows.map((show) => (
                <TableRow className="hover:bg-transparent" key={show.id}>
                  <TableCell className="max-w-0 truncate py-4 font-medium">
                    <span className="block truncate">{show.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {show.location ?? formatDurationWords(show.durationSeconds)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(show.generatedCueCount ?? 0)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {formatCurrency(show.totalCents)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {formatDate(show.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={generationBadgeClass(show.generationStatus)}
                      variant="outline"
                    >
                      {statusLabel(show.generationStatus)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell className="text-muted-foreground py-8 text-center" colSpan={5}>
                  No shows yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ImportPipelineCard({
  complete,
  needsReview,
  rows,
}: {
  complete: number;
  needsReview: number;
  rows: { count: number; label: string; share: string }[];
}) {
  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Import pipeline</CardTitle>
        <CardAction>
          <div className="text-muted-foreground text-sm tabular-nums">
            {formatNumber(complete)} complete, {formatNumber(needsReview)} review
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 font-normal">Status</TableHead>
              <TableHead className="h-8 w-24 text-right font-normal">Jobs</TableHead>
              <TableHead className="h-8 w-24 text-right font-normal">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {rows.map((row) => (
              <TableRow className="hover:bg-transparent" key={row.label}>
                <TableCell className="py-4 font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(row.count)}</TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {row.share}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function buildActivityData(
  overview: AdminOverviewMetrics,
  rangeWindow: AdminOverviewRangeWindow,
): AdminOverviewActivityDatum[] {
  const buckets = buildActivityBuckets(rangeWindow);

  for (const show of overview.recentShows) {
    const bucket = findActivityBucket(buckets, show.createdAt);
    if (bucket) bucket.shows += 1;
  }
  for (const analysis of overview.recentMusicAnalyses) {
    const bucket = findActivityBucket(buckets, analysis.createdAt);
    if (bucket) bucket.analyses += 1;
  }
  for (const cue of overview.recentShowCues) {
    const bucket = findActivityBucket(buckets, cue.createdAt);
    if (bucket) bucket.cues += 1;
  }

  return buckets.map((bucket) => bucket.data);
}

function buildPulseData(activityData: AdminOverviewActivityDatum[]): AdminOverviewPulseDatum[] {
  return activityData.map(({ cues, dayIndex, label }) => ({
    cues,
    dayIndex,
    label,
  }));
}

function buildActivityBuckets(rangeWindow: AdminOverviewRangeWindow) {
  const granularity = activityGranularity(rangeWindow);
  const buckets: {
    data: AdminOverviewActivityDatum;
    endExclusive: Date;
    start: Date;
  }[] = [];
  let cursor = startOfUtcDay(rangeWindow.start);
  const lastDay = startOfUtcDay(rangeWindow.end);
  const afterLastDay = addUtcDays(lastDay, 1);

  while (cursor < afterLastDay) {
    const next = nextActivityBucketStart(cursor, granularity, afterLastDay);
    const endInclusive = addUtcDays(next, -1);
    buckets.push({
      data: {
        analyses: 0,
        cues: 0,
        dayIndex: buckets.length + 1,
        label: activityBucketLabel(cursor, endInclusive, granularity),
        shows: 0,
      },
      endExclusive: next,
      start: cursor,
    });
    cursor = next;
  }

  return buckets;
}

function activityGranularity(rangeWindow: AdminOverviewRangeWindow): ActivityBucketGranularity {
  if (rangeWindow.chartDays > 120) return 'month';
  if (rangeWindow.chartDays > 35) return 'week';
  return 'day';
}

function nextActivityBucketStart(date: Date, granularity: ActivityBucketGranularity, maxEnd: Date) {
  if (granularity === 'month') {
    return minDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)), maxEnd);
  }
  if (granularity === 'week') return minDate(new Date(date.getTime() + WEEK_MS), maxEnd);
  return minDate(addUtcDays(date, 1), maxEnd);
}

function activityBucketLabel(
  start: Date,
  endInclusive: Date,
  granularity: ActivityBucketGranularity,
) {
  if (granularity === 'day') return shortDateFormatter.format(start);
  if (granularity === 'month') return monthDateFormatter.format(start);
  return `${shortDateFormatter.format(start)} - ${shortDateFormatter.format(endInclusive)}`;
}

function findActivityBucket(
  buckets: ReturnType<typeof buildActivityBuckets>,
  value: string,
): AdminOverviewActivityDatum | null {
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  const bucket = buckets.find(
    (candidate) => date >= candidate.start && date < candidate.endExclusive,
  );
  return bucket?.data ?? null;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function minDate(date: Date, max: Date): Date {
  return date < max ? date : max;
}

function buildGenerationStatuses(overview: AdminOverviewMetrics): AdminOverviewStatusDatum[] {
  const count = (status: string) =>
    overview.recentShows.filter((show) => show.generationStatus === status).length;

  return [
    { label: 'Running', value: count('running'), tone: 'success' },
    { label: 'Idle', value: count('idle'), tone: 'neutral' },
    { label: 'Completed', value: count('completed'), tone: 'success' },
    { label: 'Failed', value: count('failed'), tone: 'danger' },
  ];
}

function buildImportRows(imports: Awaited<ReturnType<typeof listImportJobs>>) {
  const total = imports.length;
  return ['draft', 'queued', 'processing', 'needs_review', 'complete', 'failed'].map((status) => {
    const count = imports.filter((job) => job.status === status).length;
    return {
      count,
      label: statusLabel(status),
      share: total > 0 ? `${Math.round((count / total) * 100)}%` : '0%',
    };
  });
}

function topBuckets<T>(items: T[], getLabel: (item: T) => string): AdminOverviewBarDatum[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = getLabel(item).trim() || 'Unknown';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([source, value]) => ({
      label: compactFormatter.format(value),
      source,
      value,
    }));
}

function trendFor(current: number, previous: number, label: string): KpiTrend {
  if (current === previous) return { direction: 'flat', label, tone: 'neutral' };
  return {
    direction: current > previous ? 'up' : 'down',
    label,
    tone: current > previous ? 'positive' : 'danger',
  };
}

function trendBadgeClass(tone: TrendTone) {
  if (tone === 'positive')
    return 'bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300';
  if (tone === 'danger') return 'bg-destructive/10 text-destructive';
  return 'bg-secondary text-secondary-foreground';
}

function generationBadgeClass(status: string) {
  if (status === 'completed')
    return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300';
  if (status === 'running') return 'border-primary/30 bg-primary/10 text-primary';
  if (status === 'failed') return 'border-destructive/30 bg-destructive/10 text-destructive';
  return 'border-border text-muted-foreground';
}

function statusLabel(status: string) {
  return status
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatCurrency(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function formatDate(value: string) {
  return shortDateFormatter.format(new Date(value));
}
