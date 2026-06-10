/** Admin dashboard index summarising platform-wide stats. */

import { Suspense, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { AdminOverviewSkeleton } from '@/app/components/app/RouteSkeletons';
import { AnalyserWarmthControl } from './AnalyserWarmthControl';
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getAdminOverviewMetrics,
  getCurrentProfile,
  listAdminEffects,
  listAdminFireworks,
  listAdminUsers,
  listCatalogueProducts,
  listImportJobs,
  listSuppliers,
  type AdminOverviewMetrics,
} from '@/lib/admin.server';
import { getAnalyserWarmthState } from '@/lib/analyser-warmth.server';

type RecentShow = AdminOverviewMetrics['recentShows'][number];

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

export default function AdminOverviewPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<AdminOverviewSkeleton />}>
        <AdminOverviewData />
      </Suspense>
    </div>
  );
}

async function AdminOverviewData() {
  const [users, suppliers, imports, catalogue, fireworks, effects, overview, warmthState, profile] =
    await Promise.all([
      listAdminUsers(),
      listSuppliers(),
      listImportJobs(),
      listCatalogueProducts(),
      listAdminFireworks(),
      listAdminEffects(),
      getAdminOverviewMetrics(),
      getAnalyserWarmthState(),
      getCurrentProfile(),
    ]);
  const canManageAnalyser = profile?.permissions.includes('admin.manage_imports') ?? false;
  const now = Date.now();
  const last7Start = now - 7 * 24 * 60 * 60 * 1000;
  const previous7Start = now - 14 * 24 * 60 * 60 * 1000;
  const recentShows = overview.recentShows.slice(0, 5);
  const activityData = buildActivityData(overview);
  const pulseData: AdminOverviewPulseDatum[] = activityData.map(({ cues, dayIndex, label }) => ({
    cues,
    dayIndex,
    label,
  }));
  const showLastWeek = countBetween(
    overview.recentShows,
    (show) => show.createdAt,
    last7Start,
    now,
  );
  const showPreviousWeek = countBetween(
    overview.recentShows,
    (show) => show.createdAt,
    previous7Start,
    last7Start,
  );
  const cueLastWeek = countBetween(
    overview.recentShowCues,
    (cue) => cue.createdAt,
    last7Start,
    now,
  );
  const cuePreviousWeek = countBetween(
    overview.recentShowCues,
    (cue) => cue.createdAt,
    previous7Start,
    last7Start,
  );
  const analysisLastWeek = countBetween(
    overview.recentMusicAnalyses,
    (analysis) => analysis.createdAt,
    last7Start,
    now,
  );
  const analysisPreviousWeek = countBetween(
    overview.recentMusicAnalyses,
    (analysis) => analysis.createdAt,
    previous7Start,
    last7Start,
  );
  const activeUsers = users.filter((user) => user.status === 'active').length;
  const suspendedUsers = users.length - activeUsers;
  const completeImports = imports.filter((job) => job.status === 'complete').length;
  const needsReviewImports = imports.filter((job) => job.status === 'needs_review').length;
  const kpis: KpiCardData[] = [
    {
      title: 'Shows created',
      value: formatNumber(overview.totalShows),
      trend: trendFor(showLastWeek, showPreviousWeek, `${formatNumber(showLastWeek)} last week`),
      footer: (
        <>
          from <span className="text-foreground">{formatNumber(showPreviousWeek)}</span> previous
          week
        </>
      ),
    },
    {
      title: 'Cue output',
      value: formatNumber(overview.totalShowCues),
      trend: trendFor(cueLastWeek, cuePreviousWeek, `${formatNumber(cueLastWeek)} last week`),
      footer: (
        <>
          from <span className="text-foreground">{formatNumber(cuePreviousWeek)}</span> previous
          week
        </>
      ),
    },
    {
      title: 'Music analyses',
      value: formatNumber(overview.totalMusicAnalyses),
      trend: trendFor(
        analysisLastWeek,
        analysisPreviousWeek,
        `${formatNumber(analysisLastWeek)} last week`,
      ),
      footer: (
        <>
          from <span className="text-foreground">{formatNumber(analysisPreviousWeek)}</span>{' '}
          previous week
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
    {
      title: 'Users',
      value: formatNumber(users.length),
      trend: {
        direction: 'flat',
        label: `${formatNumber(activeUsers)} active`,
        tone: activeUsers > 0 ? 'positive' : 'neutral',
      },
      footer:
        suspendedUsers > 0 ? (
          <>
            <span className="text-foreground">{formatNumber(suspendedUsers)}</span> suspended
          </>
        ) : (
          'all active accounts'
        ),
    },
  ];
  const generationStatuses = buildGenerationStatuses(overview);
  const fireworkTypes = topBuckets(
    fireworks,
    (firework) => firework.fireworkType ?? 'Unclassified',
  );
  const manufacturers = topBuckets(
    fireworks,
    (firework) => firework.manufacturer ?? 'Unknown maker',
  );
  const importStatuses = topBuckets(imports, (job) => statusLabel(job.status));
  const importRows = buildImportRows(imports);

  return (
    <>
      <Tabs defaultValue="overview" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
            <TabsTrigger value="imports">Imports</TabsTrigger>
            <TabsTrigger value="generation">Generation</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <AdminOverviewToolbar />
        </div>

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
                summaryLabel="cues last week"
                summaryValue={cueLastWeek}
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

        <TabsContent value="catalogue">
          <CatalogueMixChart
            fireworkTypes={fireworkTypes}
            importStatuses={importStatuses}
            manufacturers={manufacturers}
          />
        </TabsContent>

        <TabsContent value="imports">
          <ImportPipelineCard
            complete={completeImports}
            needsReview={needsReviewImports}
            rows={importRows}
          />
        </TabsContent>

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
                summaryLabel="cues last week"
                summaryValue={cueLastWeek}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <RecentShowsCard shows={recentShows} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function AdminOverviewToolbar() {
  return (
    <div className="flex items-center gap-2">
      <Select defaultValue="last-4-weeks">
        <SelectTrigger className="w-34">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="last-7-days">Last 7 days</SelectItem>
            <SelectItem value="last-4-weeks">Last 4 weeks</SelectItem>
            <SelectItem value="last-3-months">Last 3 months</SelectItem>
            <SelectItem value="year-to-date">Year to date</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function KpiStrip({ items }: { items: KpiCardData[] }) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:shadow-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
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
        <div className="flex items-center justify-between gap-4">
          <div className="text-2xl leading-none tracking-tight tabular-nums">{value}</div>
          <Badge className={trendBadgeClass(trend.tone)}>
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
                      {show.location ?? formatDuration(show.durationSeconds)}
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

function buildActivityData(overview: AdminOverviewMetrics): AdminOverviewActivityDatum[] {
  const now = new Date();
  const buckets = new Map<string, AdminOverviewActivityDatum>();

  for (let i = 0; i < 28; i += 1) {
    const date = new Date(now.getTime() - (27 - i) * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, {
      analyses: 0,
      cues: 0,
      dayIndex: i + 1,
      label: shortDateFormatter.format(date),
      shows: 0,
    });
  }

  for (const show of overview.recentShows) {
    const bucket = buckets.get(show.createdAt.slice(0, 10));
    if (bucket) bucket.shows += 1;
  }
  for (const analysis of overview.recentMusicAnalyses) {
    const bucket = buckets.get(analysis.createdAt.slice(0, 10));
    if (bucket) bucket.analyses += 1;
  }
  for (const cue of overview.recentShowCues) {
    const bucket = buckets.get(cue.createdAt.slice(0, 10));
    if (bucket) bucket.cues += 1;
  }

  return [...buckets.values()];
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

function countBetween<T>(items: T[], getDate: (item: T) => string, startMs: number, endMs: number) {
  return items.filter((item) => {
    const time = Date.parse(getDate(item));
    return Number.isFinite(time) && time >= startMs && time < endMs;
  }).length;
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

function formatDuration(seconds: number | null) {
  if (seconds == null) return 'n/a';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
}
